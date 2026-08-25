/*
 * FICHIER : src/shared/components/LoadingScreen.tsx
 * ROLE    : Écran de chargement brandé Shoneya — affiché pendant le
 *           chargement asynchrone des bundles (Suspense fallback).
 *
 * UTILISATION :
 *   <Suspense fallback={<LoadingScreen />}>
 *     <MonComposantLazy />
 *   </Suspense>
 *
 *   // version mini (intérieur d'un dashboard déjà chargé) :
 *   <Suspense fallback={<LoadingScreen mini />}>
 *
 * AUTEUR  : Shopi03
 * DATE    : 2026-07-18
 */

import React from 'react';
import ShoneyaLogo from './ShoneyaLogo';

/* ── Styles injectés une seule fois ───────────────────────── */
const STYLE_ID = 'shoneya-loading-styles';

function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    @keyframes shoneya-pulse {
      0%,100% { transform: scale(1);   opacity: 1;   }
      50%      { transform: scale(1.06); opacity: .88; }
    }
    @keyframes shoneya-dot {
      0%,80%,100% { transform: scaleY(1);   opacity: .4; }
      40%          { transform: scaleY(1.6); opacity: 1;  }
    }
    @keyframes shoneya-fade-in {
      from { opacity:0; transform:translateY(10px); }
      to   { opacity:1; transform:translateY(0);    }
    }
  `;
  document.head.appendChild(el);
}



/* ── Composant principal ────────────────────────────────────── */
interface LoadingScreenProps {
  /** Version compacte pour fallback intérieur à un dashboard */
  mini?: boolean;
}

export default function LoadingScreen({ mini = false }: LoadingScreenProps) {
  injectStyles();

  if (mini) {
    return (
      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          minHeight:      280,
          gap:            16,
          animation:      'shoneya-fade-in .3s ease both',
        }}
      >
        <div style={{ animation: 'shoneya-pulse 2s ease-in-out infinite' }}>
          <ShoneyaLogo size={64} />
        </div>
        <DotsLoader />
      </div>
    );
  }

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     'linear-gradient(145deg, #071526 0%, #0B1F3A 60%, #0d2a52 100%)',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            28,
        zIndex:         9999,
        animation:      'shoneya-fade-in .25s ease both',
      }}
    >
      {/* Logo animé */}
      <div
        style={{
          animation:    'shoneya-pulse 2.2s ease-in-out infinite',
          filter:       'drop-shadow(0 0 24px rgba(33,150,243,.35))',
          borderRadius: 44,
        }}
      >
        <ShoneyaLogo size={128} />
      </div>

      {/* Points de chargement */}
      <DotsLoader />

      {/* Texte */}
      <p
        style={{
          margin:      0,
          color:       'rgba(200,217,248,.5)',
          fontFamily:  'DM Sans, Inter, system-ui, sans-serif',
          fontSize:    13,
          fontWeight:  500,
          letterSpacing: '.04em',
          userSelect:  'none',
        }}
      >
        Chargement…
      </p>
    </div>
  );
}

/* ── Points de chargement animés ───────────────────────────── */
function DotsLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            display:         'inline-block',
            width:           8,
            height:          8,
            borderRadius:    '50%',
            background:      '#2196F3',
            animation:       `shoneya-dot 1.1s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
