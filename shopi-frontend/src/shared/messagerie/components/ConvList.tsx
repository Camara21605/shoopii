/*
 * FICHIER : src/shared/messagerie/components/ConvList.tsx
 *
 * Colonne gauche : recherche + onglets filtre + liste des conversations.
 * Reçoit les données depuis MessagerieCore via props.
 */
import { memo, useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Conversation, ChatUser, ApiSearchUser, NewConvUser } from '../data/messagerieTypes';
import { getRoleConfig, apiSearchUserToNewConvUser } from '../data/messagerieTypes';
import { getRoleFromToken } from '../../services/authUtils';
import { apiFetch } from '../../services/apiFetch';
import type { CallHistoryItem } from '../hooks/useCallHistory';
import { useContactSync } from '../hooks/useContactSync';
import { cldAvatar } from '../utils/chatUtils';
import s from '../styles/ConvList.module.css';

type Tab = 'all' | 'unread' | 'boutiques' | 'livreurs' | 'clients' | 'correspondants' | 'contacts' | 'masquees' | 'groupes' | 'appels';

/* ── Cascade "de haut en bas" ──────────────────────────────────
 * Chaque ligne (skeleton pendant le chargement, ou conversation réelle)
 * apparaît avec un délai croissant selon sa position plutôt que toutes
 * en même temps — plafonné pour qu'une longue liste ne prenne pas des
 * secondes à finir de s'afficher. Comme les clés React (`key={c.id}`)
 * sont stables, l'animation CSS ne rejoue qu'au premier montage de
 * chaque ligne, jamais sur un re-render (mise à jour de lastMsg, etc.). */
const STAGGER_STEP_MS = 35;
const STAGGER_MAX_MS  = 350;
function staggerStyle(index: number): { animationDelay: string } {
  return { animationDelay: `${Math.min(index * STAGGER_STEP_MS, STAGGER_MAX_MS)}ms` };
}

/* ── Badge qui compte "en suivant l'ordre d'arrivée" ─────────────
 * Le backend envoie déjà le compteur absolu à jour à chaque message
 * (WsNewMessage.convPreview.unreadCount) — plutôt que de faire sauter
 * le badge directement à la nouvelle valeur, on l'anime en comptant
 * pas à pas jusqu'à elle, pour une sensation d'incrément message par
 * message plutôt qu'un saut brutal. Ne s'anime qu'à la HAUSSE — un
 * retour à 0 (conversation lue) reste instantané. */
function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    const to   = value;
    prevRef.current = value;
    if (to <= from) { setDisplay(to); return; }

    const steps = Math.min(to - from, 12);
    const stepSize = (to - from) / steps;
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      setDisplay(step >= steps ? to : Math.round(from + stepSize * step));
      if (step >= steps) clearInterval(timer);
    }, 90);
    return () => clearInterval(timer);
  }, [value]);

  return <>{display}</>;
}

/* Onglets "dédiés à un acteur" — un contact LIÉ (commande/abonnement/
 * contact partagé, cf. MessagerieService.searchUsers) doit y apparaître
 * même sans conversation existante, comme un contact WhatsApp qu'on n'a
 * encore jamais écrit. Tab → type d'acteur backend attendu par
 * GET /messagerie/users/search?type=.
 *
 * 'contacts' et 'clients' pointent tous les deux vers l'acteur 'client' —
 * ce sont les DEUX FACES du même lien client↔client (voir
 * client-client.evaluator.ts) : 'clients' est ce qu'un vendeur/livreur/
 * correspondant voit de SES clients (commandes/follows), 'contacts' est
 * ce qu'un CLIENT voit des autres clients (uniquement via contacts
 * téléphoniques synchronisés — voir messagerie.service.ts,
 * "Client ↔ client : uniquement via contacts téléphoniques synchronisés").
 * Mutuellement exclusifs par rôle (voir getVisibleTabs), donc partager
 * la même clé de cache `relatedByKey['client']` est sans risque. */
const TAB_ACTOR_TYPE: Partial<Record<Tab, string>> = {
  boutiques:      'company',
  livreurs:       'delivery',
  clients:        'client',
  correspondants: 'correspondent',
  contacts:       'client',
};

/** Rôle frontend (ChatUser.role) correspondant à chaque onglet dédié — pour
 *  dédupliquer les contacts liés contre les conversations déjà existantes. */
const TAB_CONTACT_ROLE: Partial<Record<Tab, string>> = {
  boutiques:      'vendeur',
  livreurs:       'livreur',
  clients:        'client',
  correspondants: 'correspondant',
  contacts:       'client',
};

