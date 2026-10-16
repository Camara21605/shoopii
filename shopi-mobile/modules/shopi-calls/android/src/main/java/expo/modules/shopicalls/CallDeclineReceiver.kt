package expo.modules.shopicalls

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

/**
 * « Refuser » touché sur la notification : coupe la sonnerie tout de suite, puis prévient le
 * serveur (POST /calls/push-reject avec le jeton signé reçu dans le push — aucun mot de passe
 * ni session nécessaire, le jeton n'autorise QUE le refus de cet appel pendant ~45 s).
 */
class CallDeclineReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    val callId = intent.getStringExtra(CallNotifier.EXTRA_PREFIX + "callId")
    val url = intent.getStringExtra(CallNotifier.EXTRA_PREFIX + "rejectUrl")
    val token = intent.getStringExtra(CallNotifier.EXTRA_PREFIX + "rejectToken")

    CallNotifier.cancel(context.applicationContext, callId)
    ShopiCallsModule.emit("onCallAction", mapOf("action" to "declined", "callId" to (callId ?: "")))

    if (url.isNullOrBlank() || token.isNullOrBlank() || !url.startsWith("https://")) return

    val pending = goAsync()
    Thread {
      try {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.connectTimeout = 8_000
        conn.readTimeout = 8_000
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { it.write(JSONObject().put("token", token).toString().toByteArray()) }
        conn.responseCode
        conn.disconnect()
      } catch (e: Exception) {
        Log.w("ShopiCalls", "Refus d'appel non transmis au serveur", e)
      } finally {
        pending.finish()
      }
    }.start()
  }
}
