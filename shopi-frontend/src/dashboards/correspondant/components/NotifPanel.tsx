// components/NotifPanel.tsx
import React, { useState } from 'react';
import s from '../styles/NotifPanel.module.css';

interface Notif {
  id:     number;
  ic:     string;
  bg:     string;
  c:      string;
  msg:    string;
  time:   string;
  unread: boolean;
  type:   'colis' | 'transfert' | 'evaluation' | 'retour' | 'client';
}

const INITIAL_NOTIFS: Notif[] = [
  {
    id: 1, ic: 'fa-box', bg: 'rgba(180,83,9,.10)', c: '#B45309',
    msg: '3 nouveaux colis TechStore enregistrés en dépôt',
    time: 'Il y a 30 min', unread: true, type: 'colis',
  },
  {
    id: 2, ic: 'fa-arrows-rotate', bg: 'rgba(14,116,144,.10)', c: '#0E7490',
    msg: 'Transfert TR-0041 confirmé — MacBook à Mamadou Diallo',
    time: 'Il y a 2h', unread: true, type: 'transfert',
  },
  {
    id: 3, ic: 'fa-star', bg: 'rgba(245,158,11,.12)', c: '#F59E0B',
    msg: 'AppleZone GN vous a noté 5 ⭐',
    time: 'Hier', unread: false, type: 'evaluation',
  },
  {
    id: 4, ic: 'fa-triangle-exclamation', bg: 'rgba(220,38,38,.09)', c: '#DC2626',
    msg: 'Retour RET-0012 — litige FashionHub GN en attente',
    time: 'Ven.', unread: false, type: 'retour',
  },
  {
    id: 5, ic: 'fa-phone', bg: 'rgba(4,120,87,.10)', c: '#047857',
    msg: 'Fatoumata D. a récupéré son colis avec succès',
    time: 'Ven.', unread: false, type: 'client',
  },
  {
    id: 6, ic: 'fa-box', bg: 'rgba(180,83,9,.10)', c: '#B45309',
    msg: 'Apple Watch Ultra 2 — délai dépassé, action requise',
    time: 'Jeu.', unread: false, type: 'colis',
  },
];

interface Props { open: boolean; onClose: () => void; }

export default function NotifPanel({ open, onClose }: Props) {
  const [notifs,  setNotifs]  = useState<Notif[]>(INITIAL_NOTIFS);
  const [filter,  setFilter]  = useState<'all' | 'unread'>('all');

  const unreadCount = notifs.filter(n => n.unread).length;

  const visible = filter === 'unread'
    ? notifs.filter(n => n.unread)
    : notifs;

  /* Marquer une notif comme lue */
  function markRead(id: number) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
  }

  /* Tout marquer comme lu */
  function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, unread: false })));
  }

  /* Supprimer une notif */
  function dismiss(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setNotifs(prev => prev.filter(n => n.id !== id));
  }

  return (
    <div className={`${s.panel} ${open ? s.open : ''}`}>

      {/* ── Header ── */}
      <div className={s.hd}>
        <div className={s.hdLeft}>
          <div className={s.hdTitle}>
            <i className="fas fa-bell" />
            Notifications
            {unreadCount > 0 && (
              <span className={s.badge}>{unreadCount}</span>
            )}
          </div>

          {/* Filtres */}
          <div className={s.hdFilters}>
            <button
              className={`${s.fBtn} ${filter === 'all'    ? s.fBtnOn : ''}`}
              onClick={() => setFilter('all')}
            >
              Toutes
            </button>
            <button
              className={`${s.fBtn} ${filter === 'unread' ? s.fBtnOn : ''}`}
              onClick={() => setFilter('unread')}
            >
              Non lues {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>
        </div>

        <div className={s.hdRight}>
          {unreadCount > 0 && (
            <button className={s.markAll} onClick={markAllRead} title="Tout marquer comme lu">
              <i className="fas fa-check-double" />
            </button>
          )}
          <button className={s.close} onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>
      </div>

      {/* ── Liste ── */}
      <div className={s.list}>
        {visible.length === 0 ? (
          <div className={s.empty}>
            <i className="fas fa-bell-slash" />
            <div>Aucune notification{filter === 'unread' ? ' non lue' : ''}</div>
          </div>
        ) : (
          visible.map(n => (
            <div
              key={n.id}
              className={`${s.item} ${n.unread ? s.unread : ''}`}
              onClick={() => markRead(n.id)}
            >
              {/* Icône type */}
              <div className={s.ic} style={{ background: n.bg }}>
                <i className={`fas ${n.ic}`} style={{ color: n.c, fontSize: 14 }} />
              </div>

              {/* Contenu */}
              <div className={s.body}>
                <div className={s.msg}>{n.msg}</div>
                <div className={s.time}>
                  <i className="fas fa-clock" style={{ fontSize: 9, marginRight: 4 }} />
                  {n.time}
                </div>
              </div>

              {/* Dot non-lu + bouton supprimer */}
              <div className={s.itemRight}>
                {n.unread && <div className={s.dot} />}
                <button
                  className={s.dismiss}
                  onClick={e => dismiss(n.id, e)}
                  title="Supprimer"
                >
                  <i className="fas fa-xmark" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Footer ── */}
      {notifs.length > 0 && (
        <div className={s.footer}>
          <button
            className={s.footerBtn}
            onClick={() => setNotifs([])}
          >
            <i className="fas fa-trash-can" /> Tout effacer
          </button>
          <button className={s.footerBtn}>
            <i className="fas fa-gear" /> Paramètres notifs
          </button>
        </div>
      )}
    </div>
  );
}