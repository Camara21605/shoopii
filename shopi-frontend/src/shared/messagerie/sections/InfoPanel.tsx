/*
 * FICHIER : src/shared/messagerie/sections/InfoPanel.tsx
 * Panneau droit : profil du contact ou détail d'un groupe de livraison.
 *
 * Vue groupe :
 *   - Liste des membres avec initiales colorées + rôle
 *   - Clic sur un membre → vue détail de cet acteur
 *   - Bouton "← Retour" pour revenir à la liste
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Conversation, ChatUser, GroupMember } from '../data/messagerieTypes';
import { getRoleConfig } from '../data/messagerieTypes';
import { cldAvatar } from '../utils/chatUtils';
import s from '../styles/InfoPanel.module.css';

// ── Route profil selon le type d'acteur ──────────────────────

function getProfileUrl(member: GroupMember): string | null {
  switch (member.actorType) {
    case 'delivery':      return `/livreurs/${member.actorId}`;
    case 'correspondent': return `/correspondants/${member.actorId}`;
    case 'company':       return `/boutique/${member.actorId}`;
    default:              return null;
  }
}

// ── Config rôle par type d'acteur de groupe ────────────────────

function getActorConfig(t: TFunction): Record<string, { label: string; icon: string; color: string; bg: string }> {
  return {
    client:        { label: t('messagerie.actorConfig.client'),        icon: '🛍️', color: '#1A4FC4', bg: 'rgba(26,79,196,.1)'   },
    company:       { label: t('messagerie.actorConfig.company'),       icon: '🏪', color: '#047857', bg: 'rgba(4,120,87,.1)'    },
    delivery:      { label: t('messagerie.actorConfig.delivery'),      icon: '🛵', color: '#0E7490', bg: 'rgba(14,116,144,.1)'  },
    correspondent: { label: t('messagerie.actorConfig.correspondent'), icon: '📍', color: '#B45309', bg: 'rgba(180,83,9,.1)'    },
  };
}

const ACTOR_COLORS: Record<string, string> = {
  client:        'rgba(26,79,196,.8)',
  company:       'rgba(4,120,87,.8)',
  delivery:      'rgba(14,116,144,.8)',
  correspondent: 'rgba(180,83,9,.8)',
};

function getGroupStatusLabel(t: TFunction): Record<string, string> {
  return {
    active:    t('messagerie.messagesZone.groupStatus.active'),
    completed: t('messagerie.messagesZone.groupStatus.completed'),
    expired:   t('messagerie.messagesZone.groupStatus.expired'),
    cancelled: t('messagerie.messagesZone.groupStatus.cancelled'),
  };
}

// ── Props ──────────────────────────────────────────────────────

interface Props {
  conv:     Conversation | null;
  user:     ChatUser | null;
  members?: GroupMember[];
  onClose:  () => void;
  onToast:  (msg: string, type?: string) => void;
}

// ── Composant ─────────────────────────────────────────────────

export default function InfoPanel({ conv, user, members, onClose, onToast }: Props) {
  if (!conv || !user) return null;

  const isGroup = !!conv.isGroup;

  return isGroup
    ? <GroupInfoPanel conv={conv} user={user} members={members ?? []} onClose={onClose} />
    : <ContactInfoPanel conv={conv} user={user} onClose={onClose} onToast={onToast} />;
}

// ── Vue contact direct ─────────────────────────────────────────

function ContactInfoPanel({
  conv, user, onClose, onToast,
}: {
  conv: Conversation; user: ChatUser;
  onClose: () => void; onToast: (msg: string, type?: string) => void;
}) {
  const { t } = useTranslation();
  const roleConfig = getRoleConfig(t);
  const rc       = roleConfig[user.role] ?? roleConfig['client'];
  const isImgAva = user.ava?.startsWith('http');

  return (
    <div className={s.panel}>
      <div className={s.hd}>
        <div className={s.hdTitle}>{t('messagerie.infoPanel.informations')}</div>
        <button className={s.hdClose} onClick={onClose}><i className="fas fa-xmark" /></button>
      </div>

      <div className={s.profile}>
        <div className={s.ava} style={{ background: isImgAva ? undefined : user.avaColor, padding: 0, overflow: 'hidden' }}>
          {isImgAva
            ? <img src={cldAvatar(user.ava, 160)!} alt={user.name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit', display:'block' }} />
            : user.ava}
        </div>
        <div className={s.name}>{user.name}</div>
        <div className={s.roleTag} style={{ background: rc.bg, color: rc.color }}>{rc.icon} {rc.label}</div>
        {user.context && <div style={{ fontSize:11, color:'var(--t3)', marginTop:2, textAlign:'center' }}>{user.context}</div>}
        <div className={s.stat}>{user.online ? t('messagerie.infoPanel.enLigneMaintenant') : t('messagerie.infoPanel.horsLigne')}</div>
        <div className={s.actions}>
          <button className={s.btn} onClick={() => onToast(t('messagerie.infoPanel.appelToast'), 'i')}><i className="fas fa-phone" /> {t('messagerie.infoPanel.appel')}</button>
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => onToast(t('messagerie.infoPanel.messageToast'), 's')}><i className="fas fa-paper-plane" /> {t('messagerie.infoPanel.message')}</button>
        </div>
      </div>

      <div className={s.section}>
        <div className={s.sectTitle}>{t('messagerie.infoPanel.informations')}</div>
        <div className={s.row}><div className={s.rowIco}><i className="fas fa-tag" /></div><div><div className={s.rowLbl}>{t('messagerie.infoPanel.role')}</div><div className={s.rowVal}>{rc.label}</div></div></div>
        {user.context && <div className={s.row}><div className={s.rowIco}><i className="fas fa-location-dot" /></div><div><div className={s.rowLbl}>{t('messagerie.infoPanel.localisation')}</div><div className={s.rowVal}>{user.context}</div></div></div>}
        <div className={s.row}><div className={s.rowIco}><i className="fas fa-clock" /></div><div><div className={s.rowLbl}>{t('messagerie.infoPanel.membreDepuis')}</div><div className={s.rowVal}>{t('messagerie.infoPanel.dateMockMembre')}</div></div></div>
        <div className={s.row}><div className={s.rowIco}><i className="fas fa-comment-dots" /></div><div><div className={s.rowLbl}>{t('messagerie.infoPanel.messagesEchanges')}</div><div className={s.rowVal}>{t('messagerie.infoPanel.messagesCount', { count: conv.messages.length })}</div></div></div>
      </div>

      <div className={s.section}>
        <div className={s.sectTitle}>{t('messagerie.infoPanel.mediasPartages')}</div>
        <div className={s.mediaGrid}>
          {['📱','💻','🎧','📷','📦','📄'].map(em => (
            <div key={em} className={s.mediaItem} onClick={() => onToast(t('messagerie.infoPanel.voirMediaToast'), 'i')}>{em}</div>
          ))}
        </div>
        <button className={s.mediaAllBtn} onClick={() => onToast(t('messagerie.infoPanel.tousLesMediasToast'), 'i')}>{t('messagerie.infoPanel.voirTout')}</button>
      </div>

      <div className={s.section}>
        <div className={s.sectTitle}>{t('messagerie.infoPanel.options')}</div>
        <div className={s.optionsWrap}>
          {([
            ['fa-thumbtack', t('messagerie.infoPanel.epinglerConversation'), 'i', false],
            ['fa-bell-slash', t('messagerie.infoPanel.couperNotifications'), 'i', false],
            ['fa-trash-can', t('messagerie.infoPanel.supprimerConversation'), 'w', false],
            ['fa-ban', t('messagerie.infoPanel.bloquerContact'), 'e', true],
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

// ── Vue groupe : liste membres + détail acteur ─────────────────

function GroupInfoPanel({
  conv, user, members, onClose,
}: {
  conv: Conversation; user: ChatUser;
  members: GroupMember[]; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);

  return (
    <div className={s.panel}>
      <div className={s.hd}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {selectedMember && (
            <button
              className={s.hdClose}
              onClick={() => setSelectedMember(null)}
              title={t('messagerie.chatHeader.retour')}
              style={{ marginRight:0, fontSize:13 }}
            >
              <i className="fas fa-arrow-left" />
            </button>
          )}
          <div className={s.hdTitle}>
            {selectedMember ? t('messagerie.chatHeader.profilMembre') : t('messagerie.convList.groupeDeLivraison')}
          </div>
        </div>
        <button className={s.hdClose} onClick={onClose}><i className="fas fa-xmark" /></button>
      </div>

      {selectedMember
        ? <MemberDetail member={selectedMember} conv={conv} onBack={() => setSelectedMember(null)} />
        : <MemberList conv={conv} user={user} members={members} onSelect={setSelectedMember} />
      }
    </div>
  );
}

// ── Sous-vue : liste des membres ──────────────────────────────

function MemberList({
  conv, user, members, onSelect,
}: {
  conv: Conversation; user: ChatUser;
  members: GroupMember[]; onSelect: (m: GroupMember) => void;
}) {
  const { t } = useTranslation();
  const statusLabel = getGroupStatusLabel(t)[conv.groupStatus ?? 'active'] ?? getGroupStatusLabel(t).active;

  return (
    <>
      {/* En-tête groupe */}
      <div className={s.profile}>
        <div className={s.ava} style={{ background: 'rgba(14,116,144,.12)', fontSize: 28 }}>
          📦
        </div>
        <div className={s.name}>{user.name}</div>
        <div className={s.roleTag} style={{ background: 'rgba(14,116,144,.1)', color: '#0E7490' }}>
          📦 {t('messagerie.infoPanel.livraison')}
        </div>
        <div style={{ fontSize:11, color:'var(--t3)', marginTop:4, textAlign:'center' }}>
          {statusLabel}
          {conv.expiresAt && conv.groupStatus === 'completed' && (
            <span> {t('messagerie.infoPanel.expireLe', { date: new Date(conv.expiresAt).toLocaleDateString('fr-FR') })}</span>
          )}
        </div>
      </div>

      {/* Liste des membres */}
      <div className={s.section}>
        <div className={s.sectTitle}>{t('messagerie.chatHeader.membre', { count: members.length })}</div>
        {members.length === 0 ? (
          <div style={{ color:'var(--t4)', fontSize:12, padding:'8px 0' }}>
            {t('messagerie.infoPanel.chargementMembres')}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {members.map(m => {
              const actorConfig = getActorConfig(t);
              const ac = actorConfig[m.actorType] ?? actorConfig['client'];
              return (
                <button
                  key={m.id}
                  onClick={() => onSelect(m)}
                  style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'9px 8px', borderRadius:'var(--r-md)',
                    background:'transparent', border:'none',
                    cursor:'pointer', textAlign:'left', width:'100%',
                    transition:'background .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--g50)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Initiale colorée */}
                  <div style={{
                    width:36, height:36, borderRadius:10, flexShrink:0,
                    background: ACTOR_COLORS[m.actorType] ?? '#6B7280',
                    color:'#fff', fontSize:14, fontWeight:800,
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    {m.displayName.charAt(0).toUpperCase()}
                  </div>

                  {/* Nom + rôle */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{
                      fontSize:13, fontWeight:700, color:'var(--navy)',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    }}>
                      {m.displayName}
                    </div>
                    <div style={{
                      display:'inline-flex', alignItems:'center', gap:4, marginTop:2,
                      fontSize:10.5, fontWeight:700,
                      color: ac.color, background: ac.bg,
                      padding:'2px 8px', borderRadius:99,
                    }}>
                      {ac.icon} {ac.label}
                    </div>
                  </div>

                  <i className="fas fa-chevron-right" style={{ color:'var(--t4)', fontSize:11, flexShrink:0 }} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Infos générales du groupe */}
      <div className={s.section}>
        <div className={s.sectTitle}>{t('messagerie.infoPanel.informations')}</div>
        {conv.commandeNumero && (
          <div className={s.row}>
            <div className={s.rowIco}><i className="fas fa-box" /></div>
            <div><div className={s.rowLbl}>{t('messagerie.infoPanel.commande')}</div><div className={s.rowVal}>{conv.commandeNumero}</div></div>
          </div>
        )}
        <div className={s.row}>
          <div className={s.rowIco}><i className="fas fa-users" /></div>
          <div><div className={s.rowLbl}>{t('messagerie.infoPanel.membres')}</div><div className={s.rowVal}>{t('messagerie.infoPanel.acteurs', { count: members.length })}</div></div>
        </div>
        <div className={s.row}>
          <div className={s.rowIco}><i className="fas fa-comment-dots" /></div>
          <div><div className={s.rowLbl}>{t('messagerie.infoPanel.messages')}</div><div className={s.rowVal}>{conv.messages.length}</div></div>
        </div>
      </div>
    </>
  );
}

// ── Sous-vue : détail d'un membre ─────────────────────────────

function MemberDetail({
  member, conv, onBack,
}: {
  member: GroupMember; conv: Conversation; onBack: () => void;
}) {
  const { t } = useTranslation();
  const navigate    = useNavigate();
  const actorConfig = getActorConfig(t);
  const ac          = actorConfig[member.actorType] ?? actorConfig['client'];
  const profileUrl  = getProfileUrl(member);
  const joinDate    = new Date(member.joinedAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  function handleViewProfile() {
    if (!profileUrl) return;
    navigate(profileUrl);
  }

  return (
    <>
      {/* Profil de l'acteur */}
      <div className={s.profile}>
        <div className={s.ava} style={{
          background: ACTOR_COLORS[member.actorType] ?? '#6B7280',
          color: '#fff', fontSize: 28, fontWeight: 800,
        }}>
          {member.displayName.charAt(0).toUpperCase()}
        </div>
        <div className={s.name}>{member.displayName}</div>
        <div className={s.roleTag} style={{ background: ac.bg, color: ac.color }}>
          {ac.icon} {ac.label}
        </div>
        <div className={s.stat}>
          {t('messagerie.infoPanel.groupePrefix', { numero: conv.commandeNumero ?? '' })}
        </div>

        {/* Bouton voir profil */}
        <div className={s.actions} style={{ marginTop: 4 }}>
          {profileUrl ? (
            <button
              className={`${s.btn} ${s.btnPrimary}`}
              onClick={handleViewProfile}
            >
              <i className="fas fa-user" /> {t('messagerie.chatHeader.voirProfil')}
            </button>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--t4)', padding: '4px 0' }}>
              {t('messagerie.chatHeader.profilNonDisponible')}
            </div>
          )}
        </div>
      </div>

      {/* Infos de l'acteur */}
      <div className={s.section}>
        <div className={s.sectTitle}>{t('messagerie.infoPanel.informations')}</div>
        <div className={s.row}>
          <div className={s.rowIco}><i className="fas fa-tag" /></div>
          <div><div className={s.rowLbl}>{t('messagerie.infoPanel.role')}</div><div className={s.rowVal}>{ac.label}</div></div>
        </div>
        <div className={s.row}>
          <div className={s.rowIco}><i className="fas fa-calendar-plus" /></div>
          <div><div className={s.rowLbl}>{t('messagerie.infoPanel.aRejointLe')}</div><div className={s.rowVal}>{joinDate}</div></div>
        </div>
        {conv.commandeNumero && (
          <div className={s.row}>
            <div className={s.rowIco}><i className="fas fa-box" /></div>
            <div><div className={s.rowLbl}>{t('messagerie.infoPanel.commande')}</div><div className={s.rowVal}>{conv.commandeNumero}</div></div>
          </div>
        )}
      </div>
    </>
  );
}
