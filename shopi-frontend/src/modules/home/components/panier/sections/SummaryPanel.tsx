/*
 * SummaryPanel.tsx — Panneau récapitulatif professionnel
 *
 * Sur mobile (≤768px), ce panneau devient une feuille fixe en bas
 * d'écran (voir CommandePage.module.css .rightCol). Repliée par
 * défaut — seule une barre compacte (total + flèche) reste visible,
 * pour ne pas masquer en permanence le reste du formulaire (adresse,
 * livraison…). Un tap sur la barre déplie le détail complet.
 * Sur desktop, la feuille repliable n'existe pas : tout reste visible.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SPEEDS, fmt, lvFeeCalc } from '../data/panierData';
import type { CartItem } from '../data/panierData';
import type { LivreurSuivi } from '../services/livreursSuivis.api';
import styles from '../styles/SummaryPanel.module.css';

interface Props {
  items:      CartItem[];
  delMode:    'std' | 'lvr';
  selLvrObj:  LivreurSuivi | null;
  corrFee:    number;
  curSpd:     string;
  promoActif: boolean;
  etaDest:    string;
  loading:    boolean;
  /** Solde réel du portefeuille Shoneya — le paiement se fait toujours par ce solde. */
  walletBalance: number | null;
  loadingWallet: boolean;
  onConfirm:  () => void;
  onEdit:     () => void;
}

