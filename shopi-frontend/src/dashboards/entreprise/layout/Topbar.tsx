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
import { useTranslation } from 'react-i18next';

import type { EntreprisePage } from '../types';
import { apiFetch } from '../../../shared/services/apiFetch';
import { useGlobalCall } from '../../../shared/context/GlobalCallContext';
import NotificationCenter from '../../../shared/notifications/NotificationCenter';
import { useNotifications } from '../../../shared/notifications/NotificationContext';
import WalletQuickBar from '../../../shared/components/portefeuille/WalletQuickBar';
import MonEspaceClientModal from '../../../shared/components/MonEspaceClientModal';
import AccountSwitchLink   from '../../../shared/components/AccountSwitchLink';
import './Topbar.css';

type CanFn = (group: string, action: string) => boolean;

interface TopbarProps {
  activePage:     EntreprisePage;
  onNavigate:     (page: EntreprisePage, id?: string) => void;
  companyId?:     string;
  companyLogo?:   string | null;
  companyName?:   string;
  companyStatus?: string;
  companyEmail?:  string;
  companyVille?:  string;
  companyPays?:   string;
  can?:           CanFn;
  isOwner?:       boolean;
}

/* Titre + sous-titre par page — [clé titre, clé sous-titre] dans le
   namespace "common" (src/shared/i18n/locales/{fr,en}/common.json,
   sous topbar.titles.*), résolues via t() au rendu. */
const TITLES: Record<EntreprisePage, [string, string]> = {
  overview:       ['topbar.titles.overview.title',       'topbar.titles.overview.subtitle'],
  commandes:      ['topbar.titles.commandes.title',      'topbar.titles.commandes.subtitle'],
  retours:        ['topbar.titles.retours.title',        'topbar.titles.retours.subtitle'],
  produits:       ['topbar.titles.produits.title',       'topbar.titles.produits.subtitle'],
  ajouter:        ['topbar.titles.ajouter.title',        'topbar.titles.ajouter.subtitle'],
  inventaire:     ['topbar.titles.inventaire.title',     'topbar.titles.inventaire.subtitle'],
  fournisseurs:   ['topbar.titles.fournisseurs.title',   'topbar.titles.fournisseurs.subtitle'],
  promotions:     ['topbar.titles.promotions.title',     'topbar.titles.promotions.subtitle'],
  analytics:      ['topbar.titles.analytics.title',      'topbar.titles.analytics.subtitle'],
  messages:       ['topbar.titles.messages.title',       'topbar.titles.messages.subtitle'],
  seo:            ['topbar.titles.seo.title',            'topbar.titles.seo.subtitle'],
  livreurs:       ['topbar.titles.livreurs.title',       'topbar.titles.livreurs.subtitle'],
  correspondants: ['topbar.titles.correspondants.title', 'topbar.titles.correspondants.subtitle'],
  finances:       ['topbar.titles.finances.title',       'topbar.titles.finances.subtitle'],
  portefeuille:   ['topbar.titles.portefeuille.title',   'topbar.titles.portefeuille.subtitle'],
  clients:        ['topbar.titles.clients.title',        'topbar.titles.clients.subtitle'],
  avis:           ['topbar.titles.avis.title',           'topbar.titles.avis.subtitle'],
  parametres:     ['topbar.titles.parametres.title',     'topbar.titles.parametres.subtitle'],
  profil:             ['topbar.titles.profil.title',              'topbar.titles.profil.subtitle'],
  'boutique-preview': ['topbar.titles.boutiquePreview.title',     'topbar.titles.boutiquePreview.subtitle'],
  reseauCorrespondants:      ['topbar.titles.reseauCorrespondants.title',      'topbar.titles.reseauCorrespondants.subtitle'],
  reseauLivreurs:            ['topbar.titles.reseauLivreurs.title',            'topbar.titles.reseauLivreurs.subtitle'],
  profilCorrespondantReseau: ['topbar.titles.profilCorrespondantReseau.title', 'topbar.titles.profilCorrespondantReseau.subtitle'],
  profilLivreurReseau:       ['topbar.titles.profilLivreurReseau.title',      'topbar.titles.profilLivreurReseau.subtitle'],
  equipe:         ['topbar.titles.equipe.title',         'topbar.titles.equipe.subtitle'],
};

