/* ui/HScrollSection.tsx — Wrapper scroll horizontal avec flèches */
import React, { useRef } from 'react';
import styles from './HScrollSection.module.css';
interface Props { children: React.ReactNode; dark?: boolean; }
export default function HScrollSection({ children, dark = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 270, behavior: 'smooth' });
  return (
    <div className={styles.wrap}>
      <div className={styles.hs} ref={ref}>{children}</div>
      <div className={styles.arrows}>
        <button className={`${styles.arr} ${dark ? styles.dark : ''}`} onClick={() => scroll(-1)}>
          <i className="fas fa-chevron-left" />
        </button>
        <button className={`${styles.arr} ${dark ? styles.dark : ''}`} onClick={() => scroll(1)}>
          <i className="fas fa-chevron-right" />
        </button>
      </div>
    </div>
  );
}
