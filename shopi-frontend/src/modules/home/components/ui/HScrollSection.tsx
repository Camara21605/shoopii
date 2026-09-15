/* ================================================================
 * src/modules/home/components/ui/HScrollSection.tsx
 *
 * AMÉLIORATIONS :
 *   - Masquer les flèches si pas de dépassement
 *   - Support touch/swipe natif (scroll horizontal)
 *   - Indicateur scrollable sur mobile (gradient fade)
 * ================================================================ */

import React, { useRef, useState, useEffect } from 'react';
import styles from './HScrollSection.module.css';

interface Props {
  children: React.ReactNode;
  dark?:    boolean;
}

export default function HScrollSection({ children, dark = false }: Props) {
  const ref      = useRef<HTMLDivElement>(null);
  const [canLeft,  setCanLeft]  = useState(false);
  const [canRight, setCanRight] = useState(true);

  /* Met à jour la visibilité des flèches selon la position de scroll */
  function updateArrows() {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateArrows); ro.disconnect(); };
  }, []);

  const scroll = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });

  return (
    <div className={styles.wrap}>

      {/* Gradient fade gauche */}
      {canLeft && (
        <div className={`${styles.fadeLeft} ${dark ? styles.fadeLeftDark : ''}`} />
      )}

      {/* Contenu scrollable */}
      <div
        className={styles.hs}
        ref={ref}
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {children}
      </div>

      {/* Gradient fade droite */}
      {canRight && (
        <div className={`${styles.fadeRight} ${dark ? styles.fadeRightDark : ''}`} />
      )}

      {/* Flèches navigation */}
      <div className={styles.arrows}>
        <button
          className={`${styles.arr} ${dark ? styles.dark : ''}`}
          onClick={() => scroll(-1)}
          disabled={!canLeft}
          aria-label="Défiler à gauche"
          style={{ opacity: canLeft ? 1 : 0.3, pointerEvents: canLeft ? 'auto' : 'none' }}
        >
          <i className="fas fa-chevron-left" />
        </button>
        <button
          className={`${styles.arr} ${dark ? styles.dark : ''}`}
          onClick={() => scroll(1)}
          disabled={!canRight}
          aria-label="Défiler à droite"
          style={{ opacity: canRight ? 1 : 0.3, pointerEvents: canRight ? 'auto' : 'none' }}
        >
          <i className="fas fa-chevron-right" />
        </button>
      </div>
    </div>
  );
}