interface Props {
  conversations:   Conversation[];
  usersMap:        Map<string, ChatUser>;
  activeId:        string | null;
  mobileOpen:      boolean;
  totalUnread:     number;
  onSelect:        (id: string) => void;
  onNewConv:       () => void;
  onStartConversation: (user: NewConvUser) => void;
  /** Incrémenté par MessagerieCore pour focaliser la recherche depuis l'extérieur
   *  (ex: bouton "Démarrer une conversation" de l'état vide du chat). */
  focusSearchToken?: number;
  onDeleteConv:    (id: string) => void;
  onHideConv:      (id: string) => void;
  /** Optionnel : affiche un toast (ex: résultat de la synchro de contacts). */
  onToast?:        (msg: string, type?: string) => void;
  archivedConvs:   Conversation[];
  onLoadArchived:  () => void;
  onUnhideConv:    (id: string) => void;
  onMarkUnread:    (id: string) => void;
  onMarkRead:      (id: string) => void;
  /** true pendant le tout premier chargement (avant que `conversations` ait le moindre élément) — affiche un skeleton. */
  loadingConvs?:      boolean;
  /** Pagination infinite scroll — voir loadMoreConversations() dans useMessagerie. */
  hasMoreConvs?:      boolean;
  loadingMoreConvs?:  boolean;
  onLoadMoreConversations?: () => void;
  /** Groupes de livraison automatiques */
  groupConvs?:     Conversation[];
  groupUsersMap?:  Map<string, ChatUser>;
  /** Historique des appels (onglet "Appels") */
  callHistory?:        CallHistoryItem[];
  callHistoryLoading?: boolean;
  onLoadCallHistory?:  () => void;
  onDeleteCallHistoryItem?: (id: string) => void;
}

/* Toutes les définitions d'onglets disponibles */
function getAllTabs(t: TFunction): { key: Tab; label: string; icon?: string }[] {
  return [
    { key: 'all',            label: t('messagerie.convList.tabs.all')            },
    { key: 'unread',         label: t('messagerie.convList.tabs.unread')         },
    { key: 'groupes',        label: t('messagerie.convList.tabs.groupes'),        icon: 'fas fa-box'       },
    { key: 'appels',         label: t('messagerie.convList.tabs.appels'),         icon: 'fas fa-phone'     },
    { key: 'boutiques',      label: t('messagerie.convList.tabs.boutiques')      },
    { key: 'livreurs',       label: t('messagerie.convList.tabs.livreurs')       },
    { key: 'clients',        label: t('messagerie.convList.tabs.clients')        },
    { key: 'correspondants', label: t('messagerie.convList.tabs.correspondants') },
    { key: 'contacts',       label: t('messagerie.convList.tabs.contacts'),      icon: 'fas fa-address-book' },
    { key: 'masquees',       label: t('messagerie.convList.tabs.masquees'),       icon: 'fas fa-eye-slash' },
  ];
}

/* Onglets visibles selon le rôle JWT de l'utilisateur connecté.
 * Chaque onglet de filtre correspond aux interlocuteurs possibles
 * du rôle courant — on n'affiche pas les onglets qui seront toujours vides.
 *
 *   client        → parle à boutiques, livreurs, correspondants
 *   company       → parle à clients, livreurs, correspondants
 *   delivery      → parle à boutiques, clients, correspondants
 *   correspondent → parle à boutiques, clients, livreurs
 *   admin / super_admin → tous les types */
function getVisibleTabs(role: string | null): Tab[] {
  const base: Tab[] = ['all', 'unread', 'groupes', 'appels'];
  const end:  Tab[] = ['masquees'];
  switch (role) {
    case 'client':        return [...base, 'boutiques', 'livreurs',  'correspondants', 'contacts', ...end];
    case 'company':       return [...base, 'clients',   'livreurs',  'correspondants',           ...end];
    case 'delivery':      return [...base, 'boutiques', 'clients',   'correspondants',           ...end];
    case 'correspondent': return [...base, 'boutiques', 'clients',   'livreurs',                 ...end];
    default:              return [...base, 'boutiques', 'clients',   'livreurs', 'correspondants', ...end];
  }
}

