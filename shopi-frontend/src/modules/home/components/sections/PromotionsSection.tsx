import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { promotionsApi, type PublicPromo } from '../../../../shared/services/api/promotions.api';
import { useCountdown } from '../../hooks/useCountdown';
import styles from './PromotionsSection.module.css';


const TYPE_ICON: Record<string, string> = {
  discount:    '🏷️',
  'free-ship': '🚚',
  bundle:      '🎁',
  flash:       '⚡',
};

const TYPE_COLOR: Record<string, string> = {
  discount:    'var(--rose)',
  'free-ship': 'var(--blue)',
  bundle:      'var(--violet)',
  flash:       'var(--amber)',
};

const TYPE_BG: Record<string, string> = {
  discount:    'var(--rs-bg)',
  'free-ship': 'var(--sky-2)',
  bundle:      'var(--vl-bg)',
  flash:       'var(--am-bg)',
};

/** Formate la valeur d'une promo pour l'affichage (−20%, −5 000 GNF, Livraison…). */
function formatPct(p: PublicPromo, t: TFunction): string {
  if (p.valueType === 'percent' && p.valeur != null) return `−${p.valeur}%`;
  if (p.valueType === 'fixed'   && p.valeur != null) return `−${Number(p.valeur).toLocaleString('fr-FR')} GNF`;
  if (p.type === 'free-ship') return t('home.promotions.livraison');
  return t('home.promotions.promo');
}

export default function PromotionsSection() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [promos,  setPromos]  = useState<PublicPromo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    promotionsApi.getPublicActive(5)
      .then(data => { if (!cancelled) setPromos(data); })
      .catch(() => { /* section masquée silencieusement si l'API échoue — pas critique pour la home */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const [big, ...small] = promos;
  const timer = useCountdown(big?.endDate ?? null);

  /**
   * Clic sur une promo précise : va DIRECTEMENT sur la fiche du produit
   * ciblé si la promo est liée à un produit spécifique (scope='products'),
   * ou sur la boutique de l'entreprise si la promo s'applique à tout son
   * catalogue (scope='global') — plutôt que la liste générique /offres.
   */
  const goToPromo = (p: PublicPromo) => {
    if (p.scope === 'products' && p.productIds.length > 0) {
      navigate(`/produit/${p.productIds[0]}`);
    } else {
      navigate(`/boutique/${p.company.id}`);
    }
  };

  /* Rien à afficher (chargement terminé, aucune promo active nulle part) —
     mieux vaut masquer la section qu'afficher une "Flash Sale" vide. */
  if (!loading && promos.length === 0) return null;
  if (loading) return null;

  return (
    <section className={styles.sec}>
      <div className={styles.wrap}>
        <div className={styles.layout}>
          {/* Grande promo — le plus gros pourcentage actif */}
          {big && (
            <div className={styles.big} onClick={() => goToPromo(big)}>
              <div className={styles.bigBg}/><div className={styles.bigEm}>{TYPE_ICON[big.type] ?? '🏷️'}</div>
              <div className={styles.tag}><i className="fas fa-bolt" /> {big.company.nom}</div>
              <div className={styles.pct}>{formatPct(big, t)}</div>
              <div className={styles.bigTitle}>{big.nom}</div>
              <p className={styles.bigSub}>{big.scope === 'global' ? t('home.promotions.surBoutique') : t('home.promotions.surSelection')}</p>
              {timer && (
                <div className={styles.timer}>
                  {[{v:timer.h,l:'H'},{v:timer.m,l:'M'},{v:timer.s,l:'S'}].map((tb,i) => (
                    <React.Fragment key={i}>
                      {i>0 && <span className={styles.tsep}>:</span>}
                      <div className={styles.tblk}><div className={styles.tnum}>{String(tb.v).padStart(2,'0')}</div><div className={styles.tlbl}>{tb.l}</div></div>
                    </React.Fragment>
                  ))}
                </div>
              )}
              <button className={styles.bigBtn} onClick={e => { e.stopPropagation(); goToPromo(big); }}>
                <i className="fas fa-bolt" /> {t('home.promotions.voirOffre')}
              </button>
            </div>
          )}
          {/* Petites promos — le reste des offres actives */}
          {small.length > 0 && (
            <div className={styles.smGrid}>
              {small.map(p => (
                <div key={p.id} className={styles.sm} onClick={() => goToPromo(p)}>
                  <div className={styles.smIco} style={{ background: TYPE_BG[p.type] ?? 'var(--rs-bg)' }}>{TYPE_ICON[p.type] ?? '🏷️'}</div>
                  <div className={styles.smText}><div className={styles.smTitle}>{p.nom}</div><div className={styles.smSub}>{p.company.nom}</div></div>
                  <div className={styles.smPct} style={{ color: TYPE_COLOR[p.type] ?? 'var(--rose)' }}>{formatPct(p, t)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
