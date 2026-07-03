/*
 * FICHIER : src/dashboards/entreprise/layout/Sidebar.tsx
 *
 * ✅ AJOUT : prop `companyLogo` et `companyName` pour afficher
 *    le vrai logo de la boutique dans la carte entreprise.
 */

import React from 'react';
import type { EntreprisePage } from '../types';
import { useToast } from '../../../shared/context/ToastContext';
import { useGlobalCall } from '../../../shared/context/GlobalCallContext';
import './Sidebar.css';

interface SidebarProps {
  activePage:   EntreprisePage;
  onNavigate:   (page: EntreprisePage) => void;
  companyLogo?: string | null;   // ✅ NOUVEAU — URL Cloudinary du logo
  companyName?: string;          // ✅ NOUVEAU — nom de la boutique
}

const NAV_SECTIONS = [
  {
    title: 'Principal',
    items: [
      { id: 'overview'  as EntreprisePage, icon: 'fa-chart-pie',    label: "Vue d'ensemble" },
      { id: 'commandes' as EntreprisePage, icon: 'fa-box',           label: 'Commandes',     badge: '14', badgeClass: 'r' },
      { id: 'retours'   as EntreprisePage, icon: 'fa-rotate-left',   label: 'Retours & SAV', badge: '3',  badgeClass: 'a' },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      { id: 'produits'   as EntreprisePage, icon: 'fa-tag',         label: 'Produits',       badge: '124' },
      { id: 'ajouter'    as EntreprisePage, icon: 'fa-plus-circle', label: 'Ajouter produit' },
      { id: 'inventaire' as EntreprisePage, icon: 'fa-warehouse',   label: 'Inventaire',     badge: '6', badgeClass: 'a' },
      { id: 'promotions' as EntreprisePage, icon: 'fa-percent',     label: 'Promotions',     badge: '4', badgeClass: 'p' },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { id: 'analytics' as EntreprisePage, icon: 'fa-chart-line',             label: 'Analytics' },
      { id: 'messages'  as EntreprisePage, icon: 'fa-comment-dots',           label: 'Messages',       badge: '5', badgeClass: 'new' },
      { id: 'seo'       as EntreprisePage, icon: 'fa-magnifying-glass-chart', label: 'SEO & Marketing' },
    ],
  },
  {
    title: 'Réseau & Logistique',
    items: [
      { id: 'livreurs'       as EntreprisePage, icon: 'fa-motorcycle', label: 'Mes livreurs',   badge: '6', badgeClass: 'g' },
      { id: 'correspondants' as EntreprisePage, icon: 'fa-map-pin',    label: 'Correspondants', badge: '3', badgeClass: 'p' },
    ],
  },
  {
    title: 'Finances & Clients',
    items: [
      { id: 'finances'     as EntreprisePage, icon: 'fa-coins',  label: 'Finances' },
      { id: 'portefeuille' as EntreprisePage, icon: 'fa-wallet', label: 'Portefeuille' },
      { id: 'clients'  as EntreprisePage, icon: 'fa-users', label: 'Clients' },
      { id: 'avis'     as EntreprisePage, icon: 'fa-star',  label: 'Avis clients', badge: '8', badgeClass: 'a' },
    ],
  },
];

export default function Sidebar({ activePage, onNavigate, companyLogo, companyName }: SidebarProps) {
  const { pop } = useToast();
  const { msgUnread } = useGlobalCall();

  /* Initiales de la boutique si pas de logo */
  const initiales = (companyName ?? 'TC')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

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

          {/*
           * ✅ CORRIGÉ : affiche le vrai logo si disponible,
           *    sinon les initiales sur fond gradient navy
           */}
          <div className="sb-shop-logo">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName ?? 'Logo boutique'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 'inherit',
                  display: 'block',
                }}
              />
            ) : (
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
                {initiales}
              </span>
            )}
          </div>

          <div>
            {/* ✅ Nom dynamique depuis les props */}
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
        {NAV_SECTIONS.map(section => (
          <React.Fragment key={section.title}>
            <div className="sb-sect">{section.title}</div>
            {section.items.map(item => {
              const isMessages = item.id === 'messages';
              const badgeVal   = isMessages
                ? (msgUnread > 0 ? (msgUnread > 99 ? '99+' : String(msgUnread)) : null)
                : (item.badge ?? null);
              return (
                <div
                  key={item.id}
                  className={`nb${activePage === item.id ? ' on' : ''}`}
                  onClick={() => onNavigate(item.id)}
                >
                  <i className={`fas ${item.icon}`}></i>
                  <span>{item.label}</span>
                  {badgeVal && (
                    <span className={`nb-badge${isMessages ? ' new' : (item.badgeClass ? ` ${item.badgeClass}` : '')}`}>
                      {badgeVal}
                    </span>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}

        {/* ── Section Boutique ── */}
        <div className="sb-sect">Boutique</div>
        <div
          className={`nb${activePage === 'parametres' ? ' on' : ''}`}
          onClick={() => onNavigate('parametres')}
        >
          <i className="fas fa-gear"></i>
          <span>Paramètres</span>
        </div>
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
        <button className="sb-bot-btn" onClick={() => pop('👋 Déconnexion en cours…', 'w')}>
          <i className="fas fa-right-from-bracket"></i><span>Quitter</span>
        </button>
      </div>
    </nav>
  );
}