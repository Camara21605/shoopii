package expo.modules.shopicalls

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * Appel EN COURS (1:1 ou groupe) quand on quitte l'écran d'appel — comme un
 * appel téléphonique ou WhatsApp :
 *   - service au premier plan (type micro, + caméra en vidéo) : Android coupe
 *     le micro d'une application en arrière-plan sans ce service — l'autre
 *     n'entendait plus rien dès qu'on appuyait sur Accueil ou Retour ;
 *   - notification « Appel en cours » permanente (style appel Android :
 *     pastille verte dans la barre d'état), avec le chronomètre, toucher =
 *     revenir à l'appel, bouton « Raccrocher » sans ouvrir l'application ;
 *   - s'arrête avec l'appel (et si l'application est fermée de force).
 * Démarré / mis à jour / arrêté par le JavaScript (ShopiCalls.startOngoingCall…).
 */
class OngoingCallService : Service() {

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelfCompat()
      return START_NOT_STICKY
    }
    val name = intent?.getStringExtra(EXTRA_NAME).orEmpty().ifBlank { "Appel Shoneya" }
    val video = intent?.getBooleanExtra(EXTRA_VIDEO, false) ?: false
    val connectedAt = intent?.getLongExtra(EXTRA_CONNECTED_AT, 0L) ?: 0L
    val status = intent?.getStringExtra(EXTRA_STATUS).orEmpty()

    ensureChannel(this)
    val notification = build(this, name, video, connectedAt, status)
    try {
      var type = 0
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        /* Caméra seulement si l'autorisation est accordée (sinon Android refuse le service). */
        if (video && ContextCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
          type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
        }
      }
      ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
      running = true
    } catch (e: Exception) {
      /* Démarrage refusé (application en arrière-plan sur Android 12+, autorisation retirée…) :
       * l'appel continue tant que l'application reste ouverte. */
      Log.w(TAG, "Service d'appel en cours non démarré", e)
      stopSelfCompat()
    }
    return START_NOT_STICKY
  }

  /** Application balayée des applications récentes : l'appel (JavaScript) est terminé, le service aussi. */
  override fun onTaskRemoved(rootIntent: Intent?) {
    stopSelfCompat()
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    running = false
    super.onDestroy()
  }

  private fun stopSelfCompat() {
    running = false
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  /** « Raccrocher » touché sur la notification : le JavaScript termine l'appel proprement. */
  class HangUpReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      ShopiCallsModule.emit("onCallAction", mapOf("action" to "hangup"))
      stop(context.applicationContext)
    }
  }

  companion object {
    private const val TAG = "ShopiCalls"
    const val CHANNEL_ID = "shoneya_ongoing_call"
    const val NOTIFICATION_ID = 7_402
    private const val ACTION_STOP = "expo.modules.shopicalls.ONGOING_STOP"
    private const val EXTRA_NAME = "name"
    private const val EXTRA_VIDEO = "video"
    private const val EXTRA_CONNECTED_AT = "connectedAt"
    private const val EXTRA_STATUS = "status"

    @Volatile var running = false

    /**
     * Démarre ou met à jour l'appel en cours. `connectedAt` = heure de décroché
     * (0 = pas encore connecté : « Appel en cours… » sans chronomètre).
     */
    fun start(context: Context, name: String, video: Boolean, connectedAt: Long, status: String) {
      val i = Intent(context, OngoingCallService::class.java)
        .putExtra(EXTRA_NAME, name)
        .putExtra(EXTRA_VIDEO, video)
        .putExtra(EXTRA_CONNECTED_AT, connectedAt)
        .putExtra(EXTRA_STATUS, status)
      try {
        ContextCompat.startForegroundService(context, i)
      } catch (e: Exception) {
        Log.w(TAG, "Appel en cours : démarrage impossible", e)
      }
    }

    fun stop(context: Context) {
      if (!running) {
        context.getSystemService(NotificationManager::class.java)?.cancel(NOTIFICATION_ID)
        return
      }
      try {
        context.startService(Intent(context, OngoingCallService::class.java).setAction(ACTION_STOP))
      } catch (_: Exception) {
        context.stopService(Intent(context, OngoingCallService::class.java))
      }
    }

    private fun ensureChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val nm = context.getSystemService(NotificationManager::class.java) ?: return
      if (nm.getNotificationChannel(CHANNEL_ID) != null) return
      nm.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Appel en cours", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Affiche l'appel en cours quand vous quittez l'écran d'appel"
        setSound(null, null)
        enableVibration(false)
        setShowBadge(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      })
    }

    private fun build(context: Context, name: String, video: Boolean, connectedAt: Long, status: String): Notification {
      /* Toucher la notification : l'application revient au premier plan sur l'écran d'appel. */
      val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        putExtra(CallNotifier.EXTRA_ACTION, "resume")
      }
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      val openPi = open?.let { PendingIntent.getActivity(context, 21, it, flags) }
      val hangUpPi = PendingIntent.getBroadcast(context, 22, Intent(context, HangUpReceiver::class.java), flags)

      val text = when {
        connectedAt > 0 -> if (video) "Appel vidéo en cours · toucher pour revenir" else "Appel en cours · toucher pour revenir"
        status.isNotBlank() -> status
        else -> "Appel en cours…"
      }
      val person = Person.Builder().setName(name).setImportant(true).build()

      fun base() = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_stat_shoneya)
        .setContentTitle(name)
        .setContentText(text)
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setSilent(true)
        .setColor(0xFF22C55E.toInt())
        .setColorized(true)
        .apply {
          if (openPi != null) setContentIntent(openPi)
          if (connectedAt > 0) { setWhen(connectedAt); setUsesChronometer(true); setShowWhen(true) }
        }

      return try {
        base()
          .setStyle(NotificationCompat.CallStyle.forOngoingCall(person, hangUpPi).setIsVideo(video))
          .addPerson(person)
          .build()
      } catch (e: Exception) {
        base().addAction(0, "Raccrocher", hangUpPi).build()
      }
    }
  }
}
