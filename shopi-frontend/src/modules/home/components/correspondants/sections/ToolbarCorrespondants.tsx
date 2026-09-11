/* ================================================================
 * FICHIER : correspondants/sections/ToolbarCorrespondants.tsx
 *
 * Barre d'outils : recherche, filtres rapides, tri, compteur, +
 * bascule "Hors ligne" (mobile uniquement — voir styles.mobileOnly).
 * ================================================================ */

import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/Correspondants.module.css';
import type { FiltreRapide, TriOption } from '../data/types';

interface Props {
  recherche:   string;
  filtre:      FiltreRapide;
  tri:         TriOption;
  count:       number;
  statut:      'all' | 'online' | 'offline';
  onRecherche: (v: string) => void;
  onFiltre:    (f: FiltreRapide) => void;
  onTri:       (t: TriOption) => void;
  onStatut:    (s: 'all' | 'online' | 'offline') => void;
}

export default function ToolbarCorrespondants({
  recherche, filtre, tri, count, statut,
  onRecherche, onFiltre, onTri, onStatut,
}: Props) {
  const { t } = useTranslation();
  const FILTRES: { id: FiltreRapide; icon: string; label: string }[] = [
    { id: 'all',       icon: 'fa-border-all',     label: t('correspondantsPage.toolbar.filters.tous')          },
    { id: 'available', icon: 'fa-circle',         label: t('correspondantsPage.toolbar.filters.enLigne')      },
    { id: 'followed',  icon: 'fa-check',          label: t('correspondantsPage.toolbar.filters.mesAbonnements') },
    { id: 'regional',  icon: 'fa-map-marked-alt', label: t('correspondantsPage.toolbar.filters.regionaux')     },
    { id: 'zonal',     icon: 'fa-map',            label: t('correspondantsPage.toolbar.filters.zonaux')        },
    { id: 'national',  icon: 'fa-globe-africa',   label: t('correspondantsPage.toolbar.filters.nationaux')     },
  ];
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarIn}>
        {/* Recherche */}
        <div className={styles.srchWrap}>
          <i className="fas fa-search" />
          <input
            type="text"
            placeholder={t('correspondantsPage.toolbar.searchPlaceholder')}
            value={recherche}
            onChange={e => onRecherche(e.target.value)}
          />
        </div>

        {/* Filtres rapides */}
        {FILTRES.map((f, i) => (
          <React.Fragment key={f.id}>
            {i === 3 && <div className={styles.fsep} />}
            <button
              className={`${styles.fbtn} ${filtre === f.id ? styles.fbtnOn : ''}`}
              onClick={() => onFiltre(f.id)}
            >
              <i className={`fas ${f.icon}`}
                 style={f.id === 'available' ? { color: '#10B981', fontSize: 8 } : undefined} />
              {f.label}
            </button>
          </React.Fragment>
        ))}

        {/* Tri */}
        <select className={styles.srt} value={tri} onChange={e => onTri(e.target.value as TriOption)}>
          <option value="pertinence">{t('correspondantsPage.toolbar.sorts.pertinence')}</option>
          <option value="note">{t('correspondantsPage.toolbar.sorts.mieuxNotes')}</option>
          <option value="missions">{t('correspondantsPage.toolbar.sorts.plusDeMissions')}</option>
          <option value="nom">{t('correspondantsPage.toolbar.sorts.nomAZ')}</option>
        </select>

        {/* Disponibilité (mobile uniquement — sur desktop, voir la sidebar
         * section Disponibilité, pour ne pas dupliquer) */}
        <button
          className={`${styles.fbtn} ${styles.mobileOnly} ${statut === 'offline' ? styles.fbtnOn : ''}`}
          onClick={() => onStatut(statut === 'offline' ? 'all' : 'offline')}
        >
          <i className="fas fa-moon" />
          {t('correspondantsPage.sidebar.horsLigne')}
        </button>

        {/* Compteur */}
        <span className={styles.cntPill}>{t('correspondantsPage.toolbar.correspondantCount', { count })}</span>
      </div>
    </div>
  );
}