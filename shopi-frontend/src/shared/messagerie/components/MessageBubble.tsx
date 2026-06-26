/**
 * src/shared/messagerie/components/MessageBubble.tsx
 * Rendu d'une seule bulle de message (tous types).
 * Composant pur — aucun état local sauf VoicePlayer.
 */
import type { ChatMessage, ChatUser } from '../data/messagerieTypes';
import { ROLE_CONFIG } from '../data/messagerieTypes';
import VoicePlayer from './VoicePlayer';
import s from '../styles/ChatWindow.module.css';

interface Props {
  msg:         ChatMessage;
  idx:         number;
  msgs:        ChatMessage[];
  user:        ChatUser;
  /** Vrai pour le dernier message envoyé par moi et vu — affiche l'avatar de lecture */
  isLastRead?: boolean;
  onReply:     (r: { sender: string; text: string }) => void;
  onToast:     (msg: string, type?: string) => void;
}

export default function MessageBubble({
  msg, idx, msgs, user, isLastRead = false, onReply, onToast,
}: Props) {
  const isMe    = msg.from === 'me';
  const prev    = msgs[idx - 1];
  const isSame  = prev?.from === msg.from;
  const isFirst = !isSame;
  const rc      = ROLE_CONFIG[user.role] ?? ROLE_CONFIG['client'];
  const isImgAva = user.ava?.startsWith('http');

  return (
    <div className={[s.msgRow, isMe ? s.mine : '', isFirst ? s.firstGroup : '', isSame ? s.noAva : ''].filter(Boolean).join(' ')}>

      {/* Avatar gauche (messages reçus) */}
      {!isMe && (
        <div className={s.msgAva}>
          {isFirst && (
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: isImgAva ? undefined : user.avaColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'var(--navy)', overflow: 'hidden', flexShrink: 0,
            }}>
              {isImgAva
                ? <img src={user.ava} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }} />
                : user.ava
              }
            </div>
          )}
        </div>
      )}

      <div className={s.msgGroup}>
        {/* Nom expéditeur (1er du groupe, pas moi) */}
        {isFirst && !isMe && (
          <div className={s.msgSender} style={{ color: rc.color }}>{user.name}</div>
        )}

        {/* Contenu de la bulle */}
        <div className={s.bubbleWrap}>

          {/* TEXTE */}
          {msg.type === 'text' && (
            <>
              <div className={`${s.bubble} ${isMe ? s.sent : s.recv}`}>{msg.text}</div>
              <div className={s.bubbleActions}>
                <button className={s.baBtn} title="Répondre"
                  onClick={() => onReply({ sender: isMe ? 'Vous' : user.name, text: msg.text ?? '' })}>
                  <i className="fas fa-reply" />
                </button>
                <button className={s.baBtn} title="Copier"
                  onClick={() => { navigator.clipboard.writeText(msg.text ?? ''); onToast('📋 Copié !', 's'); }}>
                  <i className="fas fa-copy" />
                </button>
                {isMe && (
                  <button className={s.baBtn} style={{ color: 'var(--red,#DC2626)' }} title="Supprimer"
                    onClick={() => onToast('🗑️ Supprimé', 'w')}>
                    <i className="fas fa-trash-can" />
                  </button>
                )}
              </div>
            </>
          )}

          {/* PRODUIT */}
          {msg.type === 'product' && msg.product && (
            <>
              <div className={`${s.bubble} ${isMe ? s.sent : s.recv}`}>{msg.text}</div>
              <div className={s.msgProduct} onClick={() => onToast('📦 Voir le produit', 'i')}>
                <div className={s.mpImg}>{msg.product.em}</div>
                <div className={s.mpBody}>
                  <div className={s.mpNm}>{msg.product.nm}</div>
                  <div className={s.mpPrice}>{msg.product.price}</div>
                  <button className={s.mpBtn} onClick={e => { e.stopPropagation(); onToast('🛒 Ajouté au panier', 's'); }}>
                    Ajouter au panier
                  </button>
                </div>
              </div>
            </>
          )}

          {/* COMMANDE */}
          {msg.type === 'order' && msg.order && (
            <>
              <div className={`${s.bubble} ${isMe ? s.sent : s.recv}`}>{msg.text}</div>
              <div className={s.msgOrder}>
                <div className={s.moHd}>
                  <div className={s.moId}>{msg.order.id}</div>
                  <span className={s.moStatus}>{msg.order.status}</span>
                </div>
                <div className={s.moBody}>
                  <div className={s.moNm}>{msg.order.nm}</div>
                  <button className={s.moTrack} onClick={() => onToast('📍 Suivi de commande', 'i')}>
                    <i className="fas fa-map-location-dot" /> Suivre la commande
                  </button>
                </div>
              </div>
            </>
          )}

          {/* IMAGE */}
          {msg.type === 'image' && (
            <>
              <div className={s.msgImg}>
                {msg.mediaUrl
                  ? <img src={msg.mediaUrl} alt={msg.mediaName ?? 'Photo'} className={s.msgImgReal}
                      onClick={() => window.open(msg.mediaUrl, '_blank')} />
                  : <div className={s.msgImgPlaceholder}>📸</div>
                }
              </div>
              {msg.text && <div className={`${s.bubble} ${isMe ? s.sent : s.recv} ${s.mediaCaption}`}>{msg.text}</div>}
            </>
          )}

          {/* VIDÉO */}
          {msg.type === 'video' && (
            <>
              <div className={s.msgVideo}>
                {msg.mediaUrl
                  ? <video src={msg.mediaUrl} controls className={s.msgVideoEl} />
                  : <div className={s.msgImgPlaceholder}>🎥</div>
                }
              </div>
              {msg.text && <div className={`${s.bubble} ${isMe ? s.sent : s.recv} ${s.mediaCaption}`}>{msg.text}</div>}
            </>
          )}

          {/* FICHIER / DOCUMENT */}
          {msg.type === 'file' && (
            <>
              <a href={msg.mediaUrl ?? '#'} target="_blank" rel="noreferrer" download={msg.mediaName}
                className={s.msgFile} onClick={e => { if (!msg.mediaUrl) e.preventDefault(); }}>
                <div className={s.mfIcon}><i className="fas fa-file-pdf" /></div>
                <div className={s.mfBody}>
                  <div className={s.mfName}>{msg.mediaName ?? 'Document'}</div>
                  <div className={s.mfMeta}>PDF · Cliquer pour ouvrir</div>
                </div>
                <i className="fas fa-arrow-up-right-from-square" style={{ color: 'var(--t3)', fontSize: 13 }} />
              </a>
              {msg.text && <div className={`${s.bubble} ${isMe ? s.sent : s.recv} ${s.mediaCaption}`}>{msg.text}</div>}
            </>
          )}

          {/* VOCAL */}
          {msg.type === 'voice' && (
            <VoicePlayer url={msg.mediaUrl} duration={msg.duration} isMe={isMe} />
          )}

          {/* APPEL AUDIO */}
          {msg.type === 'call' && (
            <CallBubble meta={msg.callMeta} isMe={isMe} />
          )}
        </div>

        {/* ── Statut envoi 3 états : ✓ envoyé / ✓✓ livré / ✓✓ vu ── */}
        {isMe && (
          <div className={s.msgStatus}>
            {/* Avatar de lecture sur le dernier message vu */}
            {isLastRead && (
              <div className={s.readAvatar} title={`Vu par ${user.name}`}>
                {isImgAva
                  ? <img src={user.ava} alt={user.name} />
                  : user.ava
                }
              </div>
            )}
            {msg.read ? (
              <span className={s.tickRead} title="Vu"><i className="fas fa-check-double" /></span>
            ) : msg.delivered ? (
              <span className={s.tickDelivered} title="Livré"><i className="fas fa-check-double" /></span>
            ) : (
              <span className={s.tickSent} title="Envoyé"><i className="fas fa-check" /></span>
            )}
          </div>
        )}
      </div>

      {/* Heure */}
      {(!isSame || idx === msgs.length - 1) && msg.time.length <= 5 && (
        <div className={s.msgTime}>{msg.time}</div>
      )}

      {/* Espace avatar droit (moi) */}
      {isMe && <div className={s.msgAva} />}
    </div>
  );
}

