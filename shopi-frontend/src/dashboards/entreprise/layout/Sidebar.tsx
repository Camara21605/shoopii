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
import { useSidebarBadges } from '../hooks/useSidebarBadges';
import WalletQuickBar from '../../../shared/components/portefeuille/WalletQuickBar';
import './Sidebar.css';

type CanFn = (group: string, action: string) => boolean;

/* Libellé du statut réel de la boutique (avant : « Actif » affiché en dur, même pour une boutique en pause) */
const STATUS_LABEL_KEYS: Record<string, string> = {
  active:    'topbar.status.active',
  suspended: 'topbar.status.suspended',
  private:   'topbar.status.private',
  pending:   'topbar.status.pending',
};

interface SidebarProps {
  activePage:   EntreprisePage;
  onNavigate:   (page: EntreprisePage) => void;
  companyLogo?: string | null;
  companyName?: string;
  /** Statut réel de la boutique (active | suspended | private | pending) */
  companyStatus?: string;
  /** true = identité pas encore connue : squelette au lieu d'un nom de remplacement */
  identityLoading?: boolean;
  /** Filtre le bloc "Catalogue" entre produits et services — voir
   *  buildNavSections() plus bas et Company.businessModel côté backend. */
  businessModel?: 'products' | 'services';
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
  /** Style de couleur du badge (rouge/ambre/vert/violet…) — le NOMBRE
   *  affiché, lui, est toujours calculé en direct (voir useSidebarBadges),
   *  jamais une valeur codée en dur ici. */
  badgeClass?: string;
  /** Permission requise : [group, action] */
  perm?:       [string, string];
}

/* Les valeurs title/label sont des CLÉS de traduction (namespace "common",
   voir src/shared/i18n/locales/{fr,en}/common.json → sidebar.*), pas du
   texte en dur — NAV_SECTIONS reste une constante de module (pas de hook
   ici), la résolution `t(clé)` se fait au rendu dans le composant. */
/** Bloc "Catalogue" pour un compte businessModel==='products' (par défaut). */
const CATALOGUE_PRODUITS: NavItem[] = [
  { id: 'produits',     icon: 'fa-tag',       label: 'sidebar.items.produits',                    perm: ['products',   'view']   },
  { id: 'ajouter',      icon: 'fa-plus-circle', label: 'sidebar.items.ajouter',                   perm: ['products',   'create'] },
  { id: 'inventaire',   icon: 'fa-warehouse', label: 'sidebar.items.inventaire', badgeClass: 'a',  perm: ['products', 'view']   },
  { id: 'fournisseurs', icon: 'fa-industry',  label: 'sidebar.items.fournisseurs',                perm: ['fournisseurs', 'view']   },
  { id: 'promotions',   icon: 'fa-percent',   label: 'sidebar.items.promotions', badgeClass: 'p',  perm: ['promotions','view']  },
];

/** Bloc "Catalogue" pour un compte businessModel==='services' — remplace
 *  entièrement le bloc produits (stock/fournisseurs/promotions n'ont pas de
 *  sens pour une prestation, voir service.entity.ts "hors scope MVP"). */
const CATALOGUE_SERVICES: NavItem[] = [
  { id: 'services',        icon: 'fa-concierge-bell', label: 'sidebar.items.services',       perm: ['services', 'view']   },
  { id: 'ajouter-service', icon: 'fa-plus-circle',    label: 'sidebar.items.ajouterService',             perm: ['services', 'create'] },
];

/**
 * Construit les sections de navigation selon le modèle économique du
 * compte connecté — un compte "produits" et un compte "services" ne
 * voient jamais les deux catalogues à la fois (voir Company.businessModel,
 * modèle exclusif fixé à l'inscription).
 */
