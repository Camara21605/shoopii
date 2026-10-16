package expo.modules.shopicalls

import android.app.Activity
import android.content.Intent
import android.os.Build
import androidx.core.content.FileProvider
import java.io.File

/**
 * « Partager Shoneya » : envoie l'application installée, en UN fichier complet,
 * par Bluetooth, Nearby Share, Xender, WhatsApp… (comme WhatsApp le fait).
 * Possible seulement si l'application est installée en un seul APK — c'est le
 * cas des versions construites avec plugins/with-shareable-apk.js.
 */
object AppSharer {

  /** "ok" | "split" (installée en plusieurs morceaux : impossible à copier) | "error" */
  fun share(activity: Activity): String {
    val ctx = activity.applicationContext
    val info = ctx.applicationInfo
    if (!info.splitSourceDirs.isNullOrEmpty()) return "split"
    return try {
      val version = try {
        ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName ?: ""
      } catch (_: Exception) { "" }
      val dir = File(ctx.cacheDir, "partage").apply { mkdirs() }
      dir.listFiles()?.forEach { it.delete() }   // une seule copie à la fois
      val out = File(dir, if (version.isNotEmpty()) "Shoneya-$version.apk" else "Shoneya.apk")
      File(info.sourceDir).inputStream().use { input -> out.outputStream().use { input.copyTo(it) } }

      val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.shoneya.share", out)
      val send = Intent(Intent.ACTION_SEND)
        .setType("application/vnd.android.package-archive")
        .putExtra(Intent.EXTRA_STREAM, uri)
        .putExtra(Intent.EXTRA_TITLE, "Shoneya")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) send.clipData = android.content.ClipData.newRawUri("Shoneya", uri)
      activity.runOnUiThread { activity.startActivity(Intent.createChooser(send, "Partager Shoneya")) }
      "ok"
    } catch (e: Exception) {
      android.util.Log.w("ShopiShare", "Partage de l'application impossible", e)
      "error"
    }
  }
}
