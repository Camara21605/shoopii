/*
 * ============================================================
 * FICHIER : src/modules/home/components/panier/sections/LivraisonSection.tsx
 *
 * RÔLE    : Section "Mode de livraison" — étape 3.
 *
 *   Option 1 — Livraison standard (gratuite, gérée par la boutique)
 *   Option 2 — Choisir un livreur :
 *     - Sélecteur vitesse : Éco 🐢 / Standard 🚴 / Express 🚀 / Ultra ⚡
 *     - Liste des livreurs SUIVIS par le client (API)
 *     - Badges source
 *   Bloc correspondant (si boutique internationale — prop showCorr)
 *
 * ✅ DYNAMIQUE :
 *   Les livreurs proposés sont ceux auxquels le client est ABONNÉ
 *   (prop `livreurs`, chargée par CommandePage via /suivis/mes-abonnements).
 *   Si la liste est vide → message invitant à suivre des livreurs.
 * ============================================================
 */
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { CORRESPONDANTS, SPEEDS, fmt, lvFeeCalc } from '../data/panierData';
import type { LivreurSuivi } from '../services/livreursSuivis.api';
import styles from '../styles/LivraisonSection.module.css';

interface Props {
  delMode:  'std' | 'lvr';
  selLvr:   string | null;        /* ✅ id livreur = string (UUID) */
  selCorr:  number | null;
  curSpd:   string;
  showCorr: boolean;              /* true si boutique hors continent */
  livreurs: LivreurSuivi[];       /* ✅ livreurs suivis (dynamique) */
  loadingLivreurs?: boolean;      /* ✅ état de chargement */
  onDel:    (m: 'std' | 'lvr') => void;
  onSelLvr: (id: string) => void; /* ✅ id = string */
  onSelCorr:(id: number) => void;
  onSpeed:  (s: string)  => void;
  onToast:  (m: string)  => void;
}

function getSpeedBtns(t: TFunction) {
  return [
    { key:'eco', em:'🐢', nm:t('panierCommande.livraisonSection.speeds.eco'),      mul:'×1.0'      },
    { key:'std', em:'🚴', nm:t('panierCommande.livraisonSection.speeds.std'),  mul:`×1.3 ${t('panierCommande.livraisonSection.recommande')}` },
    { key:'exp', em:'🚀', nm:t('panierCommande.livraisonSection.speeds.exp'),   mul:'×1.8'      },
    { key:'ult', em:'⚡', nm:t('panierCommande.livraisonSection.speeds.ult'),     mul:'×2.5'      },
  ];
}