function buildNavSections(businessModel?: 'products' | 'services'): { title: string; items: NavItem[] }[] {
  const catalogueItems = businessModel === 'services' ? CATALOGUE_SERVICES : CATALOGUE_PRODUITS;
  return [
    {
      title: 'sidebar.sections.principal',
      items: [
        { id: 'overview',      icon: 'fa-chart-pie', label: 'sidebar.items.overview' },
        { id: 'commandes', icon: 'fa-box',         label: 'sidebar.items.commandes', badgeClass: 'r', perm: ['orders',  'view'] },
        /* Pas de badge live pour "Retours" — aucun NotificationType dédié
         * n'existe encore côté backend (voir SIDEBAR_BADGE_TYPES) ; mieux
         * vaut aucun chiffre qu'un chiffre inventé. */
        { id: 'retours',   icon: 'fa-rotate-left', label: 'sidebar.items.retours',   perm: ['returns', 'view'] },
      ],
    },
    {
      title: 'sidebar.sections.catalogue',
      items: catalogueItems,
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
        { id: 'livreurs',       icon: 'fa-motorcycle', label: 'sidebar.items.livreurs',       badgeClass: 'g', perm: ['deliveries', 'view'] },
        { id: 'correspondants', icon: 'fa-map-pin',    label: 'sidebar.items.correspondants', badgeClass: 'p', perm: ['deliveries', 'view'] },
      ],
    },
    {
      title: 'sidebar.sections.financesClients',
      items: [
        { id: 'finances',     icon: 'fa-coins',  label: 'sidebar.items.finances',     perm: ['payments', 'view']             },
        { id: 'portefeuille', icon: 'fa-wallet', label: 'sidebar.items.portefeuille', perm: ['wallet', 'view'] },
        { id: 'clients',  icon: 'fa-users', label: 'sidebar.items.clients', perm: ['orders', 'view'] },
        { id: 'avis',     icon: 'fa-star',  label: 'sidebar.items.avis',    badgeClass: 'a', perm: ['orders', 'view'] },
      ],
    },
    {
      title: 'sidebar.sections.equipe',
      items: [
        { id: 'equipe', icon: 'fa-users-gear', label: 'sidebar.items.equipeGestion', perm: ['team', 'view'] },
      ],
    },
  ];
}

export default function Sidebar({
  activePage, onNavigate,
  companyLogo, companyName, companyStatus, identityLoading = false, businessModel,
  can, isOwner = false,
}: SidebarProps) {
  const { pop } = useToast();
  const { t } = useTranslation();
  const { getBadge, clearBadge } = useSidebarBadges();

  const handleItemClick = (id: EntreprisePage) => {
    clearBadge(id);
    onNavigate(id);
  };

  const initiales = (companyName ?? '')
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
            {identityLoading ? (
              <span className="id-skel id-skel-ava" aria-hidden="true" />
            ) : companyLogo ? (
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
            {identityLoading ? (
              <>
                <div className="id-skel id-skel-nm" aria-hidden="true" />
                <div className="id-skel id-skel-sub" aria-hidden="true" />
              </>
            ) : (
              <>
                <div className="sb-shop-nm">{companyName ?? t('topbar.status.default')}</div>
                <div className="sb-shop-sub">
                  <span className="sb-shop-dot"></span>
                  {t(STATUS_LABEL_KEYS[companyStatus ?? ''] ?? 'topbar.status.default')}
                </div>
              </>
            )}
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
        {buildNavSections(businessModel).map(section => {
          const visibleItems = section.items.filter(isVisible);
          if (visibleItems.length === 0) return null;
          return (
            <React.Fragment key={section.title}>
              <div className="sb-sect">{t(section.title)}</div>
              {visibleItems.map(item => {
                const count = getBadge(item.id);
                return (
                  <div
                    key={item.id}
                    className={`nb${activePage === item.id ? ' on' : ''}`}
                    onClick={() => handleItemClick(item.id)}
                  >
                    <i className={`fas ${item.icon}`}></i>
                    <span>{t(item.label)}</span>
                    {count > 0 && (
                      <span className={`nb-badge${item.badgeClass ? ` ${item.badgeClass}` : ''}`}>
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </div>
                );
              })}
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
