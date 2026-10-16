package expo.modules.shopicalls

import android.content.ComponentName
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log

/**
 * Chiffre sur l'icône Shoneya (messages + notifications non lus), application
 * FERMÉE comprise. Le total exact vient du serveur avec chaque push (`unread`),
 * et de l'application quand elle est ouverte (lecture, déconnexion).
 *
 * Android n'a pas d'API unique pour ce chiffre :
 *   - Android 8+ (la plupart des téléphones) : le lanceur affiche le nombre
 *     des notifications Shoneya présentes (ou leur « number ») — voir
 *     NotifNotifier, qui donne à chaque notification sa part du total ;
 *   - certains fabricants ont leur propre canal, utilisé EN PLUS pour afficher
 *     le total exact : Huawei / Honor, Samsung (anciens One UI / TouchWiz),
 *     Sony, HTC, OPPO / realme, vivo, ASUS, ZUK, Xiaomi (via la notification).
 * Chaque essai est indépendant et silencieux : un téléphone qui ne connaît pas
 * un canal l'ignore simplement. Pixel / Android pur : un point, sans chiffre
 * (choix d'Android, pas réglable par une application).
 */
object BadgeManager {
  private const val TAG = "ShoneyaBadge"
  private const val PREFS = "shoneya_badge"

  fun last(context: Context): Int = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt("count", 0)

  /** Enregistre et affiche le total. Ne lève jamais. */
  fun set(context: Context, raw: Int) {
    val count = raw.coerceIn(0, 999)
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt("count", count).apply()
    val launcher = launcherComponent(context) ?: return
    val pkg = context.packageName
    val cls = launcher.className
    attempt("huawei") { huawei(context, pkg, cls, count) }
    attempt("samsung") { broadcast(context, Intent("android.intent.action.BADGE_COUNT_UPDATE").apply {
      putExtra("badge_count", count); putExtra("badge_count_package_name", pkg); putExtra("badge_count_class_name", cls)
    }) }
    attempt("sony") { broadcast(context, Intent("com.sonyericsson.home.action.UPDATE_BADGE").apply {
      putExtra("com.sonyericsson.home.intent.extra.badge.ACTIVITY_NAME", cls)
      putExtra("com.sonyericsson.home.intent.extra.badge.SHOW_MESSAGE", count > 0)
      putExtra("com.sonyericsson.home.intent.extra.badge.MESSAGE", count.toString())
      putExtra("com.sonyericsson.home.intent.extra.badge.PACKAGE_NAME", pkg)
    }) }
    attempt("sony-provider") { sonyProvider(context, pkg, cls, count) }
    attempt("htc") { broadcast(context, Intent("com.htc.launcher.action.SET_NOTIFICATION").apply {
      putExtra("com.htc.launcher.extra.COMPONENT", launcher.flattenToShortString()); putExtra("com.htc.launcher.extra.COUNT", count)
    }) }
    attempt("oppo") { oppo(context, count) }
    attempt("vivo") { broadcast(context, Intent("launcher.action.CHANGE_APPLICATION_NOTIFICATION_NUM").apply {
      putExtra("packageName", pkg); putExtra("className", cls); putExtra("notificationNum", count)
    }) }
    attempt("asus") { broadcast(context, Intent("android.intent.action.BADGE_COUNT_UPDATE").apply {
      putExtra("badge_count", count); putExtra("badge_count_package_name", pkg); putExtra("badge_count_class_name", cls); putExtra("badge_vip_count", 0)
    }) }
    attempt("zuk") {
      val extra = Bundle().apply { putInt("app_badge_count", count) }
      context.contentResolver.call(Uri.parse("content://com.android.badge/badge"), "setAppBadgeCount", null, extra)
    }
  }

  /** Xiaomi (MIUI / HyperOS) lit le chiffre sur la notification elle-même. */
  fun applyToNotification(notification: android.app.Notification, count: Int) {
    attempt("xiaomi") {
      val field = notification.javaClass.getDeclaredField("extraNotification")
      val extra = field.get(notification) ?: return@attempt
      extra.javaClass.getDeclaredMethod("setMessageCount", Int::class.javaPrimitiveType).invoke(extra, count)
    }
  }

  private fun launcherComponent(context: Context): ComponentName? =
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.component

  private fun huawei(context: Context, pkg: String, cls: String, count: Int) {
    val extra = Bundle().apply { putString("package", pkg); putString("class", cls); putInt("badgenumber", count) }
    for (uri in listOf("content://com.huawei.android.launcher.settings/badge/", "content://com.hihonor.android.launcher.settings/badge/")) {
      try { context.contentResolver.call(Uri.parse(uri), "change_badge", null, extra) } catch (_: Exception) { /* autre marque */ }
    }
  }

  private fun sonyProvider(context: Context, pkg: String, cls: String, count: Int) {
    val values = ContentValues().apply {
      put("badge_count", count); put("package_name", pkg); put("activity_name", cls)
    }
    context.contentResolver.insert(Uri.parse("content://com.sonymobile.home.resourceprovider/badge"), values)
  }

  private fun oppo(context: Context, count: Int) {
    val extra = Bundle().apply { putInt("app_badge_count", count) }
    context.contentResolver.call(Uri.parse("content://com.android.badge/badge"), "setAppBadgeCount", null, extra)
  }

  private fun broadcast(context: Context, intent: Intent) {
    val receivers = context.packageManager.queryBroadcastReceivers(intent, 0)
    if (receivers.isEmpty()) return
    for (r in receivers) {
      context.sendBroadcast(Intent(intent).setPackage(r.activityInfo.packageName))
    }
  }

  private inline fun attempt(name: String, block: () -> Unit) {
    try { block() } catch (e: Throwable) { Log.v(TAG, "badge $name indisponible : ${e.javaClass.simpleName}") }
  }
}