export default function LivraisonSection({
  delMode, selLvr, selCorr, curSpd, showCorr,
  livreurs, loadingLivreurs = false,
  onDel, onSelLvr, onSelCorr, onSpeed, onToast,
}: Props) {
  const { t } = useTranslation();
  const SPEED_BTNS = getSpeedBtns(t);

  const spd = SPEEDS[curSpd];

  /* Prix mini pour le label de l'option livreur (0 si aucun livreur) */
  const minFee = livreurs.length
    ? Math.min(...livreurs.map(l => lvFeeCalc(l.base, spd.m)))
    : 0;

  return (
    <div className={`${styles.sc} ${styles.lit}`}>

      {/* ── En-tête ── */}
      <div className={styles.scHd}>
        <div className={styles.scNum}>3</div>
        <div>
          <div className={styles.scTitre}>{t('panierCommande.livraisonSection.titre')}</div>
          <div className={styles.scSub}>{t('panierCommande.livraisonSection.sub')}</div>
        </div>
      </div>

      <div className={styles.scBody}>

        {/* ── 2 options : standard | livreur ── */}
        <div className={styles.delGrid}>

          {/* Standard — gratuite */}
          <div
            className={`${styles.delOpt} ${delMode === 'std' ? styles.delOptSel : ''}`}
            onClick={() => onDel('std')}
          >
            <div className={`${styles.delRadio} ${delMode === 'std' ? styles.delRadioOn : ''}`} />
            <div className={styles.delIcon}>🚚</div>
            <div className={styles.delTitre}>{t('panierCommande.livraisonSection.livraisonStandard')}</div>
            <div className={styles.delSub}>{t('panierCommande.livraisonSection.gereeParBoutique')}</div>
            <span className={`${styles.delPrice} ${styles.delPriceFree}`}>{t('panierCommande.livraisonSection.gratuite')}</span>
            <div className={styles.delEta}>
              <i className="fas fa-calendar" style={{ fontSize:9 }} /> {t('panierCommande.livraisonSection.delai2448h')}
            </div>
          </div>

          {/* Livreur — tarif dynamique */}
          <div
            className={`${styles.delOpt} ${delMode === 'lvr' ? styles.delOptSel : ''}`}
            onClick={() => onDel('lvr')}
          >
            <div className={`${styles.delRadio} ${delMode === 'lvr' ? styles.delRadioOn : ''}`} />
            <div className={styles.delIcon}>🛵</div>
            <div className={styles.delTitre}>{t('panierCommande.livraisonSection.choisirLivreur')}</div>
            <div className={styles.delSub}>{t('panierCommande.livraisonSection.vosLivreursAbonnes')}</div>
            <span className={`${styles.delPrice} ${styles.delPriceTeal}`}>
              {livreurs.length ? t('panierCommande.livraisonSection.desPrix', { montant: fmt(minFee) }) : t('panierCommande.livraisonSection.aucunLivreur')}
            </span>
            <div className={styles.delEta}>
              <i className="fas fa-bolt" style={{ fontSize:9, color:'var(--teal,#0E7490)' }} />
              {t('panierCommande.livraisonSection.prixSelonDistance')}
            </div>
          </div>
        </div>

        {/* ── Panneau livreurs (visible si mode = livreur) ── */}
        {delMode === 'lvr' && (
          <div className={styles.lvrPanel}>

            {/* Titre + badges source */}
            <div className={styles.panelHd}>
              <span>
                <i className="fas fa-motorcycle" style={{ color:'var(--blue,#1A4FC4)', marginRight:4 }} />
                {t('panierCommande.livraisonSection.vosLivreursSuivis')}
              </span>
              <div className={styles.srcTags}>
                <span className={`${styles.srcTag} ${styles.srcC}`}>{t('panierCommande.livraisonSection.vosAbonnes')}</span>
              </div>
            </div>

            {/* Sélecteur vitesse */}
            <div className={styles.spdLabel}>
              <i className="fas fa-gauge" style={{ color:'var(--blue,#1A4FC4)' }} /> {t('panierCommande.livraisonSection.vitesse')}
            </div>
            <div className={styles.spdRow}>
              {SPEED_BTNS.map(s => (
                <button
                  key={s.key}
                  className={`${styles.spdBtn} ${curSpd === s.key ? styles.spdBtnOn : ''}`}
                  onClick={() => onSpeed(s.key)}
                >
                  <span className={styles.spdEm}>{s.em}</span>
                  <span>{s.nm}</span>
                  <span className={styles.spdMul}>{s.mul}</span>
                </button>
              ))}
            </div>

            {/* Liste des livreurs suivis */}
            <div className={styles.lvList}>

              {/* État chargement */}
              {loadingLivreurs && (
                <div style={{ padding:'24px 0', textAlign:'center', color:'var(--t3,#5A7A9E)', fontSize:13 }}>
                  <i className="fas fa-circle-notch fa-spin" style={{ marginRight:6 }} />
                  {t('panierCommande.livraisonSection.chargementLivreurs')}
                </div>
              )}

              {/* État vide : aucun livreur suivi */}
              {!loadingLivreurs && livreurs.length === 0 && (
                <div style={{ padding:'24px 16px', textAlign:'center', color:'var(--t3,#5A7A9E)', fontSize:13 }}>
                  <i className="fas fa-user-slash" style={{ fontSize:24, display:'block', marginBottom:10, color:'var(--t4,#96B2CC)' }} />
                  {t('panierCommande.livraisonSection.aucunLivreurSuiviPart1')}<br />
                  {t('panierCommande.livraisonSection.aucunLivreurSuiviPart2')} <strong>{t('panierCommande.livraisonSection.livreursPage')}</strong> {t('panierCommande.livraisonSection.aucunLivreurSuiviPart3')}
                </div>
              )}

              {/* Cartes livreurs */}
              {!loadingLivreurs && livreurs.map(lv => {
                const fee = lvFeeCalc(lv.base, spd.m);
                return (
                  <div
                    key={lv.id}
                    className={`${styles.lvCard} ${selLvr === lv.id ? styles.lvCardSel : ''}`}
                    onClick={() => { onSelLvr(lv.id); onToast(t('panierCommande.livraisonSection.livreurToast', { nom: lv.nm })); }}
                  >
                    {/* Avatar + indicateur online */}
                    <div className={styles.lvAvaWrap}>
                      <div className={styles.lvAva}>{lv.em}</div>
                      <div className={`${styles.lvOl} ${lv.on ? styles.lvOlOn : styles.lvOlOff}`} />
                    </div>

                    {/* Infos livreur */}
                    <div className={styles.lvInf}>
                      <div className={styles.lvNm}>{lv.nm}</div>
                      <div className={styles.lvMeta}>
                        <span><i className="fas fa-location-dot" style={{ color:'#1A4FC4' }} /> {lv.zn}</span>
                        <span><i className="fas fa-star" style={{ color:'#B45309' }} /> {lv.rt}</span>
                      </div>
                      <div className={styles.lvMeta} style={{ marginTop:3 }}>
                        <span className={`${styles.lvSrc} ${styles.lvSrcC}`}>{t('panierCommande.livraisonSection.votreAbonne')}</span>
                      </div>
                    </div>

                    {/* Tarif + ETA + radio */}
                    <div className={styles.lvRight}>
                      <div className={styles.lvFee}>{fmt(fee)}</div>
                      <div className={styles.lvEta}>
                        <i className="fas fa-clock" style={{ fontSize:9 }} /> {spd.e}
                      </div>
                      <div className={`${styles.lvRadio} ${selLvr === lv.id ? styles.lvRadioOn : ''}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Bloc Correspondant (boutique internationale) ── */}
        {showCorr && (
          <div className={styles.corrBlk}>
            <div className={styles.corrTitre}>
              <i className="fas fa-map-pin" /> {t('panierCommande.livraisonSection.correspondantIntl')}
            </div>
            <div className={styles.infoInd}>
              <i className="fas fa-circle-info" />
              <span>{t('panierCommande.livraisonSection.boutiqueEtranger')}</span>
            </div>
            <div className={styles.corrList}>
              {CORRESPONDANTS.map(c => (
                <div
                  key={c.id}
                  className={`${styles.corrCard} ${selCorr === c.id ? styles.corrCardSel : ''}`}
                  onClick={() => { onSelCorr(c.id); onToast(t('panierCommande.livraisonSection.correspondantToast', { nom: c.nm })); }}
                >
                  <div className={styles.corrAva}>{c.em}</div>
                  <div className={styles.corrInf}>
                    <div className={styles.corrNm}>{c.nm}</div>
                    <div className={styles.corrMeta}>
                      <span><i className="fas fa-location-dot" /> {c.rg}</span>
                      <span className={styles.corrTag}>{c.tp}</span>
                      <span><i className="fas fa-star" style={{ color:'#B45309' }} /> {c.rt}</span>
                    </div>
                  </div>
                  <div className={styles.corrFee}>{fmt(c.fee)}</div>
                  <div className={`${styles.corrRd} ${selCorr === c.id ? styles.corrRdOn : ''}`} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}