/* ================================================================
 * FICHIER : profil-client/components/ProfilSidebarClient.tsx
 *
 * Colonne latérale : Wallet, transactions, points Gold,
 * méthodes de paiement, infos personnelles.
 *
 * DONNÉES :
 *   ✅ props (dynamiques) : pays (paiement), infos, points, wallet
 *   🟡 mock : transactions wallet (pas encore d'endpoint dédié)
 *
 * Les props ont des valeurs par défaut (mock) → le composant
 * fonctionne même si la page ne les fournit pas encore.
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/ProfilClient.module.css';
import {
  WALLET as MOCK_WALLET,
  TRANSACTIONS,
  POINTS as MOCK_POINTS,
  PAY_METHODS as MOCK_PAY,
  INFOS as MOCK_INFOS,
  fmtGnf,
} from '../data/profilClientData';
import type { PayMethod, InfoRow } from '../data/profilClientData';
import PortefeuilleStandalone from '../../../components/portefeuille/PortefeuilleStandalone';

/* Points simplifiés venant du hook (sous-ensemble de PointsData) */
interface PointsLite {
  solde: number; gagnesMois: number; utilises: number; expiration: string | null;
}
interface WalletLite { solde: number; }

interface Props {
  onToast: (m: string, t?: 's' | 'i' | 'w' | 'e') => void;
  /* Dynamiques (optionnels → fallback mock) */
  pays?:   PayMethod[];
  infos?:  InfoRow[];
  points?: PointsLite;
  wallet?: WalletLite;
}

export default function ProfilSidebarClient({
  onToast,
  pays   = MOCK_PAY,
  infos  = MOCK_INFOS,
  points,
  wallet,
}: Props) {

  /* Modal de gestion complète du portefeuille */
  const [walletOpen, setWalletOpen] = useState(false);

  /* Solde wallet : dynamique si fourni, sinon mock */
  const soldeWallet = wallet?.solde ?? MOCK_WALLET.solde;

  /* Points : dynamiques si fournis, sinon mock.
     prochainSeuil reste mock (logique de paliers non encore en base). */
  const ptsSolde      = points?.solde      ?? MOCK_POINTS.solde;
  const ptsGagnes     = points?.gagnesMois ?? MOCK_POINTS.gagnesMois;
  const prochainSeuil = MOCK_POINTS.prochainSeuil;
  const pct           = Math.min(100, Math.round((ptsSolde / prochainSeuil) * 100));

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
        <div className={styles.walletFlux}>
          <div><div className={styles.wfLbl}>Entrées ce mois</div><div className={`${styles.wfVal} ${styles.wfIn}`}>+ {fmtGnf(MOCK_WALLET.entreesMois)}</div></div>
          <div><div className={styles.wfLbl}>Sorties ce mois</div><div className={`${styles.wfVal} ${styles.wfOut}`}>− {fmtGnf(MOCK_WALLET.sortiesMois)}</div></div>
        </div>

        <button className={styles.walletManageBtn} onClick={() => setWalletOpen(true)}>
          <i className="fas fa-wallet" /> Gérer mon portefeuille
        </button>
      </div>

      {/* ── DERNIÈRES TRANSACTIONS (mock) ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.ct}><i className="fas fa-receipt" /> Dernières transactions</div>
        </div>
        <div className={styles.cb}>
          {TRANSACTIONS.map(t => (
            <div key={t.id} className={styles.txRow}>
              <div>
                <div className={styles.txLbl}>{t.label}</div>
                <div className={styles.txDate}>{t.date}</div>
              </div>
              <div className={`${styles.txMontant} ${t.montant >= 0 ? styles.txIn : styles.txOut}`}>
                {t.montant >= 0 ? '+' : '−'} {fmtGnf(Math.abs(t.montant))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── POINTS GOLD (dynamique) ── */}
      <div className={styles.pointsCard}>
        <div className={styles.walletLabel} style={{ opacity: .85 }}>
          <i className="fas fa-crown" /> Points ShopiGold
        </div>
        <div className={styles.pointsSolde}>{ptsSolde.toLocaleString('fr-FR')} pts</div>
        <div className={styles.pointsSub}>
          +{ptsGagnes} pts ce mois{points?.expiration ? ` · Expire ${points.expiration}` : ''}
        </div>
        <div className={styles.pointsBar}>
          <div className={styles.pointsBarFill} style={{ width: `${pct}%` }} />
        </div>
        <div className={styles.pointsNiveau}>
          Niveau {MOCK_POINTS.niveau} · {MOCK_POINTS.prochainNiveau} à {prochainSeuil.toLocaleString('fr-FR')} pts
        </div>
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