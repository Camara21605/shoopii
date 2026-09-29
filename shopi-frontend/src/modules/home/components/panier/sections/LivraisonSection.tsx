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
 * RÉGLAGES DES BOUTIQUES : chaque option suit Paramètres > Livraison des
 * boutiques du panier (livraison standard / retrait / livreurs Shoneya /
 * zones desservies) — grisée avec le nom de la boutique qui ne la propose pas.
 *
 * TARIF RÉEL : celui de la zone couvrant l'adresse (GeoZone.fraisLivraison),
 * facturé une fois PAR BOUTIQUE — exactement ce que fait le serveur
 * (commande-creation.service). Plus de « vitesse » (Éco, Express… ×1,3 à ×2,5)
 * ni de délais inventés : le serveur ne les appliquait pas, le montant affiché
 * ne correspondait donc pas au montant débité.
 * ============================================================
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { STD_LIBELLES, type ModesLivraison } from '../data/livraisonModes';
import { useTranslation } from 'react-i18next';
import { fmt } from '../data/panierData';
import type { LivreurSuivi } from '../services/livreursSuivis.api';
import styles from '../styles/LivraisonSection.module.css';

interface Props {
  delMode:  'std' | 'lvr';
  /** Modes permis par les réglages de livraison des boutiques du panier (voir livraisonModes.ts). */
  modes:    ModesLivraison;
  /** Commune de l'adresse saisie (zones desservies par la boutique). */
  commune:  string | null;
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
  delMode, modes, commune, selLvr, livreurs, loadingLivreurs = false, zoneFee, shopCount, onDel, onSelLvr,
}: Props) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, string>) => t(`panierCommande.v2.livraison.${key}`, o);

  const tarif = zoneFee == null
    ? k('tarifSelonAdresse')
    : zoneFee === 0
      ? k('gratuite')
      : shopCount > 1 ? k('parBoutique', { montant: fmt(zoneFee) }) : fmt(zoneFee);

  /* Libellé « par la boutique » selon ce que proposent réellement les boutiques */
  const stdTitre = k(STD_LIBELLES[modes.std.genre].titre);
  const stdDesc  = k(STD_LIBELLES[modes.std.genre].desc);

  /* Une carte de mode : grisée et non sélectionnable si une boutique du panier
   * ne le propose pas (le serveur refuserait la commande). */
  const option = (m: 'std' | 'lvr', icon: string, titre: string, desc: string, prix: ReactNode) => {
    const dispo = modes[m];
    const sel   = delMode === m && dispo.ok;
    const pick  = () => { if (dispo.ok) onDel(m); };
    return (
      <div
        role="radio" aria-checked={sel} aria-disabled={!dispo.ok} tabIndex={dispo.ok ? 0 : -1}
        className={`${styles.delOpt} ${sel ? styles.delOptSel : ''} ${dispo.ok ? '' : styles.delOptOff}`}
        onClick={pick}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}
      >
        <div className={`${styles.delRadio} ${sel ? styles.delRadioOn : ''}`} />
        <div className={styles.delIcon}>{icon}</div>
        <div className={styles.delTitre}>{titre}</div>
        <div className={styles.delSub}>{desc}</div>
        {dispo.ok ? prix : <span className={styles.delIndispo}>{k('indispo', { boutiques: dispo.bloquees.join(', ') })}</span>}
      </div>
    );
  };

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
          {option('std', modes.std.genre === 'retrait' ? '🏬' : '🏪', stdTitre, stdDesc,
            <span className={`${styles.delPrice} ${styles.delPriceFree}`}>{k('gratuite')}</span>)}
          {option('lvr', '🛵', k('livreurTitre'), k('livreurDesc'),
            <span className={`${styles.delPrice} ${styles.delPriceTeal}`}>{tarif}</span>)}
        </div>

        {!modes.std.ok && !modes.lvr.ok && (
          <div className={styles.delNote} role="alert"><i className="fas fa-triangle-exclamation" /> {k('aucunMode')}</div>
        )}
        {delMode === 'std' && modes.std.ok && commune && modes.std.horsZone.length > 0 && (
          <div className={styles.delNote}>
            <i className="fas fa-circle-info" /> {k('horsZone', { boutiques: modes.std.horsZone.join(', '), commune })}
          </div>
        )}

        {delMode === 'lvr' && modes.lvr.ok && (
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
