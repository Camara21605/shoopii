// components/Sidebar.tsx
import React from 'react';
import s from '../styles/Sidebar.module.css';
import { pop } from './Toast';
import type { PageId } from '../data/correspondantData';

interface Props {
  page: PageId;
  setPage: (p: PageId) => void;
  open: boolean;
  onClose: () => void;
}
interface NavItem { id: PageId; icon: string; label: string; badge?: string; badgeCls?: string; }

const GROUPS: { title: string; items: NavItem[] }[] = [
  { title: 'Mon espace', items: [
    { id: 'overview',   icon: 'fa-chart-pie',         label: "Vue d'ensemble" },
    { id: 'colis',      icon: 'fa-box',               label: 'Colis en dépôt',      badge: '14',     badgeCls: '' },
    { id: 'transferts', icon: 'fa-arrows-rotate',     label: 'Transferts actifs',   badge: '3',      badgeCls: s.badgeT },
    { id: 'retours',    icon: 'fa-rotate-left',       label: 'Retours & litiges',   badge: '2',      badgeCls: s.badgeR },
  ]},
  { title: 'Mes relations', items: [
    { id: 'boutiques',  icon: 'fa-store',             label: 'Boutiques partenaires', badge: '4',    badgeCls: s.badgeB },
    { id: 'livreurs',   icon: 'fa-motorcycle',        label: 'Livreurs locaux',     badge: '7',      badgeCls: s.badgeT },
    { id: 'clients',    icon: 'fa-users',             label: 'Clients zone' },
  ]},
  { title: 'Finances & Compte', items: [
    { id: 'revenus',     icon: 'fa-coins',             label: 'Mes revenus' },
    { id: 'portefeuille', icon: 'fa-wallet',           label: 'Portefeuille' },
    { id: 'zone',       icon: 'fa-map-location-dot',  label: 'Ma zone' },
    { id: 'evaluation', icon: 'fa-star',              label: 'Mon évaluation',      badge: '★ 4.9' },
    { id: 'parametres', icon: 'fa-gear',              label: 'Paramètres' },
  ]},
];

export default function Sidebar({ page, setPage, open, onClose }: Props) {
  const go = (id: PageId) => { setPage(id); onClose(); };
  return (
    <nav className={`${s.sb} ${open ? s.open : ''}`}>
      {/* Logo */}
      <div className={s.logo}>
        <div className={s.logoMark}>Sh</div>
        <div className={s.brand}>Sho<b>pi</b></div>
      </div>

      {/* Card correspondant */}
      <div className={s.corCard}>
        <div className={s.corInner} onClick={() => go('parametres')}>
          <div className={s.corTop}>
            <div className={s.ava}>
              📍<div className={s.avaOnline} />
            </div>
            <div>
              <div className={s.corName}>Amadou Bah</div>
              <div className={s.corRole}><i className="fas fa-map-pin" /> Correspondant · Conakry</div>
            </div>
          </div>
          <div className={s.regionBadge}>
            <div className={s.regionTxt}><i className="fas fa-globe-africa" /> Région : Conakry</div>
            <div className={s.regionScope}>Type Régional</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className={s.nav}>
        {GROUPS.map(g => (
          <div key={g.title}>
            <div className={s.sect}>{g.title}</div>
            {g.items.map(item => (
              <div
                key={item.id}
                className={`${s.nb} ${page === item.id ? s.nbOn : ''}`}
                onClick={() => go(item.id)}
              >
                <i className={`fas ${item.icon}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`${s.badge} ${item.badgeCls ?? ''}`}>{item.badge}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div className={s.bot}>
        <button className={s.botBtn} onClick={() => pop('🔔 Notifications', 'i')}>
          <i className="fas fa-bell" /><span>Alertes</span>
        </button>
        <button className={s.botBtn} onClick={() => pop('👋 À bientôt !', 'w')}>
          <i className="fas fa-right-from-bracket" /><span>Quitter</span>
        </button>
      </div>
    </nav>
  );
}