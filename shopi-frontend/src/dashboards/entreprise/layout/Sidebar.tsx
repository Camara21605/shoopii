/*
 * FICHIER : src/dashboards/entreprise/layout/Sidebar.tsx
 *
 * ✅ AJOUT : prop `can` + `isOwner` pour masquer les sections
 *    de navigation auxquelles le collaborateur n'a pas accès.
 * ✅ AJOUT : prop `companyLogo` et `companyName`.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { EntreprisePage } from '../types';
import { useToast } from '../../../shared/context/ToastContext';
import { useAppContext } from '../../../shared/context/AppContext';
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

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Principal',
    items: [
      { id: 'overview',  icon: 'fa-chart-pie',  label: "Vue d'ensemble" },
      { id: 'commandes', icon: 'fa-box',         label: 'Commandes',     badge: '14', badgeClass: 'r', perm: ['orders',  'view'] },
      { id: 'retours',   icon: 'fa-rotate-left', label: 'Retours & SAV', badge: '3',  badgeClass: 'a', perm: ['returns', 'view'] },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      { id: 'produits',   icon: 'fa-tag',         label: 'Produits',       badge: '124',              perm: ['products',   'view']   },
      { id: 'ajouter',    icon: 'fa-plus-circle', label: 'Ajouter produit',                           perm: ['products',   'create'] },
      { id: 'inventaire', icon: 'fa-warehouse',   label: 'Inventaire',     badge: '6', badgeClass: 'a', perm: ['products', 'view']   },
      { id: 'promotions', icon: 'fa-percent',     label: 'Promotions',     badge: '4', badgeClass: 'p', perm: ['promotions','view']  },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { id: 'analytics', icon: 'fa-chart-line',             label: 'Analytics',      perm: ['statistics', 'view'] },
      { id: 'seo',       icon: 'fa-magnifying-glass-chart', label: 'SEO & Marketing', perm: ['statistics', 'view'] },
    ],
  },
  {
    title: 'Réseau & Logistique',
    items: [
      { id: 'livreurs',       icon: 'fa-motorcycle', label: 'Mes livreurs',   badge: '6', badgeClass: 'g', perm: ['deliveries', 'view'] },
      { id: 'correspondants', icon: 'fa-map-pin',    label: 'Correspondants', badge: '3', badgeClass: 'p', perm: ['deliveries', 'view'] },
    ],
  },
  {
    title: 'Finances & Clients',
    items: [
      { id: 'finances',     icon: 'fa-coins',  label: 'Finances',    perm: ['payments', 'view']             },
      { id: 'portefeuille', icon: 'fa-wallet', label: 'Portefeuille', perm: ['payments', 'viewTransactions'] },
      { id: 'clients',  icon: 'fa-users', label: 'Clients',      perm: ['orders', 'view'] },
      { id: 'avis',     icon: 'fa-star',  label: 'Avis clients', badge: '8', badgeClass: 'a', perm: ['orders', 'view'] },
    ],
  },
  {
    title: 'Équipe',
    items: [
      { id: 'equipe', icon: 'fa-users-gear', label: "Gestion de l'équipe", perm: ['team', 'view'] },
    ],
  },
];

export default function Sidebar({
  activePage, onNavigate,
  companyLogo, companyName,
  can, isOwner = false,
}: SidebarProps) {
  const { pop } = useToast();
  const navigate = useNavigate();
  const { logout } = useAppContext();

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
      {/* ── Logo Shopi ── */}
      <div className="sb-logo">
        <div className="sb-lm">Sh</div>
        <div className="sb-brand">Sho<b>pi</b></div>
        <span className="sb-version">PRO</span>
      </div>

      {/* ── Carte boutique ── */}
      <div className="sb-shop">
        <div className="sb-shop-card" onClick={() => onNavigate('parametres')}>
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
              Boutique active · Vendeur Pro
            </div>
          </div>
          <div className="sb-verified">
            <i className="fas fa-shield-check"></i>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="sb-nav">
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(isVisible);
          if (visibleItems.length === 0) return null;
          return (
            <React.Fragment key={section.title}>
              <div className="sb-sect">{section.title}</div>
              {visibleItems.map(item => (
                <div
                  key={item.id}
                  className={`nb${activePage === item.id ? ' on' : ''}`}
                  onClick={() => onNavigate(item.id)}
                >
                  <i className={`fas ${item.icon}`}></i>
                  <span>{item.label}</span>
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
            <div className="sb-sect">Boutique</div>
            <div
              className={`nb${activePage === 'parametres' ? ' on' : ''}`}
              onClick={() => onNavigate('parametres')}
            >
              <i className="fas fa-gear"></i>
              <span>Paramètres</span>
            </div>
          </>
        )}
        <div className="nb" onClick={() => pop('👁️ Voir votre boutique publique', 'i')}>
          <i className="fas fa-arrow-up-right-from-square"></i>
          <span>Voir ma boutique</span>
        </div>
      </div>

      {/* ── Boutons bas ── */}
      <div className="sb-bot">
        <button className="sb-bot-btn" onClick={() => pop('🔔 Notifications', 'i')}>
          <i className="fas fa-bell"></i><span>Alertes</span>
        </button>
        <button className="sb-bot-btn" onClick={() => { logout(); navigate('/login'); }}>
          <i className="fas fa-right-from-bracket"></i><span>Quitter</span>
        </button>
      </div>
    </nav>
  );
}
