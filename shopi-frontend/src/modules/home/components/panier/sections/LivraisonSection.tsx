/*
 * ============================================================
 * FICHIER : src/modules/home/components/panier/sections/LivraisonSection.tsx
 *
 * RÔLE    : Étape 3 — Mode de livraison.
 *
 *   1. Par la boutique — gratuite (la boutique organise la livraison ou le
 *      retrait ; commande enregistrée en ModeLivraison.PICKUP).
 *   2. Un livreur choisi parmi ceux que le client SUIT.
 *
 * TARIF RÉEL : celui de la zone couvrant l'adresse (GeoZone.fraisLivraison),
 * facturé une fois PAR BOUTIQUE — exactement ce que fait le serveur
 * (commande-creation.service). Plus de « vitesse » (Éco, Express… ×1,3 à ×2,5)
 * ni de délais inventés : le serveur ne les appliquait pas, le montant affiché
 * ne correspondait donc pas au montant débité.
 * ============================================================
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fmt } from '../data/panierData';
import type { LivreurSuivi } from '../services/livreursSuivis.api';
import styles from '../styles/LivraisonSection.module.css';

interface Props {
  delMode:  'std' | 'lvr';
  selLvr:   string | null;
  livreurs: LivreurSuivi[];
  loadingLivreurs?: boolean;
  /** Tarif de la zone couvrant l'adresse saisie (par boutique). null = pas encore connu. */
  zoneFee:  number | null;
  shopCount: number;
  onDel:    (m: 'std' | 'lvr') => void;
  onSelLvr: (id: string) => void;
}

export default function LivraisonSection({
  delMode, selLvr, livreurs, loadingLivreurs = false, zoneFee, shopCount, onDel, onSelLvr,
}: Props) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, string>) => t(`panierCommande.v2.livraison.${key}`, o);

  const tarif = zoneFee == null
    ? k('tarifSelonAdresse')
    : zoneFee === 0
      ? k('gratuite')
      : shopCount > 1 ? k('parBoutique', { montant: fmt(zoneFee) }) : fmt(zoneFee);

  return (
    <div className={`${styles.sc} ${styles.lit}`}>
      <div className={styles.scHd}>
        <div className={styles.scNum}>3</div>
        <div>
          <div className={styles.scTitre}>{k('titre')}</div>
          <div className={styles.scSub}>{k('sub')}</div>
        </div>
      </div>

      <div className={styles.scBody}>
        <div className={styles.delGrid} role="radiogroup" aria-label={k('titre')}>
          <div
            role="radio" aria-checked={delMode === 'std'} tabIndex={0}
            className={`${styles.delOpt} ${delMode === 'std' ? styles.delOptSel : ''}`}
            onClick={() => onDel('std')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDel('std'); } }}
          >
            <div className={`${styles.delRadio} ${delMode === 'std' ? styles.delRadioOn : ''}`} />
            <div className={styles.delIcon}>🏪</div>
            <div className={styles.delTitre}>{k('boutiqueTitre')}</div>
            <div className={styles.delSub}>{k('boutiqueDesc')}</div>
            <span className={`${styles.delPrice} ${styles.delPriceFree}`}>{k('gratuite')}</span>
          </div>

          <div
            role="radio" aria-checked={delMode === 'lvr'} tabIndex={0}
            className={`${styles.delOpt} ${delMode === 'lvr' ? styles.delOptSel : ''}`}
            onClick={() => onDel('lvr')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDel('lvr'); } }}
          >
            <div className={`${styles.delRadio} ${delMode === 'lvr' ? styles.delRadioOn : ''}`} />
            <div className={styles.delIcon}>🛵</div>
            <div className={styles.delTitre}>{k('livreurTitre')}</div>
            <div className={styles.delSub}>{k('livreurDesc')}</div>
            <span className={`${styles.delPrice} ${styles.delPriceTeal}`}>{tarif}</span>
          </div>
        </div>

        {delMode === 'lvr' && (
          <div className={styles.lvrPanel}>
            <div className={styles.panelHd}>
              <span><i className="fas fa-motorcycle" style={{ color: 'var(--blue,#1A4FC4)', marginRight: 4 }} /> {k('livreursSuivis')}</span>
            </div>

            <div className={styles.lvList}>
              {loadingLivreurs && (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--t3,#5A7A9E)', fontSize: 13 }}>
                  <i className="fas fa-circle-notch fa-spin" style={{ marginRight: 6 }} /> {k('chargement')}
                </div>
              )}

              {!loadingLivreurs && livreurs.length === 0 && (
                <div style={{ padding: '22px 16px', textAlign: 'center', color: 'var(--t3,#5A7A9E)', fontSize: 13 }}>
                  <i className="fas fa-user-slash" style={{ fontSize: 22, display: 'block', marginBottom: 10, color: 'var(--t4,#96B2CC)' }} />
                  {k('aucun')}{' '}
                  <Link to="/livreurs" style={{ fontWeight: 700 }}>{k('trouver')}</Link>
                </div>
              )}

              {!loadingLivreurs && livreurs.map(lv => (
                <div
                  key={lv.id}
                  role="radio" aria-checked={selLvr === lv.id} tabIndex={0}
                  className={`${styles.lvCard} ${selLvr === lv.id ? styles.lvCardSel : ''}`}
                  onClick={() => onSelLvr(lv.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelLvr(lv.id); } }}
                >
                  <div className={styles.lvAvaWrap}>
                    <div className={styles.lvAva}>{lv.em}</div>
                    <div className={`${styles.lvOl} ${lv.on ? styles.lvOlOn : styles.lvOlOff}`} />
                  </div>
                  <div className={styles.lvInf}>
                    <div className={styles.lvNm}>{lv.nm}</div>
                    <div className={styles.lvMeta}>
                      <span><i className="fas fa-location-dot" style={{ color: 'var(--blue,#1A4FC4)' }} /> {lv.zn}</span>
                      {lv.rt !== '—' && <span><i className="fas fa-star" style={{ color: '#B45309' }} /> {lv.rt}</span>}
                      <span style={{ color: lv.on ? '#047857' : 'var(--t3,#5A7A9E)' }}>{lv.on ? k('disponible') : k('indisponible')}</span>
                    </div>
                  </div>
                  <div className={styles.lvRight}>
                    <div className={`${styles.lvRadio} ${selLvr === lv.id ? styles.lvRadioOn : ''}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
