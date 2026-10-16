package expo.modules.shopicalls

import android.os.Handler
import android.os.Looper
import android.util.Log
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
    /* « Es-tu là ? » du serveur (quelqu'un regarde ce profil) : réponse immédiate,
     * rien ne s'affiche. Sans réseau ce push n'arrive pas → « hors ligne ». */
    if (data["kind"] == "presence.ping") {
      PresencePinger.pingNow(applicationContext, data["url"], data["token"], force = true)
      return
    }
    /* Tout push reçu prouve que le téléphone a internet : « joignable ». */
    PresencePinger.pingAsync(applicationContext)
    /* Notifications (messages, commandes, livraisons, paiements…) : affichées
     * tout de suite, même application fermée — puis l'appli ouverte est prévenue
     * pour rafraîchir ses listes et compteurs. */
    when (data["kind"]) {
      "notif" -> {
        NotifNotifier.show(applicationContext, data)
        ShopiCallsModule.emit("onNotification", data)
        return
      }
      "dismiss" -> {
        data["tag"]?.let { NotifNotifier.dismiss(applicationContext, it) }
        data["unread"]?.toIntOrNull()?.let { BadgeManager.set(applicationContext, it) }
        return
      }
    }
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
    prewarmApp()
  }

  /**
   * Pendant que le téléphone sonne, on charge déjà l'application (moteur JavaScript
   * + code de l'appli) en arrière-plan : quand la personne touche « Répondre »,
   * l'écran d'appel s'affiche aussitôt au lieu du logo de démarrage.
   * Par réflexion (getReactHost().start()) pour ne dépendre d'aucune version
   * précise de React Native ; sans effet si l'application est déjà chargée.
   */
  private fun prewarmApp() {
    Handler(Looper.getMainLooper()).post {
      try {
        val app = applicationContext
        val host = app.javaClass.getMethod("getReactHost").invoke(app) ?: return@post
        host.javaClass.getMethod("start").invoke(host)
      } catch (e: Throwable) {
        Log.w("ShopiCalls", "Préchargement de l'application impossible", e)
      }
    }
  }

  override fun onNewToken(token: String) {
    ShopiCallsModule.emit("onPushToken", mapOf("token" to token))
  }
}
