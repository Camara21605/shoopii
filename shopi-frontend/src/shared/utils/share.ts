/*
 * ============================================================
 * FICHIER : src/shared/utils/share.ts
 *
 * RÔLE    : Logique commune à toutes les modales/boutons de partage
 *           (boutique, produit, service, stories, carte produit…).
 *
 * BUGS CORRIGÉS (2026-10-11) :
 *   - Les liens partagés pointaient vers https://shopi.gn, un domaine
 *     qui ne sert pas l'application : le destinataire tombait sur une
 *     page morte. Les liens sont maintenant construits sur l'origine
 *     réelle du site (ou VITE_PUBLIC_SITE_URL si définie).
 *   - Les liens produit/service utilisaient le slug, alors que les pages
 *     /produit/:id et /service/:id (et l'API /public/...) n'acceptent que
 *     l'UUID → « Produit introuvable » à l'ouverture.
 *   - Instagram ne faisait rien d'autre que copier le lien : il passe
 *     désormais par la feuille de partage native du téléphone (où
 *     Instagram apparaît), avec la copie en repli.
 *   - « Lien copié » s'affichait même quand la copie échouait (WebView,
 *     HTTP, permission refusée) : repli execCommand puis prompt().
 * ============================================================
 */

export type ShareNetwork = 'WhatsApp' | 'Facebook' | 'Instagram' | 'X' | 'Email' | 'Copier';

export interface SharePayload {
  url:   string;
  /** Nom de l'élément partagé (boutique, produit…) — repris dans le message. */
  title: string;
  /** Phrase d'accroche optionnelle, placée avant le lien. */
  text?: string;
}

/** Ce qui s'est réellement passé — permet d'afficher le bon toast. */
export type ShareOutcome = 'opened' | 'shared' | 'copied' | 'manual' | 'cancelled'
  /** Facebook ouvert ET texte du message copié (à coller dans la publication). */
  | 'textCopied';

/* ── URL publique ─────────────────────────────────────────── */

/**
 * Construit l'URL publique d'une page du site, ex. publicUrl('/boutique/123').
 * VITE_PUBLIC_SITE_URL permet de forcer le domaine (utile si l'app tourne
 * sur un domaine secondaire) ; sinon on prend l'origine courante, qui est
 * celle de la prod une fois déployé (et celle du TWA Android).
 */
export function publicUrl(path: string): string {
  const env  = (import.meta as { env?: Record<string, string | undefined> }).env;
  const base = (env?.VITE_PUBLIC_SITE_URL || window.location.origin).replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/* ── Presse-papier ────────────────────────────────────────── */

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Copie dans le presse-papier. Renvoie 'copied' si c'est fait, sinon
 * affiche le lien dans une boîte de dialogue pour une copie manuelle
 * ('manual') — l'utilisateur n'est jamais laissé avec un faux « Lien copié ».
 */
export async function copyText(text: string): Promise<'copied' | 'manual'> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
  } catch { /* on tente le repli ci-dessous */ }
  if (legacyCopy(text)) return 'copied';
  window.prompt('Copiez ce lien :', text);
  return 'manual';
}

/** Copie silencieuse (sans boîte de dialogue de repli) — true si réussie. */
async function quietCopy(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* repli ci-dessous */ }
  return legacyCopy(text);
}

/* ── Partage natif (Web Share API) ────────────────────────── */

export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** Ouvre la feuille de partage du téléphone ; null si indisponible. */
export async function nativeShare(p: SharePayload): Promise<'shared' | 'cancelled' | null> {
  if (!canNativeShare()) return null;
  try {
    await navigator.share({ title: p.title, text: p.text ?? p.title, url: p.url });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    return null;
  }
}

/** Partage natif si possible, sinon copie du lien. */
export async function shareOrCopy(p: SharePayload): Promise<ShareOutcome> {
  const native = await nativeShare(p);
  if (native) return native;
  return copyText(p.url);
}

/* ── Liens de partage par réseau ──────────────────────────── */

function message(p: SharePayload): string {
  const head = p.text ?? p.title;
  return head ? `${head}\n${p.url}` : p.url;
}

