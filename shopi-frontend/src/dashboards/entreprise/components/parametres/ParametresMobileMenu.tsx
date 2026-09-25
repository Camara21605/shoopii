/* ================================================================
 * src/dashboards/entreprise/components/parametres/ParametresMobileMenu.tsx
 *
 * Écran racine des paramètres entreprise en mode téléphone : liste
 * groupée avec icônes + libellés + chevrons (même esprit qu'un écran
 * de réglages natif), affichée à la place de la barre de pills
 * horizontale quand l'écran est étroit — voir ParametresPage.tsx.
 * Les 12 sections existantes (déjà réelles, branchées à l'API via
 * useParametres) sont juste regroupées différemment ; rien n'est
 * inventé ici. Icônes en niveaux de gris, cohérent avec le reste de
 * cette page (.itemIco, .sidebarItem).
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import type { SectionKey } from '../../pages/ParametresPage';
import s from '../../styles/parametres/ParametresMobileMenu.module.css';

export type SidebarItem = { key: SectionKey; icon: string; label: string; danger?: boolean };

interface Props {
  items:        SidebarItem[];
  onOpen:       (key: SectionKey) => void;
  onLogout:     () => void;
  logo?:        string | null;
  companyName?: string;
  statusLabel?: string;
  canEdit:      boolean;
}

const GROUPS: { labelKey: string; keys: SectionKey[] }[] = [
  { labelKey: 'parametres.sidebar.groups.boutique', keys: ['horaires', 'catalogue'] },
  { labelKey: 'parametres.sidebar.groups.activite',  keys: ['livraison', 'paiement', 'commissions', 'documents'] },
  { labelKey: 'parametres.sidebar.groups.compte',    keys: ['securite', 'notifs', 'privacy', 'langue'] },
];

function Row({ icon, label, danger, onClick }: { icon: string; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`${s.row} ${danger ? s.dangerRow : ''}`} onClick={onClick}>
      <div className={s.icon}><i className={`fas ${icon}`} /></div>
      <div className={s.label}>{label}</div>
      <i className={`fas fa-chevron-right ${s.chevron}`} />
    </button>
  );
}

export default function ParametresMobileMenu({ items, onOpen, onLogout, logo, companyName, statusLabel, canEdit }: Props) {
  const { t } = useTranslation();

  const byKey = (key: SectionKey) => items.find(i => i.key === key);
  const dangerItem = byKey('danger');

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <span className={s.headerTitle}>{t('parametres.sidebar.title')}</span>
      </div>

      {!canEdit && (
        <div className={s.readOnlyBanner}>
          <i className="fas fa-lock" style={{ fontSize: 12 }} />
          {t('parametres.readOnly')}
        </div>
      )}

      {/* ── Résumé boutique ── */}
      <button type="button" className={s.boutiqueRow} onClick={() => onOpen('boutique')}>
        <div className={s.boutiqueLogo}>
          {logo ? <img src={logo} alt="" /> : '🏪'}
        </div>
        <div className={s.boutiqueInfo}>
          <div className={s.boutiqueName}>{companyName || byKey('boutique')?.label}</div>
          {statusLabel && <div className={s.boutiqueStatus}>{statusLabel}</div>}
        </div>
        <i className={`fas fa-chevron-right ${s.chevron}`} />
      </button>

      {GROUPS.map(group => {
        const rows = group.keys.map(byKey).filter((i): i is SidebarItem => !!i);
        if (rows.length === 0) return null;
        return (
          <div className={s.group} key={group.labelKey}>
            <div className={s.groupLabel}>{t(group.labelKey)}</div>
            <div className={s.card}>
              {rows.map(item => (
                <Row key={item.key} icon={item.icon} label={item.label} onClick={() => onOpen(item.key)} />
              ))}
            </div>
          </div>
        );
      })}

      {dangerItem && (
        <div className={s.group}>
          <div className={s.groupLabel}>{dangerItem.label}</div>
          <div className={`${s.card} ${s.danger}`}>
            <Row icon={dangerItem.icon} label={dangerItem.label} danger onClick={() => onOpen('danger')} />
          </div>
        </div>
      )}

      <div className={s.logoutGroup}>
        <div className={s.card}>
          <button type="button" className={`${s.row} ${s.logoutRow}`} onClick={onLogout}>
            <div className={s.icon}><i className="fas fa-right-from-bracket" /></div>
            <div className={s.label}>{t('parametres.sidebar.logout')}</div>
          </button>
        </div>
      </div>
    </div>
  );
}
