// components/Sidebar.tsx
import React from 'react';
import s from '../styles/Sidebar.module.css';
import { pop } from './Toast';
import WalletQuickBar from '../../../shared/components/portefeuille/WalletQuickBar';
import { useSidebarBadges } from '../hooks/useSidebarBadges';
import type { CorrespondantBadges } from '../hooks/useSidebarBadges';
import type { PageId } from '../data/correspondantData';

interface Props {
  page: PageId;
  setPage: (p: PageId) => void;
  open: boolean;
  onClose: () => void;
  nomUtilisateur?: string;
  photoUrl?: string | null;
}
interface NavItem { id: PageId; icon: string; label: string; badge?: string; badgeCls?: string; }

/* Badges calculés en direct (voir useSidebarBadges) — plus aucune valeur
 * codée en dur ici. Un onglet sans donnée réelle correspondante n'a
 * simplement pas de badge (ex: "clients", "revenus", "zone"). */
function buildGroups(b: CorrespondantBadges): { title: string | null; items: NavItem[] }[] {
  return [
    { title: null, items: [
      { id: 'overview',   icon: 'fa-chart-pie',         label: "Vue d'ensemble" },
      { id: 'colis',      icon: 'fa-box',               label: 'Colis en dépôt',      ...(b.colis      ? { badge: String(b.colis),      badgeCls: '' }        : {}) },
      { id: 'transferts', icon: 'fa-arrows-rotate',     label: 'Transferts actifs',   ...(b.transferts ? { badge: String(b.transferts), badgeCls: s.badgeT }  : {}) },
      { id: 'retours',    icon: 'fa-rotate-left',       label: 'Retours & litiges',   ...(b.retours    ? { badge: String(b.retours),    badgeCls: s.badgeR }  : {}) },
    ]},
    { title: 'Mes relations', items: [
      { id: 'boutiques',  icon: 'fa-store',             label: 'Boutiques partenaires', ...(b.boutiques ? { badge: String(b.boutiques), badgeCls: s.badgeB } : {}) },
      { id: 'livreurs',   icon: 'fa-motorcycle',        label: 'Livreurs locaux',     ...(b.livreurs   ? { badge: String(b.livreurs),   badgeCls: s.badgeT }  : {}) },
      { id: 'clients',    icon: 'fa-users',             label: 'Clients zone' },
    ]},
    { title: 'Finances & Compte', items: [
      { id: 'revenus',     icon: 'fa-coins',             label: 'Mes revenus' },
      { id: 'portefeuille', icon: 'fa-wallet',           label: 'Portefeuille' },
      { id: 'zone',       icon: 'fa-map-location-dot',  label: 'Ma zone' },
      { id: 'evaluation', icon: 'fa-star',              label: 'Mon évaluation',      ...(b.evaluation ? { badge: b.evaluation } : {}) },
      { id: 'parametres', icon: 'fa-gear',              label: 'Paramètres' },
    ]},
  ];
}

export default function Sidebar({ page, setPage, open, onClose, nomUtilisateur, photoUrl }: Props) {
  const displayName = nomUtilisateur ?? '—';
  const initiales   = nomUtilisateur
    ? nomUtilisateur.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  const { badges } = useSidebarBadges();
  const GROUPS = buildGroups(badges);
  const go = (id: PageId) => { setPage(id); onClose(); };
  return (
    <nav className={`${s.sb} ${open ? s.open : ''}`}>
      {/* Logo */}
      <div className={s.logo}>
        <div className={s.brand}>Sho<b>neya</b></div>
      </div>

      {/* Card correspondant */}
      <div className={s.corCard}>
        <div className={s.corInner} onClick={() => go('parametres')}>
          <div className={s.corTop}>
            <div className={s.ava}>
              {photoUrl
                ? <img src={photoUrl} alt={displayName} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit' }} />
                : initiales}
              <div className={s.avaOnline} />
            </div>
            <div>
              <div className={s.corName}>{displayName}</div>
              <div className={s.corRole}><i className="fas fa-map-pin" /> Correspondant</div>
            </div>
          </div>
          <div className={s.regionBadge}>
            <div className={s.regionTxt}><i className="fas fa-globe-africa" /> Région : Conakry</div>
            <div className={s.regionScope}>Type Régional</div>
          </div>
        </div>
      </div>

      {/* Solde du portefeuille Shoneya — sous la carte correspondant.
          Masqué en rail compact (≤960px, s.walletWrap) : WalletQuickBar
          n'a pas de mode icône-seule et déborderait dans une piste de 68px. */}
      <div className={s.walletWrap} style={{ padding: '0 22px 12px' }}>
        <WalletQuickBar compact mini onManage={() => go('portefeuille')} />
      </div>

      {/* Navigation */}
      <div className={s.nav}>
        {GROUPS.map((g, gi) => (
          <div key={g.title ?? gi}>
            {g.title && <div className={s.sect}>{g.title}</div>}
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
      </div>
    </nav>
  );
}