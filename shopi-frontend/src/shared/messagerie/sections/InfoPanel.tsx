/*
 * FICHIER : src/shared/messagerie/sections/InfoPanel.tsx
 * Panneau droit : profil du contact, infos, médias partagés, options.
 */
import type { Conversation, ChatUser } from '../data/messagerieTypes';
import { ROLE_CONFIG } from '../data/messagerieTypes';
import s from '../styles/InfoPanel.module.css';

interface Props {
  conv:    Conversation | null;
  user:    ChatUser | null;
  onClose: () => void;
  onToast: (msg: string, type?: string) => void;
}

export default function InfoPanel({ conv, user, onClose, onToast }: Props) {
  if (!conv || !user) return null;
  const rc       = ROLE_CONFIG[user.role] ?? ROLE_CONFIG['client'];
  const isImgAva = user.ava?.startsWith('http');

  return (
    <div className={s.panel}>
      <div className={s.hd}>
        <div className={s.hdTitle}>Informations</div>
        <button className={s.hdClose} onClick={onClose}><i className="fas fa-xmark" /></button>
      </div>

      {/* Profil */}
      <div className={s.profile}>
        <div className={s.ava} style={{ background: isImgAva ? undefined : user.avaColor, padding: 0, overflow: 'hidden' }}>
          {isImgAva
            ? <img src={user.ava} alt={user.name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit', display:'block' }} />
            : user.ava
          }
        </div>
        <div className={s.name}>{user.name}</div>
        <div className={s.roleTag} style={{ background: rc.bg, color: rc.color }}>{rc.icon} {rc.label}</div>
        {user.context && <div style={{ fontSize:11, color:'var(--t3)', marginTop:2, textAlign:'center' }}>{user.context}</div>}
        <div className={s.stat}>{user.online ? '🟢 En ligne maintenant' : '⚫ Hors ligne'}</div>
        <div className={s.actions}>
          <button className={s.btn} onClick={() => onToast('📞 Appel audio', 'i')}><i className="fas fa-phone" /> Appel</button>
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => onToast('💬 Message', 's')}><i className="fas fa-paper-plane" /> Message</button>
        </div>
      </div>

      {/* Infos */}
      <div className={s.section}>
        <div className={s.sectTitle}>Informations</div>
        <div className={s.row}><div className={s.rowIco}><i className="fas fa-tag" /></div><div><div className={s.rowLbl}>Rôle</div><div className={s.rowVal}>{rc.label}</div></div></div>
        {user.context && <div className={s.row}><div className={s.rowIco}><i className="fas fa-location-dot" /></div><div><div className={s.rowLbl}>Localisation</div><div className={s.rowVal}>{user.context}</div></div></div>}
        <div className={s.row}><div className={s.rowIco}><i className="fas fa-clock" /></div><div><div className={s.rowLbl}>Membre depuis</div><div className={s.rowVal}>Mars 2024</div></div></div>
        <div className={s.row}><div className={s.rowIco}><i className="fas fa-comment-dots" /></div><div><div className={s.rowLbl}>Messages échangés</div><div className={s.rowVal}>{conv.messages.length} messages</div></div></div>
      </div>

      {/* Médias */}
      <div className={s.section}>
        <div className={s.sectTitle}>Médias partagés</div>
        <div className={s.mediaGrid}>
          {['📱','💻','🎧','📷','📦','📄'].map(em => (
            <div key={em} className={s.mediaItem} onClick={() => onToast('🖼️ Voir le média', 'i')}>{em}</div>
          ))}
        </div>
        <button className={s.mediaAllBtn} onClick={() => onToast('📁 Tous les médias', 'i')}>Voir tout</button>
      </div>

      {/* Options */}
      <div className={s.section}>
        <div className={s.sectTitle}>Options</div>
        <div className={s.optionsWrap}>
          {([
            ['fa-thumbtack', 'Épingler la conversation', 'i', false],
            ['fa-bell-slash', 'Couper les notifications', 'i', false],
            ['fa-trash-can', 'Supprimer la conversation', 'w', false],
            ['fa-ban', 'Bloquer le contact', 'e', true],
          ] as [string, string, string, boolean][]).map(([icon, label, type, danger]) => (
            <button key={label} className={`${s.optionBtn} ${danger ? s.danger : ''}`}
              onClick={() => onToast(label, type)}>
              <i className={`fas ${icon}`} />{label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}