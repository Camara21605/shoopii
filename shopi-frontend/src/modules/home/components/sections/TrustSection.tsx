import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './TrustSection.module.css';
interface Props { onToast: (m: string) => void; }
export default function TrustSection({ onToast }: Props) {
  const { t } = useTranslation();
  const ITEMS = [
    { ico:'🔒', cls:styles.t1, titre:t('home.trustSection.paiement.titre'),    sub:t('home.trustSection.paiement.sub') },
    { ico:'⚡', cls:styles.t2, titre:t('home.trustSection.livraison.titre'),   sub:t('home.trustSection.livraison.sub') },
    { ico:'🛡️', cls:styles.t3, titre:t('home.trustSection.protection.titre'), sub:t('home.trustSection.protection.sub') },
    { ico:'💬', cls:styles.t4, titre:t('home.trustSection.support.titre'),    sub:t('home.trustSection.support.sub') },
  ];
  return (
    <section className={styles.sec}>
      <div className={styles.wrap}>
        <div className={styles.grid}>
          {ITEMS.map(item => (
            <div key={item.titre} className={styles.item} onClick={() => onToast(`${item.ico} ${item.titre}`)}>
              <div className={`${styles.ico} ${item.cls}`}>{item.ico}</div>
              <div><div className={styles.titre}>{item.titre}</div><div className={styles.sub}>{item.sub}</div></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
