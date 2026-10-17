package expo.modules.shopicalls

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import java.io.File
import java.io.FileOutputStream

/**
 * « Retirer le fond » : détection du PRODUIT par l'IA du téléphone (ML Kit
 * Subject Segmentation de Google, sur l'appareil, gratuit, hors ligne une
 * fois le modèle installé par les services Google Play).
 *
 * Renvoie l'adresse d'un PNG de la même taille que la photo : blanc, dont
 * l'opacité = confiance « c'est le produit » (0…255). L'éditeur s'en sert
 * comme point de départ ; le vendeur retouche ensuite au doigt.
 * null si l'IA n'est pas disponible (pas de services Google Play, modèle
 * encore en téléchargement…) : l'éditeur passe alors à la méthode « couleur
 * du fond ». Ne lève jamais.
 */
object SubjectSegmenter {
  private const val TAG = "ShoneyaBg"

  fun segment(context: Context, uri: String, done: (String?) -> Unit) {
    var answered = false
    val reply = { v: String? -> if (!answered) { answered = true; done(v) } }
    val bmp = try { load(context, uri) } catch (e: Throwable) { null }
    if (bmp == null) { reply(null); return }
    try {
      val options = SubjectSegmenterOptions.Builder().enableForegroundConfidenceMask().build()
      val client = SubjectSegmentation.getClient(options)
      client.process(InputImage.fromBitmap(bmp, 0))
        .addOnSuccessListener { result ->
          val mask = result.foregroundConfidenceMask
          if (mask == null) { client.close(); reply(null); return@addOnSuccessListener }
          Thread {
            try {
              val w = bmp.width
              val h = bmp.height
              val pixels = IntArray(w * h)
              mask.rewind()
              for (i in 0 until w * h) {
                val a = (mask.get().coerceIn(0f, 1f) * 255f).toInt()
                pixels[i] = (a shl 24) or 0x00FFFFFF
              }
              val out = Bitmap.createBitmap(pixels, w, h, Bitmap.Config.ARGB_8888)
              val file = File(context.cacheDir, "shoneya-mask-${System.currentTimeMillis()}.png")
              FileOutputStream(file).use { out.compress(Bitmap.CompressFormat.PNG, 100, it) }
              out.recycle()
              reply(Uri.fromFile(file).toString())
            } catch (e: Throwable) {
              Log.w(TAG, "masque impossible", e)
              reply(null)
            } finally {
              client.close()
            }
          }.start()
        }
        .addOnFailureListener { e ->
          Log.i(TAG, "IA indisponible : ${e.message}")
          client.close()
          reply(null)
        }
    } catch (e: Throwable) {
      // Services Google Play absents ou trop anciens
      Log.i(TAG, "IA indisponible", e)
      reply(null)
    }
  }

  private fun load(context: Context, uri: String): Bitmap? {
    val u = Uri.parse(uri)
    val stream = if (u.scheme == null) File(uri).inputStream() else context.contentResolver.openInputStream(u)
    return stream?.use { BitmapFactory.decodeStream(it) }
  }
}
