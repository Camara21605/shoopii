/*
 * ============================================================
 * FICHIER : src/modules/home/components/panier/sections/RecapSection.tsx
 *
 * RÔLE    : Section "Récapitulatif & Confirmation" — étape 5.
 *
 * ✅ DYNAMIQUE : reçoit l'objet livreur sélectionné (selLvrObj)
 *    au lieu de le chercher dans le mock LIVREURS.
 * ============================================================
 */
import React from 'react';
import { CORRESPONDANTS, SPEEDS, fmt } from '../data/panierData';
import type { CartItem } from '../data/panierData';
import type { LivreurSuivi } from '../services/livreursSuivis.api';
import type { ProfilData, AdresseItem } from '../../settings/api/settings.api';
import styles from '../styles/RecapSection.module.css';

const PAY_LBL: Record<string,string> = {
  omo:'Orange Money 🏦', mtn:'MTN Money 💛', card:'Carte bancaire 💳',
  cash:'À la livraison 💵', wire:'Virement 🏛️', wallet:'Wallet Shopi 👛',
};

interface Props {
  items:         CartItem[];
  delMode:       'std' | 'lvr';
  selLvrObj:     LivreurSuivi | null;
  selCorr:       number | null;
  curSpd:        string;
  payMode:       string;
  promoActif:    boolean;
  total:         number;
  termsOk:       boolean;
  onTerms:       (v: boolean) => void;
  clientProfil:  ProfilData | null;
  clientAddr:    AdresseItem | null;
  loadingClient: boolean;
}

export default function RecapSection({
  items, delMode, selLvrObj, selCorr, curSpd,
  payMode, promoActif, total, termsOk, onTerms,
  clientProfil, clientAddr, loadingClient,
}: Props) {
  const lv = selLvrObj;
  const co = selCorr ? CORRESPONDANTS.find(c => c.id === selCorr) : null;
  const sp = SPEEDS[curSpd];

  return (
    <div className={styles.sc}>
      {/* En-tête navy */}
      <div className={styles.scHd}>
        <div className={styles.scNum}>5</div>
        <div>
          <div className={styles.scTitre}>Récapitulatif &amp; Confirmation</div>
          <div className={styles.scSub}>Vérifiez tous les détails avant de confirmer</div>
        </div>
      </div>

      <div className={styles.scBody}>
        {/* Grille 2 cases */}
        <div className={styles.grid}>
          {/* Destinataire */}
          <div className={styles.box}>
            <div className={`${styles.boxTitle} ${styles.blue}`}><i className="fas fa-user" /> Destinataire</div>
            {loadingClient ? (
              <>
                <div className={styles.skelLine} style={{ width: '70%', height: 16, marginBottom: 6 }} />
                <div className={styles.skelLine} style={{ width: '90%', height: 13 }} />
              </>
            ) : clientProfil ? (
              <>
                <div className={styles.boxVal}>
                  {clientProfil.firstName} {clientProfil.lastName}
                </div>
                <div className={styles.boxSub}>
                  {clientProfil.phone}
                  {clientAddr && (
                    <><br />{clientAddr.commune ? `${clientAddr.commune} — ` : ''}{clientAddr.adresse}</>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.boxSub}>Informations non disponibles</div>
            )}
          </div>
          {/* Livraison */}
          <div className={styles.box}>
            <div className={`${styles.boxTitle} ${styles.teal}`}><i className="fas fa-truck" /> Livraison</div>
            <div className={styles.boxVal}>
              {delMode === 'std' ? '🚚 Standard' : lv ? `${lv.em} ${lv.nm}` : '⚠️ Non sélectionné'}
            </div>
            <div className={styles.boxSub}>
              {delMode === 'lvr' && lv ? `${sp.l} · ${sp.e}` : 'Gratuite · 24–48h'}
              {co ? <><br />📍 Correspondant : {co.nm}</> : null}
            </div>
          </div>
        </div>

        {/* Paiement */}
        <div className={styles.box} style={{ marginTop:0 }}>
          <div className={`${styles.boxTitle} ${styles.green}`}><i className="fas fa-credit-card" /> Paiement</div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div className={styles.boxVal}>{PAY_LBL[payMode] || '—'}</div>
            <div className={styles.totalVal}>{fmt(total)}</div>
          </div>
        </div>

        {/* CGV */}
        <div className={styles.terms}>
          <label className={styles.termsLabel}>
            <input
              type="checkbox"
              style={{ accentColor:'#1A4FC4', marginTop:2, flexShrink:0 }}
              checked={termsOk}
              onChange={e => onTerms(e.target.checked)}
            />
            <span>
              J'accepte les{' '}
              <a href="#" onClick={e => e.preventDefault()}>conditions générales de vente</a>,
              la <a href="#" onClick={e => e.preventDefault()}>politique de retour</a>{' '}
              et j'autorise Shopi à traiter mon paiement.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}