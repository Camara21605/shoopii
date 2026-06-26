/* ============================================================
 * FICHIER : src/main.tsx
 * ============================================================ */

import React    from 'react';
import ReactDOM from 'react-dom/client';
import App      from './app/App';

/* ── Styles globaux ── */
import './styles/variables.css';
import './styles/global.css';

/* ✅ Contexte panier global (badge header + addToCart partout) */
import { CartProvider } from './shared/context/CartContext';
/* ✅ Contexte favoris global (cœur ❤️ synchronisé partout) */
import { FavorisProvider } from './shared/context/FavorisContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CartProvider>
      <FavorisProvider>
        <App />
      </FavorisProvider>
    </CartProvider>
  </React.StrictMode>
);