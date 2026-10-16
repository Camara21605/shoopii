// vite.config.ts

import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'


/* ── Préchargement de la page ouverte, en parallèle du fichier principal ──
 * LENTEUR DU PREMIER CHARGEMENT CORRIGÉE : chaque page est chargée à la
 * demande (lazy() dans router.tsx). Conséquence : le navigateur ne
 * découvrait les fichiers de la page ouverte (Home : ~25 fichiers JS/CSS)
 * qu'APRÈS avoir téléchargé ET exécuté le fichier principal — deux
 * vagues de téléchargement l'une après l'autre (mesuré : la Home ne
 * commençait à se télécharger qu'à 1,9 s en 4G lente).
 * Ce plugin écrit dans index.html, au build, la liste des fichiers de
 * quelques pages clés ; un petit script choisit selon l'URL (et le rôle
 * du dernier compte connecté) et lance leur téléchargement DÈS le début,
 * en même temps que le fichier principal. Seule la page ouverte est
 * préchargée : rien de gaspillé pour les autres. Les CSS sont seulement
 * préchargées (rel=preload) : c'est toujours Vite qui les applique, dans
 * son ordre habituel — aucun changement de priorité entre feuilles. */
const PAGES_PRECHARGEES: Record<string, RegExp> = {
  home:          /modules\/home\/pages\/HomePage\.tsx$/,
  produit:       /produit\/pages\/ProduitPage\.tsx$/,
  boutique:      /boutique\/pages\/BoutiquePage\.tsx$/,
  service:       /service\/pages\/ServiceDetailPage\.tsx$/,
  super_admin:   /dashboards\/super-admin\/SuperAdminApp\.tsx$/,
  admin:         /dashboards\/administrateur\/AdministrateurApp\.tsx$/,
  company:       /dashboards\/entreprise\/EntrepriseApp\.tsx$/,
  partner:       /dashboards\/partenaire\/PartenaireApp\.tsx$/,
  delivery:      /dashboards\/livreur\/LivreurApp\.tsx$/,
  correspondent: /dashboards\/correspondant\/CorrespondantApp\.tsx$/,
}

