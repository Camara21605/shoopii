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
 *
 * BUG CORRIGÉ — le bouton "Suivre" ne faisait que basculer un état local
 * (jamais persisté, réinitialisé à chaque rechargement) : ce livreur
 * n'apparaissait jamais réellement dans "Mes abonnements", peu importe le
 * nombre de clics. Remplacé par le vrai FollowButton partagé (même
 * composant que pour suivre la boutique elle-même, voir BoutiqueIdentity.tsx),
 * qui persiste via /suivis/livreurs/:id.
 * ============================================================
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LivreurApi } from '../pages/BoutiquePage';
import FollowButton from '../../../../../shared/components/FollowButton';
import { useAuthGate } from '../../../../../shared/hooks/useAuthGate';
import styles from '../styles/CardsLivreur.module.css';
import { locationLabel } from '../../../../../shared/location/utils/locationLabel';
import ActorLocation from '../../../../../shared/location/components/ActorLocation';
import ActorDistance from '../../../../../shared/location/components/ActorDistance';

interface Props {
  l:       LivreurApi;
  onToast: (m: string, type?: 's' | 'i' | 'w' | 'e') => void;
  /** Vrai statut d'abonnement — résolu par BoutiquePage.tsx (GET
   *  /suivis/livreurs/:id/statut), absent (undefined) pour un visiteur
   *  anonyme. */
  isSuivi?: boolean;
  onSuiviChange?: (id: string, isSuivi: boolean) => void;
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

export default function CardLivreurBoutique({ l, onToast, isSuivi = false, onSuiviChange }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openAuthModal, authModal } = useAuthGate();
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
      {locationLabel(l) && (
        <div className={styles.zone}>
          <i className="fas fa-map-pin" /> <ActorLocation value={l} /><ActorDistance role="delivery" id={l?.id} />
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
        {/* FollowButton gère son propre style (texte "S'abonner" ou badge "Suivi(e)" + menu ⋮) —
         * l'ancien .btnSuivre (36px, icône seule) était taillé pour le faux bouton local, trop
         * étroit pour un vrai bouton texte ; flex:1 le met à égalité avec "Voir profil" ci-dessus. */}
        <div style={{ flex: 1, display: 'flex' }}>
          <FollowButton
            actorType="livreur"
            id={l.id}
            name={l.fullName}
            isSuivi={isSuivi}
            onToast={onToast}
            onRequireAuth={openAuthModal}
            onChange={next => onSuiviChange?.(l.id, next.isSuivi)}
          />
        </div>
      </div>
      {authModal}
    </div>
  );
}
