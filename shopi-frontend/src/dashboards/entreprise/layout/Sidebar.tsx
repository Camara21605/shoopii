/*
 * FICHIER : src/dashboards/entreprise/layout/Sidebar.tsx
 *
 * ✅ AJOUT : prop `can` + `isOwner` pour masquer les sections
 *    de navigation auxquelles le collaborateur n'a pas accès.
 * ✅ AJOUT : prop `companyLogo` et `companyName`.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { EntreprisePage } from '../types';
import { useToast } from '../../../shared/context/ToastContext';
import WalletQuickBar from '../../../shared/components/portefeuille/WalletQuickBar';
import './Sidebar.css';

type CanFn = (group: string, action: string) => boolean;

interface SidebarProps {
  activePage:   EntreprisePage;
  onNavigate:   (page: EntreprisePage) => void;
  companyLogo?: string | null;
  companyName?: string;
  /** Vérifie si l'utilisateur courant a une permission */
  can?:         CanFn;
  /** true si c'est le propriétaire (toutes permissions accordées) */
  isOwner?:     boolean;
}

/**
 * Chaque item peut définir une condition de permission.
 * Si `perm` est absent, l'item est toujours visible.
 * Si `isOwner` est true, tous les items sont visibles.
 */
interface NavItem {
  id:          EntreprisePage;
  icon:        string;
  label:       string;
  badge?:      string;
  badgeClass?: string;
  /** Permission requise : [group, action] */
  perm?:       [string, string];
}

/* Les valeurs title/label sont des CLÉS de traduction (namespace "common",
   voir src/shared/i18n/locales/{fr,en}/common.json → sidebar.*), pas du
   texte en dur — NAV_SECTIONS reste une constante de module (pas de hook
   ici), la résolution `t(clé)` se fait au rendu dans le composant. */
const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'sidebar.sections.principal',
    items: [
      { id: 'overview',      icon: 'fa-chart-pie', label: 'sidebar.items.overview' },
      { id: 'commandes', icon: 'fa-box',         label: 'sidebar.items.commandes', badge: '14', badgeClass: 'r', perm: ['orders',  'view'] },
      { id: 'retours',   icon: 'fa-rotate-left', label: 'sidebar.items.retours',   badge: '3',  badgeClass: 'a', perm: ['returns', 'view'] },
    ],
  },
  {
    title: 'sidebar.sections.catalogue',
    items: [
      { id: 'produits',   icon: 'fa-tag',         label: 'sidebar.items.produits',   badge: '124',              perm: ['products',   'view']   },
      { id: 'ajouter',    icon: 'fa-plus-circle', label: 'sidebar.items.ajouter',                               perm: ['products',   'create'] },
      { id: 'inventaire',   icon: 'fa-warehouse', label: 'sidebar.items.inventaire',   badge: '6', badgeClass: 'a', perm: ['products', 'view']   },
      { id: 'fournisseurs', icon: 'fa-industry',  label: 'sidebar.items.fournisseurs',                              perm: ['fournisseurs', 'view']   },
      { id: 'promotions',   icon: 'fa-percent',   label: 'sidebar.items.promotions',   badge: '4', badgeClass: 'p', perm: ['promotions','view']  },
    ],
  },
  {
    title: 'sidebar.sections.marketing',
    items: [
      { id: 'analytics', icon: 'fa-chart-line',             label: 'sidebar.items.analytics', perm: ['statistics', 'view'] },
      { id: 'seo',       icon: 'fa-magnifying-glass-chart', label: 'sidebar.items.seo',       perm: ['statistics', 'view'] },
    ],
  },
  {
    title: 'sidebar.sections.reseauLogistique',
    items: [
      { id: 'livreurs',       icon: 'fa-motorcycle', label: 'sidebar.items.livreurs',       badge: '6', badgeClass: 'g', perm: ['deliveries', 'view'] },
      { id: 'correspondants', icon: 'fa-map-pin',    label: 'sidebar.items.correspondants', badge: '3', badgeClass: 'p', perm: ['deliveries', 'view'] },
    ],
  },
  {
    title: 'sidebar.sections.financesClients',
    items: [
      { id: 'finances',     icon: 'fa-coins',  label: 'sidebar.items.finances',     perm: ['payments', 'view']             },
      { id: 'portefeuille', icon: 'fa-wallet', label: 'sidebar.items.portefeuille', perm: ['wallet', 'view'] },
      { id: 'clients',  icon: 'fa-users', label: 'sidebar.items.clients', perm: ['orders', 'view'] },
      { id: 'avis',     icon: 'fa-star',  label: 'sidebar.items.avis',    badge: '8', badgeClass: 'a', perm: ['orders', 'view'] },
    ],
  },
  {
    title: 'sidebar.sections.equipe',
    items: [
      { id: 'equipe', icon: 'fa-users-gear', label: 'sidebar.items.equipeGestion', perm: ['team', 'view'] },
    ],
  },
];

