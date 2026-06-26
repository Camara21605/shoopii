/*
 * SummaryPanel.tsx — Panneau récapitulatif professionnel
 */
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
  onToast:    (m: string) => void;
  onConfirm:  () => void;
}

export default function SummaryPanel({
  items, delMode, selLvrObj, corrFee, curSpd,
  promoActif, etaDest, loading, onToast, onConfirm,
}: Props) {
  const sub   = items.reduce((s, i) => s + i.price * i.qty, 0);
  const lv    = selLvrObj;
  const lvFee = lv ? lvFeeCalc(lv.base, SPEEDS[curSpd].m) : 0;
  const disc  = promoActif ? Math.round(sub * 0.2) : 0;
  const total = sub + lvFee + corrFee - disc;
  const sp    = SPEEDS[curSpd];

  const etaMode = delMode === 'std'
    ? 'Livraison standard'
    : lv ? `${lv.em} ${lv.nm} · ${sp.l}` : 'Non sélectionné';
  const etaTime = delMode === 'std' ? '24 – 48h' : lv ? sp.e : '—';

  return (
    <div>
      {/* ── Handle mobile ── */}
      <div className={styles.drawerHandle} />

      {/* ── Carte principale ── */}
      <div className={styles.card}>

        {/* Titre */}
        <div className={styles.titre}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}>
            <i className="fas fa-receipt" style={{ color:'#1A4FC4', fontSize:13 }} />
            Récapitulatif
          </span>
          <span onClick={() => onToast('✏️ Modification du panier')}>Modifier</span>
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
              Sous-total ({items.length} article{items.length > 1 ? 's' : ''})
            </span>
            <span className={styles.rowV}>{fmt(sub)}</span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowL}>
              <i className="fas fa-truck" />
              Livraison
            </span>
            <span className={`${styles.rowV} ${(delMode === 'std' || lvFee === 0) ? styles.free : ''}`}>
              {delMode === 'std' || lvFee === 0 ? '✓ Gratuite' : fmt(lvFee)}
            </span>
          </div>

          {corrFee > 0 && (
            <div className={styles.row}>
              <span className={styles.rowL}><i className="fas fa-map-pin" /> Correspondant</span>
              <span className={`${styles.rowV} ${styles.corr}`}>{fmt(corrFee)}</span>
            </div>
          )}

          {promoActif && (
            <div className={styles.row}>
              <span className={styles.rowL}><i className="fas fa-tag" /> Promo SHOPI20</span>
              <span className={`${styles.rowV} ${styles.disc}`}>−{fmt(disc)}</span>
            </div>
          )}

          <div className={styles.divider} />
        </div>

        {/* Total */}
        <div className={styles.totalRow}>
          <span className={styles.totalL}>Total à payer</span>
          <span className={styles.totalV}>{fmt(total)}</span>
        </div>

        {/* Bouton confirmer */}
        <button
          className={`${styles.btnPlace} ${loading ? styles.loading : ''}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? (
            <><i className="fas fa-circle-notch" /> Traitement en cours…</>
          ) : (
            <><i className="fas fa-shield-check" /> Confirmer la commande</>
          )}
        </button>

        {/* Garanties */}
        <div className={styles.guarantees}>
          <div className={`${styles.g} ${styles.gGreen}`}>
            <i className="fas fa-lock" /> Paiement sécurisé SSL 256-bit
          </div>
          <div className={`${styles.g} ${styles.gBlue}`}>
            <i className="fas fa-rotate-left" /> Retour gratuit sous 7 jours
          </div>
          <div className={`${styles.g} ${styles.gAmber}`}>
            <i className="fas fa-shield-check" /> Protection acheteur Shopi
          </div>
        </div>
      </div>

      {/* ── Carte ETA ── */}
      <div className={styles.etaCard}>
        <div className={styles.etaTitre}>
          <i className="fas fa-map-location-dot" style={{ color:'#1A4FC4' }} />
          Estimation de livraison
        </div>
        <div className={styles.etaRow}>
          <span className={styles.etaL}>Mode</span>
          <span className={styles.etaV}>{etaMode}</span>
        </div>
        <div className={styles.etaRow}>
          <span className={styles.etaL}>Destination</span>
          <span className={styles.etaV}>{etaDest}</span>
        </div>
        <div className={styles.etaRow}>
          <span className={styles.etaL}>Délai estimé</span>
          <span className={`${styles.etaV} ${styles.etaOk}`}>{etaTime}</span>
        </div>
      </div>
    </div>
  );
}