function ConvList({
  conversations, usersMap, activeId, mobileOpen, totalUnread, onSelect, onStartConversation,
  focusSearchToken, onDeleteConv, onHideConv, onToast,
  archivedConvs, onLoadArchived, onUnhideConv, onMarkUnread, onMarkRead, groupConvs = [], groupUsersMap = new Map(),
  callHistory = [], callHistoryLoading = false, onLoadCallHistory, onDeleteCallHistoryItem,
  loadingConvs = false, hasMoreConvs = false, loadingMoreConvs = false, onLoadMoreConversations,
}: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [tab,    setTab]    = useState<Tab>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemsRef    = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  /* Onglets pertinents pour le rôle de l'utilisateur connecté */
  const myRole     = getRoleFromToken();
  const visibleSet = useMemo(() => new Set(getVisibleTabs(myRole)), [myRole]);
  const TABS       = useMemo(() => getAllTabs(t).filter(tb => visibleSet.has(tb.key)), [visibleSet, t]);

  /* ── Synchronisation des contacts téléphoniques ──────────────────
   * Client↔client uniquement (voir client-client.evaluator.ts côté
   * backend — les autres rôles se retrouvent via commandes/follows).
   * Après une synchro réussie, on bascule sur l'onglet "Contacts" pour
   * que l'utilisateur voie immédiatement les nouveaux contacts trouvés
   * (relatedContacts se rafraîchit automatiquement au changement de tab).
   * NB : bascule bien sur 'contacts' (visible pour le rôle client), pas
   * 'clients' (visible seulement pour vendeur/livreur/correspondant) —
   * sinon l'effet juste en dessous annule immédiatement le changement
   * d'onglet puisque 'clients' n'est pas dans getVisibleTabs('client'). */
  const { syncing, syncFromDevice } = useContactSync();
  const handleSyncContacts = async () => {
    const result = await syncFromDevice();
    if (!result.ok) {
      onToast?.(result.message, 'e');
      return;
    }
    onToast?.(
      result.matched.length > 0
        ? t('messagerie.convList.contactsSyncSucces', { count: result.matched.length })
        : t('messagerie.convList.contactsSyncAucun'),
      's',
    );
    setTab('contacts');
  };

  /* Si l'onglet actif n'est plus dans la liste visible, revenir à "Tous" */
  useEffect(() => {
    if (!visibleSet.has(tab)) setTab('all');
  }, [visibleSet, tab]);

  /* ── Contacts liés sans conversation existante ─────────────────
   * Remplace l'ancienne modale "Nouvelle conversation" : sur un onglet
   * dédié à un type d'acteur (Boutiques/Livreurs/Clients/Correspondants),
   * tout contact LIÉ (commande partagée, abonnement, contact tél.) doit
   * apparaître même sans conversation encore démarrée — comme un contact
   * WhatsApp jamais écrit. Sur "Tous", la recherche interroge aussi le
   * backend pour retrouver un contact lié qui n'apparaît dans aucune
   * conversation existante (remplace la recherche de l'ex-modale).
   */
  const [relatedByKey, setRelatedByKey] = useState<Record<string, ApiSearchUser[]>>({});
  const [relatedLoading, setRelatedLoading] = useState(false);
  const relatedDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actorType   = TAB_ACTOR_TYPE[tab];
  const relatedKey  = actorType ?? 'all';
  const wantRelated = !!actorType || (tab === 'all' && search.trim().length > 0);

  useEffect(() => {
    if (!wantRelated) return;

    if (relatedDebounceRef.current) clearTimeout(relatedDebounceRef.current);
    relatedDebounceRef.current = setTimeout(() => {
      setRelatedLoading(true);
      const qs = new URLSearchParams();
      const q  = search.trim();
      if (q) qs.set('q', q);
      if (actorType) qs.set('type', actorType);
      apiFetch<ApiSearchUser[]>(`/messagerie/users/search?${qs.toString()}`)
        .then(data => setRelatedByKey(prev => ({ ...prev, [relatedKey]: Array.isArray(data) ? data : [] })))
        .catch(() => setRelatedByKey(prev => ({ ...prev, [relatedKey]: [] })))
        .finally(() => setRelatedLoading(false));
    }, actorType ? 0 : 300); /* onglet dédié : chargement immédiat au changement d'onglet ; "Tous" : debounce de frappe */

    return () => { if (relatedDebounceRef.current) clearTimeout(relatedDebounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search, wantRelated]);

  /* Contacts liés à afficher pour l'onglet courant, DÉDUPLIQUÉS contre
   * les conversations déjà existantes du même type (déjà visibles via
   * `filtered` plus bas, avec aperçu du dernier message). */
  const relatedContacts = useMemo(() => {
    if (!wantRelated) return [];
    const list = relatedByKey[relatedKey] ?? [];
    const contactRole = TAB_CONTACT_ROLE[tab];
    const existingIds = new Set(
      conversations
        .filter(c => !c.isGroup && (!contactRole || usersMap.get(c.userId)?.role === contactRole))
        .map(c => c.userId),
    );
    return list.filter(u => !existingIds.has(u.id));
  }, [wantRelated, relatedByKey, relatedKey, conversations, usersMap, tab]);

  /* ── Focus recherche déclenché depuis l'extérieur (état vide du chat) ── */
  const focusTokenRef = useRef(focusSearchToken);
  useEffect(() => {
    if (focusSearchToken === undefined || focusSearchToken === focusTokenRef.current) return;
    focusTokenRef.current = focusSearchToken;
    if (tab === 'masquees' || tab === 'appels' || tab === 'groupes') setTab('all');
    searchInputRef.current?.focus();
  }, [focusSearchToken, tab]);

  function handleStartRelated(api: ApiSearchUser) {
    onStartConversation(apiSearchUserToNewConvUser(api));
  }

  /* ── Infinite scroll — charge la page suivante de conversations ──
   * Sentinelle en bas de la liste (uniquement visible sur l'onglet "Tous",
   * seul endroit où la liste paginée complète est affichée sans filtre de
   * rôle côté serveur) : dès qu'elle entre dans le viewport du conteneur
   * scrollable `.items`, on déclenche le chargement de la page suivante.
   * `root: itemsRef.current` — sans ça, IntersectionObserver observerait
   * le viewport de la fenêtre entière, pas le scroll interne de la liste. */
  useEffect(() => {
    if (tab !== 'all' || !hasMoreConvs || !onLoadMoreConversations) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) onLoadMoreConversations(); },
      { root: itemsRef.current, rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [tab, hasMoreConvs, onLoadMoreConversations]);

  const filtered = useMemo(() => {
    /* Les onglets Livraisons, Appels et Masquées sont gérés séparément */
    if (tab === 'groupes' || tab === 'masquees' || tab === 'appels') return [];

    /* Base : conversations P2P uniquement (pas les groupes isGroup) */
    let list = conversations.filter(c => !c.isGroup);

    /* Filtre par statut lu/non lu */
    if (tab === 'unread') list = list.filter(c => c.unread > 0);

    /* Filtre par rôle du contact (interlocuteur) */
    if (tab === 'boutiques')      list = list.filter(c => usersMap.get(c.userId)?.role === 'vendeur');
    if (tab === 'livreurs')       list = list.filter(c => usersMap.get(c.userId)?.role === 'livreur');
    if (tab === 'clients')        list = list.filter(c => usersMap.get(c.userId)?.role === 'client');
    if (tab === 'correspondants') list = list.filter(c => usersMap.get(c.userId)?.role === 'correspondant');
    if (tab === 'contacts')       list = list.filter(c => usersMap.get(c.userId)?.role === 'client');

    /* Filtre texte sur le nom du contact ou le dernier message */
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => {
        const u = usersMap.get(c.userId);
        return u?.name.toLowerCase().includes(q) || c.lastMsg.toLowerCase().includes(q);
      });
    }
    return list;
  }, [conversations, tab, search, usersMap]);

  /* Groupes de livraison filtrés par la recherche */
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupConvs;
    const q = search.toLowerCase();
    return groupConvs.filter(g =>
      (g.commandeNumero ?? '').toLowerCase().includes(q) ||
      (groupUsersMap.get(g.id)?.name ?? '').toLowerCase().includes(q) ||
      g.lastMsg.toLowerCase().includes(q),
    );
  }, [groupConvs, groupUsersMap, search]);

  const pinned  = filtered.filter(c => c.pinned);
  const regular = filtered.filter(c => !c.pinned);
  /* Groupes visibles dans l'onglet "Tous"/"Non lus" — hissé hors du JSX
   * (au lieu d'une IIFE inline) pour pouvoir calculer les délais de
   * cascade des sections suivantes (pinned/regular/relatedContacts) à
   * partir de sa longueur, sans redéfinir la logique deux fois. */
  const visibleGroupsForList = tab === 'unread' ? filteredGroups.filter(g => g.unread > 0) : filteredGroups;

  const switchTab = (key: Tab) => {
    setTab(key);
    if (key === 'masquees') onLoadArchived();
    if (key === 'appels')   onLoadCallHistory?.();
  };

  /* Conversations masquées filtrées par la recherche */
  const filteredArchived = archivedConvs.filter(c => {
    if (!search.trim()) return true;
    const u = usersMap.get(c.userId);
    return u?.name.toLowerCase().includes(search.toLowerCase()) || c.lastMsg.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <aside className={`${s.aside} ${mobileOpen ? s.mobileOpen : ''}`}>

      {/* Recherche + bouton nouveau message */}
      <div className={s.searchWrap}>
        <div className={s.searchRow}>
          <div className={s.searchInner}>
            <i className="fas fa-magnifying-glass" />
            <input ref={searchInputRef} className={s.searchInput} type="text" placeholder={t('messagerie.convList.searchPlaceholder')}
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', padding:'0 10px', fontSize:12 }}>
                <i className="fas fa-xmark" />
              </button>
            )}
          </div>
          {/* Synchro contacts téléphoniques — client↔client uniquement,
              voir client-client.evaluator.ts côté backend. */}
          {myRole === 'client' && (
            <button
              className={s.syncContactsBtn}
              onClick={handleSyncContacts}
              disabled={syncing}
              title={t('messagerie.convList.synchroniserContacts')}
            >
              <i className={`fas ${syncing ? 'fa-circle-notch fa-spin' : 'fa-address-book'}`} />
            </button>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div className={s.tabs}>
        {TABS.map(tb => (
          <button key={tb.key} className={`${s.tab} ${tab === tb.key ? s.active : ''}`} onClick={() => switchTab(tb.key)}>
            {tb.icon && <i className={tb.icon} style={{ fontSize: 10 }} />}
            {tb.label}
            {(tb.key === 'all' || tb.key === 'unread') && totalUnread > 0 && (
              <span className={s.tabCount}><AnimatedCount value={totalUnread} /></span>
            )}
            {tb.key === 'groupes' && groupConvs.filter(g => g.unread > 0).length > 0 && (
              <span className={s.tabCount}><AnimatedCount value={groupConvs.filter(g => g.unread > 0).length} /></span>
            )}
            {tb.key === 'masquees' && archivedConvs.length > 0 && (
              <span className={s.tabCount}>{archivedConvs.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className={s.items} ref={itemsRef}>
        {loadingConvs && conversations.length === 0 && groupConvs.length === 0 ? (
          <>
            {Array.from({ length: 8 }).map((_, i) => <ConvItemSkeleton key={i} index={i} />)}
          </>
        ) : tab === 'groupes' ? (
          <>
            {filteredGroups.length === 0 ? (
              <div className={s.empty}>
                <i className="fas fa-box-open" />
                {t('messagerie.convList.emptyGroupes')}
              </div>
            ) : (
              <>
                <div className={s.section}>{t('messagerie.convList.groupesDeLivraison')}</div>
                {filteredGroups.map((g, i) => (
                  <GroupConvItem
                    key={`grp-${g.id}`}
                    conv={g}
                    user={groupUsersMap.get(g.id)}
                    active={activeId === g.id}
                    onSelect={onSelect}
                    index={i}
                  />
                ))}
              </>
            )}
          </>
        ) : tab === 'appels' ? (
          <>
            {callHistoryLoading ? (
              <div className={s.empty}>
                <i className="fas fa-spinner fa-spin" />
                {t('messagerie.convList.loading')}
              </div>
            ) : callHistory.length === 0 ? (
              <div className={s.empty}>
                <i className="fas fa-phone-slash" />
                {t('messagerie.convList.emptyAppels')}
              </div>
            ) : (
              callHistory.map((h, i) => (
                <CallHistoryItemRow key={h.id} item={h} onDelete={onDeleteCallHistoryItem} index={i} />
              ))
            )}
          </>
        ) : tab === 'masquees' ? (
          <>
            {filteredArchived.length === 0 ? (
              <div className={s.empty}>
                <i className="fas fa-eye-slash" />
                {t('messagerie.convList.emptyMasquees')}
              </div>
            ) : (
              <>
                <div className={s.section}>{t('messagerie.convList.conversationsMasquees')}</div>
                {filteredArchived.map((c, i) => (
                  <ConvItem key={`arch-${c.id}`} conv={c} user={usersMap.get(c.userId)}
                    active={false} isArchived
                    onSelect={onSelect} onDelete={onDeleteConv}
                    onHide={onHideConv} onUnhide={onUnhideConv}
                    onMarkUnread={onMarkUnread} onMarkRead={onMarkRead}
                    index={i} />
                ))}
              </>
            )}
          </>
        ) : (
          <>
            {/* Groupes de livraison — uniquement dans "Tous" et "Non lus".
             * Les onglets de filtre par rôle (boutiques, livreurs…) ne montrent
             * que des conversations P2P, jamais les groupes automatiques. */}
            {(tab === 'all' || tab === 'unread') && visibleGroupsForList.length > 0 && (
              <>
                <div className={s.section}>📦 {t('messagerie.convList.groupesDeLivraison')}</div>
                {visibleGroupsForList.map((g, i) => (
                  <GroupConvItem
                    key={`grp-${g.id}`}
                    conv={g}
                    user={groupUsersMap.get(g.id)}
                    active={activeId === g.id}
                    onSelect={onSelect}
                    index={i}
                  />
                ))}
              </>
            )}

            {pinned.length > 0 && (
              <>
                <div className={s.section}>{t('messagerie.convList.epinglees')}</div>
                {pinned.map((c, i) => (
                  <ConvItem key={`conv-${c.id}`} conv={c} user={usersMap.get(c.userId)}
                    active={activeId === c.id} isArchived={false}
                    onSelect={onSelect} onDelete={onDeleteConv}
                    onHide={onHideConv} onUnhide={onUnhideConv}
                    onMarkUnread={onMarkUnread} onMarkRead={onMarkRead}
                    index={visibleGroupsForList.length + i} />
                ))}
              </>
            )}
            {regular.length > 0 && (
              <>
                {pinned.length > 0 && <div className={s.section}>{t('messagerie.convList.recentes')}</div>}
                {regular.map((c, i) => (
                  <ConvItem key={`conv-${c.id}`} conv={c} user={usersMap.get(c.userId)}
                    active={activeId === c.id} isArchived={false}
                    onSelect={onSelect} onDelete={onDeleteConv}
                    onHide={onHideConv} onUnhide={onUnhideConv}
                    onMarkUnread={onMarkUnread} onMarkRead={onMarkRead}
                    index={visibleGroupsForList.length + pinned.length + i} />
                ))}
              </>
            )}
            {/* Contacts liés sans conversation existante — onglets dédiés
             * (Boutiques/Livreurs/Clients/Correspondants) toujours ; "Tous"
             * uniquement pendant une recherche active (remplace l'ex-modale). */}
            {relatedContacts.length > 0 && (
              <>
                <div className={s.section}>{t('messagerie.convList.contactsSansConversation')}</div>
                {relatedContacts.map((api, i) => (
                  <RelatedContactItem key={`related-${api.type}-${api.id}`} api={api} onStart={handleStartRelated}
                    index={visibleGroupsForList.length + pinned.length + regular.length + i} />
                ))}
              </>
            )}

            {/* État vide :
             * - onglets "Tous"/"Non lus" : vide si aucune conv ET aucun groupe visible
             * - onglets de filtre P2P (boutiques, livreurs…) : vide si aucune conv */}
            {filtered.length === 0 && relatedContacts.length === 0 && !relatedLoading && (
              (tab === 'all' || tab === 'unread')
                ? visibleGroupsForList.length === 0
                : true
            ) && (
              <div className={s.empty}>
                <i className="fas fa-comment-slash" />
                {t('messagerie.convList.emptyConversations')}
              </div>
            )}

            {/* Sentinelle infinite scroll — invisible, juste un déclencheur
             * IntersectionObserver. Le spinner en dessous ne s'affiche que
             * pendant le chargement effectif de la page suivante. */}
            {tab === 'all' && hasMoreConvs && (
              <div ref={sentinelRef} style={{ height: 1 }} />
            )}
            {tab === 'all' && loadingMoreConvs && (
              <div className={s.empty} style={{ padding: '12px 0' }}>
                <i className="fas fa-spinner fa-spin" />
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

/* Placeholder animé pendant le tout premier chargement — même gabarit
 * qu'un ConvItem réel (avatar + 2 lignes) pour éviter un saut de mise en
 * page quand les vraies conversations arrivent. */
function ConvItemSkeleton({ index }: { index: number }) {
  return (
    <div className={`${s.item} ${s.itemEnter}`} style={{ cursor: 'default', ...staggerStyle(index) }}>
      <div className={s.avaWrap}>
        <div className={s.ava} style={{ background: 'var(--sky-2,#E2EAFB)', opacity: .6 }} />
      </div>
      <div className={s.info}>
        <div className={s.skeletonLine} style={{ width: '55%' }} />
        <div className={s.skeletonLine} style={{ width: '35%' }} />
        <div className={s.skeletonLine} style={{ width: '75%' }} />
      </div>
    </div>
  );
}

/*
 * React.memo : `conversations`/`usersMap` ne changent que quand la liste
 * ou la présence d'un contact change réellement — évite de refaire tout
 * le filtrage/tri quand seul un état SANS rapport (ex: texte en cours de
 * saisie dans MessageInput, panneau d'info) provoque un rendu de
 * MessagerieCore.
 */
export default memo(ConvList);

/* ── Item conversation ───────────────────────────────────────── */
interface ItemProps {
  conv:        Conversation;
  user?:       ChatUser;
  active:      boolean;
  isArchived:  boolean;
  onSelect:    (id: string) => void;
  onDelete:    (id: string) => void;
  onHide:      (id: string) => void;
  onUnhide:    (id: string) => void;
  onMarkUnread:(id: string) => void;
  onMarkRead:  (id: string) => void;
  /** Position dans la liste affichée — pilote le délai de la cascade d'apparition. */
  index:       number;
}

/* ── Item groupe de livraison ────────────────────────────────── */
interface GroupItemProps {
  conv:     Conversation;
  user?:    ChatUser;
  active:   boolean;
  onSelect: (id: string) => void;
  index:    number;
}

const GroupConvItem = memo(function GroupConvItem({ conv, user, active, onSelect, index }: GroupItemProps) {
  const { t } = useTranslation();
  if (!user) return null;

  const statusColor =
    conv.groupStatus === 'active'    ? '#10B981' :
    conv.groupStatus === 'completed' ? '#0E7490' :
    conv.groupStatus === 'expired'   ? '#6B7280' : '#DC2626';

  const statusLabel =
    conv.groupStatus === 'active'    ? t('messagerie.convList.groupStatus.active') :
    conv.groupStatus === 'completed' ? t('messagerie.convList.groupStatus.completed') :
    conv.groupStatus === 'expired'   ? t('messagerie.convList.groupStatus.expired') : t('messagerie.convList.groupStatus.cancelled');

  return (
    <div
      className={`${s.item} ${s.itemEnter} ${active ? s.active : ''} ${conv.unread > 0 ? s.unread : ''}`}
      style={staggerStyle(index)}
      onClick={() => onSelect(conv.id)}
    >
      {/* Avatar groupe */}
      <div className={s.avaWrap}>
        <div className={s.ava} style={{ background: user.avaColor, fontSize: 22 }}>
          {user.ava}
        </div>
        <div
          className={s.roleBadge}
          style={{ background: statusColor, color: '#fff', fontSize: 6, fontWeight: 800 }}
        >
          {conv.groupStatus === 'active' ? '🟢' : conv.groupStatus === 'completed' ? '✅' : conv.groupStatus === 'expired' ? '🔒' : '❌'}
        </div>
      </div>

      {/* Infos */}
      <div className={s.info}>
        <div className={s.name}>
          <span className={s.nameText}>{conv.commandeNumero}</span>
        </div>
        <div className={s.context} style={{ color: statusColor }}>
          {user.context ?? statusLabel}
        </div>
        <div className={s.lastMsg}>
          {conv.lastMsg || <span style={{ color: 'var(--t4)', fontStyle: 'italic' }}>{t('messagerie.convList.groupeDeLivraison')}</span>}
        </div>
      </div>

      {/* Meta */}
      <div className={s.meta}>
        <div className={s.metaTop}>
          <div className={s.time}>{conv.lastTime}</div>
        </div>
        {conv.unread > 0 && <div className={s.badge}><AnimatedCount value={conv.unread} /></div>}
      </div>
    </div>
  );
});

const ConvItem = memo(function ConvItem({ conv, user, active, isArchived, onSelect, onDelete, onHide, onUnhide, onMarkUnread, onMarkRead, index }: ItemProps) {
  const { t } = useTranslation();
  if (!user) return null;
  const roleConfig = getRoleConfig(t);
  const rc       = roleConfig[user.role] ?? roleConfig['client'];
  const isImgAva = user.ava.startsWith('http');

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Ferme le menu si clic en dehors */
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <div className={`${s.item} ${s.itemEnter} ${active ? s.active : ''} ${conv.unread > 0 ? s.unread : ''}`}
         style={staggerStyle(index)}
         onClick={() => { if (!menuOpen) onSelect(conv.id); }}>

      {/* Avatar */}
      <div className={s.avaWrap}>
        <div className={s.ava} style={{ background: isImgAva ? undefined : user.avaColor, overflow:'hidden', padding:0 }}>
          {isImgAva
            ? <img src={cldAvatar(user.ava, 56)!} alt={user.name}
                style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit', display:'block' }}
                loading="lazy"
                onError={e => {
                  const img = e.currentTarget as HTMLImageElement;
                  img.style.display = 'none';
                  (img.parentElement as HTMLElement).style.background = user.avaColor;
                  (img.parentElement as HTMLElement).textContent = user.name.slice(0,2).toUpperCase();
                }}
              />
            : user.ava
          }
        </div>
        <div className={`${s.onlineDot} ${user.online ? s.on : s.off}`} />
        <div className={s.roleBadge} style={{ background: rc.color, color:'#fff' }}>{rc.icon}</div>
      </div>

      {/* Infos */}
      <div className={s.info}>
        <div className={s.name}>
          <span className={s.nameText}>{user.name}</span>
          {conv.pinned && <i className="fas fa-thumbtack" style={{ fontSize:9, color:'var(--t4)' }} />}
        </div>
        {/* Étiquette de rôle (toujours visible) */}
        <div className={s.context} style={{ color: rc.color }}>
          {user.context ?? rc.label}
        </div>
        <div className={s.lastMsg}>{conv.lastMsg || <span style={{ color:'var(--t4)', fontStyle:'italic' }}>{t('messagerie.convList.nouvelleConversation')}</span>}</div>
      </div>

      {/* Meta + menu contextuel */}
      <div className={s.meta} ref={menuRef}>
        <div className={s.metaTop}>
          <div className={s.time}>{conv.lastTime}</div>
          <button
            className={s.itemMenuBtn}
            title={t('messagerie.convList.optionsTitle')}
            onClick={e => { e.stopPropagation(); setMenuOpen(p => !p); }}
          >
            <i className="fas fa-ellipsis-vertical" />
          </button>
        </div>
        {conv.unread > 0 && <div className={s.badge}><AnimatedCount value={conv.unread} /></div>}
        {conv.muted && <i className="fas fa-bell-slash" style={{ fontSize:11, color:'var(--t4)' }} />}

        {menuOpen && (
          <div className={s.itemMenu}>
            {isArchived ? (
              /* ── Conversation masquée : Démasquer + Supprimer ── */
              <button
                className={s.itemMenuItem}
                onClick={e => { e.stopPropagation(); onUnhide(conv.id); setMenuOpen(false); }}
              >
                <i className="fas fa-eye" />
                <span>{t('messagerie.convList.demasquer')}</span>
              </button>
            ) : (
              /* ── Conversation normale : Masquer + Lu/Non lu ── */
              <>
                <button
                  className={s.itemMenuItem}
                  onClick={e => { e.stopPropagation(); onHide(conv.id); setMenuOpen(false); }}
                >
                  <i className="fas fa-eye-slash" />
                  <span>{t('messagerie.convList.masquer')}</span>
                </button>
                {conv.unread === 0 ? (
                  <button
                    className={s.itemMenuItem}
                    onClick={e => { e.stopPropagation(); onMarkUnread(conv.id); setMenuOpen(false); }}
                  >
                    <i className="fas fa-circle-dot" />
                    <span>{t('messagerie.convList.marquerNonLu')}</span>
                  </button>
                ) : (
                  <button
                    className={s.itemMenuItem}
                    onClick={e => { e.stopPropagation(); onMarkRead(conv.id); setMenuOpen(false); }}
                  >
                    <i className="fas fa-check-double" />
                    <span>{t('messagerie.convList.marquerToutLu')}</span>
                  </button>
                )}
              </>
            )}
            <button
              className={`${s.itemMenuItem} ${s.itemMenuDanger}`}
              onClick={e => { e.stopPropagation(); onDelete(conv.id); setMenuOpen(false); }}
            >
              <i className="fas fa-trash-can" />
              <span>{t('messagerie.convList.supprimer')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Item contact lié sans conversation existante ──────────────
 * Même habillage visuel que ConvItem (avatar, badge de rôle, point
 * en ligne) mais sans les affordances propres à une conversation déjà
 * existante (épingle, menu masquer/supprimer, badge non-lu). Le clic
 * démarre la conversation via getOrCreateConversation() côté backend
 * (POST /messagerie/conversations), exactement comme le faisait l'ex-
 * modale "Nouvelle conversation". */
interface RelatedItemProps {
  api:     ApiSearchUser;
  onStart: (api: ApiSearchUser) => void;
  index:   number;
}

const RelatedContactItem = memo(function RelatedContactItem({ api, onStart, index }: RelatedItemProps) {
  const { t } = useTranslation();
  const role     = ({ company: 'vendeur', delivery: 'livreur', correspondent: 'correspondant', client: 'client' } as Record<string, string>)[api.type] ?? 'client';
  const rc       = getRoleConfig(t)[role as keyof ReturnType<typeof getRoleConfig>];
  const isImgAva = !!api.logo;

  return (
    <div className={`${s.item} ${s.itemEnter}`} style={staggerStyle(index)} onClick={() => onStart(api)}>
      <div className={s.avaWrap}>
        <div className={s.ava} style={{ background: isImgAva ? undefined : rc.bg, overflow:'hidden', padding:0 }}>
          {isImgAva
            ? <img src={cldAvatar(api.logo, 56)!} alt={api.name}
                style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit', display:'block' }}
                loading="lazy"
                onError={e => {
                  const img = e.currentTarget as HTMLImageElement;
                  img.style.display = 'none';
                  (img.parentElement as HTMLElement).textContent = api.name.slice(0,2).toUpperCase();
                }}
              />
            : <span style={{ fontSize:16 }}>{rc.icon}</span>
          }
        </div>
        <div className={`${s.onlineDot} ${api.online ? s.on : s.off}`} />
        <div className={s.roleBadge} style={{ background: rc.color, color:'#fff' }}>{rc.icon}</div>
      </div>

      <div className={s.info}>
        <div className={s.name}><span className={s.nameText}>{api.name}</span></div>
        <div className={s.context} style={{ color: rc.color }}>{api.subtitle || rc.label}</div>
        <div className={s.lastMsg}>
          <span style={{ color:'var(--t4)', fontStyle:'italic' }}>{t('messagerie.convList.nouvelleConversation')}</span>
        </div>
      </div>
    </div>
  );
});

/* ── Item historique d'appel (onglet "Appels") ─────────────────
 * Lecture seule — pas de clic pour rappeler ici (à la différence
 * de WhatsApp) car on ne connaît pas toujours le contexte
 * conversation/relation d'origine ; l'utilisateur rappelle depuis
 * la conversation ou le profil du contact. */
function getCallStatusLabel(t: TFunction): Record<CallHistoryItem['status'], string> {
  return {
    completed: t('messagerie.convList.callStatus.completed'),
    missed:    t('messagerie.convList.callStatus.missed'),
    rejected:  t('messagerie.convList.callStatus.rejected'),
    busy:      t('messagerie.convList.callStatus.busy'),
  };
}
const CALL_STATUS_COLOR: Record<CallHistoryItem['status'], string> = {
  completed: 'var(--t3)',
  missed:    '#DC2626',
  rejected:  '#7C3AED',
  busy:      '#D97706',
};

function fmtDuration(sec: number): string {
  if (sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s2 = sec % 60;
  return m > 0 ? `${m} min ${s2}s` : `${s2}s`;
}

function fmtCallTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function CallHistoryItemRow({ item, onDelete, index }: { item: CallHistoryItem; onDelete?: (id: string) => void; index: number }) {
  const { t } = useTranslation();
  const isImgAva = item.contactAvatar?.startsWith('http');
  const initials = item.contactName.trim().split(/\s+/).slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

  return (
    <div className={`${s.item} ${s.itemEnter}`} style={{ cursor: 'default', ...staggerStyle(index) }}>
      <div className={s.avaWrap}>
        <div className={s.ava} style={{ overflow: 'hidden', padding: 0, background: isImgAva ? undefined : 'var(--sky,#EEF3FF)' }}>
          {isImgAva
            ? <img src={cldAvatar(item.contactAvatar, 56)!} alt={item.contactName} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit' }} loading="lazy" />
            : initials}
        </div>
      </div>

      <div className={s.info}>
        <div className={s.name}>
          <span className={s.nameText}>{item.contactName}</span>
        </div>
        <div className={s.context} style={{ color: CALL_STATUS_COLOR[item.status] }}>
          <i className={`fas ${item.direction === 'outgoing' ? 'fa-arrow-up-right' : 'fa-arrow-down-left'}`} style={{ fontSize: 10, marginRight: 4 }} />
          {getCallStatusLabel(t)[item.status]}
          {item.callType === 'video' && <i className="fas fa-video" style={{ fontSize: 10, marginLeft: 6 }} />}
        </div>
        <div className={s.lastMsg}>
          {item.duration > 0 ? fmtDuration(item.duration) : <span style={{ fontStyle: 'italic' }}>—</span>}
        </div>
      </div>

      <div className={s.meta}>
        <div className={s.metaTop}>
          <div className={s.time}>{fmtCallTime(item.endedAt)}</div>
        </div>
        {/* Toujours visible (pas de reveal au survol) — doit rester utilisable
         * au clic/tap aussi bien sur petit écran (mobile, pas de hover) qu'en
         * grand écran. Supprime cette entrée de MON historique uniquement. */}
        {onDelete && (
          <button
            className={s.callDeleteBtn}
            onClick={() => onDelete(item.id)}
            title={t('messagerie.convList.supprimerAppel', 'Supprimer cet appel')}
            aria-label={t('messagerie.convList.supprimerAppel', 'Supprimer cet appel')}
          >
            <i className="fas fa-trash-can" />
          </button>
        )}
      </div>
    </div>
  );
}