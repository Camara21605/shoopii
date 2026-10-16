package expo.modules.shopicalls

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Reçoit les push FCM « data » haute priorité envoyés par le serveur, même application
 * fermée : Android réveille ce service sans démarrer le JavaScript, donc la sonnerie part
 * immédiatement.
 *   type = call.incoming → notification d'appel plein écran + sonnerie du téléphone
 *   type = call.ended    → fin de la sonnerie (décroché ailleurs, annulé, refusé, manqué)
 */
class ShopiCallsMessagingService : FirebaseMessagingService() {

  override fun onMessageReceived(message: RemoteMessage) {
    val data = message.data
    when (data["type"]) {
      "call.incoming" -> onIncoming(data)
      "call.ended" -> {
        CallNotifier.cancel(applicationContext, data["callId"])
        ShopiCallsModule.emit("onCallAction", mapOf("action" to "ended", "callId" to (data["callId"] ?: "")))
      }
    }
  }

  private fun onIncoming(data: Map<String, String>) {
    // Push arrivé en retard (téléphone hors réseau pendant la sonnerie) : l'appel est déjà fini.
    val expiresAt = data["expiresAt"]?.toLongOrNull()
    if (expiresAt != null && System.currentTimeMillis() > expiresAt) return

    val payload = CallNotifier.DATA_KEYS.mapNotNull { k -> data[k]?.let { k to it } }.toMap()

    if (CallNotifier.isForeground) {
      // Application à l'écran : c'est l'écran d'appel de l'appli qui sonne (temps réel).
      // On prévient quand même le JavaScript au cas où le socket serait en reconnexion.
      ShopiCallsModule.emit("onIncomingPush", payload)
      return
    }
    CallNotifier.showIncoming(applicationContext, payload)
    ShopiCallsModule.emit("onIncomingPush", payload)
  }

  override fun onNewToken(token: String) {
    ShopiCallsModule.emit("onPushToken", mapOf("token" to token))
  }
}
