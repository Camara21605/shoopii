/**
 * « Fichier » dans la messagerie = DOCUMENTS uniquement (PDF, Word, Excel,
 * PowerPoint, texte, archives, audio…). Photos et vidéos ont leur propre
 * bouton (« Photo ou vidéo ») pour s'afficher directement dans la discussion
 * au lieu d'arriver comme une pièce jointe à télécharger.
 *
 * Le sélecteur Android filtre déjà par type ; on revérifie après le choix,
 * car certains gestionnaires de fichiers ignorent le filtre.
 */
export const DOCUMENT_TYPES: string[] = [
  'application/*',
  'text/*',
  'audio/*',
];

const MEDIA_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|mp4|mov|m4v|3gp|mkv|webm|avi)$/i;

export function isPhotoOrVideo(mimeType: string | null | undefined, name: string | null | undefined): boolean {
  if (mimeType && /^(image|video)\//i.test(mimeType)) return true;
  return !!name && MEDIA_EXT.test(name);
}
