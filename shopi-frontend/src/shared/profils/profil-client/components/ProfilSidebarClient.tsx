/* ================================================================
 * FICHIER : profil-client/components/ProfilSidebarClient.tsx
 *
 * Colonne latérale : points Gold, méthodes de paiement, infos
 * personnelles. Toutes les données viennent de /client/profil via
 * useProfilClient.
 *
 * Le solde du portefeuille (ex-carte "Shopi Wallet" ici) n'est plus
 * dupliqué sur cette page — il est accessible partout via le widget
 * compact du tiroir de menu (WalletQuickBar, voir Header.tsx), qui
 * pointe vers la page portefeuille complète du dashboard client.
 * ================================================================ */

import styles from '../styles/ProfilClient.module.css';
import type { PayMethod, InfoRow } from '../data/profilClientData';

/* Points simplifiés venant du hook (sous-ensemble de PointsData) */
interface PointsLite {
  solde: number; gagnesMois: number; utilises: number; expiration: string | null;
}

interface Props {
  onToast: (m: string, t?: 's' | 'i' | 'w' | 'e') => void;
  pays?:   PayMethod[];
  infos?:  InfoRow[];
  points?: PointsLite;
}

export default function ProfilSidebarClient({
  onToast,
  pays   = [],
  infos  = [],
  points,
}: Props) {

  const ptsSolde      = points?.solde      ?? 0;
  const ptsGagnes     = points?.gagnesMois ?? 0;

  return (
    <aside className={styles.sidebar}>

      {/* ── POINTS GOLD ── */}
      <div className={styles.pointsCard}>
        <div className={styles.walletLabel} style={{ opacity: .85 }}>
          <i className="fas fa-crown" /> Points ShopiGold
        </div>
        <div className={styles.pointsSolde}>{ptsSolde.toLocaleString('fr-FR')} pts</div>
        {ptsGagnes > 0 && (
          <div className={styles.pointsSub}>
            +{ptsGagnes} pts ce mois{points?.expiration ? ` · Expire ${points.expiration}` : ''}
          </div>
        )}
      </div>

      {/* ── MÉTHODES DE PAIEMENT (dynamique) ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.ct}><i className="fas fa-wallet" /> Méthodes de paiement</div>
          <button className={styles.chLink} onClick={() => onToast('➕ Ajouter une méthode')}>Ajouter</button>
        </div>
        <div className={styles.cb}>
          {pays.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--t3)', textAlign: 'center', padding: '8px 0' }}>
              Aucune méthode enregistrée.
            </div>
          ) : pays.map(m => (
            <div key={m.id} className={styles.payRow}>
              <span className={styles.payEmo}>{m.emoji}</span>
              <div className={styles.payInf}>
                <div className={styles.payNm}>{m.nom}</div>
                <div className={styles.payDetail}>{m.detail}</div>
              </div>
              <span className={styles.payTag}>{m.tag}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── INFOS PERSONNELLES (dynamique) ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.ct}><i className="fas fa-id-card" /> Informations personnelles</div>
          <button className={styles.chLink} onClick={() => onToast('✏️ Modifier les infos')}>Modifier</button>
        </div>
        <div className={styles.cb}>
          {infos.map(row => (
            <div key={row.label} className={styles.infoRow}>
              <span className={styles.infoLbl}>{row.label}</span>
              <span className={styles.infoVal}>
                {row.valeur}
                {row.verifie && <i className="fas fa-circle-check" style={{ color: '#10B981', fontSize: 11, marginLeft: 5 }} />}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
