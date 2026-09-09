/**
 * src/shared/messagerie/components/MessagesZone.tsx
 * Zone scrollable des messages + indicateur de frappe/enregistrement.
 *
 * BUG CORRIGÉ — les groupes affichaient une grosse bannière profil éditable
 * (avatars, statut, description) empilée devant les messages, à chaque
 * ouverture du groupe. Retirée : la modification de la description se fait
 * désormais depuis un petit bouton dans l'en-tête (voir ChatHeader.tsx,
 * GroupDescriptionEditor) — même panneau d'édition, juste plus l'énorme
 * carte permanente au-dessus des messages.
 */
import { memo, useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Conversation, ChatUser } from '../data/messagerieTypes';
import type { WsTyping } from '../hooks/useSocket';
import MessageBubble from './MessageBubble';
import VirtualizedMessageList from './VirtualizedMessageList';
import type { VirtualizedMessageListHandle } from './VirtualizedMessageList';
import type { MediaViewerItem } from './MediaViewer';
import { cldAvatar } from '../utils/chatUtils';
import s from '../styles/ChatWindow.module.css';

// ── MessagesZone ──────────────────────────────────────────────

interface Props {
  conv:            Conversation;
  user:            ChatUser;
  typingActivity?: WsTyping;
  onReply:         (r: { sender: string; text: string }) => void;
  onToast:         (msg: string, type?: string) => void;
  onDelete:        (msgId: string, mode: 'me' | 'everyone' | 'other') => void;
  /** Charge les messages plus anciens que le plus ancien déjà affiché (scroll vers le haut). */
  onLoadOlderMessages?: (convId: string) => void;
  /** Relance l'envoi d'un message resté en échec */
  onRetry?:        (msgId: string) => void;
  /** Ouvre la visionneuse plein écran IN-APP (voir MediaViewer.tsx) — remplace window.open.
   *  `index` permet les flèches ← → quand `items` contient plusieurs médias. */
  onOpenMedia:     (items: MediaViewerItem[], index: number) => void;
  /** id du message ciblé par "aller au message" (résultat de recherche, voir ChatHeader) —
   *  doit déjà être présent dans conv.messages (l'appelant charge les pages plus anciennes
   *  au préalable si besoin, voir MessagerieCore.handleJumpToMessage). */
  jumpToMessageId?: string | null;
  /** Appelé une fois le défilement/surlignage déclenché, pour que l'appelant remette
   *  jumpToMessageId à null (sinon un nouveau clic sur le MÊME résultat ne redéclenche rien). */
  onJumpHandled?:  () => void;
}