export default function SummaryPanel({
  items, delMode, selLvrObj, corrFee, curSpd,
  promoActif, etaDest, loading, walletBalance, loadingWallet, onConfirm, onEdit,
}: Props) {
  const { t } = useTranslation();
  const sub   = items.reduce((s, i) => s + i.price * i.qty, 0);
  const lv    = selLvrObj;
  const lvFee = lv ? lvFeeCalc(lv.base, SPEEDS[curSpd].m) : 0;
  const disc  = promoActif ? Math.round(sub * 0.2) : 0;
  const total = sub + lvFee + corrFee - disc;
  const sp    = SPEEDS[curSpd];

  const etaMode = delMode === 'std'
    ? t('panierCommande.summaryPanel.livraisonStandardLabel')
    : lv ? `${lv.em} ${lv.nm} · ${sp.l}` : t('panierCommande.summaryPanel.nonSelectionne');
  const etaTime = delMode === 'std' ? '24 – 48h' : lv ? sp.e : '—';

  /* Repliée par défaut — n'a d'effet que sur mobile (voir CSS) */
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={expanded ? styles.sheetOpen : styles.sheetClosed}>

      {/* ── Barre de bascule (mobile uniquement) — total + flèche plier/déplier ── */}
      <button type="button" className={styles.toggleBar} onClick={() => setExpanded(v => !v)}>
        <span className={styles.drawerHandle} />
        <span className={styles.toggleRow}>
          <span className={styles.toggleLabel}>
            <i className="fas fa-receipt" />
            {t('panierCommande.summaryPanel.recapitulatif')}
            <strong className={styles.toggleTotal}>{fmt(total)}</strong>
          </span>
          <i className={`fas ${expanded ? 'fa-chevron-down' : 'fa-chevron-up'} ${styles.toggleChevron}`} />
        </span>
      </button>

      <div className={styles.sheetBody}>

      {/* ── Carte principale ── */}
      <div className={styles.card}>

        {/* Titre */}
        <div className={styles.titre}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}>
            <i className="fas fa-receipt" style={{ color:'#1A4FC4', fontSize:13 }} />
            {t('panierCommande.summaryPanel.recapitulatif')}
          </span>
          <span onClick={onEdit}>{t('panierCommande.summaryPanel.modifier')}</span>
        </div>

        {/* Articles miniatures */}
        <div className={styles.items}>
          {items.map(i => (
            <div key={i.id} className={styles.si}>
              <div className={styles.siImg}>
                {typeof i.em === 'string' && i.em.startsWith('http')
                  ? <img src={i.em} alt={i.name} />
                  : i.em}
              </div>
              <div className={styles.siInfo}>
                <div className={styles.siNm}>{i.name}</div>
                <div className={styles.siQty}>× {i.qty}</div>
              </div>
              <div className={styles.siPr}>{fmt(i.price * i.qty)}</div>
            </div>
          ))}
        </div>

        {/* Détail coûts */}
        <div className={styles.rows}>
          <div className={styles.row}>
            <span className={styles.rowL}>
              <i className="fas fa-bag-shopping" />
              {t('panierCommande.summaryPanel.sousTotal', { count: items.length })}
            </span>
            <span className={styles.rowV}>{fmt(sub)}</span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowL}>
              <i className="fas fa-truck" />
              {t('panierCommande.summaryPanel.livraison')}
            </span>
            <span className={`${styles.rowV} ${(delMode === 'std' || lvFee === 0) ? styles.free : ''}`}>
              {delMode === 'std' || lvFee === 0 ? t('panierCommande.summaryPanel.gratuite') : fmt(lvFee)}
            </span>
          </div>

          {corrFee > 0 && (
            <div className={styles.row}>
              <span className={styles.rowL}><i className="fas fa-map-pin" /> {t('panierCommande.summaryPanel.correspondant')}</span>
              <span className={`${styles.rowV} ${styles.corr}`}>{fmt(corrFee)}</span>
            </div>
          )}

          {promoActif && (
            <div className={styles.row}>
              <span className={styles.rowL}><i className="fas fa-tag" /> {t('panierCommande.summaryPanel.promoShopi20')}</span>
              <span className={`${styles.rowV} ${styles.disc}`}>−{fmt(disc)}</span>
            </div>
          )}

          <div className={styles.divider} />
        </div>

        {/* Total */}
        <div className={styles.totalRow}>
          <span className={styles.totalL}>{t('panierCommande.summaryPanel.totalAPayer')}</span>
          <span className={styles.totalV}>{fmt(total)}</span>
        </div>

        {/* Solde du portefeuille Shoneya — le paiement est toujours prélevé dessus */}
        <div className={styles.row} style={{ marginTop: 2 }}>
          <span className={styles.rowL}>
            <i className="fas fa-wallet" />
            {t('panierCommande.summaryPanel.soldePortefeuille')}
          </span>
          <span
            className={styles.rowV}
            style={
              loadingWallet || walletBalance == null
                ? undefined
                : { color: walletBalance < total ? '#DC2626' : '#047857', fontWeight: 800 }
            }
          >
            {loadingWallet ? t('panierCommande.summaryPanel.chargement') : walletBalance != null ? fmt(walletBalance) : '—'}
          </span>
        </div>
        {!loadingWallet && walletBalance != null && walletBalance < total && (
          <div className={styles.row} style={{ marginTop: -4 }}>
            <span style={{ fontSize: 11.5, color: '#DC2626', fontWeight: 600 }}>
              <i className="fas fa-triangle-exclamation" style={{ marginRight: 5 }} />
              {t('panierCommande.summaryPanel.soldeInsuffisant')}
            </span>
          </div>
        )}

        {/* Bouton confirmer */}
        <button
          className={`${styles.btnPlace} ${loading ? styles.loading : ''}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? (
            <><i className="fas fa-circle-notch" /> {t('panierCommande.summaryPanel.traitementEnCours')}</>
          ) : (
            <><i className="fas fa-shield-check" /> {t('panierCommande.summaryPanel.confirmerLaCommande')}</>
          )}
        </button>

        {/* Garanties */}
        <div className={styles.guarantees}>
          <div className={`${styles.g} ${styles.gGreen}`}>
            <i className="fas fa-lock" /> {t('panierCommande.summaryPanel.paiementSecuriseSsl')}
          </div>
          <div className={`${styles.g} ${styles.gBlue}`}>
            <i className="fas fa-rotate-left" /> {t('panierCommande.summaryPanel.retourGratuit')}
          </div>
          <div className={`${styles.g} ${styles.gAmber}`}>
            <i className="fas fa-shield-check" /> {t('panierCommande.summaryPanel.protectionAcheteur')}
          </div>
        </div>
      </div>

      {/* ── Carte ETA ── */}
      <div className={styles.etaCard}>
        <div className={styles.etaTitre}>
          <i className="fas fa-map-location-dot" style={{ color:'#1A4FC4' }} />
          {t('panierCommande.summaryPanel.estimationLivraison')}
        </div>
        <div className={styles.etaRow}>
          <span className={styles.etaL}>{t('panierCommande.summaryPanel.mode')}</span>
          <span className={styles.etaV}>{etaMode}</span>
        </div>
        <div className={styles.etaRow}>
          <span className={styles.etaL}>{t('panierCommande.summaryPanel.destination')}</span>
          <span className={styles.etaV}>{etaDest}</span>
        </div>
        <div className={styles.etaRow}>
          <span className={styles.etaL}>{t('panierCommande.summaryPanel.delaiEstime')}</span>
          <span className={`${styles.etaV} ${styles.etaOk}`}>{etaTime}</span>
        </div>
      </div>

      </div>
    </div>
  );
}
