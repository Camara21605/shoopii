// vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
        start_url: '/',
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
        globPatterns: ['**/*.{html,webmanifest,ico,png,svg}'],
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
    include: ['socket.io-client', 'leaflet', 'react-leaflet', 'qrcode'],
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