function MessagesZone({
  conv, user, typingActivity, onReply, onToast, onDelete, onLoadOlderMessages, onRetry,
  jumpToMessageId, onJumpHandled, onOpenMedia,
}: Props) {
  const { t } = useTranslation();
  const msgsRef      = useRef<HTMLDivElement>(null);
  const virtualRef    = useRef<VirtualizedMessageListHandle>(null);
  const isImgAva = user.ava?.startsWith('http');

  /* Virtualisation (react-window) pour les conversations directes —
   * gère elle-même son scroll/prepend/append en interne (voir
   * VirtualizedMessageList.tsx). Les groupes de livraison gardent le
   * rendu natif ci-dessous (volume de messages typiquement faible) —
   * voir le commentaire de fichier de VirtualizedMessageList.tsx pour
   * le raisonnement complet. */
  const isVirtualized = !conv.isGroup;

  /* ── "Aller au message" (résultat de recherche, voir ChatHeader) ──
   * jumpToMessageId change → on fait défiler jusqu'au message ciblé (déjà
   * chargé dans conv.messages à ce stade, voir MessagerieCore) et on le
   * met brièvement en évidence (flash CSS, voir .jumpHighlight). */
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!jumpToMessageId) return;

    if (isVirtualized) {
      virtualRef.current?.scrollToMessage(jumpToMessageId);
    } else {
      const el = msgsRef.current?.querySelector<HTMLElement>(`[data-msg-id="${jumpToMessageId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setHighlightedId(jumpToMessageId);
    onJumpHandled?.();

    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedId(null), 1800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToMessageId]);

  useEffect(() => () => { if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current); }, []);

  /* ── Scroll natif (groupes uniquement) : 3 cas distincts, tous gérés
   * ici pour ne jamais se marcher dessus (voir dépendances ci-dessous,
   * comparées par ref plutôt que par conv.messages.length seul, qui ne
   * suffit pas à distinguer "message ajouté en bas" de "page plus
   * ancienne préfixée en haut") :
   *
   *   1. Changement de conversation (conv.id) → aller tout en bas, direct.
   *   2. Messages plus anciens préfixés (loadOlderMessages ci-dessous a
   *      capturé scrollHeight/scrollTop AVANT le prepend) → recalculer
   *      scrollTop pour conserver EXACTEMENT la position visuelle de
   *      l'utilisateur (sinon le prepend fait "sauter" tout le contenu
   *      visible vers le bas — bug classique des listes de chat).
   *   3. Nouveau message ajouté en bas (envoyé ou reçu, id du dernier
   *      message différent du précédent) → auto-scroll vers le bas. */
  const prevConvIdRef = useRef<string | null>(null);
  const prevLastIdRef = useRef<string | null>(null);
  const pendingOldScrollHeightRef = useRef<number | null>(null);
  const pendingOldScrollTopRef    = useRef<number>(0);

  useLayoutEffect(() => {
    if (isVirtualized) return; // VirtualizedMessageList gère son propre scroll
    const el = msgsRef.current;
    if (!el) return;
    const lastId = conv.messages[conv.messages.length - 1]?.id ?? null;
    const convChanged = prevConvIdRef.current !== conv.id;

    if (convChanged) {
      setTimeout(() => { if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight; }, 50);
    } else if (pendingOldScrollHeightRef.current !== null) {
      const delta = el.scrollHeight - pendingOldScrollHeightRef.current;
      el.scrollTop = pendingOldScrollTopRef.current + delta;
      pendingOldScrollHeightRef.current = null;
    } else if (lastId !== prevLastIdRef.current) {
      setTimeout(() => { if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight; }, 50);
    }

    prevConvIdRef.current = conv.id;
    prevLastIdRef.current = lastId;
  }, [conv.messages, conv.id, isVirtualized]);

  /* Déclenche le chargement des messages plus anciens quand l'utilisateur
   * approche du haut de la zone (groupes uniquement — VirtualizedMessageList
   * a son propre équivalent via onScroll de react-window) — capture
   * scrollHeight/scrollTop AVANT l'arrivée des nouveaux messages pour que
   * l'effet ci-dessus puisse restaurer la position visuelle exacte après
   * leur insertion. */
  const handleScroll = useCallback(() => {
    const el = msgsRef.current;
    if (!el || !onLoadOlderMessages) return;
    if (el.scrollTop < 80 && conv.hasMoreMessages && !conv.loadingOlder) {
      pendingOldScrollHeightRef.current = el.scrollHeight;
      pendingOldScrollTopRef.current    = el.scrollTop;
      onLoadOlderMessages(conv.id);
    }
  }, [conv.id, conv.hasMoreMessages, conv.loadingOlder, onLoadOlderMessages]);

  /* Index du dernier message envoyé par moi et vu (pour avatar de lecture) */
  let lastReadIdx = -1;
  conv.messages.forEach((m, i) => { if (m.from === 'me' && m.read) lastReadIdx = i; });

  /* Libellé indicateur d'activité */
  const isTyping = !!typingActivity && typingActivity.activity !== 'stopped';
  const typingLabel = !typingActivity ? '' :
    typingActivity.activity === 'recording' ? t('messagerie.messagesZone.typingRecording', { name: typingActivity.senderName.split(' ')[0] }) :
    typingActivity.activity === 'uploading' ? t('messagerie.messagesZone.typingUploading', { name: typingActivity.senderName.split(' ')[0] }) :
    t('messagerie.messagesZone.typingWriting', { name: typingActivity.senderName.split(' ')[0] });

  /* Aller au tout début / à la toute fin de la conversation — délègue au
   * handle impératif de VirtualizedMessageList pour les conv directes
   * (react-window gère son propre conteneur de scroll interne, `msgsRef`
   * ne pointe vers rien d'utile dans ce cas). */
  const scrollToStart = useCallback(() => {
    if (isVirtualized) virtualRef.current?.scrollToStart();
    else msgsRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [isVirtualized]);
  const scrollToEnd = useCallback(() => {
    if (isVirtualized) { virtualRef.current?.scrollToEnd(); return; }
    const el = msgsRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [isVirtualized]);

  return (
    <>
      {/* ── Liste des messages ── */}
      <div className={s.msgsZoneWrap}>
        {isVirtualized ? (
          <VirtualizedMessageList
            ref={virtualRef}
            messages={conv.messages}
            user={user}
            lastReadIdx={lastReadIdx}
            onReply={onReply}
            onToast={onToast}
            onDelete={onDelete}
            onRetry={onRetry}
            onOpenMedia={onOpenMedia}
            convId={conv.id}
            hasMoreMessages={conv.hasMoreMessages}
            loadingOlder={conv.loadingOlder}
            onLoadOlderMessages={onLoadOlderMessages}
            highlightedId={highlightedId}
            headerContent={conv.messages.length === 0 ? (
              <div className={s.sysMsg}><span>{t('messagerie.messagesZone.nouvelleConversationAvec', { name: user.name })}</span></div>
            ) : undefined}
          />
        ) : (
          <div className={s.msgsZone} ref={msgsRef} onScroll={handleScroll}>

            {/* Spinner "chargement des messages plus anciens" — en haut de liste */}
            {conv.loadingOlder && (
              <div className={s.sysMsg}><i className="fas fa-spinner fa-spin" /></div>
            )}

            {conv.messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                msg={msg} idx={idx} msgs={conv.messages}
                user={user}
                isLastRead={idx === lastReadIdx}
                highlighted={msg.id === highlightedId}
                onReply={onReply}
                onToast={onToast}
                onDelete={onDelete}
                onRetry={onRetry}
                onOpenMedia={onOpenMedia}
              />
            ))}
          </div>
        )}

        {/* Navigation rapide — début / fin de la conversation */}
        {conv.messages.length > 1 && (
          <div className={s.jumpBtns}>
            <button className={s.jumpBtn} onClick={scrollToStart} title={t('messagerie.messagesZone.allerAuDebut')} aria-label={t('messagerie.messagesZone.allerAuDebut')}>
              <i className="fas fa-angles-up" />
            </button>
            <button className={s.jumpBtn} onClick={scrollToEnd} title={t('messagerie.messagesZone.allerALaFin')} aria-label={t('messagerie.messagesZone.allerALaFin')}>
              <i className="fas fa-angles-down" />
            </button>
          </div>
        )}
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
              ? <img src={cldAvatar(user.ava, 60)!} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }} />
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

/*
 * React.memo (comparaison shallow par défaut) : évite de refaire tout le
 * .map() des bulles quand MessagerieCore se re-rend pour une raison sans
 * rapport avec la conversation ACTIVE (ex: présence d'un autre contact,
 * changement de conversation dans la liste de gauche). `conv` change de
 * référence uniquement quand la conversation affichée ici est concernée
 * (voir useMessagerie.ts), donc le memo peut sauter le rendu le reste
 * du temps.
 */
export default memo(MessagesZone);