/* Items du drawer mobile (navigation complète) — réutilise les mêmes clés
   que Sidebar.tsx (sidebar.items.*) puisque les libellés sont identiques. */
const DRAWER_NAV: { id: EntreprisePage; icon: string; label: string; perm?: [string, string] }[] = [
  { id: 'overview',       icon: 'fa-chart-pie',    label: 'sidebar.items.overview' },
  { id: 'commandes',      icon: 'fa-box',           label: 'sidebar.items.commandes',  perm: ['orders',    'view'] },
  { id: 'retours',        icon: 'fa-rotate-left',   label: 'sidebar.items.retours',     perm: ['returns',   'view'] },
  { id: 'produits',       icon: 'fa-tag',           label: 'sidebar.items.produits',    perm: ['products',  'view'] },
  { id: 'ajouter',        icon: 'fa-plus-circle',   label: 'sidebar.items.ajouter',     perm: ['products',  'create'] },
  { id: 'inventaire',     icon: 'fa-warehouse',     label: 'sidebar.items.inventaire',  perm: ['products',  'view'] },
  { id: 'promotions',     icon: 'fa-percent',       label: 'sidebar.items.promotions', perm: ['promotions','view'] },
  { id: 'analytics',      icon: 'fa-chart-line',    label: 'sidebar.items.analytics',  perm: ['statistics','view'] },
  { id: 'seo',            icon: 'fa-magnifying-glass-chart', label: 'sidebar.items.seo', perm: ['statistics','view'] },
  { id: 'messages',       icon: 'fa-comment-dots',  label: 'sidebar.items.messages',    perm: ['messaging', 'view'] },
  { id: 'livreurs',       icon: 'fa-motorcycle',    label: 'sidebar.items.livreurs',       perm: ['deliveries','view'] },
  { id: 'correspondants', icon: 'fa-map-pin',       label: 'sidebar.items.correspondants', perm: ['deliveries','view'] },
  { id: 'finances',       icon: 'fa-coins',         label: 'sidebar.items.finances',       perm: ['payments',  'view'] },
  { id: 'portefeuille',   icon: 'fa-wallet',        label: 'sidebar.items.portefeuille',   perm: ['payments',  'viewTransactions'] },
  { id: 'clients',        icon: 'fa-users',         label: 'sidebar.items.clients',        perm: ['orders',    'view'] },
  { id: 'avis',           icon: 'fa-star',          label: 'sidebar.items.avis',           perm: ['orders',    'view'] },
  { id: 'parametres',     icon: 'fa-gear',          label: 'sidebar.items.parametres',     perm: ['settings',  'view'] },
];

/* ─────────────────────────────────────────────────────────────
   RECHERCHE GLOBALE — types de résultats (un sous-ensemble minimal
   des champs réels, juste ce qu'affiche le dropdown) et endpoints
   interrogés en parallèle. Chaque backend supporte déjà ?search= :
     GET /produits                    → { data: Produit[] }
     GET /entreprise/commandes        → Commande[]            (pas d'enveloppe)
     GET /dashboard/entreprise/clients→ { data: Client[] }
     GET /livreurs                    → { data: Livreur[] }
     GET /correspondants              → { data: Correspondant[] }
   ───────────────────────────────────────────────────────────── */
interface SearchProduit       { id: string; nom: string; prix: number; images: { url: string }[] }
interface SearchCommande      { uuid: string; id: string; client: string; price: number }
interface SearchClient        { id: string; fullName: string; email: string; profilePicture: string | null }
interface SearchLivreur       { id: string; fullName: string; zone: string | null; avatarEmoji: string }
interface SearchCorrespondant { id: string; fullName: string; ville: string; avatarEmoji: string }

interface SearchResults {
  produits:       SearchProduit[];
  commandes:      SearchCommande[];
  clients:        SearchClient[];
  livreurs:       SearchLivreur[];
  correspondants: SearchCorrespondant[];
}

const EMPTY_RESULTS: SearchResults = { produits: [], commandes: [], clients: [], livreurs: [], correspondants: [] };

/* Libellé statut boutique — clés dans topbar.status.*, 'default' pour le
   fallback "Vendeur Pro" utilisé quand companyStatus ne correspond à rien. */
