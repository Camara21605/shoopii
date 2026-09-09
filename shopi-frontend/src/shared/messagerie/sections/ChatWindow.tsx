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
import { useTranslation } from 'react-i18next';
import type { Conversation, ChatUser, GroupMember } from '../data/messagerieTypes';
import type { MediaAttachment, ShareExtra }          from '../hooks/useMessagerie';
import type { WsTyping }                            from '../hooks/useSocket';

import ChatHeader       from '../components/ChatHeader';
import MessagesZone     from '../components/MessagesZone';
import MessageInput     from '../components/MessageInput';
import WallpaperPicker  from '../components/WallpaperPicker';
import type { MediaViewerItem } from '../components/MediaViewer';
import { useWallpaper }        from '../hooks/useWallpaper';
import { resolveWallpaperStyle } from '../utils/wallpaperPresets';
import s from '../styles/ChatWindow.module.css';

// ─────────────────────────────────────────────────────────────

interface Props {
  conv:            Conversation | null;
  user:            ChatUser | null;
  members?:        GroupMember[];
  infoPanelOpen:   boolean;
  typingActivity?: WsTyping;
  onSend:          (convId: string, text: string, media?: MediaAttachment, extra?: ShareExtra, resolveMedia?: () => Promise<MediaAttachment>) => void;
  onTyping?:       (convId: string, activity: WsTyping['activity']) => void;
  onToggleInfo:    () => void;
  onNewConv:       () => void;
  onToast:         (msg: string, type?: string) => void;
  onDelete:        (msgId: string, mode: 'me' | 'everyone' | 'other') => void;
  onUpdateGroup?:  (groupId: string, description: string) => void;
  onCall?:         () => void;
  onVideoCall?:    () => void;
  onMobileMenu?:   () => void;
  onLoadOlderMessages?: (convId: string) => void;
  onRetry?:        (msgId: string) => void;
  /** Ouvre la visionneuse plein écran IN-APP (voir MediaViewer.tsx) — remplace window.open.
   *  `index` permet les flèches ← → quand `items` contient plusieurs médias. */
  onOpenMedia:     (items: MediaViewerItem[], index: number) => void;
  onArchiveConv?:  (convId: string) => void;
  onDeleteConv?:   (convId: string) => void;
  /** Ouvre le panneau "Paramètres" (colonne latérale, même présentation
   * que le panneau "Informations") — état/rendu vivent dans MessagerieCore. */
  onOpenSettings?: () => void;
  /** "Aller au message" (résultat de recherche du ChatHeader) — voir MessagerieCore.handleJumpToMessage. */
  onJumpToMessage?: (msgId: string) => void;
  jumpToMessageId?: string | null;
  onJumpHandled?:  () => void;
  /** false → masque la zone de saisie (collaborateur d'entreprise sans la
   * permission messaging.send — voir MessagerieCore). Undefined/true = comportement
   * inchangé pour tous les autres rôles/dashboards. */
  canSend?: boolean;
}

// ─────────────────────────────────────────────────────────────

export default function ChatWindow({
  conv, user, members, infoPanelOpen, typingActivity,
  onSend, onTyping, onToggleInfo, onNewConv, onToast, onDelete, onUpdateGroup, onCall, onVideoCall, onMobileMenu,
  onLoadOlderMessages, onRetry, onOpenMedia, onArchiveConv, onDeleteConv,
  onJumpToMessage, jumpToMessageId, onJumpHandled,
  canSend = true, onOpenSettings,
}: Props) {
  const { t } = useTranslation();
  /** Message cité (réponse) — partagé entre MessagesZone (set) et MessageInput (affichage) */
  const [replyTo, setReplyTo] = useState<{ sender: string; text: string } | null>(null);

  /** Fond d'écran de la messagerie — préférence globale (voir useWallpaper). */
  const { wallpaper, saving: wallpaperSaving, chooseWallpaper } = useWallpaper();
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);
  const wallpaperStyle = resolveWallpaperStyle(wallpaper);

  /* ── État vide ── */
  if (!conv || !user) {
    return (
      <div className={s.window}>
        <div className={s.empty}>
          <div className={s.emptyIcon}>💬</div>
          <div className={s.emptyTitle}>{t('messagerie.chatWindow.emptyTitle')}</div>
          <div className={s.emptySub}>
            {t('messagerie.chatWindow.emptySub')}
          </div>
          {onMobileMenu && (
            <button className={s.emptyBtnSecondary} onClick={onMobileMenu}>
              <i className="fas fa-list" /> {t('messagerie.chatWindow.voirConversations')}
            </button>
          )}
          <button className={s.emptyBtn} onClick={onNewConv}>
            <i className="fas fa-pen-to-square" /> {t('messagerie.chatWindow.demarrerConversation')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.window} style={wallpaperStyle}>

      {/* ── En-tête ── */}
      <ChatHeader
        convId={conv.id}
        user={user}
        members={members}
        infoPanelOpen={infoPanelOpen}
        onToggleInfo={onToggleInfo}
        onToast={onToast}
        onCall={onCall}
        onVideoCall={onVideoCall}
        onMobileMenu={onMobileMenu}
        convPinned={conv.pinned}
        convMuted={conv.muted}
        onArchiveConv={onArchiveConv}
        onDeleteConv={onDeleteConv}
        onJumpToMessage={onJumpToMessage}
        onOpenWallpaper={() => setWallpaperPickerOpen(true)}
        hasWallpaper={!!wallpaper}
        onOpenSettings={onOpenSettings}
        groupDescription={conv.description}
        onUpdateGroupDescription={onUpdateGroup ? (desc: string) => onUpdateGroup(conv.id, desc) : undefined}
        isCustomGroup={conv.isCustomGroup}
      />

      {/* ── Messages + indicateur typing ── */}
      <MessagesZone
        conv={conv}
        user={user}
        typingActivity={typingActivity}
        onReply={setReplyTo}
        onToast={onToast}
        onDelete={onDelete}
        onLoadOlderMessages={onLoadOlderMessages}
        onRetry={onRetry}
        onOpenMedia={onOpenMedia}
        jumpToMessageId={jumpToMessageId}
        onJumpHandled={onJumpHandled}
      />

      {/* ── Zone de saisie ── */}
      {canSend ? (
        <MessageInput
          convId={conv.id}
          replyTo={replyTo}
          onSend={onSend}
          onTyping={onTyping}
          onToast={onToast}
          onClearReply={() => setReplyTo(null)}
        />
      ) : (
        <div className={s.sendDisabled}>
          <i className="fas fa-lock" /> {t('messagerie.messageInput.envoiNonAutorise')}
        </div>
      )}

      {/* ── Sélecteur de fond d'écran (préférence globale) ── */}
      {wallpaperPickerOpen && (
        <WallpaperPicker
          current={wallpaper}
          saving={wallpaperSaving}
          onChoose={chooseWallpaper}
          onClose={() => setWallpaperPickerOpen(false)}
          onToast={onToast}
        />
      )}

    </div>
  );
}
