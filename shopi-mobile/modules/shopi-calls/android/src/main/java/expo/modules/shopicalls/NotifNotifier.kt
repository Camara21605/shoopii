package expo.modules.shopicalls

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.media.AudioAttributes
import android.net.Uri
import android.provider.Settings
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.app.RemoteInput
import androidx.core.graphics.drawable.IconCompat
import java.net.HttpURLConnection
import java.net.URL

/**
 * Toutes les notifications Shoneya (hors appels entrants, voir CallNotifier) :
 *   - logo Shoneya dans la barre d'état, catégorie lisible dans l'en-tête
 *     (« Shoneya • Commande »), photo de l'expéditeur / de la boutique ;
 *   - une catégorie = un canal Android : l'utilisateur règle le son, la
 *     vibration ou coupe une catégorie (ex. Promotions) dans les réglages ;
 *   - messages : conversation regroupée (style messagerie), boutons
 *     « Répondre » (sans ouvrir l'appli) et « Marquer comme lu » ;
 *   - une notification par sujet : la suivante remplace la précédente (tag) ;
 *   - SON = le son de notification choisi dans les réglages du téléphone
 *     (Settings.System.DEFAULT_NOTIFICATION_URI), imposé explicitement : sans
 *     cela, certains fabricants (Xiaomi, Tecno, Infinix…) mettaient leur propre
 *     son, ou aucun, aux canaux d'une nouvelle application. + vibration et
 *     voyant. L'utilisateur peut toujours changer le son d'une catégorie dans
 *     Réglages › Applications › Shoneya › Notifications.
 * Le contenu vient du serveur (AndroidPushService) en push FCM « data ».
 */
object NotifNotifier {
  private const val TAG = "ShopiNotif"
  const val ACTION_REPLY = "expo.modules.shopicalls.NOTIF_REPLY"
  const val ACTION_READ = "expo.modules.shopicalls.NOTIF_READ"
  const val KEY_REPLY = "shoneya_reply_text"
  private const val BRAND_COLOR = 0xFF1F1F1F.toInt()

  /* Android interdit de changer le son d'un canal déjà créé : les canaux
   * reçoivent donc un nouveau préfixe (v2) et les anciens sont supprimés. */
  private const val PREFIX = "shoneya_v2_"
  private const val OLD_PREFIX = "shoneya_"
  private val VIBRATION = longArrayOf(0, 250, 150, 250)

  private data class Channel(val id: String, val name: String, val desc: String, val importance: Int)

  private val CHANNELS = listOf(
    Channel("messages", "Messages", "Nouveaux messages de vos conversations", NotificationManager.IMPORTANCE_HIGH),
    Channel("calls", "Appels manqués", "Appels audio et vidéo manqués", NotificationManager.IMPORTANCE_HIGH),
    Channel("orders", "Commandes", "Nouvelles commandes, confirmations, annulations, retours", NotificationManager.IMPORTANCE_HIGH),
    Channel("deliveries", "Livraisons", "Suivi des livraisons et des colis", NotificationManager.IMPORTANCE_HIGH),
    Channel("payments", "Paiements et portefeuille", "Paiements reçus, envoyés, remboursements", NotificationManager.IMPORTANCE_HIGH),
    Channel("account", "Compte et sécurité", "Validation, sécurité et état de votre compte", NotificationManager.IMPORTANCE_HIGH),
    Channel("support", "Assistance", "Réponses de l'assistance Shoneya", NotificationManager.IMPORTANCE_HIGH),
    Channel("social", "Abonnés, avis et j'aime", "Nouveaux abonnés, avis, j'aime, stories", NotificationManager.IMPORTANCE_DEFAULT),
    Channel("products", "Produits et stock", "Stock faible, baisse de prix, produit validé", NotificationManager.IMPORTANCE_DEFAULT),
    Channel("promos", "Promotions", "Offres et promotions des boutiques", NotificationManager.IMPORTANCE_DEFAULT),
    Channel("system", "Annonces Shoneya", "Maintenance et annonces importantes", NotificationManager.IMPORTANCE_DEFAULT),
    Channel("general", "Autres notifications", "Tout le reste", NotificationManager.IMPORTANCE_DEFAULT),
  )

  /** Conversation ouverte à l'écran : ses messages ne sonnent pas (l'appli les affiche déjà). */
  @Volatile var activeConversationId: String? = null

  fun channelId(category: String) =
    PREFIX + (CHANNELS.firstOrNull { it.id == category }?.id ?: "general")

