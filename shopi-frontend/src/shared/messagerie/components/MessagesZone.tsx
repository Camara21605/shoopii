/**
 * src/shared/messagerie/components/MessagesZone.tsx
 * Zone scrollable des messages + indicateur de frappe/enregistrement.
 */
import React, { useRef, useEffect } from 'react';
import type { Conversation, ChatUser } from '../data/messagerieTypes';
import type { WsTyping } from '../hooks/useSocket';
import MessageBubble from './MessageBubble';
import s from '../styles/ChatWindow.module.css';

interface Props {
  conv:            Conversation;
  user:            ChatUser;
  typingActivity?: WsTyping;
  onReply:         (r: { sender: string; text: string }) => void;
  onToast:         (msg: string, type?: string) => void;
}

export default function MessagesZone({ conv, user, typingActivity, onReply, onToast }: Props) {
  const msgsRef  = useRef<HTMLDivElement>(null);
  const isImgAva = user.ava?.startsWith('http');

  /* Auto-scroll vers le bas à chaque nouveau message */
  useEffect(() => {
    setTimeout(() => {
      if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }, 50);
  }, [conv.messages.length, conv.id]);

  /* Index du dernier message envoyé par moi et vu (pour avatar de lecture) */
  let lastReadIdx = -1;
  conv.messages.forEach((m, i) => { if (m.from === 'me' && m.read) lastReadIdx = i; });

  /* Libellé indicateur d'activité */
  const isTyping = !!typingActivity && typingActivity.activity !== 'stopped';
  const typingLabel = !typingActivity ? '' :
    typingActivity.activity === 'recording' ? `${typingActivity.senderName.split(' ')[0]} enregistre…` :
    typingActivity.activity === 'uploading' ? `${typingActivity.senderName.split(' ')[0]} envoie un fichier…` :
    `${typingActivity.senderName.split(' ')[0]} écrit…`;

  return (
    <>
      {/* ── Liste des messages ── */}
      <div className={s.msgsZone} ref={msgsRef}>
        {conv.messages.length === 0 && (
          <div className={s.sysMsg}><span>Nouvelle conversation avec {user.name}</span></div>
        )}
        {conv.messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            msg={msg} idx={idx} msgs={conv.messages}
            user={user}
            isLastRead={idx === lastReadIdx}
            onReply={onReply}
            onToast={onToast}
          />
        ))}
      </div>

      {/* ── Indicateur typing / recording / upload ── */}
      <div className={s.typingWrap}>
        <div className={`${s.typingInd} ${isTyping ? s.show : ''}`}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: isImgAva ? undefined : user.avaColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: 'var(--navy)', flexShrink: 0, overflow: 'hidden',
          }}>
            {isImgAva
              ? <img src={user.ava} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }} />
              : user.ava
            }
          </div>
          <div className={s.typingBubble}>
            <span className={s.typingDot} />
            <span className={s.typingDot} />
            <span className={s.typingDot} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>{typingLabel}</span>
        </div>
      </div>
    </>
  );
}
