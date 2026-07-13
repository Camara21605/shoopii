/**
 * src/shared/messagerie/components/ChatHeader.tsx
 * En-tête de la fenêtre de chat : avatar, nom, rôle, statut en ligne,
 * et boutons d'action (appel, vidéo, recherche, info, options).
 *
 * Pour les groupes de livraison : les avatars empilés sont cliquables
 * et ouvrent un popup contextuel listant les membres du groupe.
 * Cliquer sur un membre dans le popup affiche son profil détaillé.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate }                  from 'react-router-dom';
import type { ChatUser, GroupMember }  from '../data/messagerieTypes';
import { ROLE_CONFIG }                  from '../data/messagerieTypes';
import s from '../styles/ChatWindow.module.css';

// ── Route profil selon le type d'acteur ──────────────────────

function getProfileUrl(member: GroupMember): string | null {
  switch (member.actorType) {
    case 'delivery':      return `/livreurs/${member.actorId}`;
    case 'correspondent': return `/correspondants/${member.actorId}`;
    case 'company':       return `/boutique/${member.actorId}`;
    default:              return null; // pas de page publique pour les clients
  }
}

// ── Config visuelle par type d'acteur ─────────────────────────

const ACTOR_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; initBg: string }> = {
  client:        { label: 'Client',        icon: '🛍️', color: '#1A4FC4', bg: 'rgba(26,79,196,.1)',   initBg: 'rgba(26,79,196,.82)'   },
  company:       { label: 'Entreprise',    icon: '🏪', color: '#047857', bg: 'rgba(4,120,87,.1)',    initBg: 'rgba(4,120,87,.82)'    },
  delivery:      { label: 'Livreur',       icon: '🛵', color: '#0E7490', bg: 'rgba(14,116,144,.1)',  initBg: 'rgba(14,116,144,.82)'  },
  correspondent: { label: 'Correspondant', icon: '📍', color: '#B45309', bg: 'rgba(180,83,9,.1)',    initBg: 'rgba(180,83,9,.82)'    },
};

// ── Props ──────────────────────────────────────────────────────

interface Props {
  user:           ChatUser;
  members?:       GroupMember[];
  infoPanelOpen:  boolean;
  onToggleInfo:   () => void;
  onToast:        (msg: string, type?: string) => void;
  onCall?:        () => void;
  onVideoCall?:   () => void;
  onMobileMenu?:  () => void;
}

// ── Composant ─────────────────────────────────────────────────

export default function ChatHeader({
  user, members, infoPanelOpen, onToggleInfo, onToast, onCall, onVideoCall, onMobileMenu,
}: Props) {
  const rc       = ROLE_CONFIG[user.role] ?? ROLE_CONFIG['client'];
  const isImgAva = user.ava?.startsWith('http');
  const isGroupe = user.role === 'groupe';

  /* Avatars empilés — on affiche max 2 + badge "+N" */
  const showGroupAva   = isGroupe && !!members && members.length > 0;
  const visibleMembers = showGroupAva ? members!.slice(0, 2) : [];
  const extraCount     = showGroupAva ? Math.max(0, members!.length - 2) : 0;

  /* État du popup membres */
  const [popupOpen,   setPopupOpen]   = useState(false);
  const [detailMember, setDetailMember] = useState<GroupMember | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  /* Fermer le popup au clic extérieur */
  useEffect(() => {
    if (!popupOpen) return;
    const handle = (e: MouseEvent) => {
      if (!popupRef.current?.contains(e.target as Node)) {
        setPopupOpen(false);
        setDetailMember(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [popupOpen]);

  /* Fermer sur Escape */
  useEffect(() => {
    if (!popupOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPopupOpen(false); setDetailMember(null); }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [popupOpen]);

  function togglePopup() {
    if (!showGroupAva) return;
    setPopupOpen(p => !p);
    setDetailMember(null);
  }

  return (
    <div className={s.header}>
      {/* Bouton retour liste — mobile uniquement */}
      {onMobileMenu && (
        <button className={s.hdMobileBtn} onClick={onMobileMenu} title="Conversations">
          <i className="fas fa-bars" />
        </button>
      )}

      {/* ── Avatar + popup membres (groupes) ── */}
      <div className={s.hdAvaWrap} ref={popupRef} style={{ position: 'relative' }}>
        <div
          className={s.hdAva}
          style={{
            background: isImgAva ? undefined : (showGroupAva ? 'transparent' : user.avaColor),
            padding:    isImgAva ? 0 : undefined,
            overflow:   'hidden',
            cursor:     showGroupAva ? 'pointer' : 'default',
          }}
          onClick={togglePopup}
          title={showGroupAva ? 'Voir les membres du groupe' : undefined}
        >
          {showGroupAva ? (
            /* Initiales empilées des membres */
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {visibleMembers.map((m, i) => {
                const ac = ACTOR_CONFIG[m.actorType];
                return (
                  <div key={m.id} style={{
                    width: 21, height: 21, borderRadius: 6,
                    background: ac?.initBg ?? '#6B7280',
                    color: '#fff', fontSize: 9, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1.5px solid var(--white)',
                    marginLeft: i > 0 ? -7 : 0,
                    position: 'relative', zIndex: 2 - i,
                    flexShrink: 0,
                  }}>
                    {m.displayName.charAt(0).toUpperCase()}
                  </div>
                );
              })}
              {extraCount > 0 && (
                <div style={{
                  width: 21, height: 21, borderRadius: 6,
                  background: 'var(--g200,#e5e7eb)', color: 'var(--t2)',
                  fontSize: 8, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1.5px solid var(--white)',
                  marginLeft: -7, position: 'relative', zIndex: 0,
                  flexShrink: 0,
                }}>
                  +{extraCount}
                </div>
              )}
            </div>
          ) : isImgAva ? (
            <img src={user.ava} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }} />
          ) : user.ava}
        </div>

        {user.online && <div className={s.hdOnline} />}

        {/* ── Popup contextuel membres ── */}
        {popupOpen && showGroupAva && (
          <MembersPopup
            members={members!}
            detailMember={detailMember}
            onSelectMember={setDetailMember}
            onBack={() => setDetailMember(null)}
            onClose={() => { setPopupOpen(false); setDetailMember(null); }}
          />
        )}
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

// ── Popup contextuel ───────────────────────────────────────────

interface PopupProps {
  members:        GroupMember[];
  detailMember:   GroupMember | null;
  onSelectMember: (m: GroupMember) => void;
  onBack:         () => void;
  onClose:        () => void;
}

function MembersPopup({ members, detailMember, onSelectMember, onBack, onClose }: PopupProps) {
  return (
    <div style={{
      position:  'absolute',
      top:       'calc(100% + 10px)',
      left:      0,
      zIndex:    500,
      background: 'var(--white)',
      border:    '1px solid var(--bdr2)',
      borderRadius: 14,
      boxShadow: '0 8px 32px rgba(6,15,30,.16)',
      width:     260,
      overflow:  'hidden',
      animation: 'popupIn .18s cubic-bezier(.34,1.56,.64,1) both',
    }}>
      <style>{`
        @keyframes popupIn {
          from { opacity:0; transform:translateY(-8px) scale(.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>

      {/* En-tête popup */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px 10px',
        borderBottom: '1px solid var(--bdr)',
        background: 'var(--g50)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {detailMember && (
            <button
              onClick={onBack}
              style={{
                width: 26, height: 26, borderRadius: 8,
                background: 'var(--g100)', border: 'none',
                color: 'var(--t2)', cursor: 'pointer', fontSize: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background .15s',
              }}
              title="Retour"
            >
              <i className="fas fa-arrow-left" />
            </button>
          )}
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)', fontFamily: 'var(--fd)' }}>
            {detailMember ? 'Profil du membre' : `${members.length} membre${members.length > 1 ? 's' : ''}`}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 24, height: 24, borderRadius: 7,
            background: 'none', border: 'none',
            color: 'var(--t3)', cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <i className="fas fa-xmark" />
        </button>
      </div>

      {/* Corps */}
      {detailMember
        ? <MemberDetailView member={detailMember} onClose={onClose} />
        : <MemberListView members={members} onSelect={onSelectMember} />
      }
    </div>
  );
}

// ── Vue liste des membres ─────────────────────────────────────

function MemberListView({ members, onSelect }: { members: GroupMember[]; onSelect: (m: GroupMember) => void }) {
  return (
    <div style={{ padding: '6px 0' }}>
      {members.map(m => {
        const ac = ACTOR_CONFIG[m.actorType] ?? ACTOR_CONFIG['client'];
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 14px', background: 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              transition: 'background .14s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--g50)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Initiale colorée */}
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: ac.initBg,
              color: '#fff', fontSize: 13, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {m.displayName.charAt(0).toUpperCase()}
            </div>

            {/* Nom + rôle */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12.5, fontWeight: 700, color: 'var(--navy)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: 'var(--fd)',
              }}>
                {m.displayName}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2,
                fontSize: 10, fontWeight: 700,
                color: ac.color, background: ac.bg,
                padding: '1px 7px', borderRadius: 99,
              }}>
                {ac.icon} {ac.label}
              </div>
            </div>

            <i className="fas fa-chevron-right" style={{ color: 'var(--t4)', fontSize: 10, flexShrink: 0 }} />
          </button>
        );
      })}
    </div>
  );
}

// ── Vue détail d'un membre ────────────────────────────────────

function MemberDetailView({ member, onClose }: { member: GroupMember; onClose: () => void }) {
  const navigate = useNavigate();
  const ac       = ACTOR_CONFIG[member.actorType] ?? ACTOR_CONFIG['client'];
  const profileUrl = getProfileUrl(member);
  const joinDate = new Date(member.joinedAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  function handleViewProfile() {
    if (!profileUrl) return;
    onClose();
    navigate(profileUrl);
  }

  return (
    <div style={{ padding: '18px 16px 16px' }}>
      {/* Avatar centré */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 16,
          background: ac.initBg,
          color: '#fff', fontSize: 24, fontWeight: 800,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,.14)',
          marginBottom: 10,
        }}>
          {member.displayName.charAt(0).toUpperCase()}
        </div>
        <div style={{
          fontSize: 14, fontWeight: 700, color: 'var(--navy)',
          fontFamily: 'var(--fd)', marginBottom: 6,
        }}>
          {member.displayName}
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 700,
          color: ac.color, background: ac.bg,
          padding: '3px 10px', borderRadius: 99,
        }}>
          {ac.icon} {ac.label}
        </div>
      </div>

      {/* Infos */}
      <div style={{
        background: 'var(--g50)', borderRadius: 10, padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 7,
        marginBottom: 12,
      }}>
        <InfoRow icon="fa-tag"           label="Rôle"       value={ac.label} />
        <InfoRow icon="fa-calendar-plus" label="Rejoint le" value={joinDate} />
      </div>

      {/* Bouton Voir profil */}
      {profileUrl ? (
        <button
          onClick={handleViewProfile}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '9px 0', borderRadius: 9,
            background: 'var(--navy)', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--fb)',
            transition: 'background .18s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#112648')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--navy)')}
        >
          <i className="fas fa-user" style={{ fontSize: 11 }} />
          Voir le profil
        </button>
      ) : (
        <div style={{
          textAlign: 'center', fontSize: 11, color: 'var(--t4)',
          padding: '6px 0',
        }}>
          Profil non disponible
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        background: 'var(--sky-2,#E2EAFB)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <i className={`fas ${icon}`} style={{ fontSize: 11, color: 'var(--blue)' }} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: 'var(--t3)', lineHeight: 1.2 }}>{label}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy)' }}>{value}</div>
      </div>
    </div>
  );
}
