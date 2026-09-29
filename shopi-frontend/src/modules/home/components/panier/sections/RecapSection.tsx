/*
 * ============================================================
 * FICHIER : src/modules/home/components/panier/sections/RecapSection.tsx
 *
 * RÔLE    : Étape 4 — Vérification avant confirmation.
 *
 * Affiche ce qui sera RÉELLEMENT envoyé : le destinataire et l'adresse SAISIS
 * dans le formulaire (avant : le profil et l'adresse par défaut, même quand le
 * client avait tapé une autre adresse) et le mode de livraison choisi.
 * Les montants ne sont pas répétés ici — ils sont dans le récapitulatif.
 * ============================================================
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LivreurSuivi } from '../services/livreursSuivis.api';
import { lieuLivraison, type AdresseFormData } from './AdresseSection';
import styles from '../styles/RecapSection.module.css';

interface Props {
  adresse:   AdresseFormData | null;
  delMode:   'std' | 'lvr';
  /** Libellé réel du mode « par la boutique » (livraison / retrait / les deux). */
  stdLabel:  string;
  selLvrObj: LivreurSuivi | null;
  termsOk:   boolean;
  onTerms:   (v: boolean) => void;
}

export default function RecapSection({ adresse, delMode, stdLabel, selLvrObj, termsOk, onTerms }: Props) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, string>) => t(`panierCommande.v2.verif.${key}`, o);

  const a = adresse;
  const nom   = a ? `${a.prenom} ${a.nom}`.trim() : '';
  const lieu  = [a?.adressePrecise, lieuLivraison(a?.ville, a?.commune)].filter(Boolean).join(', ');

  return (
    <div className={styles.sc}>
      <div className={styles.scHd}>
        <div className={styles.scNum}>4</div>
        <div>
          <div className={styles.scTitre}>{k('titre')}</div>
          <div className={styles.scSub}>{k('sub')}</div>
        </div>
      </div>

      <div className={styles.scBody}>
        <div className={styles.grid}>
          {/* Destinataire : exactement ce qui a été saisi */}
          <div className={styles.box}>
            <div className={`${styles.boxTitle} ${styles.blue}`}><i className="fas fa-user" /> {k('destinataire')}</div>
            {nom && a?.telephone ? (
              <>
                <div className={styles.boxVal}>{nom}</div>
                <div className={styles.boxSub}>
                  +224 {a.telephone}
                  {lieu && <><br />{lieu}</>}
                  {a.instructions && <><br /><i className="fas fa-comment" style={{ marginRight: 4 }} />{a.instructions}</>}
                </div>
              </>
            ) : (
              <div className={styles.boxSub}>{k('aCompleter')}</div>
            )}
          </div>

          {/* Livraison choisie */}
          <div className={styles.box}>
            <div className={`${styles.boxTitle} ${styles.teal}`}><i className="fas fa-truck" /> {k('livraison')}</div>
            <div className={styles.boxVal}>
              {delMode === 'std' ? stdLabel : selLvrObj ? k('livreur', { nom: selLvrObj.nm }) : k('livreurAChoisir')}
            </div>
          </div>
        </div>

        <div className={styles.terms}>
          <label className={styles.termsLabel}>
            <input
              type="checkbox"
              style={{ accentColor: 'var(--cart-blue, #1A4FC4)', marginTop: 2, flexShrink: 0 }}
              checked={termsOk}
              onChange={e => onTerms(e.target.checked)}
            />
            <span>
              {k('conditions')}{' '}
              <Link to="/politique-retour" target="_blank" rel="noopener">{k('politiqueRetour')}</Link>
              {k('debit')}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
