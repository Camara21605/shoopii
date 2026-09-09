/* ================================================================
 * FICHIER : src/modules/home/components/livreurs/sections/SidebarFilters.tsx
 *
 * RÔLE : Sidebar de filtres avancés (desktop uniquement).
 *        Contient : zone, véhicule, note minimale,
 *                   disponibilité, mes abonnements.
 *
 * PARENT : LivreursPage.tsx
 * STYLES : ../styles/SidebarFilters.module.css
 * ================================================================ */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles                from '../styles/SidebarFilters.module.css';
import type { LivreurItem }  from '../data/livreursMockData';
import { VEHICULE_OPTIONS } from '../data/livreursMockData';
import type { FilterState }  from '../hooks/useLivreurs';

/** Nombre réel de livreurs par commune — GET /client/livreurs/zones. */
export interface ZoneCount { value: string; label: string; count: number }

/* Communes affichées tant que le compte réel n'a pas encore chargé (ou a
 * échoué) — mêmes 5 communes que le backend, count à 0 plutôt qu'un chiffre
 * inventé (voir BUG CORRIGÉ ci-dessous pour le contexte). */
const ZONES_FALLBACK: ZoneCount[] = [
  { value: 'all',    label: 'Toutes les zones', count: 0 },
  { value: 'kaloum', label: 'Kaloum',           count: 0 },
  { value: 'ratoma', label: 'Ratoma',           count: 0 },
  { value: 'matam',  label: 'Matam',            count: 0 },
  { value: 'dixinn', label: 'Dixinn',           count: 0 },
  { value: 'matoto', label: 'Matoto',           count: 0 },
];

/* ── Avatar "Mes abonnements" — photo réelle si dispo, sinon initiales ──
 * (même pattern que CardLivreurGrid/List — voir ces fichiers.) */
function FollowedAvatar({ livreur }: { livreur: LivreurItem }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div
      className={styles.followedAva}
      style={livreur.profilePicture && !imgError ? undefined : { background: livreur.avatarBg }}
    >
      {livreur.profilePicture && !imgError
        ? <img
            className={styles.followedAvaImg}
            src={livreur.profilePicture}
            alt={livreur.fullName}
            onError={() => setImgError(true)}
          />
        : livreur.initials
      }
    </div>
  );
}

/* ── Props ── */
interface SidebarFiltersProps {
  filters:          FilterState;
  myFollowed:       LivreurItem[];
  /** null = pas encore chargé (voir ZONES_FALLBACK) */
  zoneCounts:       ZoneCount[] | null;
  onZone:           (z: string) => void;
  onVehicleToggle:  (v: string) => void;
  onRating:         (r: number | null) => void;
  onAvailability:   (v: 'all' | 'available' | 'busy') => void;
  onReset:          () => void;
}

/* ================================================================
 * COMPOSANT PRINCIPAL
 * ================================================================ */
