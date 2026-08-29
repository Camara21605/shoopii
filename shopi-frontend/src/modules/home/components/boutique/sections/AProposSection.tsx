/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/sections/AProposSection.tsx
 *
 * RÔLE    : Onglet "À propos" — présentation complète de la boutique.
 *
 * AFFICHE :
 *   - Description + 4 stats clés
 *   - Infos pratiques (horaires, adresse, téléphone, email, site)
 *   - Liste des livreurs (aperçu)
 * ============================================================
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { BoutiqueInfo } from '../data/boutiqueMockData';
import type { LivreurApi } from '../pages/BoutiquePage';
import styles from '../styles/AProposSection.module.css';

interface Props {
  boutiqueInfo: BoutiqueInfo;
  /** ISO — pour calculer "X années d'expérience" ; null si non chargé. */
  createdAt:    string | null;
  livreurs:     LivreurApi[];
  onToast:      (m: string) => void;
}

/** Nombre d'années pleines écoulées depuis createdAt — '—' si inconnu. */
function anneesDepuis(createdAt: string | null): string {
  if (!createdAt) return '—';
  const years = Math.floor((Date.now() - new Date(createdAt).getTime()) / (365.25 * 24 * 3600 * 1000));
  return years > 0 ? `${years}+` : '< 1';
}

function Stars({ n }: { n: number }) {
  return <span className={styles.stars}>{'★'.repeat(Math.round(n))}{'☆'.repeat(5-Math.round(n))}</span>;
}

const LIVR_DOT: Record<string, string> = {
  available:   'livrDotOn',
  on_delivery: 'livrDotOff',
};

export default function AProposSection({ boutiqueInfo, createdAt, livreurs, onToast }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  void onToast; // conservé dans l'interface pour compat avec les autres onglets — plus utilisé ici (le bouton profil navigue désormais vers la vraie page)

  /* Satisfaction client : aucune table de suivi ne calcule ce chiffre côté
   * backend actuellement (boutiqueInfo.satisf vaut toujours '—') — affiché
   * tel quel plutôt que remplacé par un pourcentage inventé. */
  const stats = [
    { val: anneesDepuis(createdAt),               lbl: t('boutiqueDetail.aPropos.anneesExperience')  },
    { val: boutiqueInfo.ventes,                    lbl: t('boutiqueDetail.aPropos.commandesLivrees')  },
    { val: boutiqueInfo.satisf,                    lbl: t('boutiqueDetail.aPropos.satisfactionClient')},
    { val: boutiqueInfo.note > 0 ? boutiqueInfo.note.toFixed(1) : '—', lbl: t('boutiqueDetail.aPropos.noteMoyenne') },
  ];

  /* Seules les infos pratiques réellement renseignées par la boutique
   * s'affichent — une ligne "Site web : " vide n'apporte rien. */
  const infoRowsData = [
    { ico:'🕐', bg:'bg1', title:t('boutiqueDetail.aPropos.horaires'),  sub: boutiqueInfo.horaires },
    { ico:'📍', bg:'bg2', title:t('boutiqueDetail.aPropos.adresse'),   sub: boutiqueInfo.adresse  },
    { ico:'📞', bg:'bg3', title:t('boutiqueDetail.aPropos.telephone'), sub: boutiqueInfo.tel      },
    { ico:'✉️', bg:'bg4', title:t('boutiqueDetail.aPropos.email'),     sub: boutiqueInfo.email    },
    { ico:'🌐', bg:'bg5', title:t('boutiqueDetail.aPropos.siteWeb'),  sub: boutiqueInfo.website  },
  ].filter(r => r.sub && r.sub.trim().length > 0);

  return (
    <div className={styles.grid}>

      {/* ── 1. Description + stats ── */}
      <div className={styles.card}>
        <h3><i className="fas fa-store" /> {t('boutiqueDetail.aPropos.titre')}</h3>
        {boutiqueInfo.description && <p className={styles.desc}>{boutiqueInfo.description}</p>}
        <div className={styles.statsGrid}>
          {stats.map(s => (
            <div key={s.lbl} className={styles.stat}>
              <div className={styles.statV}>{s.val}</div>
              <div className={styles.statL}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. Infos pratiques ── */}
      {infoRowsData.length > 0 && (
      <div className={styles.card}>
        <h3><i className="fas fa-clock" /> {t('boutiqueDetail.aPropos.infosPratiques')}</h3>
        <div className={styles.infoRows}>
          {infoRowsData.map(r => (
            <div key={r.title} className={styles.infoRow}>
              <div className={`${styles.infoIco} ${styles[r.bg]}`}>{r.ico}</div>
              <div>
                <div className={styles.infoTitle}>{r.title}</div>
                <div className={styles.infoSub}>{r.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ── 3. Livreurs de la boutique (pleine largeur) — données réelles,
             aperçu des 4 premiers (liste complète dans l'onglet "Livreurs"). ── */}
      {livreurs.length > 0 && (
        <div className={`${styles.card} ${styles.cardFull}`}>
          <h3><i className="fas fa-motorcycle" /> {t('boutiqueDetail.aPropos.livreursBoutique')}</h3>
          <div className={styles.livreursListe}>
            {livreurs.slice(0, 4).map(l => (
              <div key={l.id} className={styles.livrItem}>
                {/* Avatar */}
                <div className={styles.livrAvaWrap}>
                  <div className={styles.livrAva}>{l.emoji}</div>
                  <div className={`${styles.livrDot} ${styles[LIVR_DOT[l.availability] ?? 'livrDotOffline']}`} />
                </div>
                {/* Infos */}
                <div className={styles.livrInfos}>
                  <div className={styles.livrNom}>{l.fullName}</div>
                  {l.zone && (
                    <div className={styles.livrZone}>
                      <i className="fas fa-map-pin" /> {l.zone}
                    </div>
                  )}
                </div>
                {/* Note */}
                <div className={styles.livrNote}>
                  <Stars n={l.note} /> {l.note.toFixed(1)}
                </div>
                {/* Bouton profil */}
                <button
                  className={styles.livrBtn}
                  onClick={() => navigate(`/livreurs/${l.id}`)}
                >
                  {t('boutiqueDetail.aPropos.voirProfil')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
