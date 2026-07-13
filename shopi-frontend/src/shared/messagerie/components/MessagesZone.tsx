/**
 * src/shared/messagerie/components/MessagesZone.tsx
 * Zone scrollable des messages + indicateur de frappe/enregistrement.
 *
 * Pour les groupes de livraison, affiche une bannière profil éditable
 * en tête de la zone, avant les messages.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Conversation, ChatUser, GroupMember } from '../data/messagerieTypes';
import type { WsTyping } from '../hooks/useSocket';
import MessageBubble from './MessageBubble';
import s from '../styles/ChatWindow.module.css';

// ── Couleurs initiales par type d'acteur ──────────────────────

const ACTOR_INIT_BG: Record<string, string> = {
  client:        'rgba(26,79,196,.82)',
  company:       'rgba(4,120,87,.82)',
  delivery:      'rgba(14,116,144,.82)',
  correspondent: 'rgba(180,83,9,.82)',
};

const GROUP_STATUS_LABEL: Record<string, string> = {
  active:    '🚀 En cours',
  completed: '✅ Livré',
  expired:   '🔒 Expiré',
  cancelled: '❌ Annulé',
};

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

  const statusLabel    = GROUP_STATUS_LABEL[conv.groupStatus ?? 'active'] ?? '🚀 En cours';
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
              {conv.commandeNumero ? `Livraison · ${conv.commandeNumero}` : 'Groupe de livraison'}
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
                  {members.length} membre{members.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Bouton éditer */}
          <button
            onClick={() => setEditing(true)}
            title="Modifier la description"
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
          title="Cliquer pour modifier"
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
              Description
            </div>
            <div style={{
              fontSize: 13, lineHeight: 1.65,
              color: conv.description ? 'var(--t1)' : 'var(--t4)',
              fontStyle: conv.description ? 'normal' : 'italic',
            }}>
              {conv.description || 'Ajoutez une description au groupe…'}
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
                Modifier la description
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
                placeholder="Adresse précise, instructions de livraison…"
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
                Annuler
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
                Enregistrer
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
}

export default function MessagesZone({
  conv, user, members, typingActivity, onReply, onToast, onDelete, onUpdateGroup,
}: Props) {
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

  const handleSaveDesc = useCallback((desc: string) => {
    if (onUpdateGroup) onUpdateGroup(conv.id, desc);
  }, [onUpdateGroup, conv.id]);

  return (
    <>
      {/* ── Liste des messages ── */}
      <div className={s.msgsZone} ref={msgsRef}>

        {/* Bannière profil — groupes uniquement */}
        {conv.isGroup && (
          <GroupProfileBanner
            conv={conv}
            members={members ?? []}
            onSaveDesc={handleSaveDesc}
          />
        )}

        {conv.messages.length === 0 && !conv.isGroup && (
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
            onDelete={onDelete}
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
