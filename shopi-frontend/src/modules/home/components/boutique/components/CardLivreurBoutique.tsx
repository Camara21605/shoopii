/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/components/CardLivreurBoutique.tsx
 *
 * RÔLE    : Carte d'un livreur dans la section Livreurs
 *           de la page boutique.
 *
 * AFFICHE :
 *   - Avatar avec indicateur disponibilité (vert/orange)
 *   - Nom, zone de livraison
 *   - Note + nombre de livraisons
 *   - Badge statut (Disponible / En course)
 *   - Boutons : Voir profil | Suivre (toggle abonnement)
 * ============================================================
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LivreurApi } from '../pages/BoutiquePage';
import styles from '../styles/CardsLivreur.module.css';

interface Props {
  l:       LivreurApi;
  onToast: (m: string) => void;
}

function Stars({ n }: { n: number }) {
  return <span className={styles.stars}>{'★'.repeat(Math.round(n))}{'☆'.repeat(5-Math.round(n))}</span>;
}

/* availability réel du backend (DeliveryAvailability) : 3 états, pas un
 * simple booléen dispo/pas-dispo comme l'ancien mock. */
function statusMeta(availability: string, t: (k: string) => string) {
  if (availability === 'available') {
    return { dot: styles.dotOn,      badge: styles.dispoBadge,   label: t('boutiqueDetail.cardLivreur.disponible') };
  }
  if (availability === 'on_delivery') {
    return { dot: styles.dotOff,     badge: styles.occupeBadge,  label: t('boutiqueDetail.cardLivreur.enCourseBadge') };
  }
  return { dot: styles.dotOffline, badge: styles.offlineBadge, label: t('boutiqueDetail.cardLivreur.horsLigne') };
}

export default function CardLivreurBoutique({ l, onToast }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [suivi, setSuivi] = useState(false);
  const status = statusMeta(l.availability, t);

  return (
    <div className={styles.card}>

      {/* ── Avatar + indicateur disponibilité ── */}
      <div className={styles.avaWrap}>
        <div className={styles.ava}>{l.emoji}</div>
        <div className={`${styles.dot} ${status.dot}`} />
      </div>

      {/* ── Nom ── */}
      <div className={styles.nom}>{l.fullName}</div>

      {/* ── Zone de livraison ── */}
      {l.zone && (
        <div className={styles.zone}>
          <i className="fas fa-map-pin" /> {l.zone}
        </div>
      )}

      {/* ── Stats : note + livraisons ── */}
      <div className={styles.stats}>
        <span><Stars n={l.note} /> {l.note.toFixed(1)}</span>
        <span>{t('boutiqueDetail.cardLivreur.livraisonsCount', { count: l.trips })}</span>
      </div>

      {/* ── Badge statut ── */}
      <span className={status.badge}>{status.label}</span>

      {/* ── Boutons d'action ── */}
      <div className={styles.btns}>
        <button
          className={styles.btnProfil}
          onClick={() => navigate(`/livreurs/${l.id}`)}
        >
          <i className="fas fa-user" /> {t('boutiqueDetail.cardLivreur.voirProfil')}
        </button>
        <button
          className={`${styles.btnSuivre} ${suivi ? styles.btnSuivreOn : ''}`}
          onClick={() => { setSuivi(s => !s); onToast(suivi ? t('boutiqueDetail.cardLivreur.desabonneToast', { nom: l.fullName }) : t('boutiqueDetail.cardLivreur.abonneToast', { nom: l.fullName })); }}
        >
          {suivi ? <><i className="fas fa-check" /></> : <><i className="fas fa-plus" /></>}
        </button>
      </div>
    </div>
  );
}