  /** Son de notification du téléphone (celui des SMS / notifications, réglé par l'utilisateur). */
  private val phoneSound: Uri get() = Settings.System.DEFAULT_NOTIFICATION_URI

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = context.getSystemService(NotificationManager::class.java) ?: return
    // Anciens canaux sans son imposé (« shoneya_messages »…) : retirés une fois.
    for (c in CHANNELS) {
      val old = OLD_PREFIX + c.id
      if (nm.getNotificationChannel(old) != null) nm.deleteNotificationChannel(old)
    }
    for (c in CHANNELS) {
      val id = PREFIX + c.id
      if (nm.getNotificationChannel(id) != null) continue
      /* Messages : usage « communication instantanée » (même traitement que les
       * SMS / WhatsApp par le mode Ne pas déranger) ; le reste : notification. */
      val usage = if (c.id == "messages" || c.id == "calls") AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT
        else AudioAttributes.USAGE_NOTIFICATION
      nm.createNotificationChannel(NotificationChannel(id, c.name, c.importance).apply {
        description = c.desc
        setSound(
          phoneSound,
          AudioAttributes.Builder().setUsage(usage).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build(),
        )
        enableVibration(true)
        vibrationPattern = VIBRATION
        enableLights(true)
        lightColor = 0xFF22C55E.toInt()
        setShowBadge(true)
        lockscreenVisibility = Notification.VISIBILITY_PRIVATE
      })
    }
  }

  fun idFor(tag: String) = tag.hashCode() and 0x7fffffff or 0x10000000

  // ── Affichage ─────────────────────────────────────────────────────────

  fun show(context: Context, data: Map<String, String>) {
    val tag = data["tag"] ?: data["notifId"] ?: return
    val category = data["category"] ?: "general"
    val title = data["title"].orEmpty().ifBlank { "Shoneya" }
    val body = data["body"].orEmpty()
    val conversationId = data["conversationId"]

    // Conversation (ou groupe) déjà à l'écran : l'appli affiche le message, pas de notification.
    val chatKey = conversationId ?: tag.substringAfter("message:", "")
    if (category == "messages" && chatKey.isNotEmpty() &&
      CallNotifier.isForeground && chatKey == activeConversationId) return

    ensureChannels(context)
    val id = idFor(tag)
    val avatar = data["avatar"]?.let { loadCircle(it) }
    val open = openIntent(context, data["route"] ?: "/notifications", id)

    val b = NotificationCompat.Builder(context, channelId(category))
      .setSmallIcon(R.drawable.ic_stat_shoneya)
      .setColor(BRAND_COLOR)
      .setSubText(data["categoryLabel"])
      .setContentTitle(title)
      .setContentText(body)
      .setContentIntent(open)
      .setAutoCancel(true)
      .setOnlyAlertOnce(false)
      .setWhen(data["sentAt"]?.toLongOrNull() ?: System.currentTimeMillis())
      .setShowWhen(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      // Android 7 et moins (pas de canaux) : même son du téléphone + vibration.
      .setSound(phoneSound)
      .setVibrate(VIBRATION)
      .setGroup("shoneya_$category")
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      // Écran verrouillé : la catégorie s'affiche, pas le contenu.
      .setPublicVersion(
        NotificationCompat.Builder(context, channelId(category))
          .setSmallIcon(R.drawable.ic_stat_shoneya)
          .setColor(BRAND_COLOR)
          .setContentTitle(data["categoryLabel"] ?: "Shoneya")
          .setContentText("Nouvelle notification")
          .build(),
      )
    /* Chiffre sur l'icône : chaque notification compte pour SA part (1, ou le
     * nombre de messages de la conversation) — les lanceurs qui additionnent
     * affichent ainsi le bon total ; le total exact du serveur part aussi par
     * les canaux des fabricants (BadgeManager). */
    val total = data["unread"]?.toIntOrNull()
    b.setNumber(1)
    if (avatar != null) b.setLargeIcon(avatar)

    when (category) {
      "messages" -> {
        b.setCategory(NotificationCompat.CATEGORY_MESSAGE)
        val sender = Person.Builder()
          .setName(data["senderName"] ?: title)
          .setKey(conversationId ?: tag)
          .apply { if (avatar != null) setIcon(IconCompat.createWithBitmap(avatar)) }
          .build()
        val style = existingStyle(context, id)
          ?: NotificationCompat.MessagingStyle(Person.Builder().setName("Vous").build())
        style.addMessage(body, System.currentTimeMillis(), sender)
        b.setStyle(style)
        b.setNumber(style.messages.size.coerceAtLeast(1))
        addMessageActions(context, b, data, id, tag)
      }
      "calls" -> b.setCategory(NotificationCompat.CATEGORY_MISSED_CALL)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      else -> b.setCategory(NotificationCompat.CATEGORY_STATUS)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
    }

    try {
      val nm = NotificationManagerCompat.from(context)
      val notification = b.build()
      if (total != null) BadgeManager.applyToNotification(notification, total)
      nm.notify(id, notification)
      showGroupSummary(context, category, data["categoryLabel"] ?: "Shoneya")
      if (total != null) BadgeManager.set(context, total)
    } catch (e: SecurityException) {
      Log.w(TAG, "Notifications refusées par l'utilisateur", e)
    }
  }

  fun dismiss(context: Context, tag: String) {
    NotificationManagerCompat.from(context).cancel(idFor(tag))
  }

  /** Message ajouté à la conversation déjà affichée (au lieu d'une notification par message). */
  private fun existingStyle(context: Context, id: Int): NotificationCompat.MessagingStyle? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return null
    val nm = context.getSystemService(NotificationManager::class.java) ?: return null
    val active = nm.activeNotifications.firstOrNull { it.id == id } ?: return null
    return NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(active.notification)
  }

  private fun addMessageActions(context: Context, b: NotificationCompat.Builder, data: Map<String, String>, id: Int, tag: String) {
    val token = data["actionToken"] ?: return
    fun action(action: String, req: Int, mutable: Boolean): PendingIntent {
      val i = Intent(context, NotifActionReceiver::class.java).setAction(action)
        .putExtra("token", token).putExtra("notifId", id).putExtra("tag", tag)
        .putExtra("replyUrl", data["replyUrl"]).putExtra("readUrl", data["readUrl"])
        .putExtra("senderName", data["senderName"]).putExtra("category", data["category"])
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or
        if (mutable && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else PendingIntent.FLAG_IMMUTABLE
      return PendingIntent.getBroadcast(context, id * 4 + req, i, flags)
    }
    if (data["replyUrl"] != null) {
      val input = RemoteInput.Builder(KEY_REPLY).setLabel("Votre réponse…").build()
      b.addAction(
        NotificationCompat.Action.Builder(0, "Répondre", action(ACTION_REPLY, 1, true))
          .addRemoteInput(input)
          .setAllowGeneratedReplies(true)
          .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
          .setShowsUserInterface(false)
          .build(),
      )
    }
    if (data["readUrl"] != null) {
      b.addAction(
        NotificationCompat.Action.Builder(0, "Marquer comme lu", action(ACTION_READ, 2, false))
          .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_MARK_AS_READ)
          .setShowsUserInterface(false)
          .build(),
      )
    }
  }

  /** Plusieurs notifications d'une même catégorie : regroupées sous un seul titre. */
  private fun showGroupSummary(context: Context, category: String, label: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
    val nm = context.getSystemService(NotificationManager::class.java) ?: return
    val group = "shoneya_$category"
    val count = nm.activeNotifications.count { it.notification.group == group && (it.notification.flags and Notification.FLAG_GROUP_SUMMARY) == 0 }
    if (count < 2) return
    val summary = NotificationCompat.Builder(context, channelId(category))
      .setSmallIcon(R.drawable.ic_stat_shoneya)
      .setColor(BRAND_COLOR)
      .setSubText(label)
      .setContentTitle(label)
      .setContentText("$count notifications")
      .setGroup(group)
      .setGroupSummary(true)
      .setNumber(0)
      .setBadgeIconType(NotificationCompat.BADGE_ICON_NONE)
      .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_CHILDREN)
      .setAutoCancel(true)
      .build()
    NotificationManagerCompat.from(context).notify(idFor("summary:$group"), summary)
  }

  /** Toucher la notification ouvre l'écran concerné (lien shoneya://…, géré par expo-router). */
  private fun openIntent(context: Context, route: String, id: Int): PendingIntent {
    val path = if (route.startsWith("/")) route else "/$route"
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("shoneya:/$path"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Photo ronde (expéditeur, boutique), 4 s maximum : sans elle, la notification part quand même. */
  private fun loadCircle(url: String): Bitmap? {
    if (!url.startsWith("https://")) return null
    return try {
      val sized = if (url.contains("res.cloudinary.com") && url.contains("/upload/"))
        url.replaceFirst("/upload/", "/upload/c_fill,w_192,h_192,f_jpg/") else url
      val conn = URL(sized).openConnection() as HttpURLConnection
      conn.connectTimeout = 4000
      conn.readTimeout = 4000
      val src = conn.inputStream.use { BitmapFactory.decodeStream(it) } ?: return null
      val size = minOf(src.width, src.height)
      val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(out)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG)
      canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
      paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
      val left = (src.width - size) / 2
      val top = (src.height - size) / 2
      canvas.drawBitmap(src, Rect(left, top, left + size, top + size), Rect(0, 0, size, size), paint)
      out
    } catch (e: Exception) {
      null
    }
  }
}