function prechargementPageOuverte(): Plugin {
  return {
    name: 'shoneya-prechargement-page-ouverte',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return html
        type Chunk = { type: 'chunk'; fileName: string; imports: string[]; isEntry: boolean; facadeModuleId: string | null; viteMetadata?: { importedCss: Set<string> } }
        const chunks = Object.values(bundle).filter(c => c.type === 'chunk') as unknown as Chunk[]
        const parNom = new Map(chunks.map(c => [c.fileName, c]))
        /* Fichiers déjà chargés par index.html : inutile de les relister. */
        const dejaCharges = new Set<string>()
        const parcourir = (nom: string, acc: Set<string>) => {
          if (acc.has(nom)) return
          acc.add(nom)
          parNom.get(nom)?.imports.forEach(i => parcourir(i, acc))
        }
        chunks.filter(c => c.isEntry).forEach(c => parcourir(c.fileName, dejaCharges))
        const cssDejaCharges = new Set<string>()
        dejaCharges.forEach(n => parNom.get(n)?.viteMetadata?.importedCss.forEach(f => cssDejaCharges.add(f)))

        const carte: Record<string, [string[], string[]]> = {}
        for (const [cle, motif] of Object.entries(PAGES_PRECHARGEES)) {
          const entree = chunks.find(c => c.facadeModuleId && motif.test(c.facadeModuleId.replace(/\\/g, '/')))
          if (!entree) continue
          const js = new Set<string>()
          parcourir(entree.fileName, js)
          const css = new Set<string>()
          js.forEach(n => parNom.get(n)?.viteMetadata?.importedCss.forEach(f => css.add(f)))
          carte[cle] = [[...js].filter(n => !dejaCharges.has(n)), [...css].filter(n => !cssDejaCharges.has(n))]
        }

        const script = `<script>(function(){try{
var M=${JSON.stringify(carte)},p=location.pathname,r=null,k=null;
try{var t=localStorage.getItem('shopi_access_token');if(t)r=JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role}catch(e){}
var D={'super-admin':'super_admin',admin:'admin',entreprise:'company',partenaire:'partner',livreur:'delivery',correspondant:'correspondent'};
var d=/^\\/dashboard\\/([^/]+)/.exec(p);
if(d)k=D[d[1]];
else if(p==='/'||p==='/home')k=(r&&r!=='client'&&M[r])?r:'home';
else if(/^\\/produit\\//.test(p))k='produit';
else if(/^\\/boutique\\//.test(p))k='boutique';
else if(/^\\/service\\//.test(p))k='service';
var f=k&&M[k];if(!f)return;
var h=document.head,b='${'/'}';
f[0].forEach(function(n){var l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='';l.href=b+n;h.appendChild(l)});
f[1].forEach(function(n){var l=document.createElement('link');l.rel='preload';l.as='style';l.crossOrigin='';l.href=b+n;h.appendChild(l)});
}catch(e){}})();</script>`
        return html.replace('</head>', `    ${script}\n  </head>`)
      },
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    prechargementPageOuverte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Shoneya — Marketplace Africaine',
        short_name: 'Shoneya',
        description: 'Marketplace africaine — achetez et vendez en Guinée.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        lang: 'fr',
        start_url: '/',
        /* L'application mobile Android native (pas la PWA) — voir src/shared/pwa/nativeApp.ts. */
        related_applications: [
          { platform: 'play', url: 'https://play.google.com/store/apps/details?id=com.shoneya.app', id: 'com.shoneya.app' },
        ],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        /* Ne jamais mettre l'API en cache offline : les données (produits,
         * commandes, prix) doivent toujours venir du serveur, pas d'un
         * cache Workbox périmé. */
        navigateFallbackDenylist: [/^\/api\//],
        /* BUG CORRIGÉ — precacheAndRoute() (comportement par défaut de
         * generateSW) mettait aussi en cache et interceptait les chunks
         * JS/CSS hashés (assets/*.js, assets/*.css), qui sont DÉJÀ chargés
         * par le navigateur via les <link rel="modulepreload"> que Vite
         * génère dans index.html. Cette double prise en charge (preload
         * réseau direct + interception par le service worker) produisait
         * l'avertissement Chrome "cross-world service worker resource
         * mismatch" — le service worker répondait à la requête à la place
         * du preload réseau, rendant ce dernier inutilisé. On limite donc
         * le précache Workbox au strict app-shell (HTML/manifest/icônes) :
         * cette app dépend de toute façon entièrement de l'API réseau
         * (voir navigateFallbackDenylist ci-dessus), l'usage hors-ligne des
         * chunks JS/CSS n'apportait donc aucune valeur réelle. */
        globPatterns: ['**/*.{html,webmanifest,ico,png,svg,webp}'],
        /* Notifications push : la logique d'affichage (push, notificationclick,
         * pastille de l'icône) vit dans public/push-sw.js et est chargée DANS
         * le service worker généré — c'est le seul moyen de recevoir un push
         * application fermée sans passer à une stratégie injectManifest. */
        importScripts: ['push-sw.js'],
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            /* Bibliothèques de base (React, routeur, traductions, temps réel) dans un fichier à part :
             * elles ne changent presque jamais d'un déploiement à l'autre, donc le téléphone les garde
             * en cache et ne retélécharge que le code de Shoneya après une mise à jour — ouverture de
             * l'application plus rapide, y compris depuis une notification d'appel. */
            {
              name: 'vendor',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|i18next|react-i18next|socket\.io-client|socket\.io-parser|engine\.io-client|engine\.io-parser|@socket\.io)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },

  optimizeDeps: {
    /* Ces paquets ne sont atteints qu'à travers un import dynamique
     * (lazy() sur une page de dashboard, une modale…) : le scanner de
     * dépendances de Vite peut les rater au démarrage et les découvrir
     * seulement quand l'utilisateur ouvre cette page en dev — ça
     * déclenche un ré-optimize + rechargement complet de la page,
     * perçu comme "la navigation devient lente d'un coup". Les lister
     * ici les fait pré-bundler dès le démarrage du serveur dev. */
    include: ['socket.io-client', 'leaflet', 'react-leaflet', '@react-leaflet/core', 'qrcode', 'react-window'],
    /* Scanne TOUT le code source au démarrage (et pas seulement ce que l'entrée atteint par
     * des imports statiques) : chaque dépendance des pages chargées à la demande (carte,
     * dashboards…) est ainsi pré-compilée d'emblée. Sinon Vite la découvre en cours de
     * route, ré-optimise, change le hash `?v=` des modules et le navigateur, resté sur
     * l'ancien, reçoit « 504 Outdated Optimize Dep » (page blanche / ErrorBoundary). */
    entries: ['index.html', 'src/**/*.{ts,tsx}', '!src/**/*.{test,spec}.{ts,tsx}'],
  },

  server: {
    /* Pré-transforme ces pages dès le démarrage de `vite`, au lieu
     * d'attendre la première navigation réelle — sans ça, la toute
     * première visite de chacune paie seule tout le coût de
     * transformation (le gros du délai en dev vient du grand nombre
     * de modules ESM non-bundlés que le navigateur doit demander un
     * par un, pas du rendu React lui-même). */
    warmup: {
      clientFiles: [
        './src/app/router.tsx',
        './src/modules/home/pages/HomePage.tsx',
        './src/modules/home/components/produit/pages/ProduitPage.tsx',
        './src/modules/home/components/boutique/pages/BoutiquePage.tsx',
      ],
    },
  },
})