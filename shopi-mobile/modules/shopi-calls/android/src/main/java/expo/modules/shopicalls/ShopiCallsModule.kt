package expo.modules.shopicalls

import android.app.NotificationManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference

class ShopiCallsModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("ShopiCalls")

    Events("onCallAction", "onIncomingPush", "onPushToken", "onNotification")

    OnCreate {
      instance = WeakReference(this@ShopiCallsModule)
      appContext.reactContext?.let { CallNotifier.ensureChannel(it); NotifNotifier.ensureChannels(it) }
    }

    OnDestroy {
      if (instance?.get() === this@ShopiCallsModule) instance = null
    }

    /** Jeton FCM de cet appareil, ou null si Firebase n'est pas configuré (google-services.json absent). */
    AsyncFunction("getPushToken") { promise: Promise ->
      val ctx = appContext.reactContext
      if (ctx == null) { promise.resolve(null); return@AsyncFunction }
      try {
        if (FirebaseApp.getApps(ctx).isEmpty() && FirebaseApp.initializeApp(ctx) == null) {
          promise.resolve(null); return@AsyncFunction
        }
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
          promise.resolve(if (task.isSuccessful) task.result else null)
        }
      } catch (e: Exception) {
        promise.resolve(null)
      }
    }

    /** Conversation affichée à l'écran : ses nouveaux messages ne font pas de notification. */
    Function("setActiveConversation") { conversationId: String? ->
      NotifNotifier.activeConversationId = conversationId
      if (conversationId != null) appContext.reactContext?.let { NotifNotifier.dismiss(it, "message:$conversationId") }
      Unit
    }

    /** Ferme une notification (ex. conversation ouverte, notification lue dans l'appli). */
    Function("dismissNotification") { tag: String ->
      appContext.reactContext?.let { NotifNotifier.dismiss(it, tag) }
      Unit
    }

    /** Toutes les notifications Shoneya (déconnexion). */
    Function("clearAllNotifications") {
      appContext.reactContext?.let { androidx.core.app.NotificationManagerCompat.from(it).cancelAll() }
      Unit
    }

    /** « Partager Shoneya » (Bluetooth, Xender, Nearby Share…) : "ok" | "split" | "error". */
    AsyncFunction("shareApp") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) { promise.resolve("error"); return@AsyncFunction }
      Thread { promise.resolve(AppSharer.share(activity)) }.start()
    }

    /** Action touchée sur la notification d'appel avant que le JavaScript soit prêt. */
    Function("consumePendingAction") {
      CallNotifier.consumePending()
    }

    Function("cancelIncoming") { callId: String? ->
      appContext.reactContext?.let { CallNotifier.cancel(it, callId) }
      Unit
    }

    /** Écran d'appel visible au-dessus de l'écran verrouillé, écran allumé (pendant l'appel seulement). */
    Function("setShowOverLockScreen") { show: Boolean ->
      val activity = appContext.currentActivity ?: ShopiCallsActivityListener.lastActivity?.get()
      activity?.let { ShopiCallsActivityListener.showOverLockScreen(it, show) }
      Unit
    }

    /** Android 14+ : l'autorisation « notifications plein écran » peut être retirée par le Play Store. */
    Function("canUseFullScreenIntent") {
      val ctx = appContext.reactContext ?: return@Function true
      if (Build.VERSION.SDK_INT < 34) return@Function true
      ctx.getSystemService(NotificationManager::class.java)?.canUseFullScreenIntent() ?: true
    }

    Function("openFullScreenIntentSettings") {
      val ctx = appContext.reactContext ?: return@Function
      val intent = if (Build.VERSION.SDK_INT >= 34) {
        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${ctx.packageName}"))
      } else {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try { ctx.startActivity(intent) } catch (_: Exception) { /* réglage absent sur ce téléphone */ }
    }
  }

  companion object {
    @Volatile private var instance: WeakReference<ShopiCallsModule>? = null

    /** Envoie un évènement au JavaScript s'il tourne (sinon ignoré : l'action reste en attente). */
    fun emit(name: String, body: Map<String, String>) {
      try { instance?.get()?.sendEvent(name, body) } catch (_: Exception) { /* JS pas prêt */ }
    }
  }
}
