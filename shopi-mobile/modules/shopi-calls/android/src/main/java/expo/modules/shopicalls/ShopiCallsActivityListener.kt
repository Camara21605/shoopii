package expo.modules.shopicalls

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import java.lang.ref.WeakReference

/**
 * Notification d'appel touchée (Répondre, ou écran plein écran du téléphone verrouillé) :
 * l'activité principale s'ouvre PAR-DESSUS l'écran verrouillé et allume l'écran, et l'action
 * est gardée pour le JavaScript (lu dès qu'il est prêt — voir consumePendingAction).
 */
class ShopiCallsActivityListener : ReactActivityLifecycleListener {

  override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
    activity ?: return
    lastActivity = WeakReference(activity)
    handle(activity, activity.intent)
  }

  override fun onNewIntent(intent: Intent?): Boolean {
    val activity = lastActivity?.get() ?: return false
    return handle(activity, intent)
  }

  override fun onResume(activity: Activity) {
    lastActivity = WeakReference(activity)
    CallNotifier.isForeground = true
  }

  override fun onPause(activity: Activity) {
    CallNotifier.isForeground = false
  }

  private fun handle(activity: Activity, intent: Intent?): Boolean {
    val data = CallNotifier.dataFromIntent(intent) ?: return false
    CallNotifier.clearIntent(intent)   // une rotation / recréation ne doit pas « re-décrocher »

    showOverLockScreen(activity, true)
    if (data["action"] == "accept") CallNotifier.cancel(activity.applicationContext, data["callId"])

    CallNotifier.setPending(data)
    ShopiCallsModule.emit("onCallAction", data)
    return true
  }

  companion object {
    @Volatile var lastActivity: WeakReference<Activity>? = null

    fun showOverLockScreen(activity: Activity, show: Boolean) {
      activity.runOnUiThread {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
          activity.setShowWhenLocked(show)
          activity.setTurnScreenOn(show)
        } else {
          @Suppress("DEPRECATION")
          val flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
          if (show) activity.window.addFlags(flags) else activity.window.clearFlags(flags)
        }
        if (show) activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      }
    }
  }
}
