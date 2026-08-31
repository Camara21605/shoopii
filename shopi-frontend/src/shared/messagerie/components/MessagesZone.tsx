/**
 * src/shared/messagerie/components/MessagesZone.tsx
 * Zone scrollable des messages + indicateur de frappe/enregistrement.
 *
 * Pour les groupes de livraison, affiche une bannière profil éditable
 * en tête de la zone, avant les messages.
 */
import React, { memo, useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Conversation, ChatUser, GroupMember } from '../data/messagerieTypes';
import type { WsTyping } from '../hooks/useSocket';
import MessageBubble from './MessageBubble';
import VirtualizedMessageList from './VirtualizedMessageList';
import type { VirtualizedMessageListHandle } from './VirtualizedMessageList';
import { cldAvatar } from '../utils/chatUtils';
import s from '../styles/ChatWindow.module.css';

// ── Couleurs initiales par type d'acteur ──────────────────────

const ACTOR_INIT_BG: Record<string, string> = {
  client:        'rgba(26,79,196,.82)',
  company:       'rgba(4,120,87,.82)',
  delivery:      'rgba(14,116,144,.82)',
  correspondent: 'rgba(180,83,9,.82)',
};

function getGroupStatusLabel(t: TFunction): Record<string, string> {
  return {
    active:    t('messagerie.messagesZone.groupStatus.active'),
    completed: t('messagerie.messagesZone.groupStatus.completed'),
    expired:   t('messagerie.messagesZone.groupStatus.expired'),
    cancelled: t('messagerie.messagesZone.groupStatus.cancelled'),
  };
}

// ── Bannière profil groupe ────────────────────────────────────

interface BannerProps {
  conv:       Conversation;
  members:    GroupMember[];
  onSaveDesc: (desc: string) => void;
}

/* Couleur de la barre de progression selon le remplissage */
function progressColor(len: number): string {
  if (len < 350) return '#10B981';
  if (len < 450) return '#F59E0B';
  return '#EF4444';
}

