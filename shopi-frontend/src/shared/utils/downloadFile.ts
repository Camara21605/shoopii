/* ============================================================
 * FICHIER : src/shared/utils/downloadFile.ts
 *
 * RÔLE : Télécharger un fichier distant (Cloudinary…) DIRECTEMENT sur
 * l'appareil, sans ouvrir de nouvelle page.
 *
 * BUG CORRIGÉ — les liens <a href=URL-Cloudinary download target="_blank">
 * ouvraient d'abord une autre page : le navigateur IGNORE l'attribut
 * `download` pour une adresse d'un autre site, et l'application installée
 * ouvrait en plus une fenêtre de navigateur par-dessus Shoneya.
 * On récupère maintenant le fichier (Cloudinary autorise CORS) puis on le
 * propose via une URL blob: locale — là, `download` est respecté.
 * Repli si la récupération échoue : l'URL « fl_attachment » de Cloudinary
 * (réponse Content-Disposition: attachment) dans la page actuelle.
 * ============================================================ */

/** URL Cloudinary qui force le téléchargement (sans effet sur une autre adresse). */
export function toAttachmentUrl(url: string): string {
  if (!url.includes('res.cloudinary.com') || url.includes('fl_attachment')) return url;
  /* fl_attachment n'existe pas pour les fichiers « raw » (PDF, docs…) */
  if (url.includes('/raw/upload/')) return url;
  return url.replace('/upload/', '/upload/fl_attachment/');
}

/** Nom de fichier : celui fourni, sinon la fin de l'URL. */
function fileName(url: string, name?: string | null): string {
  if (name?.trim()) return name.trim();
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'fichier'); }
  catch { return 'fichier'; }
}

export async function downloadFile(url: string, name?: string | null): Promise<void> {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href, download: fileName(url, name) });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  } catch {
    /* Repli : téléchargement par le navigateur dans la page actuelle */
    const a = Object.assign(document.createElement('a'), { href: toAttachmentUrl(url), download: fileName(url, name) });
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
