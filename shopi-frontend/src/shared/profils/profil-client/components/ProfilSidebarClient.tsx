/* ================================================================
 * FICHIER : profil-client/components/ProfilSidebarClient.tsx
 *
 * Colonne latérale : Wallet, points Gold,
 * méthodes de paiement, infos personnelles.
 * Toutes les données viennent de /client/profil via useProfilClient.
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/ProfilClient.module.css';
import type { PayMethod, InfoRow } from '../data/profilClientData';
import PortefeuilleStandalone from '../../../components/portefeuille/PortefeuilleStandalone';

const fmtGnf = (n: number | undefined | null) =>
  n != null ? n.toLocaleString('fr-FR') + ' GNF' : '—';

/* Points simplifiés venant du hook (sous-ensemble de PointsData) */
interface PointsLite {
  solde: number; gagnesMois: number; utilises: number; expiration: string | null;
}
interface WalletLite { solde: number; }

interface Props {
  onToast: (m: string, t?: 's' | 'i' | 'w' | 'e') => void;
  pays?:   PayMethod[];
  infos?:  InfoRow[];
  points?: PointsLite;
  wallet?: WalletLite;
}

export default function ProfilSidebarClient({
  onToast,
  pays   = [],
  infos  = [],
  points,
  wallet,
}: Props) {

  const [walletOpen, setWalletOpen] = useState(false);

  const soldeWallet   = wallet?.solde      ?? 0;
  const ptsSolde      = points?.solde      ?? 0;
  const ptsGagnes     = points?.gagnesMois ?? 0;

  return (
    <aside className={styles.sidebar}>

      {/* ── WALLET ── */}
      <div className={styles.walletCard}>
        <div className={styles.walletLabel}>Solde disponible · Shopi Wallet</div>
        <div className={styles.walletSolde}>{soldeWallet.toLocaleString('fr-FR')}</div>
        <div className={styles.walletDevise}>GNF · Franc Guinéen</div>
        <div className={styles.walletBtns}>
          {[
            { i: 'fa-plus',              l: 'Recharger', a: () => onToast('💳 Recharger le wallet') },
            { i: 'fa-paper-plane',       l: 'Envoyer',   a: () => onToast("📤 Envoyer de l'argent") },
            { i: 'fa-arrow-down',        l: 'Retirer',   a: () => onToast('📥 Retrait') },
            { i: 'fa-clock-rotate-left', l: 'Histo.',    a: () => onToast('📜 Historique wallet') },
          ].map(b => (
            <button key={b.l} className={styles.walletBtn} onClick={b.a}>
              <i className={`fas ${b.i}`} /> {b.l}
            </button>
          ))}
        </div>
        <button className={styles.walletManageBtn} onClick={() => setWalletOpen(true)}>
          <i className="fas fa-wallet" /> Gérer mon portefeuille
        </button>
      </div>

      {/* ── DERNIÈRES TRANSACTIONS ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.ct}><i className="fas fa-receipt" /> Dernières transactions</div>
        </div>
        <div className={styles.cb}>
          <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--t3)', fontSize: 12 }}>
            <i className="fas fa-receipt" style={{ display: 'block', fontSize: 22, marginBottom: 8, opacity: 0.3 }} />
            Gérez votre portefeuille pour voir l'historique des transactions.
          </div>
        </div>
      </div>

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

      {/* ── MODAL : gestion complète du portefeuille ── */}
      {walletOpen && (
        <div className={styles.walletModalBg} onClick={(e) => { if (e.target === e.currentTarget) setWalletOpen(false); }}>
          <div className={styles.walletModalBox}>
            <button className={styles.walletModalClose} onClick={() => setWalletOpen(false)}>
              <i className="fas fa-xmark" />
            </button>
            <PortefeuilleStandalone />
          </div>
        </div>
      )}
    </aside>
  );
}