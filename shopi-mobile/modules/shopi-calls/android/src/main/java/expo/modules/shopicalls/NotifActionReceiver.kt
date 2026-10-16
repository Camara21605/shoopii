package expo.modules.shopicalls

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.RemoteInput
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

/**
 * Boutons d'une notification de message, SANS ouvrir l'application :
 *   « Répondre »         → POST /messagerie/push-reply { token, text }
 *   « Marquer comme lu » → POST /messagerie/push-read  { token }
 * Le jeton signé reçu avec la notification est la seule preuve (une
 * conversation, ce destinataire, 3 jours). Réussi : la notification se ferme ;
 * raté : elle le dit (« Réponse non envoyée… »).
 */
class NotifActionReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    val token = intent.getStringExtra("token") ?: return
    val notifId = intent.getIntExtra("notifId", 0)
    val isReply = intent.action == NotifNotifier.ACTION_REPLY
    val url = intent.getStringExtra(if (isReply) "replyUrl" else "readUrl") ?: return
    if (!url.startsWith("https://")) return
    val text = if (isReply) RemoteInput.getResultsFromIntent(intent)?.getCharSequence(NotifNotifier.KEY_REPLY)?.toString()?.trim() else null
    if (isReply && text.isNullOrEmpty()) return

    val app = context.applicationContext
    val pending = goAsync()
    Thread {
      val ok = try {
        val body = JSONObject().put("token", token)
        if (text != null) body.put("text", text)
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.connectTimeout = 10_000
        conn.readTimeout = 10_000
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { it.write(body.toString().toByteArray()) }
        val code = conn.responseCode
        conn.disconnect()
        code in 200..299
      } catch (e: Exception) {
        Log.w("ShopiNotif", "Action de notification non transmise", e)
        false
      }

      if (ok) {
        NotificationManagerCompat.from(app).cancel(notifId)
      } else {
        try {
          NotifNotifier.ensureChannels(app)
          val n = NotificationCompat.Builder(app, "shoneya_messages")
            .setSmallIcon(R.drawable.ic_stat_shoneya)
            .setContentTitle(intent.getStringExtra("senderName") ?: "Shoneya")
            .setContentText(if (isReply) "Réponse non envoyée. Ouvrez l’application pour réessayer." else "Action impossible. Ouvrez l’application.")
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .build()
          NotificationManagerCompat.from(app).notify(notifId, n)
        } catch (_: SecurityException) { /* notifications refusées */ }
      }
      pending.finish()
    }.start()
  }
}
