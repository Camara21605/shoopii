/* ============================================================
 * FICHIER : src/common/utils/user-agent.util.ts
 *
 * RÔLE : Extrait un appareil + navigateur lisibles d'un User-Agent brut,
 * pour l'écran "Sécurité > Session actuelle" — remplace l'ancien texte
 * codé en dur ("Android · Conakry", "Windows · Conakry") par une vraie
 * lecture du User-Agent réellement envoyé par le navigateur.
 *
 * Volontairement une regex maison plutôt qu'une dépendance (ua-parser-js
 * etc.) : le besoin ici est un simple libellé d'affichage, pas une
 * détection exhaustive (version exacte, bots...).
 * ============================================================ */

export interface ParsedUserAgent {
  device:  string;
  browser: string;
}

export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua) return { device: 'Appareil inconnu', browser: 'Navigateur inconnu' };

  let device = 'Ordinateur';
  if (/Android/i.test(ua))                       device = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua))          device = 'iOS';
  else if (/Windows/i.test(ua))                   device = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua))        device = 'Mac';
  else if (/Linux/i.test(ua))                     device = 'Linux';

  const isMobile = /Mobi/i.test(ua);
  let browser = 'Navigateur';
  if (/Edg\//i.test(ua))                          browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua))               browser = 'Opera';
  else if (/CriOS|Chrome/i.test(ua))              browser = isMobile ? 'Chrome Mobile' : 'Chrome';
  else if (/FxiOS|Firefox/i.test(ua))             browser = isMobile ? 'Firefox Mobile' : 'Firefox';
  else if (/Safari/i.test(ua))                    browser = isMobile ? 'Safari Mobile' : 'Safari';

  return { device, browser };
}
