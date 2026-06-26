/*
 * ============================================================
 * FICHIER : src/dashboards/entreprise/layout/Topbar.tsx
 *
 * Barre supérieure du dashboard Entreprise, façon "Header home".
 *
 * ✅ Boutons rapides : Livreurs, Correspondants
 * ✅ Bouton "Accueil client" → bascule vers le home public (/home)
 * ✅ Menu avatar (dropdown) : Mon profil, Voir ma boutique,
 *    Basculer vers l'accueil, Déconnexion
 * ✅ Badge panier/notifs conservés
 * ✅ Bottom nav MOBILE (la sidebar est masquée en petit écran) :
 *    accès aux pages principales + bouton "Menu" qui ouvre un
 *    drawer complet (toutes les pages + déconnexion)
 * ============================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import type { EntreprisePage } from '../types';
import { useToast } from '../../../shared/context/ToastContext';
/* ⚠️ Vérifie ce chemin selon ton projet (même que le Header home) */
import { tokenStorage } from '../../../shared/services/apiFetch';
import './Topbar.css';

interface TopbarProps {
  activePage:     EntreprisePage;
  onNavigate:     (page: EntreprisePage) => void;
  companyId?:     string;
  companyLogo?:   string | null;
  companyName?:   string;
  companyStatus?: string;
  companyEmail?:  string;
  companyVille?:  string;
  companyPays?:   string;
}

/* Titre + sous-titre par page */
const TITLES: Record<EntreprisePage, [string, string]> = {
  overview:       ["Vue d'ensemble",          'Tableau de bord de votre boutique'],
  commandes:      ['Commandes',               'Gérez toutes vos commandes'],
  retours:        ['Retours & SAV',           'Gestion des retours et service après-vente'],
  produits:       ['Catalogue produits',      '124 produits · 8 catégories'],
  ajouter:        ['Ajouter un produit',      'Créez et publiez un nouveau produit'],
  inventaire:     ['Inventaire & Stock',      'Gérez vos niveaux de stock'],
  promotions:     ['Promotions & Codes promo','Boostez vos ventes avec des offres'],
  analytics:      ['Analytics avancées',      'Statistiques et performances de votre boutique'],
  messages:       ['Messages clients',        'Conversations et support client'],
  seo:            ['SEO & Marketing',         'Optimisation et campagnes marketing'],
  livreurs:       ['Mes livreurs',            'Réseau de livraison · 4 actifs'],
  correspondants: ['Correspondants',          'Vos relais locaux et internationaux'],
  finances:       ['Finances',                'Revenus, dépenses et transactions'],
  portefeuille:   ['Portefeuille',            'Solde, retraits et transactions'],
  clients:        ['Clients',                 'Base clients · 2 414 acheteurs'],
  avis:           ['Avis clients',            '248 avis · Note moyenne 4.9 ⭐'],
  parametres:     ['Paramètres',              'Configuration de votre boutique'],
  profil:             ['Mon profil',              'Profil public de votre boutique'],
  'boutique-preview': ['Voir ma boutique',        'Aperçu de votre boutique telle que vos clients la voient'],
  reseauCorrespondants:     ['Correspondants',     'Suivez des correspondants du réseau Shopi'],
  reseauLivreurs:           ['Livreurs',           "Suivez d'autres livreurs du réseau Shopi"],
  profilCorrespondantReseau:['Profil correspondant', 'Détails et suivi'],
  profilLivreurReseau:      ['Profil livreur',       'Détails et suivi'],
};

