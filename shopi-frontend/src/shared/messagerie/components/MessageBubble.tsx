/**
 * src/shared/messagerie/components/MessageBubble.tsx
 * Rendu d'une seule bulle de message (tous types).
 */
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatMessage, ChatUser } from '../data/messagerieTypes';
import { getRoleConfig } from '../data/messagerieTypes';
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
  onDelete:    (msgId: string, mode: 'me' | 'everyone' | 'other') => void;
}

export default function MessageBubble({
  msg, idx, msgs, user, isLastRead = false, onReply, onToast, onDelete,
}: Props) {
  const { t } = useTranslation();
  // Affiche ou masque le petit menu "Supprimer pour moi / lui / tout le monde"
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);

  // Par défaut, le menu de suppression s'ouvre VERS LE HAUT (au-dessus de
  // l'icône poubelle). Problème : la liste des messages (.msgsZone) est une
  // zone qui défile (overflow-y: auto) — si le message cliqué est tout en
  // haut de cette zone visible, le menu qui s'ouvre vers le haut sort de la
  // zone de défilement et se retrouve donc invisible (coupé), même s'il
  // reste de la place plus haut dans la fenêtre du navigateur.
  // Ce booléen dit si, pour CE message précis, il faut plutôt ouvrir le
  // menu VERS LE BAS pour que toutes les options restent visibles.
  const [deleteMenuDown, setDeleteMenuDown] = useState(false);

  // Référence vers le bouton "poubelle" : sert à mesurer sa position à
  // l'écran au moment du clic, pour décider dans quel sens ouvrir le menu.
  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  const isMe     = msg.from === 'me';
  const prev     = msgs[idx - 1];
  const isSame   = prev?.from === msg.from;
  const isFirst  = !isSame;
  const roleConfig = getRoleConfig(t);
  const rc       = roleConfig[user.role] ?? roleConfig['client'];
  const isImgAva = user.ava?.startsWith('http');

  const rowCls = [s.msgRow, isMe ? s.mine : '', isFirst ? s.firstGroup : '', isSame ? s.noAva : '']
    .filter(Boolean).join(' ');

  // ── Placeholder message supprimé ──────────────────────────────
  if (msg.deleted) {
    return (
      <div className={rowCls}>
        {!isMe && <div className={s.msgAva}>{isFirst && <div style={{ width: 30, height: 30 }} />}</div>}
        <div className={s.msgGroup}>
          <div className={s.msgDeleted}>
            <i className="fas fa-ban" />
            <span>{t('messagerie.messageBubble.messageSupprime')}</span>
          </div>
        </div>
        {isMe && <div className={s.msgAva} />}
      </div>
    );
  }

  return (
    <div className={rowCls}>

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

        <div className={s.bubbleWrap}>

          {/* ── Contenu selon le type ── */}

          {msg.type === 'text' && (
            <div className={`${s.bubble} ${isMe ? s.sent : s.recv}`}>{msg.text}</div>
          )}

          {msg.type === 'product' && msg.product && (
            <>
              <div className={`${s.bubble} ${isMe ? s.sent : s.recv}`}>{msg.text}</div>
              <div className={s.msgProduct} onClick={() => onToast(t('messagerie.messageBubble.voirProduit'), 'i')}>
                <div className={s.mpImg}>{msg.product.em}</div>
                <div className={s.mpBody}>
                  <div className={s.mpNm}>{msg.product.nm}</div>
                  <div className={s.mpPrice}>{msg.product.price}</div>
                  <button className={s.mpBtn} onClick={e => { e.stopPropagation(); onToast(t('messagerie.messageBubble.ajouteAuPanierToast'), 's'); }}>
                    {t('messagerie.messageBubble.ajouterAuPanier')}
                  </button>
                </div>
              </div>
            </>
          )}

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
                  <button className={s.moTrack} onClick={() => onToast(t('messagerie.messageBubble.suiviCommandeToast'), 'i')}>
                    <i className="fas fa-map-location-dot" /> {t('messagerie.messageBubble.suivreCommande')}
                  </button>
                </div>
              </div>
            </>
          )}

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

          {msg.type === 'file' && (
            <>
              <a href={msg.mediaUrl ?? '#'} target="_blank" rel="noreferrer" download={msg.mediaName}
                className={s.msgFile} onClick={e => { if (!msg.mediaUrl) e.preventDefault(); }}>
                <div className={s.mfIcon}><i className="fas fa-file-pdf" /></div>
                <div className={s.mfBody}>
                  <div className={s.mfName}>{msg.mediaName ?? t('messagerie.messageBubble.document')}</div>
                  <div className={s.mfMeta}>{t('messagerie.messageBubble.pdfCliquerPourOuvrir')}</div>
                </div>
                <i className="fas fa-arrow-up-right-from-square" style={{ color: 'var(--t3)', fontSize: 13 }} />
              </a>
              {msg.text && <div className={`${s.bubble} ${isMe ? s.sent : s.recv} ${s.mediaCaption}`}>{msg.text}</div>}
            </>
          )}

          {msg.type === 'voice' && (
            <VoicePlayer url={msg.mediaUrl} duration={msg.duration} isMe={isMe} />
          )}

          {msg.type === 'call' && (
            <CallBubble meta={msg.callMeta} isMe={isMe} />
          )}

          {/* ── Actions au survol — communes à tous les types ── */}
          <div className={s.bubbleActions}>
            <button className={s.baBtn} title={t('messagerie.messageBubble.repondre')}
              onClick={() => onReply({ sender: isMe ? t('messagerie.messageBubble.vous') : user.name, text: msg.text ?? '' })}>
              <i className="fas fa-reply" />
            </button>
            {msg.type === 'text' && (
              <button className={s.baBtn} title={t('messagerie.messageBubble.copier')}
                onClick={() => { navigator.clipboard.writeText(msg.text ?? ''); onToast(t('messagerie.messageBubble.copieToast'), 's'); }}>
                <i className="fas fa-copy" />
              </button>
            )}

            {/* Suppression avec choix */}
            <div className={s.deleteWrap}>
              <button
                ref={deleteBtnRef}
                className={s.baBtn}
                style={{ color: showDeleteMenu ? 'var(--red, #DC2626)' : undefined }}
                title={t('messagerie.messageBubble.supprimer')}
                onClick={e => {
                  e.stopPropagation();

                  // On ne calcule le sens d'ouverture qu'au moment où on
                  // OUVRE le menu (pas quand on le ferme) : ça évite un
                  // calcul inutile et un éventuel "flash" visuel.
                  if (!showDeleteMenu) {
                    const btn = deleteBtnRef.current;

                    // .msgsZone est la zone qui défile (overflow-y: auto)
                    // contenant tous les messages. C'est SA limite haute,
                    // pas celle de la fenêtre du navigateur, qui coupe le
                    // menu s'il s'ouvre vers le haut. `closest()` remonte
                    // le DOM depuis le bouton jusqu'à trouver cette zone.
                    const scrollZone = btn?.closest(`.${s.msgsZone}`);

                    // Nombre d'options dans le menu : 3 si c'est mon propre
                    // message (pour moi / pour lui / pour tout le monde),
                    // sinon 1 seule option (pour moi uniquement).
                    const itemCount = isMe ? 3 : 1;
                    // Hauteur approximative du menu : ~40px par option,
                    // + un peu de marge pour les bordures et l'ombre.
                    const estimatedMenuHeight = itemCount * 40 + 10;

                    if (btn && scrollZone) {
                      const btnRect  = btn.getBoundingClientRect();
                      const zoneRect = scrollZone.getBoundingClientRect();
                      // Espace réellement disponible AU-DESSUS du bouton,
                      // à l'intérieur de la zone visible qui défile —
                      // et non par rapport au haut de l'écran.
                      const espaceDisponibleAuDessus = btnRect.top - zoneRect.top;

                      setDeleteMenuDown(espaceDisponibleAuDessus < estimatedMenuHeight + 12);
                    } else {
                      // Filet de sécurité si .msgsZone est introuvable
                      // (ne devrait pas arriver) : on retombe sur la
                      // position par rapport à la fenêtre du navigateur.
                      const rect = btn?.getBoundingClientRect();
                      setDeleteMenuDown(!!rect && rect.top < estimatedMenuHeight + 12);
                    }
                  }
                  setShowDeleteMenu(p => !p);
                }}
              >
                <i className="fas fa-trash-can" />
              </button>

              {showDeleteMenu && (
                <>
                  {/* Fond invisible pour fermer au clic extérieur */}
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                    onClick={() => setShowDeleteMenu(false)}
                  />
                  {/* On ajoute la classe s.deleteMenuDown seulement si le calcul
                      ci-dessus a détecté qu'il n'y avait pas assez de place
                      au-dessus : cette classe (définie dans ChatWindow.module.css)
                      inverse le positionnement CSS pour ouvrir vers le bas. */}
                  <div className={`${s.deleteMenu}${deleteMenuDown ? ` ${s.deleteMenuDown}` : ''}`}>
                    {/* Option 1 — toujours disponible, pour tout le monde */}
                    <button
                      className={s.deleteMenuItem}
                      onClick={() => { onDelete(msg.id, 'me'); setShowDeleteMenu(false); }}
                    >
                      <i className="fas fa-eye-slash" />
                      <span>{t('messagerie.messageBubble.supprimerPourMoi')}</span>
                    </button>

                    {/* Options 2 & 3 — visibles uniquement si c'est MOI qui ai
                        envoyé ce message (on ne peut pas supprimer "pour tout
                        le monde" un message reçu d'un autre utilisateur) */}
                    {isMe && (
                      <>
                        <button
                          className={s.deleteMenuItem}
                          onClick={() => { onDelete(msg.id, 'other'); setShowDeleteMenu(false); }}
                        >
                          <i className="fas fa-user-xmark" />
                          <span>{t('messagerie.messageBubble.supprimerPourLui')}</span>
                        </button>
                        <button
                          className={`${s.deleteMenuItem} ${s.deleteMenuDanger}`}
                          onClick={() => { onDelete(msg.id, 'everyone'); setShowDeleteMenu(false); }}
                        >
                          <i className="fas fa-users-slash" />
                          <span>{t('messagerie.messageBubble.supprimerPourTous')}</span>
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Statut envoi 3 états : ✓ envoyé / ✓✓ livré / ✓✓ vu ── */}
        {isMe && (
          <div className={s.msgStatus}>
            {isLastRead && (
              <div className={s.readAvatar} title={t('messagerie.messageBubble.vuPar', { name: user.name })}>
                {isImgAva ? <img src={user.ava} alt={user.name} /> : user.ava}
              </div>
            )}
            {msg.read ? (
              <span className={s.tickRead} title={t('messagerie.messageBubble.vu')}><i className="fas fa-check-double" /></span>
            ) : msg.delivered ? (
              <span className={s.tickDelivered} title={t('messagerie.messageBubble.livre')}><i className="fas fa-check-double" /></span>
            ) : (
              <span className={s.tickSent} title={t('messagerie.messageBubble.envoye')}><i className="fas fa-check" /></span>
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
  const { t } = useTranslation();
  if (!meta) {
    return (
      <div className={`${s.callBubble} ${isMe ? s.callBubbleMe : ''}`}>
        <span className={s.callIcon}><i className="fas fa-phone" /></span>
        <span className={s.callLabel}>{t('messagerie.messageBubble.appelAudioFallback')}</span>
      </div>
    );
  }

  const isVideoCall = meta.callType === 'video';

  const cfg: Record<string, { icon: string; iconColor: string; textRed?: boolean }> = {
    completed: { icon: isVideoCall ? 'fa-video'        : 'fa-phone',        iconColor: 'var(--emerald,#059669)'             },
    missed:    { icon: isVideoCall ? 'fa-video-slash'  : 'fa-phone-missed', iconColor: 'var(--rose,#DC2626)', textRed: true },
    rejected:  { icon: isVideoCall ? 'fa-video-slash'  : 'fa-phone-slash',  iconColor: 'var(--rose,#DC2626)', textRed: true },
    cancelled: { icon: isVideoCall ? 'fa-video-slash'  : 'fa-phone-slash',  iconColor: 'var(--t3,#94A3B8)'                 },
    busy:      { icon: isVideoCall ? 'fa-video'        : 'fa-phone-volume', iconColor: 'var(--amber,#B45309)'              },
  };

  const typeLabel = isVideoCall ? t('messagerie.messageBubble.typeVideo') : t('messagerie.messageBubble.typeAudio');
  const labelMap: Record<string, string> = {
    completed: t('messagerie.messageBubble.appelType', { type: typeLabel }),
    missed:    t('messagerie.messageBubble.appelManque'),
    rejected:  t('messagerie.messageBubble.appelRefuse'),
    cancelled: t('messagerie.messageBubble.appelAnnule'),
    busy:      t('messagerie.messageBubble.correspondantOccupe'),
  };
  const label = labelMap[meta.status] ?? t('messagerie.messageBubble.appelType', { type: typeLabel });
  const { icon, iconColor, textRed } = cfg[meta.status] ?? cfg['completed'];

  const dur = meta.duration
    ? ` · ${Math.floor(meta.duration / 60)}:${String(meta.duration % 60).padStart(2, '0')}`
    : '';

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
