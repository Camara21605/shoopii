/* ================================================================
 * src/modules/home/components/ui/SectionHeader.tsx
 *
 * AMÉLIORATIONS :
 *   - onLink peut être une action protégée (auth requise)
 *   - Support accessibilité (aria)
 *   - dark mode amélioré
 * ================================================================ */

import React from 'react';
import styles from './SectionHeader.module.css';

interface Props {
  kick:      string;
  title:     string;
  sub?:      string;
  linkText?: string;
  onLink?:   () => void;
  dark?:     boolean;
}

export default function SectionHeader({ kick, title, sub, linkText, onLink, dark }: Props) {
  return (
    <div className={`${styles.hd} ${dark ? styles.dark : ''}`}>
      <div>
        <div className={styles.kick}>{kick}</div>
        <h2
          className={styles.title}
          dangerouslySetInnerHTML={{ __html: title }}
        />
        {sub && <p className={styles.sub}>{sub}</p>}
      </div>

      {linkText && onLink && (
        <button
          className={styles.lkAll}
          onClick={onLink}
          aria-label={linkText}
        >
          {linkText} <i className="fas fa-arrow-right" />
        </button>
      )}
    </div>
  );
}