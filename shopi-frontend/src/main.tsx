/* ============================================================
 * FICHIER : src/main.tsx
 * ============================================================ */

import React    from 'react';
import ReactDOM from 'react-dom/client';
import App      from './app/App';
/* Capte tôt l'évènement d'installation de Chrome (émis avant le montage de React) */
import './shared/pwa/installPrompt';
import InstallBanner from './shared/pwa/InstallBanner';

/* ── Styles globaux ── */
import './styles/variables.css';
import './styles/global.css';

/* Taille du texte choisie dans Paramètres → Apparence, appliquée avant le premier affichage */
import { initTextSize } from './shared/appearance/textSize';
initTextSize();

/* ✅ Contexte panier global (badge header + addToCart partout) */
import { CartProvider } from './shared/context/CartContext';
/* ✅ Contexte favoris global (cœur ❤️ synchronisé partout) */
import { FavorisProvider } from './shared/context/FavorisContext';
/* ✅ Contexte favoris prestations global (cœur ❤️ services synchronisé partout) */
import { ServiceFavorisProvider } from './shared/context/ServiceFavorisContext';
/* ✅ Contexte liste de souhaits global (🔖 synchronisé partout) */
import { WishlistProvider } from './shared/context/WishlistContext';
/* ✅ Contexte comparaison produits global (⚖️ badge + page /comparer) */
import { CompareProvider } from './shared/context/CompareContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CartProvider>
      <FavorisProvider>
        <ServiceFavorisProvider>
          <WishlistProvider>
            <CompareProvider>
              <App />
              <InstallBanner />
            </CompareProvider>
          </WishlistProvider>
        </ServiceFavorisProvider>
      </FavorisProvider>
    </CartProvider>
  </React.StrictMode>
);

/* ── Mises à jour de l'application installée ──────────────────────
 * Sur un téléphone, l'application reste souvent ouverte/en arrière-plan des jours entiers : sans
 * vérification, elle gardait une ANCIENNE version (et un ancien service worker, donc d'anciennes
 * règles de notification d'appel) jusqu'à deux lancements plus tard. On demande donc au navigateur de
 * chercher une nouvelle version au retour sur l'application et toutes les 15 minutes. La nouvelle version
 * s'active seule (skipWaiting) ; la page se met à jour au prochain chargement — jamais de rechargement
 * forcé pendant un appel ou une saisie. */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then((registration) => {
    const check = () => { if (navigator.onLine) void registration.update().catch(() => { /* réseau : au prochain essai */ }); };
    setInterval(check, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  }).catch(() => { /* service worker indisponible (navigation privée…) : sans conséquence */ });
}
