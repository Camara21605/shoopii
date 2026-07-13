/*
 * FICHIER : src/shared/messagerie/components/ConvList.tsx
 *
 * Colonne gauche : recherche + onglets filtre + liste des conversations.
 * Reçoit les données depuis MessagerieCore via props.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Conversation, ChatUser } from '../data/messagerieTypes';
import { ROLE_CONFIG } from '../data/messagerieTypes';
import { getRoleFromToken } from '../../services/authUtils';
import s from '../styles/ConvList.module.css';

type Tab = 'all' | 'unread' | 'boutiques' | 'livreurs' | 'clients' | 'correspondants' | 'masquees' | 'groupes';

interface Props {
  conversations:   Conversation[];
  usersMap:        Map<string, ChatUser>;
  activeId:        string | null;
  mobileOpen:      boolean;
  totalUnread:     number;
  onSelect:        (id: string) => void;
  onNewConv:       () => void;
  onDeleteConv:    (id: string) => void;
  onHideConv:      (id: string) => void;
  archivedConvs:   Conversation[];
  onLoadArchived:  () => void;
  onUnhideConv:    (id: string) => void;
  onMarkUnread:    (id: string) => void;
  onMarkRead:      (id: string) => void;
  /** Groupes de livraison automatiques */
  groupConvs?:     Conversation[];
  groupUsersMap?:  Map<string, ChatUser>;
}

/* Toutes les définitions d'onglets disponibles */
const ALL_TABS: { key: Tab; label: string; icon?: string }[] = [
  { key: 'all',            label: 'Tous'           },
  { key: 'unread',         label: 'Non lus'        },
  { key: 'groupes',        label: 'Livraisons',    icon: 'fas fa-box'       },
  { key: 'boutiques',      label: 'Boutiques'      },
  { key: 'livreurs',       label: 'Livreurs'       },
  { key: 'clients',        label: 'Clients'        },
  { key: 'correspondants', label: 'Correspondants' },
  { key: 'masquees',       label: 'Masquées',      icon: 'fas fa-eye-slash' },
];

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
  const base: Tab[] = ['all', 'unread', 'groupes'];
  const end:  Tab[] = ['masquees'];
  switch (role) {
    case 'client':        return [...base, 'boutiques', 'livreurs',  'correspondants',           ...end];
    case 'company':       return [...base, 'clients',   'livreurs',  'correspondants',           ...end];
    case 'delivery':      return [...base, 'boutiques', 'clients',   'correspondants',           ...end];
    case 'correspondent': return [...base, 'boutiques', 'clients',   'livreurs',                 ...end];
    default:              return [...base, 'boutiques', 'clients',   'livreurs', 'correspondants', ...end];
  }
}

