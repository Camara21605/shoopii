/**
 * src/shared/messagerie/sections/ChatWindow.tsx
 *
 * Orchestrateur de la fenêtre de chat.
 * Toute la logique métier est déléguée aux sous-composants :
 *
 *   ChatHeader     → en-tête (avatar, nom, boutons)
 *   MessagesZone   → liste des bulles + indicateur typing
 *   MessageInput   → zone de saisie (texte, emoji, vocal, médias)
 *
 * Cet orchestrateur ne contient que :
 *   - l'état de réponse (replyTo) partagé entre MessagesZone et MessageInput
 *   - le rendu de l'état vide si aucune conversation n'est sélectionnée
 */
import { useState } from 'react';
import type { Conversation, ChatUser, GroupMember } from '../data/messagerieTypes';
import type { MediaAttachment }                     from '../hooks/useMessagerie';
import type { WsTyping }                            from '../hooks/useSocket';

import ChatHeader    from '../components/ChatHeader';
import MessagesZone  from '../components/MessagesZone';
import MessageInput  from '../components/MessageInput';
import s from '../styles/ChatWindow.module.css';

// ─────────────────────────────────────────────────────────────

interface Props {
  conv:            Conversation | null;
  user:            ChatUser | null;
  members?:        GroupMember[];
  infoPanelOpen:   boolean;
  typingActivity?: WsTyping;
  onSend:          (convId: string, text: string, media?: MediaAttachment) => void;
  onTyping?:       (convId: string, activity: WsTyping['activity']) => void;
  onToggleInfo:    () => void;
  onNewConv:       () => void;
  onToast:         (msg: string, type?: string) => void;
  onDelete:        (msgId: string, mode: 'me' | 'everyone' | 'other') => void;
  onUpdateGroup?:  (groupId: string, description: string) => void;
  onCall?:         () => void;
  onVideoCall?:    () => void;
  onMobileMenu?:   () => void;
}

// ─────────────────────────────────────────────────────────────

export default function ChatWindow({
  conv, user, members, infoPanelOpen, typingActivity,
  onSend, onTyping, onToggleInfo, onNewConv, onToast, onDelete, onUpdateGroup, onCall, onVideoCall, onMobileMenu,
}: Props) {
  /** Message cité (réponse) — partagé entre MessagesZone (set) et MessageInput (affichage) */
  const [replyTo, setReplyTo] = useState<{ sender: string; text: string } | null>(null);

  /* ── État vide ── */
  if (!conv || !user) {
    return (
      <div className={s.window}>
        <div className={s.empty}>
          <div className={s.emptyIcon}>💬</div>
          <div className={s.emptyTitle}>Votre messagerie Shopi</div>
          <div className={s.emptySub}>
            Sélectionnez une conversation pour échanger avec boutiques, clients et livreurs.
          </div>
          {onMobileMenu && (
            <button className={s.emptyBtnSecondary} onClick={onMobileMenu}>
              <i className="fas fa-list" /> Voir mes conversations
            </button>
          )}
          <button className={s.emptyBtn} onClick={onNewConv}>
            <i className="fas fa-pen-to-square" /> Démarrer une conversation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.window}>

      {/* ── En-tête ── */}
      <ChatHeader
        user={user}
        members={members}
        infoPanelOpen={infoPanelOpen}
        onToggleInfo={onToggleInfo}
        onToast={onToast}
        onCall={onCall}
        onVideoCall={onVideoCall}
        onMobileMenu={onMobileMenu}
      />

      {/* ── Messages + indicateur typing ── */}
      <MessagesZone
        conv={conv}
        user={user}
        members={members}
        typingActivity={typingActivity}
        onReply={setReplyTo}
        onToast={onToast}
        onDelete={onDelete}
        onUpdateGroup={onUpdateGroup}
      />

      {/* ── Zone de saisie ── */}
      <MessageInput
        convId={conv.id}
        replyTo={replyTo}
        onSend={onSend}
        onTyping={onTyping}
        onToast={onToast}
        onClearReply={() => setReplyTo(null)}
      />

    </div>
  );
}
