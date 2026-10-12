/*
 * FICHIER : src/shared/components/LoadingScreen.tsx
 * ROLE    : Écran de chargement Shoneya — affiché pendant le
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
 * BUG CORRIGÉ (2026-10-12) — « le logo s'affiche deux fois au premier
 * chargement » :
 *   - La version plein écran reprend À L'IDENTIQUE l'écran de démarrage
 *     posé dans index.html (classes .sh-splash*, styles dans index.html,
 *     même image déjà décodée, voir LOGO_SRC). Avant : fond bleu
 *     différent + fondu d'apparition rejoué à CHAQUE montage → chaque
 *     Suspense / garde de route qui affichait un écran de chargement
 *     donnait l'impression d'un nouveau logo qui apparaît.
 *   - La pulsation est calée sur l'horloge de la page (délai négatif) :
 *     passer d'un écran de chargement à un autre ne relance pas
 *     l'animation, l'œil ne voit qu'un seul écran continu.
 *   - La version mini (intérieur d'un dashboard) n'affiche plus le logo,
 *     seulement les points : le logo venait juste d'être montré en plein
 *     écran, le revoir en petit dans la page était la 3e apparition.
 *
 * AUTEUR  : Shopi03
 * DATE    : 2026-07-18 — refonte 2026-10-12
 */


/** Même image que l'écran de démarrage de index.html (logo intégré à la
 *  page) : relue dans le DOM avant que React ne le remplace — ce module
 *  est évalué avant le premier rendu. Déjà décodée → affichage immédiat,
 *  sans dupliquer l'image dans le JavaScript. */
const LOGO_SRC: string =
  (typeof document !== 'undefined'
    && document.querySelector<HTMLImageElement>('.sh-splash__logo')?.getAttribute('src'))
  || '/shoneya-logo.webp';

/** Durées des animations définies dans index.html (@keyframes sh-pulse / sh-dot). */
const PULSE_MS = 2200;

/** Délai négatif = l'animation reprend là où en est l'écran précédent. */
function phaseDelay(periodMs: number): string {
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  return `-${Math.round(now % periodMs)}ms`;
}

interface LoadingScreenProps {
  /** Version compacte pour fallback intérieur à un dashboard */
  mini?: boolean;
}

export default function LoadingScreen({ mini = false }: LoadingScreenProps) {
  if (mini) {
    return (
      <div
        role="status"
        aria-label="Chargement"
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          minHeight:      280,
        }}
      >
        <Dots />
      </div>
    );
  }

  return (
    <div className="sh-splash" role="status" aria-label="Chargement">
      <img
        className="sh-splash__logo"
        src={LOGO_SRC}
        alt="Shoneya"
        width={128}
        height={128}
        style={{ animationDelay: phaseDelay(PULSE_MS) }}
      />
      <Dots />
    </div>
  );
}

/* Points de chargement — styles .sh-splash__dots dans index.html */
function Dots() {
  return (
    <div className="sh-splash__dots" aria-hidden="true">
      <span /><span /><span />
    </div>
  );
}