const STATUS_LABEL_KEYS: Record<string, string> = {
  active:    'topbar.status.active',
  suspended: 'topbar.status.suspended',
  private:   'topbar.status.private',
  pending:   'topbar.status.pending',
};

export default function Topbar({
  activePage, onNavigate,
  companyId,
  companyLogo, companyName,
  companyStatus, companyEmail, companyVille, companyPays,
  can, isOwner = false,
}: TopbarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { msgUnread } = useGlobalCall();
  const { notifications } = useNotifications();
  const orderUnread = notifications.filter(n => n.type.startsWith('order') && !n.isRead).length;

  const [searchVal,      setSearchVal]      = useState('');
  const [searchOpen,     setSearchOpen]     = useState(false);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const [searchError,    setSearchError]    = useState(false);
  const [searchResults,  setSearchResults]  = useState<SearchResults>(EMPTY_RESULTS);
  const [avatarOpen,     setAvatarOpen]     = useState(false);
  const [monEspaceOpen,  setMonEspaceOpen]  = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const [titleKey, subtitleKey] = TITLES[activePage] ?? ['', ''];

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

  /* Fermer le dropdown de recherche au clic extérieur */
  useEffect(() => {
    if (!searchOpen) return;
    const fn = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('click', fn);
    return () => document.removeEventListener('click', fn);
  }, [searchOpen]);

  /* Recherche globale — interroge en parallèle produits/commandes/clients/
     livreurs/correspondants de la boutique connectée (chaque endpoint
     supporte déjà ?search=). Dès le 1er caractère : le spinner s'affiche
     immédiatement (retour instantané), la requête réseau elle-même reste
     différée de 120ms pour ne pas déclencher 5 appels par frappe — annule
     la requête en cours si l'utilisateur retape avant la réponse. */
  useEffect(() => {
    const q = searchVal.trim();
    if (q.length < 1) {
      searchAbortRef.current?.abort();
      setSearchResults(EMPTY_RESULTS);
      setSearchLoading(false);
      setSearchError(false);
      return;
    }

    setSearchLoading(true);

    const timer = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setSearchLoading(true);

      // Promise.allSettled (pas Promise.all + catch) — pour pouvoir distinguer
      // "aucun résultat" d'un vrai échec réseau/serveur et l'afficher clairement
      // au lieu de faire silencieusement croire qu'il n'y a rien à trouver.
      const settled = await Promise.allSettled([
        apiFetch<{ data: SearchProduit[] }>('/produits', { params: { search: q, limit: 4 }, signal: controller.signal }).then(r => r.data),
        apiFetch<SearchCommande[]>('/entreprise/commandes', { params: { search: q, limit: 4 }, signal: controller.signal }),
        apiFetch<{ data: SearchClient[] }>('/dashboard/entreprise/clients', { params: { search: q, limit: 4 }, signal: controller.signal }).then(r => r.data),
        apiFetch<{ data: SearchLivreur[] }>('/livreurs', { params: { search: q, limit: 4 }, signal: controller.signal }).then(r => r.data),
        apiFetch<{ data: SearchCorrespondant[] }>('/correspondants', { params: { search: q, limit: 4 }, signal: controller.signal }).then(r => r.data),
      ]);

      if (controller.signal.aborted) return;

      const [produitsR, commandesR, clientsR, livreursR, correspondantsR] = settled;
      settled.forEach(r => { if (r.status === 'rejected') console.error('[recherche globale]', r.reason); });

      setSearchResults({
        produits:       produitsR.status       === 'fulfilled' ? produitsR.value       : [],
        commandes:      commandesR.status      === 'fulfilled' ? commandesR.value      : [],
        clients:        clientsR.status        === 'fulfilled' ? clientsR.value        : [],
        livreurs:       livreursR.status       === 'fulfilled' ? livreursR.value       : [],
        correspondants: correspondantsR.status === 'fulfilled' ? correspondantsR.value : [],
      });
      // Erreur affichée seulement si TOUT a échoué (ex: backend injoignable) —
      // un seul endpoint en échec (ex: 403 sur une catégorie) reste silencieux,
      // les autres résultats restent utilisables.
      setSearchError(settled.every(r => r.status === 'rejected'));
      setSearchLoading(false);
    }, 120);

    return () => clearTimeout(timer);
  }, [searchVal]);

  /* Verrouiller le scroll quand le drawer mobile est ouvert */
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  /* Fermer le drawer mobile avec Escape */
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileMenuOpen(false); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [mobileMenuOpen]);

  /* ── Actions ── */
  function handleSwitchHome() {
    setAvatarOpen(false);
    setMobileMenuOpen(false);
    navigate('/home');               /* bascule vers l'accueil client public */
  }

  function go(page: EntreprisePage) {
    onNavigate(page);
    setMobileMenuOpen(false);
  }

  /* Sélection d'un résultat de recherche — navigue vers la page concernée.
     Pour un produit, ouvre directement sa fiche en édition (AjouterPage
     accepte déjà un productId). Les autres catégories n'ont pas de vue
     détail dédiée depuis cette page : on ouvre la liste, filtrée par
     l'utilisateur une fois sur place. */
  function selectSearchResult(page: EntreprisePage, id?: string) {
    onNavigate(page, id);
    setSearchOpen(false);
    setSearchVal('');
  }

  const searchTotal =
    searchResults.produits.length + searchResults.commandes.length + searchResults.clients.length +
    searchResults.livreurs.length + searchResults.correspondants.length;
  const searchDropdownVisible = searchOpen && searchVal.trim().length >= 1;

  return (
    <>
      <header className="topbar">

        <button className="hamburger" onClick={() => setMobileMenuOpen(true)} aria-label={t('topbar.hamburgerAria')}>
          <i className="fas fa-bars"></i>
        </button>

        {/* Titre de la page */}
        <div className="tb-title-wrap">
          <div className="tb-title">{t(titleKey)}</div>
          <div className="tb-sub">{t(subtitleKey)}</div>
        </div>

        {/* Barre de recherche globale — produits/commandes/clients/livreurs/correspondants */}
        <div className="tb-srch" ref={searchRef}>
          <input
            type="text"
            placeholder={t('topbar.searchPlaceholder')}
            value={searchVal}
            onFocus={() => setSearchOpen(true)}
            onChange={e => { setSearchVal(e.target.value); setSearchOpen(true); }}
            onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); (e.target as HTMLInputElement).blur(); } }}
          />
          <button type="button" tabIndex={-1}><i className="fas fa-magnifying-glass"></i></button>

          {searchDropdownVisible && (
            <div className="tb-srch-drop" onClick={e => e.stopPropagation()}>
              {searchLoading ? (
                <div className="tb-srch-state"><i className="fas fa-spinner fa-spin" /></div>
              ) : searchError ? (
                <div className="tb-srch-state tb-srch-state-error">
                  <i className="fas fa-triangle-exclamation" /> {t('topbar.search.error')}
                </div>
              ) : searchTotal === 0 ? (
                <div className="tb-srch-state">{t('topbar.search.noResults', { query: searchVal.trim() })}</div>
              ) : (
                <>
                  {searchResults.produits.length > 0 && (
                    <div className="tb-srch-sec">
                      <div className="tb-srch-sec-title">{t('topbar.search.produits')}</div>
                      {searchResults.produits.map(p => (
                        <button key={p.id} className="tb-srch-item" onClick={() => selectSearchResult('ajouter', p.id)}>
                          {p.images?.[0]
                            ? <img src={p.images[0].url} alt="" className="tb-srch-thumb" />
                            : <span className="tb-srch-thumb tb-srch-thumb-ico"><i className="fas fa-box" /></span>}
                          <span className="tb-srch-label">{p.nom}</span>
                          <span className="tb-srch-meta">{p.prix.toLocaleString('fr-FR')} GNF</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.commandes.length > 0 && (
                    <div className="tb-srch-sec">
                      <div className="tb-srch-sec-title">{t('topbar.search.commandes')}</div>
                      {searchResults.commandes.map(c => (
                        <button key={c.uuid} className="tb-srch-item" onClick={() => selectSearchResult('commandes')}>
                          <span className="tb-srch-thumb tb-srch-thumb-ico"><i className="fas fa-box" /></span>
                          <span className="tb-srch-label">#{c.id} · {c.client}</span>
                          <span className="tb-srch-meta">{c.price.toLocaleString('fr-FR')} GNF</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.clients.length > 0 && (
                    <div className="tb-srch-sec">
                      <div className="tb-srch-sec-title">{t('topbar.search.clients')}</div>
                      {searchResults.clients.map(c => (
                        <button key={c.id} className="tb-srch-item" onClick={() => selectSearchResult('clients')}>
                          {c.profilePicture
                            ? <img src={c.profilePicture} alt="" className="tb-srch-thumb" />
                            : <span className="tb-srch-thumb tb-srch-thumb-ico"><i className="fas fa-user" /></span>}
                          <span className="tb-srch-label">{c.fullName}</span>
                          <span className="tb-srch-meta">{c.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.livreurs.length > 0 && (
                    <div className="tb-srch-sec">
                      <div className="tb-srch-sec-title">{t('topbar.search.livreurs')}</div>
                      {searchResults.livreurs.map(l => (
                        <button key={l.id} className="tb-srch-item" onClick={() => selectSearchResult('livreurs')}>
                          <span className="tb-srch-thumb tb-srch-thumb-ico">{l.avatarEmoji || '🏍️'}</span>
                          <span className="tb-srch-label">{l.fullName}</span>
                          <span className="tb-srch-meta">{l.zone ?? ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.correspondants.length > 0 && (
                    <div className="tb-srch-sec">
                      <div className="tb-srch-sec-title">{t('topbar.search.correspondants')}</div>
                      {searchResults.correspondants.map(c => (
                        <button key={c.id} className="tb-srch-item" onClick={() => selectSearchResult('correspondants')}>
                          <span className="tb-srch-thumb tb-srch-thumb-ico">{c.avatarEmoji || '📍'}</span>
                          <span className="tb-srch-label">{c.fullName}</span>
                          <span className="tb-srch-meta">{c.ville}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Actions rapides (desktop) */}
        <div className="tb-acts">

          {/* ✅ Raccourcis réseau : Livreurs / Correspondants (gestion) */}
          {(isOwner || !can || can('deliveries', 'view')) && (<>
            <button className={`tb-ic${activePage === 'livreurs' ? ' active' : ''}`} title={t('topbar.tooltips.livreurs')}
              onClick={() => onNavigate('livreurs')}>
              <i className="fas fa-motorcycle"></i>
            </button>
            <button className={`tb-ic${activePage === 'correspondants' ? ' active' : ''}`} title={t('topbar.tooltips.correspondants')}
              onClick={() => onNavigate('correspondants')}>
              <i className="fas fa-map-pin"></i>
            </button>
          </>)}

          <div className="tb-sep"></div>

          {/* Commandes / Messages / Notifications */}
          <button className="tb-ic" title={t('topbar.tooltips.commandes')}
            onClick={() => onNavigate('commandes')}>
            <i className="fas fa-box"></i>
            {orderUnread > 0 && (
              <span className="tb-badge">{orderUnread > 99 ? '99+' : orderUnread}</span>
            )}
          </button>
          {(isOwner || !can || can('messaging', 'view')) && (
            <button className="tb-ic tb-ic-pin" title={t('topbar.tooltips.messages')}
              onClick={() => onNavigate('messages')}>
              <i className="fas fa-comment-dots"></i>
              {msgUnread > 0 && (
                <span className="tb-badge">{msgUnread > 99 ? '99+' : msgUnread}</span>
              )}
            </button>
          )}
          <NotificationCenter />

          <div className="tb-sep"></div>

          {/* Centre d'aide — accès direct depuis le dashboard entreprise */}
          <button className="tb-ic" title={t('topbar.tooltips.aide')} onClick={() => navigate('/aide')}
            aria-label={t('topbar.tooltips.aide')}>
            <i className="fas fa-circle-question"></i>
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
                      {t(STATUS_LABEL_KEYS[companyStatus ?? ''] ?? 'topbar.status.default')}
                      {(companyVille || companyPays) && ` · ${[companyVille, companyPays].filter(Boolean).join(', ')}`}
                    </div>
                    {companyEmail && (
                      <div className="tb-menu-email">{companyEmail}</div>
                    )}
                  </div>
                </div>

                <button className="tb-menu-it" onClick={() => { onNavigate('profil'); setAvatarOpen(false); }}>
                  <i className="fas fa-user"></i> {t('topbar.menu.profil')}
                </button>
                <button className="tb-menu-it" onClick={() => { onNavigate('boutique-preview'); setAvatarOpen(false); }}>
                  <i className="fas fa-store"></i> {t('topbar.menu.voirBoutique')}
                </button>
                <button className="tb-menu-it" onClick={handleSwitchHome}>
                  <i className="fas fa-house"></i> {t('topbar.menu.basculerAccueil')}
                </button>
                {/* Accès direct si déjà lié (1 clic) — se cache tout seul sinon. */}
                <AccountSwitchLink render={({ label, onClick, pending }) => (
                  <button className="tb-menu-it" disabled={pending} onClick={() => { onClick(); setAvatarOpen(false); }}>
                    <i className="fas fa-right-left"></i> Basculer vers mon espace {label}
                  </button>
                )} />
                <button className="tb-menu-it" onClick={() => { setMonEspaceOpen(true); setAvatarOpen(false); }}>
                  <i className="fas fa-user-group"></i> Mon espace client
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
          <i className="fas fa-chart-pie"></i><span>{t('topbar.bottomNav.accueil')}</span>
        </button>
        <button className={`bn-it${activePage === 'commandes' ? ' on' : ''}`}
          onClick={() => onNavigate('commandes')}>
          <i className="fas fa-box"></i>
          <span>{t('topbar.bottomNav.commandes')}</span>
          {orderUnread > 0 && (
            <span className="tb-badge">{orderUnread > 99 ? '99+' : orderUnread}</span>
          )}
        </button>

        <button className={`bn-it${activePage === 'produits' ? ' on' : ''}`}
          onClick={() => onNavigate('produits')}>
          <i className="fas fa-tag"></i><span>{t('topbar.bottomNav.produits')}</span>
        </button>
      </nav>

      {/* ════════ DRAWER MOBILE (menu complet) ════════ */}
      {mobileMenuOpen && (
        <div className="tb-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="tb-drawer" role="dialog" aria-modal="true" aria-label={t('topbar.drawer.menuAria')}
            onClick={e => e.stopPropagation()}>

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
                  {t(STATUS_LABEL_KEYS[companyStatus ?? ''] ?? 'topbar.status.default')}
                  {(companyVille || companyPays) && ` · ${[companyVille, companyPays].filter(Boolean).join(', ')}`}
                </div>
              </div>
              <button className="tb-drawer-x" onClick={() => setMobileMenuOpen(false)}>
                <i className="fas fa-xmark"></i>
              </button>
            </div>

            {/* Solde du portefeuille Shoneya — accès rapide dans le drawer mobile */}
            <div style={{ padding: '0 20px 14px' }}>
              <WalletQuickBar compact mini onManage={() => go('portefeuille')} />
            </div>

            {/* Navigation complète */}
            <div className="tb-drawer-nav">
              {DRAWER_NAV.filter(item => {
                if (!item.perm) return true;
                if (isOwner) return true;
                if (!can) return true;
                return can(item.perm[0], item.perm[1]);
              }).map(item => (
                <button key={item.id}
                  className={`tb-drawer-it${activePage === item.id ? ' on' : ''}`}
                  onClick={() => go(item.id)}>
                  <i className={`fas ${item.icon}`}></i>
                  <span>{t(item.label)}</span>
                  {activePage === item.id && <i className="fas fa-check tb-drawer-chk"></i>}
                </button>
              ))}
            </div>

            {/* Actions bas du drawer */}
            <div className="tb-drawer-foot">
              {companyId && (
                <button className="tb-drawer-home" onClick={() => { setMobileMenuOpen(false); onNavigate('boutique-preview'); }}>
                  <i className="fas fa-store"></i> {t('topbar.drawer.voirBoutique')}
                </button>
              )}
              {/* Centre d'aide accessible depuis le drawer mobile */}
              <button className="tb-drawer-home" onClick={() => { setMobileMenuOpen(false); navigate('/aide'); }}>
                <i className="fas fa-circle-question"></i> {t('topbar.drawer.aide')}
              </button>
              <button className="tb-drawer-home" onClick={handleSwitchHome}>
                <i className="fas fa-house"></i> {t('topbar.drawer.basculerAccueil')}
              </button>
            </div>
          </div>
        </div>
      )}

      {monEspaceOpen && <MonEspaceClientModal onClose={() => setMonEspaceOpen(false)} />}
    </>
  );
}