/* Items du drawer mobile (navigation complète) */
const DRAWER_NAV: { id: EntreprisePage; icon: string; label: string }[] = [
  { id: 'overview',       icon: 'fa-chart-pie',    label: "Vue d'ensemble" },
  { id: 'commandes',      icon: 'fa-box',           label: 'Commandes' },
  { id: 'retours',        icon: 'fa-rotate-left',   label: 'Retours & SAV' },
  { id: 'produits',       icon: 'fa-tag',           label: 'Produits' },
  { id: 'ajouter',        icon: 'fa-plus-circle',   label: 'Ajouter produit' },
  { id: 'inventaire',     icon: 'fa-warehouse',     label: 'Inventaire' },
  { id: 'promotions',     icon: 'fa-percent',       label: 'Promotions' },
  { id: 'analytics',      icon: 'fa-chart-line',    label: 'Analytics' },
  { id: 'messages',       icon: 'fa-comment-dots',  label: 'Messages' },
  { id: 'seo',            icon: 'fa-magnifying-glass-chart', label: 'SEO & Marketing' },
  { id: 'livreurs',       icon: 'fa-motorcycle',    label: 'Mes livreurs' },
  { id: 'correspondants', icon: 'fa-map-pin',       label: 'Correspondants' },
  { id: 'reseauLivreurs',       icon: 'fa-user-group',   label: 'Suivre des livreurs' },
  { id: 'reseauCorrespondants', icon: 'fa-circle-nodes', label: 'Suivre des correspondants' },
  { id: 'finances',       icon: 'fa-coins',         label: 'Finances' },
  { id: 'portefeuille',   icon: 'fa-wallet',        label: 'Portefeuille' },
  { id: 'clients',        icon: 'fa-users',         label: 'Clients' },
  { id: 'avis',           icon: 'fa-star',          label: 'Avis clients' },
  { id: 'parametres',     icon: 'fa-gear',          label: 'Paramètres' },
];

/* Libellé statut boutique */
const STATUS_LABEL: Record<string, string> = {
  active:    'Boutique active',
  suspended: 'En pause',
  private:   'Privée',
  pending:   'En attente de validation',
};

