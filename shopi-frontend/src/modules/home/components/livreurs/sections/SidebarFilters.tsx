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

import React from 'react';
import styles                from '../styles/SidebarFilters.module.css';
import type { LivreurItem }  from '../data/livreursMockData';
import { ZONES_OPTIONS, VEHICULE_OPTIONS } from '../data/livreursMockData';
import type { FilterState }  from '../hooks/useLivreurs';

/* ── Props ── */
interface SidebarFiltersProps {
  filters:          FilterState;
  myFollowed:       LivreurItem[];
  onZone:           (z: string) => void;
  onVehicleToggle:  (v: string) => void;
  onRating:         (r: number | null) => void;
  onAvailability:   (v: 'all' | 'available' | 'busy') => void;
  onReset:          () => void;
}

/* ── Options note minimale ── */
const RATING_OPTS = [
  { value: 5,    label: '5 étoiles seulement', stars: 5 },
  { value: 4,    label: '4+ étoiles',          stars: 4 },
  { value: 3,    label: '3+ étoiles',          stars: 3 },
  { value: null, label: 'Toutes les notes',    stars: 0 },
];

/* ================================================================
 * COMPOSANT PRINCIPAL
 * ================================================================ */
const SidebarFilters: React.FC<SidebarFiltersProps> = ({
  filters, myFollowed,
  onZone, onVehicleToggle, onRating, onAvailability, onReset,
}) => {
  return (
    <aside className={styles.sidebar} aria-label="Filtres livreurs">

      {/* ── Zone de livraison ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>
            <i className="fas fa-map-pin" aria-hidden="true" /> Zone de livraison
          </div>
          <button className={styles.resetBtn} onClick={onReset}>Réinit.</button>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.zoneList}>
            {ZONES_OPTIONS.map(z => (
              <div
                key={z.value}
                className={`${styles.zoneChip} ${filters.selectedZone === z.value ? styles.zoneChipOn : ''}`}
                onClick={() => onZone(z.value)}
                role="button"
                aria-pressed={filters.selectedZone === z.value}
              >
                <i className="fas fa-map-pin" aria-hidden="true" />
                {z.label}
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
            <i className="fas fa-motorcycle" aria-hidden="true" /> Type de véhicule
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
                <div className={styles.vehLbl}>{v.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Note minimale ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>
            <i className="fas fa-star" aria-hidden="true" /> Note minimale
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
            <i className="fas fa-circle-dot" aria-hidden="true" /> Disponibilité
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
              Disponible
            </div>
            <div
              className={`${styles.togBtn} ${filters.availabilityFilter === 'busy' ? styles.togBtnBusy : ''}`}
              onClick={() => onAvailability(
                filters.availabilityFilter === 'busy' ? 'all' : 'busy'
              )}
              role="button"
            >
              <i className="fas fa-gear" aria-hidden="true" />
              En course
            </div>
          </div>
        </div>
      </div>

      {/* ── Mes abonnements ── */}
      {myFollowed.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>
              <i className="fas fa-users" aria-hidden="true" /> Mes abonnements
            </div>
            <span className={styles.followedCount}>{myFollowed.length}</span>
          </div>
          <div className={styles.cardBody} style={{ padding: '10px 14px' }}>
            <div className={styles.followedList}>
              {myFollowed.map(l => (
                <div key={l.id} className={styles.followedItem}>
                  <div
                    className={styles.followedAva}
                    style={{ background: l.avatarBg }}
                  >
                    {l.initials}
                  </div>
                  <div>
                    <div className={styles.followedName}>{l.fullName}</div>
                    <div className={styles.followedMeta}>
                      {l.vehicule.split(' ')[0]} · {l.zone.split('·')[0].trim()} · {l.averageRating}★
                    </div>
                  </div>
                  {/* Indicateur statut */}
                  <div
                    className={styles.followedDot}
                    style={{ background: l.disponible ? '#10B981' : '#D1D5DB' }}
                    title={l.disponible ? 'Disponible' : 'En course'}
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