function GroupProfileBanner({ conv, members, onSaveDesc }: BannerProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(conv.description ?? '');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* Synchroniser le draft si la description change depuis un autre membre */
  useEffect(() => {
    if (!editing) setDraft(conv.description ?? '');
  }, [conv.description, editing]);

  /* Focus sur le textarea dès l'ouverture du panneau */
  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 80);
  }, [editing]);

  /* Enregistrement au Ctrl/Cmd + Entrée */
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') handleCancel();
  }

  function handleSave() {
    onSaveDesc(draft.trim());
    setEditing(false);
  }

  function handleCancel() {
    setDraft(conv.description ?? '');
    setEditing(false);
  }

  const statusLabel    = getGroupStatusLabel(t)[conv.groupStatus ?? 'active'] ?? getGroupStatusLabel(t).active;
  const visibleMembers = members.slice(0, 3);
  const extraCount     = Math.max(0, members.length - 3);
  const pct            = Math.round((draft.length / 500) * 100);

  return (
    <>
      {/* ── Carte bannière (toujours visible) ── */}
      <div style={{
        margin:       '0 0 24px',
        borderRadius: 16,
        overflow:     'hidden',
        border:       '1px solid var(--bdr)',
        boxShadow:    '0 2px 10px rgba(6,15,30,.07)',
        background:   'var(--white)',
      }}>

        {/* ── Header avec dégradé teal ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '15px 16px 13px',
          background: 'linear-gradient(135deg,rgba(14,116,144,.11) 0%,rgba(14,116,144,.04) 100%)',
          borderBottom: '1px solid var(--bdr)',
        }}>

          {/* Avatars en triangle */}
          <div style={{ position: 'relative', width: 54, height: 50, flexShrink: 0 }}>
            {visibleMembers.length === 0 ? (
              <div style={{
                width: 50, height: 50, borderRadius: 14,
                background: 'rgba(14,116,144,.13)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>📦</div>
            ) : (
              <>
                {visibleMembers.map((m, i) => (
                  <div key={m.id} style={{
                    position: 'absolute',
                    width:    i === 0 ? 36 : 26,
                    height:   i === 0 ? 36 : 26,
                    borderRadius: i === 0 ? 11 : 8,
                    background: ACTOR_INIT_BG[m.actorType] ?? '#6B7280',
                    color: '#fff', fontWeight: 800,
                    fontSize: i === 0 ? 15 : 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2.5px solid var(--white)',
                    boxShadow: '0 2px 6px rgba(0,0,0,.18)',
                    left: i === 0 ? 0 : i === 1 ? 18 : 9,
                    top:  i === 0 ? 0 : i === 1 ? 20 : 30,
                    zIndex: 3 - i,
                  }}>
                    {m.displayName.charAt(0).toUpperCase()}
                  </div>
                ))}
                {extraCount > 0 && (
                  <div style={{
                    position: 'absolute', right: 0, bottom: 0,
                    width: 22, height: 22, borderRadius: 7,
                    background: 'var(--g300,#d1d5db)', color: 'var(--t2)',
                    fontSize: 8, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid var(--white)',
                  }}>+{extraCount}</div>
                )}
              </>
            )}
          </div>

          {/* Nom + badges */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--fd)', fontSize: 14, fontWeight: 800,
              color: 'var(--navy)', lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: 5,
            }}>
              {conv.commandeNumero ? `${t('messagerie.messagesZone.livraisonPrefix')} · ${conv.commandeNumero}` : t('messagerie.convList.groupeDeLivraison')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11, fontWeight: 700, lineHeight: 1,
                color: 'var(--teal,#0E7490)',
                background: 'rgba(14,116,144,.1)',
                padding: '3px 9px', borderRadius: 99,
                border: '1px solid rgba(14,116,144,.15)',
              }}>
                {statusLabel}
              </span>
              {members.length > 0 && (
                <span style={{
                  fontSize: 11, color: 'var(--t3)', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <i className="fas fa-users" style={{ fontSize: 9 }} />
                  {t('messagerie.chatHeader.membre', { count: members.length })}
                </span>
              )}
            </div>
          </div>

          {/* Bouton éditer */}
          <button
            onClick={() => setEditing(true)}
            title={t('messagerie.messagesZone.modifierDescription')}
            style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'var(--white)', border: '1.5px solid var(--bdr2)',
              color: 'var(--t3)', fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .15s',
              boxShadow: '0 1px 3px rgba(0,0,0,.06)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'rgba(14,116,144,.08)';
              el.style.borderColor = 'rgba(14,116,144,.4)';
              el.style.color = 'var(--teal,#0E7490)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'var(--white)';
              el.style.borderColor = 'var(--bdr2)';
              el.style.color = 'var(--t3)';
            }}
          >
            <i className="fas fa-pen" />
          </button>
        </div>

        {/* ── Zone description (affichage seul) ── */}
        <div
          onClick={() => setEditing(true)}
          title={t('messagerie.messagesZone.cliquerPourModifier')}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '13px 16px 14px',
            cursor: 'text', transition: 'background .15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--g50,#F8FAFC)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
            background: conv.description ? 'rgba(14,116,144,.1)' : 'var(--g100)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className={`fas ${conv.description ? 'fa-align-left' : 'fa-pen'}`}
              style={{ fontSize: 11, color: conv.description ? 'var(--teal,#0E7490)' : 'var(--t4)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: 'var(--t3)',
              textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4,
            }}>
              {t('messagerie.messagesZone.description')}
            </div>
            <div style={{
              fontSize: 13, lineHeight: 1.65,
              color: conv.description ? 'var(--t1)' : 'var(--t4)',
              fontStyle: conv.description ? 'normal' : 'italic',
            }}>
              {conv.description || t('messagerie.messagesZone.ajouterDescription')}
            </div>
          </div>
        </div>
      </div>

      {/* ── Panneau édition flottant (position fixe, au-dessus du clavier) ── */}
      {editing && (
        <>
          {/* Fond semi-transparent */}
          <div
            onClick={handleCancel}
            style={{
              position: 'fixed', inset: 0, zIndex: 1200,
              background: 'rgba(6,15,30,.45)',
            }}
          />

          {/* Panneau bas */}
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1201,
            background: 'var(--white)',
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: '0 0 env(safe-area-inset-bottom, 12px)',
            boxShadow: '0 -6px 30px rgba(6,15,30,.18)',
          }}>
            {/* Poignée */}
            <div style={{
              width: 36, height: 4, borderRadius: 99,
              background: 'var(--g200,#e5e7eb)',
              margin: '12px auto 0',
            }} />

            {/* Titre */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px 10px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, fontWeight: 800, color: 'var(--navy)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'rgba(14,116,144,.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i className="fas fa-pen-to-square" style={{ fontSize: 11, color: 'var(--teal,#0E7490)' }} />
                </div>
                {t('messagerie.messagesZone.modifierDescription')}
              </div>
              <button
                onClick={handleCancel}
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: 'var(--g100)', border: 'none',
                  color: 'var(--t3)', fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <i className="fas fa-xmark" />
              </button>
            </div>

            {/* Textarea */}
            <div style={{ padding: '0 18px' }}>
              <textarea
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('messagerie.messagesZone.adressePlaceholder')}
                maxLength={500}
                rows={4}
                style={{
                  width: '100%', resize: 'none', boxSizing: 'border-box',
                  background: 'var(--g50)',
                  border: '1.5px solid var(--teal,#0E7490)',
                  borderRadius: 12, padding: '12px 14px',
                  fontSize: 14, color: 'var(--t1)', lineHeight: 1.6,
                  outline: 'none', fontFamily: 'var(--fb)',
                  boxShadow: '0 0 0 3px rgba(14,116,144,.1)',
                }}
              />
            </div>

            {/* Compteur + barre */}
            <div style={{ padding: '8px 18px 0' }}>
              <div style={{
                height: 3, borderRadius: 99, background: 'var(--g100)', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: progressColor(draft.length),
                  borderRadius: 99, transition: 'width .2s, background .3s',
                }} />
              </div>
              <div style={{
                display: 'flex', justifyContent: 'flex-end',
                marginTop: 4,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: progressColor(draft.length) }}>
                  {draft.length} / 500
                </span>
              </div>
            </div>

            {/* Boutons */}
            <div style={{
              display: 'flex', gap: 10, padding: '12px 18px 16px',
            }}>
              <button
                onClick={handleCancel}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12,
                  background: 'var(--g100)', border: 'none',
                  color: 'var(--t2)', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--fb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <i className="fas fa-xmark" style={{ fontSize: 12 }} />
                {t('messagerie.messagesZone.annuler')}
              </button>
              <button
                onClick={handleSave}
                style={{
                  flex: 2, padding: '12px 0', borderRadius: 12,
                  background: 'linear-gradient(135deg,#0E7490,#0c6480)',
                  border: 'none', color: '#fff',
                  fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--fb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: '0 4px 12px rgba(14,116,144,.4)',
                }}
              >
                <i className="fas fa-check" style={{ fontSize: 12 }} />
                {t('messagerie.messagesZone.enregistrer')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── MessagesZone ──────────────────────────────────────────────

interface Props {
  conv:            Conversation;
  user:            ChatUser;
  members?:        GroupMember[];
  typingActivity?: WsTyping;
  onReply:         (r: { sender: string; text: string }) => void;
  onToast:         (msg: string, type?: string) => void;
  onDelete:        (msgId: string, mode: 'me' | 'everyone' | 'other') => void;
  onUpdateGroup?:  (groupId: string, description: string) => void;
  /** Charge les messages plus anciens que le plus ancien déjà affiché (scroll vers le haut). */
  onLoadOlderMessages?: (convId: string) => void;
  /** Relance l'envoi d'un message resté en échec */
  onRetry?:        (msgId: string) => void;
  /** id du message ciblé par "aller au message" (résultat de recherche, voir ChatHeader) —
   *  doit déjà être présent dans conv.messages (l'appelant charge les pages plus anciennes
   *  au préalable si besoin, voir MessagerieCore.handleJumpToMessage). */
  jumpToMessageId?: string | null;
  /** Appelé une fois le défilement/surlignage déclenché, pour que l'appelant remette
   *  jumpToMessageId à null (sinon un nouveau clic sur le MÊME résultat ne redéclenche rien). */
  onJumpHandled?:  () => void;
}

function MessagesZone({
  conv, user, members, typingActivity, onReply, onToast, onDelete, onUpdateGroup, onLoadOlderMessages, onRetry,
  jumpToMessageId, onJumpHandled,
}: Props) {
  const { t } = useTranslation();
  const msgsRef      = useRef<HTMLDivElement>(null);
  const virtualRef    = useRef<VirtualizedMessageListHandle>(null);
  const isImgAva = user.ava?.startsWith('http');

  /* Virtualisation (react-window) pour les conversations directes —
   * gère elle-même son scroll/prepend/append en interne (voir
   * VirtualizedMessageList.tsx). Les groupes de livraison gardent le
   * rendu natif ci-dessous (bannière profil + volume de messages
   * typiquement faible) — voir le commentaire de fichier de
   * VirtualizedMessageList.tsx pour le raisonnement complet. */
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

  const handleSaveDesc = useCallback((desc: string) => {
    if (onUpdateGroup) onUpdateGroup(conv.id, desc);
  }, [onUpdateGroup, conv.id]);

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

            {/* Bannière profil — groupes uniquement */}
            <GroupProfileBanner
              conv={conv}
              members={members ?? []}
              onSaveDesc={handleSaveDesc}
            />

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
