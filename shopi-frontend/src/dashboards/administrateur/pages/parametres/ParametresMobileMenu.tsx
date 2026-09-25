/* ================================================================
 * FICHIER : pages/parametres/ParametresMobileMenu.tsx
 *
 * Écran racine des Paramètres Admin en mode téléphone : liste groupée
 * avec icônes + libellés + chevrons/badges (même esprit qu'un écran
 * de réglages natif), affichée à la place de la barre d'onglets
 * horizontale quand l'écran est étroit — voir ParametresPage.tsx.
 * Réutilise NAV_GROUPS de navData.ts (même regroupement/mêmes libellés
 * que la navigation desktop, une seule source de vérité) — rien n'est
 * inventé ici, seule la présentation change.
 * ================================================================ */

import { NAV_GROUPS } from './navData';
import type { ParamSection } from './types';
import s from './ParametresMobileMenu.module.css';

interface Props {
  onOpen:     (id: ParamSection) => void;
  onLogout:   () => void;
  navBadges:  Partial<Record<ParamSection, string>>;
}

export default function ParametresMobileMenu({ onOpen, onLogout, navBadges }: Props) {
  return (
    <div className={s.wrap}>
      {NAV_GROUPS.map(group => (
        <div className={s.group} key={group.label}>
          <div className={s.groupLabel}>{group.label}</div>
          <div className={s.card}>
            {group.items.map(item => (
              <button key={item.id} type="button" className={s.row} onClick={() => onOpen(item.id)}>
                <div className={s.icon}><i className={`fas ${item.icon}`} /></div>
                <div className={s.label}>{item.label}</div>
                {navBadges[item.id] && <span className={s.badge}>{navBadges[item.id]}</span>}
                <i className={`fas fa-chevron-right ${s.chevron}`} />
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className={s.logoutGroup}>
        <div className={s.card}>
          <button type="button" className={`${s.row} ${s.logoutRow}`} onClick={onLogout}>
            <div className={s.icon}><i className="fas fa-right-from-bracket" /></div>
            <div className={s.label}>Se déconnecter</div>
          </button>
        </div>
      </div>
    </div>
  );
}
