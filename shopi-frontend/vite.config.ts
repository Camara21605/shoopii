// vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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