/* ============================================================
 * FICHIER : src/common/utils/magic-bytes.util.ts
 *
 * RÔLE : Vérifie les magic bytes (signature binaire) d'un fichier
 * pour confirmer que le type MIME déclaré correspond au contenu réel.
 *
 * Un attaquant peut falsifier l'en-tête Content-Type d'un upload
 * multipart et envoyer, par exemple, un fichier HTML/JS avec
 * mimetype "image/png" — si ce fichier est un jour servi tel quel
 * (CDN, lien direct), il peut s'exécuter côté client malgré la liste
 * blanche MIME. Cette vérification lit les octets RÉELS du buffer
 * en plus de la liste blanche MIME — défense en profondeur.
 *
 * Référence : https://en.wikipedia.org/wiki/List_of_file_signatures
 * OWASP A05:2021 – Security Misconfiguration
 *
 * Extrait de attachment.service.ts (module support) pour être
 * réutilisé aussi par UploadService (audit sécurité : upload.service.ts
 * ne validait que le Content-Type déclaré, jamais le contenu réel).
 * ============================================================ */

export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  /* Un fichier trop petit pour contenir une signature valide est rejeté. */
  if (buffer.length < 12) return false;

  switch (mimeType) {
    case 'application/pdf':
      /* Signature PDF : %PDF (hex: 25 50 44 46) */
      return buffer.slice(0, 4).toString('ascii') === '%PDF';

    case 'image/jpeg':
      /* Signature JPEG : FF D8 FF (Start Of Image + marqueur APP) */
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;

    case 'image/png':
      /* Signature PNG : 89 50 4E 47 0D 0A 1A 0A (8 octets) */
      return buffer[0] === 0x89 && buffer[1] === 0x50 &&
             buffer[2] === 0x4E && buffer[3] === 0x47 &&
             buffer[4] === 0x0D && buffer[5] === 0x0A &&
             buffer[6] === 0x1A && buffer[7] === 0x0A;

    case 'image/webp':
      /* Signature WebP : RIFF????WEBP (offset 0-3 = RIFF, offset 8-11 = WEBP) */
      return buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
             buffer.slice(8, 12).toString('ascii') === 'WEBP';

    case 'image/gif':
      /* Signature GIF : "GIF87a" ou "GIF89a" (6 octets ASCII) */
      return buffer.slice(0, 6).toString('ascii') === 'GIF87a' ||
             buffer.slice(0, 6).toString('ascii') === 'GIF89a';

    case 'video/mp4':
    case 'video/quicktime':
      /* Signature MP4/MOV : box "ftyp" à l'offset 4 (ISO 14496-12) —
       * les fichiers .mov modernes exportés par un téléphone/logiciel
       * récent utilisent le même conteneur ISO BMFF que le MP4. */
      return buffer.slice(4, 8).toString('ascii') === 'ftyp';

    case 'video/webm':
      /* Signature WebM/MKV : En-tête EBML — 1A 45 DF A3 */
      return buffer[0] === 0x1A && buffer[1] === 0x45 &&
             buffer[2] === 0xDF && buffer[3] === 0xA3;

    default:
      /* Type inconnu → rejeté (fail-closed).
       * Ne jamais autoriser un type non listé même s'il passe la liste blanche. */
      return false;
  }
}
