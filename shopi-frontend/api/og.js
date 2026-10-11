/*
 * ============================================================
 * FICHIER : api/og.js  (Vercel Edge Function)
 *
 * RÔLE    : Aperçus de lien (Open Graph) pour les pages partagées.
 *
 * POURQUOI : le site est une SPA — index.html ne contient aucune balise
 *   og:* propre à la boutique/au produit, et les robots de WhatsApp,
 *   Facebook, X, Telegram… n'exécutent pas le JavaScript. Un lien partagé
 *   s'affichait donc sans titre ni image. vercel.json redirige ces robots
 *   (détectés par leur User-Agent) de /boutique/:id, /produit/:id et
 *   /service/:id vers cette fonction, qui lit l'API publique et renvoie
 *   un HTML minimal avec les bonnes balises. Les visiteurs humains ne
 *   passent jamais par ici et reçoivent l'application normale.
 *
 * ENV (Vercel) : SHARE_API_URL, sinon VITE_API_URL (ex. https://…/api).
 * ============================================================
 */

export const config = { runtime: 'edge' };

const DEFAULT_API = 'https://shoneya-2ig5.onrender.com/api';
const SITE_NAME   = 'Shoneya';
const DEFAULT_DESC = 'Shoneya — la marketplace africaine : boutiques, produits et services près de chez vous.';

const TYPES = {
  boutique: { endpoint: 'boutiques', path: 'boutique' },
  produit:  { endpoint: 'produits',  path: 'produit'  },
  service:  { endpoint: 'services',  path: 'service'  },
};

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function clip(s, n) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function fmtPrix(n) {
  return n == null ? '' : `${Number(n).toLocaleString('fr-FR')} GNF`;
}

/* Les médias peuvent être relatifs (/uploads/…) : on les rend absolus. */
function absolute(url, apiBase) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const origin = apiBase.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

function firstMedia(list) {
  const arr = Array.isArray(list) ? [...list] : [];
  arr.sort((a, b) => (a?.ordre ?? 0) - (b?.ordre ?? 0));
  const img = arr.find(m => !m?.type || /image/i.test(m.type)) ?? arr[0];
  return img?.url ?? null;
}

export function buildMeta(type, data, apiBase) {
  if (type === 'boutique') {
    return {
      title: data.companyName,
      description: data.slogan || data.description || [data.domaine, data.localisation].filter(Boolean).join(' · '),
      image: absolute(data.coverImage || data.logo, apiBase),
    };
  }
  if (type === 'produit') {
    const prix = fmtPrix(data.prix);
    return {
      title: prix ? `${data.nom} — ${prix}` : data.nom,
      description: data.description || (data.companyName ? `Disponible chez ${data.companyName}` : ''),
      image: absolute(firstMedia(data.images), apiBase) || absolute(data.companyLogo, apiBase),
    };
  }
  const prix = data.pricingType === 'sur_devis' ? 'Sur devis' : fmtPrix(data.prix);
  return {
    title: prix ? `${data.nom} — ${prix}` : data.nom,
    description: data.description || (data.companyName ? `Proposé par ${data.companyName}` : ''),
    image: absolute(firstMedia(data.media), apiBase) || absolute(data.companyLogo, apiBase),
  };
}

export function renderHtml({ title, description, image, url, type }) {
  const t = esc(clip(title || SITE_NAME, 90));
  const d = esc(clip(description || DEFAULT_DESC, 200));
  const i = esc(image);
  const u = esc(url);
  /* Si un humain arrive ici par erreur (User-Agent mal détecté), ?_r=1
   * fait sauter la règle de vercel.json et sert l'application normale. */
  const appUrl = `${url}${url.includes('?') ? '&' : '?'}_r=1`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${t} | ${SITE_NAME}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${u}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:locale" content="fr_FR" />
<meta property="og:type" content="${type === 'produit' ? 'product' : 'website'}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${u}" />
<meta property="og:image" content="${i}" />
<meta property="og:image:alt" content="${t}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${i}" />
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<p><a href="${esc(appUrl)}">Voir sur ${SITE_NAME}</a></p>
<script>location.replace(${JSON.stringify(appUrl).replace(/</g, '\\u003c')});</script>
</body>
</html>`;
}

export default async function handler(request) {
  const reqUrl = new URL(request.url);
  const type   = reqUrl.searchParams.get('type');
  const id     = reqUrl.searchParams.get('id') ?? '';
  const def    = TYPES[type];
  const origin = reqUrl.origin;

  /* Garde-fou : seul un identifiant simple est transmis à l'API. */
  if (!def || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
    return new Response(renderHtml({ url: `${origin}/`, image: `${origin}/pwa-512x512.png` }), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const pageUrl = `${origin}/${def.path}/${id}`;
  const apiBase = (process.env.SHARE_API_URL || process.env.VITE_API_URL || DEFAULT_API).replace(/\/+$/, '');
  let meta = { title: SITE_NAME, description: DEFAULT_DESC, image: null };
  let found = false;

  try {
    /* Les robots abandonnent vite : on ne les fait pas attendre plus de 5 s
     * (backend en veille) — dans ce cas on sert l'aperçu générique. */
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res   = await fetch(`${apiBase}/public/${def.endpoint}/${id}`, {
      headers: { accept: 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (res.ok) { meta = buildMeta(type, await res.json(), apiBase); found = true; }
  } catch { /* aperçu générique */ }

  return new Response(
    renderHtml({ ...meta, image: meta.image || `${origin}/pwa-512x512.png`, url: pageUrl, type }),
    {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        /* Aperçu générique (API indisponible) : pas de cache, pour réessayer au prochain robot. */
        'cache-control': found ? 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600' : 'no-store',
      },
    },
  );
}
