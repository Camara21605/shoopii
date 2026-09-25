/* ================================================================
 * src/dashboards/livreur/components/ParamMobileMenu.tsx
 *
 * Écran racine des paramètres livreur en mode téléphone : liste
 * groupée avec icônes + libellés + chevrons (même esprit qu'un écran
 * de réglages natif), affichée à la place de la barre de pills
 * horizontale quand l'écran est étroit — voir LivreurParametresPage.tsx.
 * Réutilise buildGroups() de data/parametresData.ts (même regroupement/
 * mêmes libellés que la navigation desktop ParamNav.tsx, une seule
 * source de vérité) — rien n'est inventé ici, seule la présentation change.
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import { buildGroups, type ParamSectionId } from '../data/parametresData';
import s from '../styles/ParamMobileMenu.module.css';

interface Props {
  onOpen:      (id: ParamSectionId) => void;
  onLogout:    () => void;
  photoUrl?:   string | null;
  fullName?:   string;
}

export default function ParamMobileMenu({ onOpen, onLogout, photoUrl, fullName }: Props) {
  const { t } = useTranslation();
  const groups = buildGroups(t);
  const initials = (fullName ?? '').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

  return (
    <div className={s.wrap}>
      {/* ── Résumé profil ── */}
      <button type="button" className={s.profileRow} onClick={() => onOpen('profil')}>
        <div className={s.profileAvatar}>
          {photoUrl ? <img src={photoUrl} alt="" /> : initials}
        </div>
        <div className={s.profileName}>{fullName || t('livreurParametres.nav.items.profil')}</div>
        <i className={`fas fa-chevron-right ${s.chevron}`} />
      </button>

      {groups.map(group => (
        <div className={s.group} key={group.title}>
          <div className={s.groupLabel}>{group.title}</div>
          <div className={s.card}>
            {group.items.map(item => (
              <button
                key={item.id}
                type="button"
                className={`${s.row} ${item.warn === 'r' ? s.dangerRow : ''}`}
                onClick={() => onOpen(item.id)}
              >
                <div className={s.icon}><i className={`fas ${item.icon}`} /></div>
                <div className={s.label}>{item.label}</div>
                {item.warn && <div className={`${s.dot} ${item.warn === 'r' ? s.dotR : s.dotA}`} />}
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
            <div className={s.label}>{t('livreurParametres.seDeconnecter')}</div>
          </button>
        </div>
      </div>
    </div>
  );
}