export default function ConvList({ conversations, usersMap, activeId, mobileOpen, totalUnread, onSelect, onNewConv, onDeleteConv, onHideConv, archivedConvs, onLoadArchived, onUnhideConv, onMarkUnread, onMarkRead, groupConvs = [], groupUsersMap = new Map() }: Props) {
  const [search, setSearch] = useState('');
  const [tab,    setTab]    = useState<Tab>('all');

  /* Onglets pertinents pour le rôle de l'utilisateur connecté */
  const myRole     = getRoleFromToken();
  const visibleSet = useMemo(() => new Set(getVisibleTabs(myRole)), [myRole]);
  const TABS       = useMemo(() => ALL_TABS.filter(t => visibleSet.has(t.key)), [visibleSet]);

  /* Si l'onglet actif n'est plus dans la liste visible, revenir à "Tous" */
  useEffect(() => {
    if (!visibleSet.has(tab)) setTab('all');
  }, [visibleSet, tab]);

  const filtered = useMemo(() => {
    /* Les onglets Livraisons et Masquées sont gérés séparément */
    if (tab === 'groupes' || tab === 'masquees') return [];

    /* Base : conversations P2P uniquement (pas les groupes isGroup) */
    let list = conversations.filter(c => !c.isGroup);

    /* Filtre par statut lu/non lu */
    if (tab === 'unread') list = list.filter(c => c.unread > 0);

    /* Filtre par rôle du contact (interlocuteur) */
    if (tab === 'boutiques')      list = list.filter(c => usersMap.get(c.userId)?.role === 'vendeur');
    if (tab === 'livreurs')       list = list.filter(c => usersMap.get(c.userId)?.role === 'livreur');
    if (tab === 'clients')        list = list.filter(c => usersMap.get(c.userId)?.role === 'client');
    if (tab === 'correspondants') list = list.filter(c => usersMap.get(c.userId)?.role === 'correspondant');

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

  const switchTab = (key: Tab) => {
    setTab(key);
    if (key === 'masquees') onLoadArchived();
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
            <input className={s.searchInput} type="text" placeholder="Rechercher une conversation…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', padding:'0 10px', fontSize:12 }}>
                <i className="fas fa-xmark" />
              </button>
            )}
          </div>
          <button className={s.newConvBtn} onClick={onNewConv} title="Nouveau message">
            <i className="fas fa-pen-to-square" />
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className={s.tabs}>
        {TABS.map(t => (
          <button key={t.key} className={`${s.tab} ${tab === t.key ? s.active : ''}`} onClick={() => switchTab(t.key)}>
            {t.icon && <i className={t.icon} style={{ fontSize: 10 }} />}
            {t.label}
            {(t.key === 'all' || t.key === 'unread') && totalUnread > 0 && (
              <span className={s.tabCount}>{totalUnread}</span>
            )}
            {t.key === 'groupes' && groupConvs.filter(g => g.unread > 0).length > 0 && (
              <span className={s.tabCount}>{groupConvs.filter(g => g.unread > 0).length}</span>
            )}
            {t.key === 'masquees' && archivedConvs.length > 0 && (
              <span className={s.tabCount}>{archivedConvs.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className={s.items}>
        {tab === 'groupes' ? (
          <>
            {filteredGroups.length === 0 ? (
              <div className={s.empty}>
                <i className="fas fa-box-open" />
                Aucun groupe de livraison
              </div>
            ) : (
              <>
                <div className={s.section}>Groupes de livraison</div>
                {filteredGroups.map(g => (
                  <GroupConvItem
                    key={`grp-${g.id}`}
                    conv={g}
                    user={groupUsersMap.get(g.id)}
                    active={activeId === g.id}
                    onSelect={onSelect}
                  />
                ))}
              </>
            )}
          </>
        ) : tab === 'masquees' ? (
          <>
            {filteredArchived.length === 0 ? (
              <div className={s.empty}>
                <i className="fas fa-eye-slash" />
                Aucune conversation masquée
              </div>
            ) : (
              <>
                <div className={s.section}>Conversations masquées</div>
                {filteredArchived.map(c => (
                  <ConvItem key={`arch-${c.id}`} conv={c} user={usersMap.get(c.userId)}
                    active={false} isArchived
                    onSelect={onSelect} onDelete={onDeleteConv}
                    onHide={onHideConv} onUnhide={onUnhideConv}
                    onMarkUnread={onMarkUnread} onMarkRead={onMarkRead} />
                ))}
              </>
            )}
          </>
        ) : (
          <>
            {/* Groupes de livraison — uniquement dans "Tous" et "Non lus".
             * Les onglets de filtre par rôle (boutiques, livreurs…) ne montrent
             * que des conversations P2P, jamais les groupes automatiques. */}
            {(tab === 'all' || tab === 'unread') && (() => {
              const visibleGroups = tab === 'unread'
                ? filteredGroups.filter(g => g.unread > 0)
                : filteredGroups;
              return visibleGroups.length > 0 ? (
                <>
                  <div className={s.section}>📦 Groupes de livraison</div>
                  {visibleGroups.map(g => (
                    <GroupConvItem
                      key={`grp-${g.id}`}
                      conv={g}
                      user={groupUsersMap.get(g.id)}
                      active={activeId === g.id}
                      onSelect={onSelect}
                    />
                  ))}
                </>
              ) : null;
            })()}

            {pinned.length > 0 && (
              <>
                <div className={s.section}>📌 Épinglées</div>
                {pinned.map(c => (
                  <ConvItem key={`conv-${c.id}`} conv={c} user={usersMap.get(c.userId)}
                    active={activeId === c.id} isArchived={false}
                    onSelect={onSelect} onDelete={onDeleteConv}
                    onHide={onHideConv} onUnhide={onUnhideConv}
                    onMarkUnread={onMarkUnread} onMarkRead={onMarkRead} />
                ))}
              </>
            )}
            {regular.length > 0 && (
              <>
                {pinned.length > 0 && <div className={s.section}>Récentes</div>}
                {regular.map(c => (
                  <ConvItem key={`conv-${c.id}`} conv={c} user={usersMap.get(c.userId)}
                    active={activeId === c.id} isArchived={false}
                    onSelect={onSelect} onDelete={onDeleteConv}
                    onHide={onHideConv} onUnhide={onUnhideConv}
                    onMarkUnread={onMarkUnread} onMarkRead={onMarkRead} />
                ))}
              </>
            )}
            {/* État vide :
             * - onglets "Tous"/"Non lus" : vide si aucune conv ET aucun groupe visible
             * - onglets de filtre P2P (boutiques, livreurs…) : vide si aucune conv */}
            {filtered.length === 0 && (
              (tab === 'all' || tab === 'unread')
                ? filteredGroups.filter(g => tab === 'unread' ? g.unread > 0 : true).length === 0
                : true
            ) && (
              <div className={s.empty}>
                <i className="fas fa-comment-slash" />
                Aucune conversation trouvée
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

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
}

/* ── Item groupe de livraison ────────────────────────────────── */
interface GroupItemProps {
  conv:     Conversation;
  user?:    ChatUser;
  active:   boolean;
  onSelect: (id: string) => void;
}

function GroupConvItem({ conv, user, active, onSelect }: GroupItemProps) {
  if (!user) return null;

  const statusColor =
    conv.groupStatus === 'active'    ? '#10B981' :
    conv.groupStatus === 'completed' ? '#0E7490' :
    conv.groupStatus === 'expired'   ? '#6B7280' : '#DC2626';

  const statusLabel =
    conv.groupStatus === 'active'    ? 'En cours' :
    conv.groupStatus === 'completed' ? 'Livré' :
    conv.groupStatus === 'expired'   ? 'Archivé' : 'Annulé';

  return (
    <div
      className={`${s.item} ${active ? s.active : ''} ${conv.unread > 0 ? s.unread : ''}`}
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
          {conv.lastMsg || <span style={{ color: 'var(--t4)', fontStyle: 'italic' }}>Groupe de livraison</span>}
        </div>
      </div>

      {/* Meta */}
      <div className={s.meta}>
        <div className={s.metaTop}>
          <div className={s.time}>{conv.lastTime}</div>
        </div>
        {conv.unread > 0 && <div className={s.badge}>{conv.unread}</div>}
      </div>
    </div>
  );
}

function ConvItem({ conv, user, active, isArchived, onSelect, onDelete, onHide, onUnhide, onMarkUnread, onMarkRead }: ItemProps) {
  if (!user) return null;
  const rc       = ROLE_CONFIG[user.role] ?? ROLE_CONFIG['client'];
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
    <div className={`${s.item} ${active ? s.active : ''} ${conv.unread > 0 ? s.unread : ''}`}
         onClick={() => { if (!menuOpen) onSelect(conv.id); }}>

      {/* Avatar */}
      <div className={s.avaWrap}>
        <div className={s.ava} style={{ background: isImgAva ? undefined : user.avaColor, overflow:'hidden', padding:0 }}>
          {isImgAva
            ? <img src={user.ava} alt={user.name}
                style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit', display:'block' }}
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
        <div className={s.lastMsg}>{conv.lastMsg || <span style={{ color:'var(--t4)', fontStyle:'italic' }}>Nouvelle conversation</span>}</div>
      </div>

      {/* Meta + menu contextuel */}
      <div className={s.meta} ref={menuRef}>
        <div className={s.metaTop}>
          <div className={s.time}>{conv.lastTime}</div>
          <button
            className={s.itemMenuBtn}
            title="Options"
            onClick={e => { e.stopPropagation(); setMenuOpen(p => !p); }}
          >
            <i className="fas fa-ellipsis-vertical" />
          </button>
        </div>
        {conv.unread > 0 && <div className={s.badge}>{conv.unread}</div>}
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
                <span>Démasquer la conversation</span>
              </button>
            ) : (
              /* ── Conversation normale : Masquer + Lu/Non lu ── */
              <>
                <button
                  className={s.itemMenuItem}
                  onClick={e => { e.stopPropagation(); onHide(conv.id); setMenuOpen(false); }}
                >
                  <i className="fas fa-eye-slash" />
                  <span>Masquer la conversation</span>
                </button>
                {conv.unread === 0 ? (
                  <button
                    className={s.itemMenuItem}
                    onClick={e => { e.stopPropagation(); onMarkUnread(conv.id); setMenuOpen(false); }}
                  >
                    <i className="fas fa-circle-dot" />
                    <span>Marquer comme non lu</span>
                  </button>
                ) : (
                  <button
                    className={s.itemMenuItem}
                    onClick={e => { e.stopPropagation(); onMarkRead(conv.id); setMenuOpen(false); }}
                  >
                    <i className="fas fa-check-double" />
                    <span>Tout marquer comme lu</span>
                  </button>
                )}
              </>
            )}
            <button
              className={`${s.itemMenuItem} ${s.itemMenuDanger}`}
              onClick={e => { e.stopPropagation(); onDelete(conv.id); setMenuOpen(false); }}
            >
              <i className="fas fa-trash-can" />
              <span>Supprimer la conversation</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}