// ── Bulle événement d'appel ───────────────────────────────────

type CallMeta = ChatMessage['callMeta'];

function CallBubble({ meta, isMe }: { meta?: CallMeta; isMe: boolean }) {
  if (!meta) {
    return (
      <div className={`${s.callBubble} ${isMe ? s.callBubbleMe : ''}`}>
        <span className={s.callIcon}><i className="fas fa-phone" /></span>
        <span className={s.callLabel}>Appel audio</span>
      </div>
    );
  }

  const isVideoCall = meta.callType === 'video';

  /* Icône et libellé selon le statut + type d'appel */
  const cfg: Record<string, { icon: string; iconColor: string; textRed?: boolean }> = {
    completed:  { icon: isVideoCall ? 'fa-video'        : 'fa-phone',        iconColor: 'var(--emerald,#059669)'              },
    missed:     { icon: isVideoCall ? 'fa-video-slash'  : 'fa-phone-missed', iconColor: 'var(--rose,#DC2626)',  textRed: true },
    rejected:   { icon: isVideoCall ? 'fa-video-slash'  : 'fa-phone-slash',  iconColor: 'var(--rose,#DC2626)',  textRed: true },
    cancelled:  { icon: isVideoCall ? 'fa-video-slash'  : 'fa-phone-slash',  iconColor: 'var(--t3,#94A3B8)'                  },
    busy:       { icon: isVideoCall ? 'fa-video'        : 'fa-phone-volume', iconColor: 'var(--amber,#B45309)'               },
  };

  const typeLabel = isVideoCall ? 'vidéo' : 'audio';
  const labelMap: Record<string, string> = {
    completed: `Appel ${typeLabel}`,
    missed:    'Appel manqué',
    rejected:  'Appel refusé',
    cancelled: 'Appel annulé',
    busy:      'Correspondant occupé',
  };
  const label = labelMap[meta.status] ?? `Appel ${typeLabel}`;

  const { icon, iconColor, textRed } = cfg[meta.status] ?? cfg['completed'];

  /* Durée formatée si appel terminé */
  const dur = meta.duration
    ? ` · ${Math.floor(meta.duration / 60)}:${String(meta.duration % 60).padStart(2, '0')}`
    : '';

  /* Flèche de direction */
  const arrow = meta.direction === 'outgoing'
    ? <i className="fas fa-arrow-up-right" style={{ fontSize: 9 }} />
    : <i className="fas fa-arrow-down-left" style={{ fontSize: 9 }} />;

  return (
    <div className={`${s.callBubble} ${isMe ? s.callBubbleMe : ''} ${textRed ? s.callBubbleMissed : ''}`}>
      <span className={s.callIcon} style={{ color: iconColor }}>
        <i className={`fas ${icon}`} />
      </span>
      <span className={s.callArrow} style={{ color: textRed ? iconColor : undefined }}>{arrow}</span>
      <span className={s.callLabel} style={{ color: textRed ? iconColor : undefined }}>{label}{dur}</span>
    </div>
  );
}