export function shareLink(network: ShareNetwork, p: SharePayload): string | null {
  const u = encodeURIComponent(p.url);
  switch (network) {
    /* api.whatsapp.com ouvre directement l'appli sur mobile (wa.me y redirige). */
    case 'WhatsApp': return `https://api.whatsapp.com/send?text=${encodeURIComponent(message(p))}`;
    case 'Facebook': return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case 'X':        return `https://twitter.com/intent/tweet?text=${encodeURIComponent(p.text ?? p.title)}&url=${u}`;
    case 'Email':    return `mailto:?subject=${encodeURIComponent(p.title)}&body=${encodeURIComponent(message(p))}`;
    default:         return null;
  }
}

/* ── Mobile ───────────────────────────────────────────────── */

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

export function isMobileDevice(): boolean {
  return isAndroid() || isIOS();
}

/**
 * BUG CORRIGÉ (2026-10-11) — sur téléphone, les liens web de partage
 * (api.whatsapp.com, facebook.com/sharer) sont interceptés par les applis
 * WhatsApp/Facebook qui ouvrent souvent une fenêtre de publication VIDE
 * (le paramètre est perdu en route, ou Chrome n'est pas connecté à
 * Facebook). On ouvre donc WhatsApp directement par son schéma d'appli
 * (le texte arrive bien prérempli), avec repli web s'il n'est pas installé.
 */
function openWhatsAppApp(p: SharePayload, webLink: string): void {
  const text = encodeURIComponent(message(p));
  if (isAndroid()) {
    /* Intent Chrome : ouvre WhatsApp (ou WhatsApp Business) ; si aucune appli
     * ne gère le schéma, Chrome bascule tout seul sur browser_fallback_url. */
    window.location.href =
      `intent://send?text=${text}#Intent;scheme=whatsapp;S.browser_fallback_url=${encodeURIComponent(webLink)};end`;
    return;
  }
  /* iOS : schéma direct, repli web si la page est toujours visible
   * (= WhatsApp ne s'est pas ouvert). */
  window.location.href = `whatsapp://send?text=${text}`;
  window.setTimeout(() => {
    if (!document.hidden) window.location.href = webLink;
  }, 1500);
}

/**
 * Exécute le partage vers un réseau. Doit être appelé directement dans le
 * gestionnaire de clic (window.open / navigator.share exigent un geste
 * utilisateur, sinon le navigateur bloque).
 */
export async function shareTo(network: ShareNetwork, p: SharePayload): Promise<ShareOutcome> {
  if (network === 'Copier') return copyText(p.url);

  /* Instagram n'a pas de lien de partage web : on passe par la feuille de
   * partage du téléphone (Instagram y figure), sinon on copie le lien. */
  if (network === 'Instagram') return shareOrCopy(p);

  const link = shareLink(network, p);
  if (!link) return copyText(p.url);

  if (network === 'Email') {
    /* window.open('mailto:') laisse un onglet vide sur plusieurs navigateurs. */
    window.location.href = link;
    return 'opened';
  }

  /* Facebook interdit de préremplir le texte d'une publication (seul le
   * lien passe, avec son aperçu). On copie donc le message pour que
   * l'utilisateur n'ait qu'à le coller. Lancé SANS attendre : await ici
   * ferait perdre le geste utilisateur exigé par navigator.share/window.open. */
  const textCopy = network === 'Facebook' ? quietCopy(p.text ?? p.title) : null;
  const withCopy = async (o: ShareOutcome): Promise<ShareOutcome> =>
    textCopy && o !== 'cancelled' && await textCopy ? 'textCopied' : o;

  if (isMobileDevice()) {
    if (network === 'WhatsApp') {
      openWhatsAppApp(p, link);
      return 'opened';
    }
    /* Facebook / X sur téléphone : la feuille de partage du système transmet
     * le lien directement à l'appli choisie, qui affiche l'aperçu (balises
     * og:* servies par api/og.js). Repli sur le lien web si indisponible. */
    const native = await nativeShare(p);
    if (native) return withCopy(native);
  }

  window.open(link, '_blank', 'noopener,noreferrer');
  return withCopy('opened');
}
