/*
 * SummaryPanel.tsx — Récapitulatif (colonne droite) : montants et confirmation
 *
 * Uniquement les MONTANTS réellement débités — les articles sont déjà listés à
 * gauche et la livraison est décrite dans sa section : rien n'est répété ici.
 * Le frais de livraison vient de CommandePage (tarif de la zone × nombre de
 * boutiques, exactement ce que facture le serveur — voir commande-creation.service).
 *
 * Sur mobile (≤768px), le panneau devient une feuille fixe en bas d'écran,
 * repliée par défaut (seuls le total et le bouton restent visibles).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmt } from '../data/panierData';
import styles from '../styles/SummaryPanel.module.css';

interface Props {
  articleCount:  number;
  sousTotal:     number;
  /** Frais de livraison réellement facturé (0 = gratuit). */
  fraisLivraison: number;
  /** Nombre de boutiques (= nombre de commandes créées). */
  shopCount:     number;
  /** true tant que le tarif dépend encore d'un choix (livreur à choisir). */
  fraisAChoisir: boolean;
  total:         number;
  walletBalance: number | null;
  loadingWallet: boolean;
  loading:       boolean;
  onConfirm:     () => void;
  onEdit:        () => void;
}

export default function SummaryPanel({
  articleCount, sousTotal, fraisLivraison, shopCount, fraisAChoisir, total,
  walletBalance, loadingWallet, loading, onConfirm, onEdit,
}: Props) {
  const { t } = useTranslation();
  const k = (key: string) => `panierCommande.v2.resume.${key}`;
  const [expanded, setExpanded] = useState(false);
  const insuffisant = !loadingWallet && walletBalance != null && walletBalance < total;

  return (
    <div className={expanded ? styles.sheetOpen : styles.sheetClosed}>

      {/* Barre de bascule (mobile uniquement) */}
      <button type="button" className={styles.toggleBar} onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>
        <span className={styles.drawerHandle} />
        <span className={styles.toggleRow}>
          <span className={styles.toggleLabel}>
            <i className="fas fa-receipt" />
            {t(k('total'))}
            <strong className={styles.toggleTotal}>{fmt(total)}</strong>
          </span>
          <i className={`fas ${expanded ? 'fa-chevron-down' : 'fa-chevron-up'} ${styles.toggleChevron}`} />
        </span>
      </button>

      <div className={styles.sheetBody}>
        <div className={styles.card}>

          <div className={styles.titre}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-receipt" style={{ color: 'var(--cart-blue, #1A4FC4)', fontSize: 13 }} />
              {t(k('titre'))}
            </span>
            <span onClick={onEdit} role="button" tabIndex={0}>{t(k('modifier'))}</span>
          </div>

          <div className={styles.rows}>
            <div className={styles.row}>
              <span className={styles.rowL}>{t(k('sousTotal'), { count: articleCount })}</span>
              <span className={styles.rowV}>{fmt(sousTotal)}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.rowL}>
                {shopCount > 1 ? t(k('livraisonBoutiques'), { count: shopCount }) : t(k('livraison'))}
              </span>
              <span className={`${styles.rowV} ${fraisLivraison === 0 && !fraisAChoisir ? styles.free : ''}`}>
                {fraisAChoisir ? '—' : fraisLivraison === 0 ? t('panierCommande.v2.livraison.gratuite') : fmt(fraisLivraison)}
              </span>
            </div>
            <div className={styles.divider} />
          </div>

          <div className={styles.totalRow}>
            <span className={styles.totalL}>{t(k('total'))}</span>
            <span className={styles.totalV}>{fmt(total)}</span>
          </div>

          {/* Portefeuille : le paiement est prélevé sur ce solde */}
          <div className={styles.rows}>
          <div className={styles.row}>
            <span className={styles.rowL}><i className="fas fa-wallet" /> {t(k('solde'))}</span>
            <span className={styles.rowV} style={loadingWallet || walletBalance == null ? undefined : { color: insuffisant ? '#DC2626' : '#047857', fontWeight: 800 }}>
              {loadingWallet ? t(k('chargement')) : walletBalance != null ? fmt(walletBalance) : '—'}
            </span>
          </div>
          {insuffisant && (
            <div className={styles.row} style={{ marginTop: -4 }}>
              <span style={{ fontSize: 11.5, color: '#DC2626', fontWeight: 600 }}>
                <i className="fas fa-triangle-exclamation" style={{ marginRight: 5 }} />{t(k('soldeInsuffisant'))}
              </span>
            </div>
          )}
          </div>

          <button className={`${styles.btnPlace} ${loading ? styles.loading : ''}`} onClick={onConfirm} disabled={loading}>
            {loading
              ? <><i className="fas fa-circle-notch" /> {t(k('traitement'))}</>
              : <><i className="fas fa-check" /> {t(k('confirmer'))}</>}
          </button>

          <p style={{ margin: '10px 16px 14px', fontSize: 11.5, lineHeight: 1.45, color: 'var(--cart-t3, #64748B)', textAlign: 'center' }}>
            {t(k('debitInfo'))}
          </p>
        </div>
      </div>
    </div>
  );
}
