/* ================================================================
 * src/dashboards/partenaire/components/ParamMobileMenu.tsx
 *
 * Écran racine des paramètres partenaire en mode téléphone : liste
 * groupée avec icônes + libellés + chevrons/indicateurs (même esprit
 * qu'un écran de réglages natif), affichée à la place de la barre de
 * pills horizontale quand l'écran est étroit — voir ParametresPage.tsx.
 * Réutilise NAV_ITEMS + computeNavState() de data/parametresData.ts
 * (mêmes indicateurs réels — % de complétion, points d'alerte — que la
 * navigation desktop ParamNav.tsx, une seule source de vérité) — rien
 * n'est inventé ici, seule la présentation change.
 * ================================================================ */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NAV_ITEMS, computeNavState, type SectionId, type NavGroupId } from '../data/parametresData';
import type { PartenaireData } from '../hooks/usePartenaireParametres';
import s from '../styles/ParamMobileMenu.module.css';

const GROUPS: NavGroupId[] = ['identite', 'activite', 'finances', 'compte'];

interface Props {
  data:     PartenaireData | null;
  onOpen:   (id: SectionId) => void;
  onLogout: () => void;
}

export default function ParamMobileMenu({ data, onOpen, onLogout }: Props) {
  const { t } = useTranslation();
  const navState = useMemo(() => computeNavState(data), [data]);
  const fullName = [data?.firstName, data?.lastName].filter(Boolean).join(' ');
  const initials = fullName.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

  return (
    <div className={s.wrap}>
      {/* ── Résumé profil ── */}
      <button type="button" className={s.profileRow} onClick={() => onOpen('profil')}>
        <div className={s.profileAvatar}>
          {data?.profilePicture ? <img src={data.profilePicture} alt="" /> : initials}
        </div>
        <div className={s.profileName}>{fullName || t('partenaireParametres.nav.items.profil')}</div>
        <i className={`fas fa-chevron-right ${s.chevron}`} />
      </button>

      {GROUPS.map(group => {
        const items = NAV_ITEMS.filter(i => i.group === group);
        return (
          <div className={s.group} key={group}>
            <div className={s.groupLabel}>{t(`partenaireParametres.nav.groups.${group}`)}</div>
            <div className={s.card}>
              {items.map(item => {
                const indicator = navState[item.id] ?? {};
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${s.row} ${item.isDanger ? s.dangerRow : ''}`}
                    onClick={() => onOpen(item.id)}
                  >
                    <div className={s.icon}><i className={`fas ${item.icon}`} /></div>
                    <div className={s.label}>{t(`partenaireParametres.nav.items.${item.labelKey}`)}</div>
                    {indicator.pct && !indicator.dotColor && (
                      <span
                        className={s.pct}
                        style={{
                          color:
                            parseInt(indicator.pct) < 50 ? 'var(--red)' :
                            parseInt(indicator.pct) < 80 ? 'var(--amber)' :
                            'var(--emerald)',
                        }}
                      >
                        {indicator.pct}
                      </span>
                    )}
                    {indicator.dotColor === 'r' && <span className={`${s.dot} ${s.dotR}`} />}
                    {indicator.dotColor === 'a' && <span className={`${s.dot} ${s.dotA}`} />}
                    <i className={`fas fa-chevron-right ${s.chevron}`} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className={s.logoutGroup}>
        <div className={s.card}>
          <button type="button" className={`${s.row} ${s.logoutRow}`} onClick={onLogout}>
            <div className={s.icon}><i className="fas fa-right-from-bracket" /></div>
            <div className={s.label}>{t('partenaireParametres.page.deconnexion')}</div>
          </button>
        </div>
      </div>
    </div>
  );
}
