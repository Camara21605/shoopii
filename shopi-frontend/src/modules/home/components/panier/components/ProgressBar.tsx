/*
 * ProgressBar.tsx — Barre d'étapes professionnelle
 */
import { useCart } from '../../../../../shared/context/CartContext';
import styles from '../styles/ProgressBar.module.css';

export default function ProgressBar() {
  const { count } = useCart();

  const STEPS = [
    {
      label: 'Panier',
      sub:   count > 0 ? `${count} article${count > 1 ? 's' : ''}` : 'Vide',
      state: 'done' as const,
    },
    { label: 'Livraison',    sub: 'Adresse & livreur', state: 'active' as const, num: 2 },
    { label: 'Paiement',     sub: 'Mode de paiement',  state: 'idle'   as const, num: 3 },
    { label: 'Confirmation', sub: 'Vérification',      state: 'idle'   as const, num: 4 },
  ];

  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        {STEPS.map((s, i) => (
          <div key={i} className={`${styles.step} ${styles[s.state]}`}>
            <div className={[
              styles.sn,
              s.state === 'done'   ? styles.snDone   : '',
              s.state === 'active' ? styles.snActive : '',
            ].filter(Boolean).join(' ')}>
              {s.state === 'done'
                ? <i className="fas fa-check" style={{ fontSize: 10 }} />
                : (s as any).num ?? i + 1}
            </div>
            <div>
              <div className={styles.sl}>{s.label}</div>
              <div className={styles.ss}>{s.sub}</div>
            </div>
          </div>
        ))}

        <div className={styles.secBadge}>
          <i className="fas fa-lock" /> Paiement sécurisé SSL
        </div>
      </div>
    </div>
  );
}
