import React from 'react';
import styles from './TrustSection.module.css';
interface Props { onToast: (m: string) => void; }
export default function TrustSection({ onToast }: Props) {
  const ITEMS = [
    { ico:'🔒', cls:styles.t1, titre:'Paiement sécurisé',    sub:'Orange Money, Visa, Mastercard — SSL' },
    { ico:'⚡', cls:styles.t2, titre:'Livraison express',    sub:'640+ livreurs vérifiés, 7j/7' },
    { ico:'🛡️', cls:styles.t3, titre:'Protection acheteur', sub:'Remboursement garanti si problème' },
    { ico:'💬', cls:styles.t4, titre:'Support 24/7',         sub:'Chat, WhatsApp, téléphone' },
  ];
  return (
    <section className={styles.sec}>
      <div className={styles.wrap}>
        <div className={styles.grid}>
          {ITEMS.map(t => (
            <div key={t.titre} className={styles.item} onClick={() => onToast(`${t.ico} ${t.titre}`)}>
              <div className={`${styles.ico} ${t.cls}`}>{t.ico}</div>
              <div><div className={styles.titre}>{t.titre}</div><div className={styles.sub}>{t.sub}</div></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