export default function Topbar({
  activePage, onNavigate,
  companyId,
  companyLogo, companyName,
  companyStatus, companyEmail, companyVille, companyPays,
}: TopbarProps) {
  const { pop } = useToast();
  const navigate = useNavigate();

  const [searchVal,      setSearchVal]      = useState('');
  const [avatarOpen,     setAvatarOpen]     = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  const [title, subtitle] = TITLES[activePage] ?? ['', ''];

  /* Initiales si pas de logo */
  const initiales = (companyName ?? 'TC')
    .split(' ').slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '').join('');

  /* Fermer le dropdown avatar au clic extérieur */
  useEffect(() => {
    if (!avatarOpen) return;
    const fn = (e: MouseEvent) => {
      if (!avatarRef.current?.contains(e.target as Node)) setAvatarOpen(false);
    };
    document.addEventListener('click', fn);
    return () => document.removeEventListener('click', fn);
  }, [avatarOpen]);

  /* Verrouiller le scroll quand le drawer mobile est ouvert */
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  /* ── Actions ── */
  function handleSwitchHome() {
    setAvatarOpen(false);
    setMobileMenuOpen(false);
    navigate('/home');               /* bascule vers l'accueil client public */
  }

  function handleLogout() {
    tokenStorage.remove();
    setAvatarOpen(false);
    setMobileMenuOpen(false);
    navigate('/login');
  }

  function go(page: EntreprisePage) {
    onNavigate(page);
    setMobileMenuOpen(false);
  }

  return (
    <>
      <header className="topbar">

        {/* Titre de la page */}
        <div className="tb-title-wrap">
          <div className="tb-title">{title}</div>
          <div className="tb-sub">{subtitle}</div>
        </div>

        {/* Barre de recherche */}
        <div className="tb-srch">
          <input
            type="text"
            placeholder="Rechercher commandes, produits, clients…"
            value={searchVal}
            onChange={e => {
              setSearchVal(e.target.value);
              if (e.target.value.length > 2) pop(`🔍 Recherche: "${e.target.value}"…`, 'i');
            }}
          />
          <button><i className="fas fa-magnifying-glass"></i></button>
        </div>

        {/* Actions rapides (desktop) */}
        <div className="tb-acts">

          {/* ✅ Raccourcis réseau : Livreurs / Correspondants (gestion) */}
          <button className={`tb-ic${activePage === 'livreurs' ? ' active' : ''}`} title="Mes livreurs"
            onClick={() => onNavigate('livreurs')}>
            <i className="fas fa-motorcycle"></i>
          </button>
          <button className={`tb-ic${activePage === 'correspondants' ? ' active' : ''}`} title="Correspondants"
            onClick={() => onNavigate('correspondants')}>
            <i className="fas fa-map-pin"></i>
          </button>

          <div className="tb-sep"></div>

          {/* ✅ Suivre des livreurs / correspondants du réseau (différent de la gestion) */}
          <button className={`tb-ic${activePage === 'reseauLivreurs' || activePage === 'profilLivreurReseau' ? ' active' : ''}`} title="Suivre des livreurs"
            onClick={() => onNavigate('reseauLivreurs')}>
            <i className="fas fa-user-group"></i>
          </button>
          <button className={`tb-ic${activePage === 'reseauCorrespondants' || activePage === 'profilCorrespondantReseau' ? ' active' : ''}`} title="Suivre des correspondants"
            onClick={() => onNavigate('reseauCorrespondants')}>
            <i className="fas fa-circle-nodes"></i>
          </button>

          <div className="tb-sep"></div>

          {/* Commandes / Messages / Notifications */}
          <button className="tb-ic" title="Commandes"
            onClick={() => onNavigate('commandes')}>
            <i className="fas fa-box"></i>
            <div className="tb-dot"></div>
          </button>
          <button className="tb-ic" title="Messages"
            onClick={() => onNavigate('messages')}>
            <i className="fas fa-comment-dots"></i>
            <div className="tb-dot"></div>
          </button>
          <button className="tb-ic" title="Notifications"
            onClick={() => pop('🔔 3 nouvelles notifications', 'i')}>
            <i className="fas fa-bell"></i>
            <div className="tb-dot"></div>
          </button>

          <div className="tb-sep"></div>

          {/* ✅ Bascule vers l'accueil client */}
          <button className="tb-home" title="Aller à l'accueil Shopi"
            onClick={handleSwitchHome}>
            <i className="fas fa-house"></i> Accueil
          </button>

          {/* Paramètres */}
          <button className={`tb-settings${activePage === 'parametres' ? ' active' : ''}`}
            onClick={() => onNavigate('parametres')}>
            <i className="fas fa-gear"></i> Paramètres
          </button>

          {/* Nouveau produit */}
          <button className="tb-new" onClick={() => onNavigate('ajouter')}>
            <i className="fas fa-plus"></i> Nouveau produit
          </button>

          {/* ✅ Avatar + dropdown */}
          <div className="tb-ava-wrap" ref={avatarRef}>
            <div
              className="tb-ava"
              onClick={() => setAvatarOpen(o => !o)}
              title={companyName ?? 'Mon compte'}
              style={{ overflow: 'hidden', padding: companyLogo ? 0 : undefined }}
            >
              {companyLogo
                ? <img src={companyLogo} alt={companyName ?? 'Logo'} className="tb-ava-img" />
                : initiales}
            </div>

            {avatarOpen && (
              <div className="tb-menu">
                <div className="tb-menu-head">
                  <div className="tb-menu-ava">
                    {companyLogo
                      ? <img src={companyLogo} alt="" className="tb-ava-img" />
                      : initiales}
                  </div>
                  <div>
                    <div className="tb-menu-nm">{companyName ?? 'Ma boutique'}</div>
                    <div className="tb-menu-sub">
                      {STATUS_LABEL[companyStatus ?? ''] ?? 'Vendeur Pro'}
                      {(companyVille || companyPays) && ` · ${[companyVille, companyPays].filter(Boolean).join(', ')}`}
                    </div>
                    {companyEmail && (
                      <div className="tb-menu-email">{companyEmail}</div>
                    )}
                  </div>
                </div>

                <button className="tb-menu-it" onClick={() => { onNavigate('profil'); setAvatarOpen(false); }}>
                  <i className="fas fa-user"></i> Mon profil
                </button>
                <button className="tb-menu-it" onClick={() => { onNavigate('boutique-preview'); setAvatarOpen(false); }}>
                  <i className="fas fa-store"></i> Voir ma boutique
                </button>
                <button className="tb-menu-it" onClick={handleSwitchHome}>
                  <i className="fas fa-house"></i> Basculer vers l'accueil
                </button>

                <div className="tb-menu-sep"></div>

                <button className="tb-menu-it danger" onClick={handleLogout}>
                  <i className="fas fa-right-from-bracket"></i> Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ════════ BOTTOM NAV MOBILE ════════ */}
      <nav className="tb-bottomnav" aria-label="Navigation mobile">
        <button className={`bn-it${activePage === 'overview' ? ' on' : ''}`}
          onClick={() => onNavigate('overview')}>
          <i className="fas fa-chart-pie"></i><span>Accueil</span>
        </button>
        <button className={`bn-it${activePage === 'commandes' ? ' on' : ''}`}
          onClick={() => onNavigate('commandes')}>
          <i className="fas fa-box"></i><span>Commandes</span>
        </button>

        {/* Bouton central : Nouveau produit */}
        <button className="bn-it bn-fab" onClick={() => onNavigate('ajouter')} title="Nouveau produit">
          <div className="bn-fab-ic"><i className="fas fa-plus"></i></div>
        </button>

        <button className={`bn-it${activePage === 'produits' ? ' on' : ''}`}
          onClick={() => onNavigate('produits')}>
          <i className="fas fa-tag"></i><span>Produits</span>
        </button>
        <button className={`bn-it${mobileMenuOpen ? ' on' : ''}`}
          onClick={() => setMobileMenuOpen(true)}>
          <i className="fas fa-bars"></i><span>Menu</span>
        </button>
      </nav>

      {/* ════════ DRAWER MOBILE (menu complet) ════════ */}
      {mobileMenuOpen && (
        <div className="tb-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="tb-drawer" onClick={e => e.stopPropagation()}>

            {/* En-tête boutique */}
            <div className="tb-drawer-head">
              <div className="tb-drawer-ava">
                {companyLogo
                  ? <img src={companyLogo} alt="" className="tb-ava-img" />
                  : initiales}
              </div>
              <div className="tb-drawer-inf">
                <div className="tb-drawer-nm">{companyName ?? 'Ma boutique'}</div>
                <div className="tb-drawer-sub">
                  {STATUS_LABEL[companyStatus ?? ''] ?? 'Vendeur Pro'}
                  {(companyVille || companyPays) && ` · ${[companyVille, companyPays].filter(Boolean).join(', ')}`}
                </div>
              </div>
              <button className="tb-drawer-x" onClick={() => setMobileMenuOpen(false)}>
                <i className="fas fa-xmark"></i>
              </button>
            </div>

            {/* Navigation complète */}
            <div className="tb-drawer-nav">
              {DRAWER_NAV.map(item => (
                <button key={item.id}
                  className={`tb-drawer-it${activePage === item.id ? ' on' : ''}`}
                  onClick={() => go(item.id)}>
                  <i className={`fas ${item.icon}`}></i>
                  <span>{item.label}</span>
                  {activePage === item.id && <i className="fas fa-check tb-drawer-chk"></i>}
                </button>
              ))}
            </div>

            {/* Actions bas du drawer */}
            <div className="tb-drawer-foot">
              {companyId && (
                <button className="tb-drawer-home" onClick={() => { setMobileMenuOpen(false); onNavigate('boutique-preview'); }}>
                  <i className="fas fa-store"></i> Voir ma boutique
                </button>
              )}
              <button className="tb-drawer-home" onClick={handleSwitchHome}>
                <i className="fas fa-house"></i> Basculer vers l'accueil
              </button>
              <button className="tb-drawer-out" onClick={handleLogout}>
                <i className="fas fa-right-from-bracket"></i> Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}