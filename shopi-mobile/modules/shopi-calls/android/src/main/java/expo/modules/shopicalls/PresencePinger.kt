package expo.modules.shopicalls

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * « Joignable » : l'application est fermée, mais le téléphone a internet.
 * Le téléphone le dit au serveur (POST /presence/device-ping, jeton signé qui
 * n'autorise QUE ce signal) :
 *   - en quittant l'application ;
 *   - toutes les 15 min, par une tâche Android qui ne démarre QU'AVEC du
 *     réseau (données coupées = rien n'est envoyé = « hors ligne » côté serveur) ;
 *   - à chaque push reçu, et aussitôt quand le serveur demande « es-tu là ? »
 *     (quelqu'un ouvre la conversation ou le profil).
 * Le jeton et l'adresse viennent de l'application (setPresenceCredentials) ;
 * ils sont effacés à la déconnexion. Aucun contenu, aucune position : un
 * simple « présent ».
 */
object PresencePinger {
  private const val TAG = "ShoneyaPresence"
  private const val PREFS = "shoneya_presence"
  private const val WORK = "shoneya_presence_ping"
  /** Pas plus d'un signal spontané par minute (les push peuvent arriver en rafale). */
  private const val MIN_GAP_MS = 60_000L

  fun setCredentials(context: Context, url: String, token: String, intervalMinutes: Long) {
    if (!url.startsWith("https://")) return
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("url", url).putString("token", token).apply()
    schedule(context, intervalMinutes.coerceAtLeast(15))
  }

  fun clear(context: Context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    try { WorkManager.getInstance(context).cancelUniqueWork(WORK) } catch (e: Exception) { Log.w(TAG, "annulation", e) }
  }

  private fun schedule(context: Context, minutes: Long) {
    try {
      val req = PeriodicWorkRequest.Builder(PresenceWorker::class.java, minutes, TimeUnit.MINUTES)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .build()
      WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, req)
    } catch (e: Exception) {
      Log.w(TAG, "tâche périodique impossible", e)
    }
  }

  /**
   * Envoi SYNCHRONE (à appeler hors du fil principal). `url` / `token` : ceux
   * d'une vérification du serveur, sinon ceux enregistrés. `force` ignore
   * l'écart minimal. Renvoie true si le serveur a répondu.
   */
  fun pingNow(context: Context, url: String? = null, token: String? = null, force: Boolean = false): Boolean {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val target = url ?: prefs.getString("url", null) ?: return false
    val jwt = token ?: prefs.getString("token", null) ?: return false
    if (!target.startsWith("https://")) return false
    val now = System.currentTimeMillis()
    if (!force && now - prefs.getLong("last", 0L) < MIN_GAP_MS) return true
    return try {
      val conn = URL(target).openConnection() as HttpURLConnection
      conn.requestMethod = "POST"
      conn.connectTimeout = 8000
      conn.readTimeout = 8000
      conn.doOutput = true
      conn.setRequestProperty("Content-Type", "application/json")
      conn.outputStream.use { it.write(JSONObject().put("token", jwt).toString().toByteArray()) }
      val code = conn.responseCode
      conn.disconnect()
      if (code in 200..299) prefs.edit().putLong("last", now).apply()
      code in 200..299
    } catch (e: Exception) {
      Log.v(TAG, "ping impossible : ${e.javaClass.simpleName}")
      false
    }
  }

  /** Même chose, sur un fil à part (appel depuis le fil principal). */
  fun pingAsync(context: Context, force: Boolean = false) {
    val app = context.applicationContext
    Thread { pingNow(app, force = force) }.start()
  }
}

/** Tâche Android périodique (≈ 15 min), lancée seulement quand le téléphone a du réseau. */
class PresenceWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    PresencePinger.pingNow(applicationContext, force = true)
    // Échec réseau ponctuel : la prochaine période réessaiera, pas de relance immédiate (batterie).
    return Result.success()
  }
}