export default function Sidebar({
  activePage, onNavigate,
  companyLogo, companyName,
  can, isOwner = false,
}: SidebarProps) {
  const { pop } = useToast();
  const { t } = useTranslation();

  const initiales = (companyName ?? 'TC')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  /** Détermine si un item doit être affiché */
  const isVisible = (item: NavItem): boolean => {
    if (!item.perm) return true;          // pas de restriction
    if (isOwner) return true;             // propriétaire voit tout
    if (!can) return false;               // permissions non chargées → refus safe
    return can(item.perm[0], item.perm[1]);
  };

  return (
    <nav className="sb">
      {/* ── Logo Shoneya ── */}
      <div className="sb-logo">
        <div className="sb-brand">Sho<b>neya</b></div>
        <span className="sb-version">PRO</span>
      </div>

      {/* ── Carte boutique ── */}
      <div className="sb-shop">
        <div className="sb-shop-card" onClick={() => onNavigate('overview')}>
          <div className="sb-shop-logo">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName ?? 'Logo boutique'}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }}
              />
            ) : (
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                {initiales}
              </span>
            )}
          </div>
          <div>
            <div className="sb-shop-nm">{companyName ?? 'Ma boutique'}</div>
            <div className="sb-shop-sub">
              <span className="sb-shop-dot"></span>
              {t('topbar.status.active')} · {t('topbar.status.default')}
            </div>
          </div>
          <div className="sb-verified">
            <i className="fas fa-shield-check"></i>
          </div>
        </div>
      </div>

      {/* ── Solde du portefeuille Shoneya — sous la carte boutique ── */}
      <div className="sb-wallet" style={{ padding: '0 22px 12px' }}>
        <WalletQuickBar compact mini onManage={() => onNavigate('portefeuille')} />
      </div>

      {/* ── Navigation ── */}
      <div className="sb-nav">
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(isVisible);
          if (visibleItems.length === 0) return null;
          return (
            <React.Fragment key={section.title}>
              <div className="sb-sect">{t(section.title)}</div>
              {visibleItems.map(item => (
                <div
                  key={item.id}
                  className={`nb${activePage === item.id ? ' on' : ''}`}
                  onClick={() => onNavigate(item.id)}
                >
                  <i className={`fas ${item.icon}`}></i>
                  <span>{t(item.label)}</span>
                  {item.badge && (
                    <span className={`nb-badge${item.badgeClass ? ` ${item.badgeClass}` : ''}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              ))}
            </React.Fragment>
          );
        })}

        {/* ── Section Boutique (propriétaire uniquement ou settings.view) ── */}
        {(isOwner || (can && can('settings', 'view'))) && (
          <>
            <div className="sb-sect">{t('sidebar.sections.boutique')}</div>
            <div
              className={`nb${activePage === 'parametres' ? ' on' : ''}`}
              onClick={() => onNavigate('parametres')}
            >
              <i className="fas fa-gear"></i>
              <span>{t('sidebar.items.parametres')}</span>
            </div>
          </>
        )}
        {(isOwner || (can && can('boutique', 'view'))) && (
          <div className="nb" onClick={() => onNavigate('boutique-preview')}>
            <i className="fas fa-arrow-up-right-from-square"></i>
            <span>{t('sidebar.items.voirBoutique')}</span>
          </div>
        )}
      </div>

      {/* ── Boutons bas ── */}
      <div className="sb-bot">
        <button className="sb-bot-btn" onClick={() => pop('🔔 Notifications', 'i')}>
          <i className="fas fa-bell"></i><span>{t('sidebar.items.alertes')}</span>
        </button>
      </div>
    </nav>
  );
}
