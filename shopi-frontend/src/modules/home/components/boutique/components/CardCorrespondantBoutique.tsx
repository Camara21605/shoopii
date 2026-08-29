/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/components/CardCorrespondantBoutique.tsx
 *
 * RÔLE    : Carte d'un correspondant dans la section Correspondants
 *           de la page boutique, vue client — données réelles.
 *
 * AFFICHE :
 *   - Avatar + badge "Vérifié Shoneya" si verified
 *   - Nom, ville/quartier
 *   - Note + nombre de missions accomplies
 *   - Horaires du jour (si renseignés)
 *   - Langues parlées
 *   - Bio courte
 *   - Boutons : Contacter (tel: si numéro connu) | Choisir ce correspondant
 *
 * Volontairement absents par rapport à l'ancienne carte mock : tarif,
 * "colis/mois", taux de succès, badge disponible/complet — aucune donnée
 * réelle ne les alimente actuellement (pas de table colis/tarif côté
 * backend). Les réafficher aurait recréé le problème qu'on corrige.
 * ============================================================
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CorrespondantApi } from '../pages/BoutiquePage';
import styles from '../styles/CardsCorrespondant.module.css';

interface Props {
  c:       CorrespondantApi;
  onToast: (m: string) => void;
}

function Stars({ n }: { n: number }) {
  return (
    <span className={styles.stars}>
      {'★'.repeat(Math.round(n))}{'☆'.repeat(5 - Math.round(n))}
    </span>
  );
}

export default function CardCorrespondantBoutique({ c, onToast }: Props) {
  const { t } = useTranslation();
  const [choisi, setChoisi] = useState(false);
  const localisation = [c.quartier, c.ville].filter(Boolean).join(', ');

  return (
    <div className={`${styles.card} ${choisi ? styles.cardChoisi : ''}`}>

      {/* ── Badge Vérifié (coin haut droit) ── */}
      {c.verified && (
        <span className={styles.verifBadge}>
          <i className="fas fa-shield-check" /> {t('boutiqueDetail.cardCorrespondant.verifie')}
        </span>
      )}

      {/* ── Avatar ── */}
      <div className={styles.avaWrap}>
        <div className={styles.ava}>🏢</div>
      </div>

      {/* ── Nom ── */}
      <div className={styles.nom}>{c.fullName}</div>

      {/* ── Localisation ── */}
      {localisation && (
        <div className={styles.loc}>
          <i className="fas fa-location-dot" />
          🇬🇳 {localisation}
        </div>
      )}

      {/* ── Stats : note + missions accomplies ── */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <Stars n={c.note} />
          <span className={styles.statVal}>{c.note.toFixed(1)}</span>
        </div>
        <div className={styles.statSep} />
        <div className={styles.stat}>
          <i className="fas fa-box" style={{ color:'var(--blue)', fontSize:11 }} />
          <span className={styles.statVal}>{t('boutiqueDetail.cardCorrespondant.missionsCount', { count: c.missions })}</span>
        </div>
      </div>

      {/* ── Infos pratiques ── */}
      <div className={styles.infos}>
        <div className={styles.infoRow}>
          <i className="fas fa-clock" />
          <span>
            {c.horaireAujourdhui
              ? t('boutiqueDetail.cardCorrespondant.ouvertAujourdhui', { horaire: c.horaireAujourdhui })
              : t('boutiqueDetail.cardCorrespondant.fermeAujourdhui')}
          </span>
        </div>
        {c.langues.length > 0 && (
          <div className={styles.infoRow}>
            <i className="fas fa-language" />
            <span>{c.langues.join(', ')}</span>
          </div>
        )}
      </div>

      {/* ── Bio ── */}
      {c.bio && <p className={styles.bio}>{c.bio}</p>}

      {/* ── Boutons d'action ── */}
      <div className={styles.btns}>
        <button
          className={styles.btnContact}
          onClick={() => {
            if (c.phone) window.location.href = `tel:${c.phone}`;
            else onToast(t('boutiqueDetail.cardCorrespondant.telephoneIndisponible'));
          }}
        >
          <i className="fas fa-phone" /> {t('boutiqueDetail.cardCorrespondant.contacter')}
        </button>
        <button
          className={`${styles.btnChoisir} ${choisi ? styles.btnChoisirOn : ''}`}
          onClick={() => {
            setChoisi(v => !v);
            onToast(choisi
              ? t('boutiqueDetail.cardCorrespondant.retireToast', { nom: c.fullName })
              : t('boutiqueDetail.cardCorrespondant.selectionneToast', { nom: c.fullName })
            );
          }}
        >
          <i className={`fas ${choisi ? 'fa-check' : 'fa-plus'}`} />
          {choisi ? t('boutiqueDetail.cardCorrespondant.choisi') : t('boutiqueDetail.cardCorrespondant.choisir')}
        </button>
      </div>
    </div>
  );
}
