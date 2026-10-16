package expo.modules.shopicalls

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person

/**
 * Notification « appel entrant » native — la même que celle d'un appel téléphonique :
 *   - joue la SONNERIE CHOISIE DANS LES RÉGLAGES DU TÉLÉPHONE (Settings.System.DEFAULT_RINGTONE_URI
 *     suit le choix de l'utilisateur), au volume de la sonnerie, en boucle (FLAG_INSISTENT)
 *     jusqu'à ce qu'on décroche, refuse, ou que l'appel s'arrête ; silencieux/vibreur respectés
 *     par le système ;
 *   - s'affiche en plein écran par-dessus l'écran verrouillé (full-screen intent), sinon en
 *     bannière d'appel avec Répondre / Refuser (NotificationCompat.CallStyle).
 *
 * Toutes les données de l'appel viennent du push FCM (voir CallPushService côté serveur).
 */
object CallNotifier {
  private const val TAG = "ShopiCalls"

  /* Le son d'un canal Android est figé à sa création : changer de son = nouveau canal (v2…). */
  const val CHANNEL_ID = "shopi_calls_ringtone_v1"
  const val NOTIFICATION_ID = 7_401

  const val EXTRA_ACTION = "shopiCall.action"
  const val EXTRA_PREFIX = "shopiCall."

  /** Clés transportées du push jusqu'au JavaScript (toutes des chaînes). */
  val DATA_KEYS = listOf(
    "callId", "conversationId", "callerUserId", "callerName", "callerAvatar",
    "callType", "expiresAt", "rejectUrl", "rejectToken",
  )

  /** Vrai quand l'application est à l'écran : l'appel sonne alors dans l'appli (socket), pas en notification. */
  @Volatile var isForeground = false

  /** Appel en train de sonner en notification (pour ne fermer que le bon). */
  @Volatile var ringingCallId: String? = null

  /** Action « Répondre »/« ouvrir » touchée avant que le JavaScript soit prêt (démarrage à froid). */
  @Volatile private var pendingAction: Map<String, String>? = null

  fun setPending(action: Map<String, String>) { pendingAction = action }

  fun consumePending(): Map<String, String>? {
    val p = pendingAction
    pendingAction = null
    // Un « Répondre » de plus de 60 s ne correspond plus à un appel qui sonne.
    val at = p?.get("receivedAt")?.toLongOrNull() ?: return p
    return if (System.currentTimeMillis() - at > 60_000) null else p
  }

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = context.getSystemService(NotificationManager::class.java) ?: return
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return

    val channel = NotificationChannel(CHANNEL_ID, "Appels entrants", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Sonnerie des appels audio et vidéo Shoneya"
      setSound(
        Settings.System.DEFAULT_RINGTONE_URI,
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 1000, 1000)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setShowBadge(false)
    }
    nm.createNotificationChannel(channel)
  }

  private fun launchIntent(context: Context, action: String, data: Map<String, String>): Intent? {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    intent.putExtra(EXTRA_ACTION, action)
    data.forEach { (k, v) -> intent.putExtra(EXTRA_PREFIX + k, v) }
    return intent
  }

  private fun piFlags() = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

  fun showIncoming(context: Context, data: Map<String, String>) {
    val callId = data["callId"] ?: return
    ensureChannel(context)

    val callerName = data["callerName"].takeUnless { it.isNullOrBlank() } ?: "Appel Shoneya"
    val isVideo = data["callType"] == "video"
    val label = if (isVideo) "Appel vidéo Shoneya" else "Appel audio Shoneya"
    val expiresAt = data["expiresAt"]?.toLongOrNull()
    val timeoutMs = ((expiresAt ?: (System.currentTimeMillis() + 45_000)) - System.currentTimeMillis())
      .coerceIn(5_000, 60_000)

    val showIntent = launchIntent(context, "show", data) ?: return
    val answerIntent = launchIntent(context, "accept", data) ?: return
    val fullScreenPi = PendingIntent.getActivity(context, 1, showIntent, piFlags())
    val answerPi = PendingIntent.getActivity(context, 2, answerIntent, piFlags())
    val declineIntent = Intent(context, CallDeclineReceiver::class.java)
    data.forEach { (k, v) -> declineIntent.putExtra(EXTRA_PREFIX + k, v) }
    val declinePi = PendingIntent.getBroadcast(context, 3, declineIntent, piFlags())

    val ringtone: Uri = Settings.System.DEFAULT_RINGTONE_URI
    val caller = Person.Builder().setName(callerName).setImportant(true).build()

    fun base() = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.sym_call_incoming)
      .setContentTitle(callerName)
      .setContentText(label)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(fullScreenPi)
      .setFullScreenIntent(fullScreenPi, true)
      .setTimeoutAfter(timeoutMs)
      .setSound(ringtone, AudioManager.STREAM_RING)   // Android 7 (pas de canaux)
      .setVibrate(longArrayOf(0, 1000, 1000))

    val notification: Notification = try {
      base()
        .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, declinePi, answerPi).setIsVideo(isVideo))
        .addPerson(caller)
        .build()
    } catch (e: Exception) {
      // Certains constructeurs refusent CallStyle : notification classique avec les deux boutons.
      Log.w(TAG, "CallStyle indisponible, repli sur boutons simples", e)
      base()
        .addAction(0, "Refuser", declinePi)
        .addAction(0, "Répondre", answerPi)
        .build()
    }
    notification.flags = notification.flags or Notification.FLAG_INSISTENT   // sonnerie en boucle

    try {
      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
      ringingCallId = callId
    } catch (e: SecurityException) {
      Log.w(TAG, "Notifications refusées par l'utilisateur — l'appel ne peut pas sonner", e)
    }
  }

  /** Arrête la sonnerie et retire la notification. callId null = quel que soit l'appel. */
  fun cancel(context: Context, callId: String? = null) {
    if (callId != null && ringingCallId != null && callId != ringingCallId) return
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    ringingCallId = null
  }

  /** Données d'appel portées par un Intent (notification touchée). */
  fun dataFromIntent(intent: Intent?): Map<String, String>? {
    val extras = intent?.extras ?: return null
    if (!extras.containsKey(EXTRA_ACTION)) return null
    val out = mutableMapOf<String, String>()
    out["action"] = extras.getString(EXTRA_ACTION) ?: return null
    DATA_KEYS.forEach { k -> extras.getString(EXTRA_PREFIX + k)?.let { out[k] = it } }
    out["receivedAt"] = System.currentTimeMillis().toString()
    return out
  }

  fun clearIntent(intent: Intent?) {
    intent ?: return
    intent.removeExtra(EXTRA_ACTION)
    DATA_KEYS.forEach { intent.removeExtra(EXTRA_PREFIX + it) }
  }
}
