/**
 * src/shared/messagerie/components/ChatHeader.tsx
 * En-tête de la fenêtre de chat : avatar, nom, rôle, statut en ligne,
 * et boutons d'action (appel, vidéo, recherche, info, options).
 */
import type { ChatUser } from '../data/messagerieTypes';
import { ROLE_CONFIG }   from '../data/messagerieTypes';
import s from '../styles/ChatWindow.module.css';

interface Props {
  user:           ChatUser;
  infoPanelOpen:  boolean;
  onToggleInfo:   () => void;
  onToast:        (msg: string, type?: string) => void;
  onCall?:        () => void;       // appel audio
  onVideoCall?:   () => void;       // appel vidéo
}

export default function ChatHeader({ user, infoPanelOpen, onToggleInfo, onToast, onCall, onVideoCall }: Props) {
  const rc       = ROLE_CONFIG[user.role] ?? ROLE_CONFIG['client'];
  const isImgAva = user.ava?.startsWith('http');

  return (
    <div className={s.header}>
      {/* Avatar + indicateur en ligne */}
      <div className={s.hdAvaWrap}>
        <div className={s.hdAva} style={{
          background: isImgAva ? undefined : user.avaColor,
          padding:    isImgAva ? 0 : undefined,
          overflow:   'hidden',
        }}>
          {isImgAva
            ? <img src={user.ava} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }} />
            : user.ava
          }
        </div>
        {user.online && <div className={s.hdOnline} />}
      </div>

      {/* Nom + rôle + sous-titre + statut */}
      <div className={s.hdInfo}>
        <div className={s.hdName}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.name}
          </span>
          <span className={s.hdRolePill} style={{ background: rc.bg, color: rc.color, flexShrink: 0 }}>
            {rc.icon} {rc.label}
          </span>
        </div>
        {user.context && <div className={s.hdCtxLine}>{user.context}</div>}
        <div className={`${s.hdSub} ${user.online ? s.online : ''}`}>
          <i className="fas fa-circle" style={{ fontSize: 6 }} />
          {user.online ? 'En ligne maintenant' : 'Hors ligne'}
        </div>
      </div>

      {/* Boutons d'action */}
      <div className={s.hdActs}>
        <button
          className={s.hdBtn}
          onClick={onCall ?? (() => onToast('📞 Appel audio', 'i'))}
          title="Appel audio"
        >
          <i className="fas fa-phone" />
        </button>
        <button
          className={s.hdBtn}
          onClick={onVideoCall ?? (() => onToast('📹 Appel vidéo', 'i'))}
          title="Appel vidéo"
        >
          <i className="fas fa-video" />
        </button>
        <button className={s.hdBtn} onClick={() => onToast('🔍 Recherche dans la conversation', 'i')} title="Rechercher">
          <i className="fas fa-magnifying-glass" />
        </button>
        <button className={`${s.hdBtn} ${infoPanelOpen ? s.active : ''}`} onClick={onToggleInfo} title="Informations">
          <i className="fas fa-circle-info" />
        </button>
        <button className={s.hdBtn} onClick={() => onToast('⚙️ Options', 'i')} title="Plus">
          <i className="fas fa-ellipsis-vertical" />
        </button>
      </div>
    </div>
  );
}