const SidebarFilters: React.FC<SidebarFiltersProps> = ({
  filters, myFollowed, zoneCounts,
  onZone, onVehicleToggle, onRating, onAvailability, onReset,
}) => {
  const { t } = useTranslation();

  /* BUG CORRIGÉ — ZONES_OPTIONS (data/livreursMockData.ts) affichait des
   * comptes 100% statiques (148/34/41/28/19/26) sans rapport avec le
   * nombre réel de livreurs par commune. Vraies données depuis
   * GET /client/livreurs/zones (voir LivreursPage.tsx), avec un repli
   * "0" honnête (pas un chiffre inventé) tant que ça charge/échoue. */
  const zones = zoneCounts ?? ZONES_FALLBACK;

  /* Labels traduits pour la zone "Toutes" et les véhicules (les noms
     de communes restent en français, ce sont des noms propres) */
  const zoneLabel = (z: ZoneCount) =>
    z.value === 'all' ? t('livreursPage.sidebar.toutesLesZones') : z.label;
  const VEHICULE_LABELS: Record<string, string> = {
    moto: t('livreursPage.sidebar.vehicules.moto'),
    voiture: t('livreursPage.sidebar.vehicules.voiture'),
    pickup: t('livreursPage.sidebar.vehicules.pickup'),
    camion: t('livreursPage.sidebar.vehicules.camion'),
  };

  /* ── Options note minimale ── */
  const RATING_OPTS = [
    { value: 5,    label: t('livreursPage.sidebar.ratingOpts.cinqEtoiles'), stars: 5 },
    { value: 4,    label: t('livreursPage.sidebar.ratingOpts.quatrePlus'),  stars: 4 },
    { value: 3,    label: t('livreursPage.sidebar.ratingOpts.troisPlus'),   stars: 3 },
    { value: null, label: t('livreursPage.sidebar.ratingOpts.toutesLesNotes'), stars: 0 },
  ];

  return (
    <aside className={styles.sidebar} aria-label={t('livreursPage.sidebar.ariaLabel')}>

      {/* ── Zone de livraison ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>
            <i className="fas fa-map-pin" aria-hidden="true" /> {t('livreursPage.sidebar.zoneDeLivraison')}
          </div>
          <button className={styles.resetBtn} onClick={onReset}>{t('livreursPage.sidebar.reinit')}</button>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.zoneList}>
            {zones.map(z => (
              <div
                key={z.value}
                className={`${styles.zoneChip} ${filters.selectedZone === z.value ? styles.zoneChipOn : ''}`}
                onClick={() => onZone(z.value)}
                role="button"
                aria-pressed={filters.selectedZone === z.value}
              >
                <i className="fas fa-map-pin" aria-hidden="true" />
                {zoneLabel(z)}
                <span className={styles.zoneCnt}>{z.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Type de véhicule ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>
            <i className="fas fa-motorcycle" aria-hidden="true" /> {t('livreursPage.sidebar.typeDeVehicule')}
          </div>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.vehGrid}>
            {VEHICULE_OPTIONS.map(v => (
              <div
                key={v.value}
                className={`${styles.vehChip} ${filters.selectedVehicles.includes(v.value) ? styles.vehChipOn : ''}`}
                onClick={() => onVehicleToggle(v.value)}
                role="button"
                aria-pressed={filters.selectedVehicles.includes(v.value)}
              >
                <div className={styles.vehIco}>{v.icon}</div>
                <div className={styles.vehLbl}>{VEHICULE_LABELS[v.value] ?? v.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Note minimale ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>
            <i className="fas fa-star" aria-hidden="true" /> {t('livreursPage.sidebar.noteMinimale')}
          </div>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.ratingList}>
            {RATING_OPTS.map(r => (
              <div
                key={r.value ?? 'all'}
                className={`${styles.ratingOpt} ${filters.minRating === r.value ? styles.ratingOptOn : ''}`}
                onClick={() => onRating(r.value)}
                role="button"
                aria-pressed={filters.minRating === r.value}
              >
                {r.stars > 0 && (
                  <span className={styles.ratingStars} aria-hidden="true">
                    {'★'.repeat(r.stars)}
                    {'☆'.repeat(5 - r.stars)}
                  </span>
                )}
                {r.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Disponibilité ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>
            <i className="fas fa-circle-dot" aria-hidden="true" /> {t('livreursPage.sidebar.disponibilite')}
          </div>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.availToggle}>
            <div
              className={`${styles.togBtn} ${filters.availabilityFilter === 'available' ? styles.togBtnAvail : ''}`}
              onClick={() => onAvailability(
                filters.availabilityFilter === 'available' ? 'all' : 'available'
              )}
              role="button"
            >
              <i className="fas fa-circle" aria-hidden="true" />
              {t('livreursPage.sidebar.disponible')}
            </div>
            <div
              className={`${styles.togBtn} ${filters.availabilityFilter === 'busy' ? styles.togBtnBusy : ''}`}
              onClick={() => onAvailability(
                filters.availabilityFilter === 'busy' ? 'all' : 'busy'
              )}
              role="button"
            >
              <i className="fas fa-gear" aria-hidden="true" />
              {t('livreursPage.sidebar.enCourse')}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mes abonnements ── */}
      {myFollowed.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>
              <i className="fas fa-users" aria-hidden="true" /> {t('livreursPage.sidebar.mesAbonnements')}
            </div>
            <span className={styles.followedCount}>{myFollowed.length}</span>
          </div>
          <div className={styles.cardBody} style={{ padding: '10px 14px' }}>
            <div className={styles.followedList}>
              {myFollowed.map(l => (
                <div key={l.id} className={styles.followedItem}>
                  <FollowedAvatar livreur={l} />
                  <div>
                    <div className={styles.followedName}>{l.fullName}</div>
                    <div className={styles.followedMeta}>
                      {l.vehicule.split(' ')[0]} · {l.zone.split('·')[0].trim()} · {l.averageRating}★
                    </div>
                  </div>
                  {/* Indicateur statut */}
                  <div
                    className={styles.followedDot}
                    style={{ background: l.disponible ? 'var(--t1)' : 'var(--t4)' }}
                    title={l.disponible ? t('livreursPage.sidebar.disponible') : t('livreursPage.sidebar.enCourse')}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </aside>
  );
};

export default SidebarFilters;