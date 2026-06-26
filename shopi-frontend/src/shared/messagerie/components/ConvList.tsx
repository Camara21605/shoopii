/*
 * FICHIER : src/shared/messagerie/components/ConvList.tsx
 *
 * Colonne gauche : recherche + onglets filtre + liste des conversations.
 * Reçoit les données depuis MessagerieCore via props.
 */
import React, { useState, useMemo } from 'react';
import type { Conversation, ChatUser } from '../data/messagerieTypes';
import { ROLE_CONFIG } from '../data/messagerieTypes';
import s from '../styles/ConvList.module.css';

type Tab = 'all' | 'unread' | 'boutiques' | 'livreurs' | 'clients' | 'partenaires' | 'correspondants';

interface Props {
  conversations: Conversation[];
  usersMap:      Map<string, ChatUser>;
  activeId:      string | null;
  mobileOpen:    boolean;
  totalUnread:   number;
  onSelect:      (id: string) => void;
}

const TABS: { key: Tab; label: string }[] = [
  { key:'all',            label:'Tous'           },
  { key:'unread',         label:'Non lus'        },
  { key:'boutiques',      label:'Boutiques'      },
  { key:'livreurs',       label:'Livreurs'       },
  { key:'clients',        label:'Clients'        },
  { key:'partenaires',    label:'Partenaires'    },
  { key:'correspondants', label:'Correspondants' },
];

export default function ConvList({ conversations, usersMap, activeId, mobileOpen, totalUnread, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [tab,    setTab]    = useState<Tab>('all');

  const filtered = useMemo(() => {
    let list = conversations;
    if (tab === 'unread')    list = list.filter(c => c.unread > 0);
    if (tab === 'boutiques') list = list.filter(c => usersMap.get(c.userId)?.role === 'vendeur');
    if (tab === 'livreurs')  list = list.filter(c => usersMap.get(c.userId)?.role === 'livreur');
    if (tab === 'clients')   list = list.filter(c => usersMap.get(c.userId)?.role === 'client');
    if (tab === 'partenaires')    list = list.filter(c => usersMap.get(c.userId)?.role === 'partenaire');
    if (tab === 'correspondants') list = list.filter(c => usersMap.get(c.userId)?.role === 'correspondant');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => {
        const u = usersMap.get(c.userId);
        return u?.name.toLowerCase().includes(q) || c.lastMsg.toLowerCase().includes(q);
      });
    }
    return list;
  }, [conversations, tab, search, usersMap]);

  const pinned  = filtered.filter(c => c.pinned);
  const regular = filtered.filter(c => !c.pinned);

  return (
    <aside className={`${s.aside} ${mobileOpen ? s.mobileOpen : ''}`}>

      {/* Recherche */}
      <div className={s.searchWrap}>
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
      </div>

      {/* Onglets */}
      <div className={s.tabs}>
        {TABS.map(t => (
          <button key={t.key} className={`${s.tab} ${tab === t.key ? s.active : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {(t.key === 'all' || t.key === 'unread') && totalUnread > 0 && (
              <span className={s.tabCount}>{totalUnread}</span>
            )}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className={s.items}>
        {pinned.length > 0 && (
          <>
            <div className={s.section}>📌 Épinglées</div>
            {pinned.map(c => (
              <ConvItem key={c.id} conv={c} user={usersMap.get(c.userId)}
                active={activeId === c.id} onSelect={onSelect} />
            ))}
          </>
        )}
        {regular.length > 0 && (
          <>
            {pinned.length > 0 && <div className={s.section}>Récentes</div>}
            {regular.map(c => (
              <ConvItem key={c.id} conv={c} user={usersMap.get(c.userId)}
                active={activeId === c.id} onSelect={onSelect} />
            ))}
          </>
        )}
        {filtered.length === 0 && (
          <div className={s.empty}>
            <i className="fas fa-comment-slash" />
            Aucune conversation trouvée
          </div>
        )}
      </div>
    </aside>
  );
}

/* ── Item conversation ───────────────────────────────────────── */
interface ItemProps {
  conv:     Conversation;
  user?:    ChatUser;
  active:   boolean;
  onSelect: (id: string) => void;
}

function ConvItem({ conv, user, active, onSelect }: ItemProps) {
  if (!user) return null;
  const rc       = ROLE_CONFIG[user.role] ?? ROLE_CONFIG['client'];
  const isImgAva = user.ava.startsWith('http');

  return (
    <div className={`${s.item} ${active ? s.active : ''} ${conv.unread > 0 ? s.unread : ''}`}
         onClick={() => onSelect(conv.id)}>

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

      {/* Meta */}
      <div className={s.meta}>
        <div className={s.time}>{conv.lastTime}</div>
        {conv.unread > 0 && <div className={s.badge}>{conv.unread}</div>}
        {conv.muted && <i className="fas fa-bell-slash" style={{ fontSize:11, color:'var(--t4)' }} />}
      </div>
    </div>
  );
}