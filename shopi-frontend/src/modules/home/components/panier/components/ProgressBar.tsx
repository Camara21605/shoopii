/*
 * ProgressBar.tsx — Barre d'étapes professionnelle
 */
import { useTranslation } from 'react-i18next';
import { useCart } from '../../../../../shared/context/CartContext';
import styles from '../styles/ProgressBar.module.css';

export default function ProgressBar() {
  const { t } = useTranslation();
  const { count } = useCart();

  const STEPS = [
    {
      label: t('panierCommande.progressBar.panier'),
      sub:   count > 0 ? t('panierCommande.progressBar.articleCount', { count }) : t('panierCommande.progressBar.vide'),
      state: 'done' as const,
    },
    { label: t('panierCommande.progressBar.livraison'),    sub: t('panierCommande.progressBar.adresseLivreur'), state: 'active' as const, num: 2 },
    { label: t('panierCommande.progressBar.confirmation'), sub: t('panierCommande.progressBar.verification'),   state: 'idle'   as const, num: 3 },
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
          <i className="fas fa-lock" /> {t('panierCommande.progressBar.paiementSecuriseSsl')}
        </div>
      </div>
    </div>
  );
}
