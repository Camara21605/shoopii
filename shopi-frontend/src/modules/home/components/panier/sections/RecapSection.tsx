/*
 * ============================================================
 * FICHIER : src/modules/home/components/panier/sections/RecapSection.tsx
 *
 * RÔLE    : Section "Récapitulatif & Confirmation" — étape 4.
 *
 * ✅ DYNAMIQUE : reçoit l'objet livreur sélectionné (selLvrObj)
 *    au lieu de le chercher dans le mock LIVREURS.
 * ============================================================
 */
import { useTranslation } from 'react-i18next';
import { CORRESPONDANTS, SPEEDS, fmt } from '../data/panierData';
import type { CartItem } from '../data/panierData';
import type { LivreurSuivi } from '../services/livreursSuivis.api';
import type { ProfilData, AdresseItem } from '../../settings/api/settings.api';
import styles from '../styles/RecapSection.module.css';

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
  const { t } = useTranslation();
  const PAY_LBL: Record<string,string> = {
    omo: t('panierCommande.recapSection.payLabels.omo'),
    mtn: t('panierCommande.recapSection.payLabels.mtn'),
    card: t('panierCommande.recapSection.payLabels.card'),
    cash: t('panierCommande.recapSection.payLabels.cash'),
    wire: t('panierCommande.recapSection.payLabels.wire'),
    wallet: t('panierCommande.recapSection.payLabels.wallet'),
  };
  const lv = selLvrObj;
  const co = selCorr ? CORRESPONDANTS.find(c => c.id === selCorr) : null;
  const sp = SPEEDS[curSpd];

  return (
    <div className={styles.sc}>
      {/* En-tête navy */}
      <div className={styles.scHd}>
        <div className={styles.scNum}>4</div>
        <div>
          <div className={styles.scTitre}>{t('panierCommande.recapSection.titre')}</div>
          <div className={styles.scSub}>{t('panierCommande.recapSection.sub')}</div>
        </div>
      </div>

      <div className={styles.scBody}>
        {/* Grille 2 cases */}
        <div className={styles.grid}>
          {/* Destinataire */}
          <div className={styles.box}>
            <div className={`${styles.boxTitle} ${styles.blue}`}><i className="fas fa-user" /> {t('panierCommande.recapSection.destinataire')}</div>
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
              <div className={styles.boxSub}>{t('panierCommande.recapSection.infosNonDisponibles')}</div>
            )}
          </div>
          {/* Livraison */}
          <div className={styles.box}>
            <div className={`${styles.boxTitle} ${styles.teal}`}><i className="fas fa-truck" /> {t('panierCommande.recapSection.livraison')}</div>
            <div className={styles.boxVal}>
              {delMode === 'std' ? t('panierCommande.recapSection.standard') : lv ? `${lv.em} ${lv.nm}` : t('panierCommande.recapSection.nonSelectionne')}
            </div>
            <div className={styles.boxSub}>
              {delMode === 'lvr' && lv ? `${sp.l} · ${sp.e}` : t('panierCommande.recapSection.gratuiteDelai')}
              {co ? <><br />{t('panierCommande.recapSection.correspondantLabel', { nom: co.nm })}</> : null}
            </div>
          </div>
        </div>

        {/* Paiement */}
        <div className={styles.box} style={{ marginTop:0 }}>
          <div className={`${styles.boxTitle} ${styles.green}`}><i className="fas fa-credit-card" /> {t('panierCommande.recapSection.paiement')}</div>
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
              {t('panierCommande.recapSection.termsPart1')}{' '}
              <a href="#" onClick={e => e.preventDefault()}>{t('panierCommande.recapSection.cgv')}</a>,
              {' '}{t('panierCommande.recapSection.termsPart2')} <a href="#" onClick={e => e.preventDefault()}>{t('panierCommande.recapSection.politiqueRetour')}</a>{' '}
              {t('panierCommande.recapSection.termsPart3')}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}