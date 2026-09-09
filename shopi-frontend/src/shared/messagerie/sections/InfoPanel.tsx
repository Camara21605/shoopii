/*
 * FICHIER : src/shared/messagerie/sections/InfoPanel.tsx
 * Panneau droit : profil du contact ou détail d'un groupe de livraison.
 *
 * Vue groupe :
 *   - Liste des membres avec initiales colorées + rôle
 *   - Clic sur un membre → vue détail de cet acteur
 *   - Bouton "← Retour" pour revenir à la liste
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Conversation, ChatUser, GroupMember } from '../data/messagerieTypes';
import { getRoleConfig } from '../data/messagerieTypes';
import { cldAvatar, uploadToServer } from '../utils/chatUtils';
import type { MediaViewerItem } from '../components/MediaViewer';
import { apiFetch } from '../../services/apiFetch';
import s from '../styles/InfoPanel.module.css';

// ── Résumé médias réel (GET /messagerie/conversations/:id/media-summary) ──

interface MediaSummaryItem {
  id:            string;
  contentType:   string;
  mediaUrl:      string | null;
  mediaName:     string | null;
  mediaMimeType: string | null;
  createdAt:     string;
}
interface MediaSummary {
  totalMessages: number;
  media:         MediaSummaryItem[];
  isBlockedByMe: boolean;
}

/* Distingue les types de fichier — icône ET libellé, pas juste une icône
 * répétée (ex : 6 messages vocaux affichaient 6 fois 🎙️ sans rien pour
 * les différencier). */
const MEDIA_ICON: Record<string, string> = {
  image: '📷', video: '🎥', audio: '🎙️', file: '📄',
};
function mediaLabel(item: MediaSummaryItem, t: TFunction): string {
  if (item.contentType === 'file')  return item.mediaName || t('messagerie.infoPanel.mediaTypeFile');
  if (item.contentType === 'image') return t('messagerie.infoPanel.mediaTypeImage');
  if (item.contentType === 'video') return t('messagerie.infoPanel.mediaTypeVideo');
  if (item.contentType === 'audio') return t('messagerie.infoPanel.mediaTypeAudio');
  return item.mediaName || item.contentType;
}

/* BUG CORRIGÉ — ouvrir un média Cloudinary dans un nouvel onglet
 * l'affiche/le joue en ligne, ça ne le télécharge jamais réellement sur
 * l'appareil. `fl_attachment` force Cloudinary à répondre avec
 * Content-Disposition: attachment — vrai téléchargement, sans backend
 * dédié ni fetch-blob côté client. Sans effet (retourne l'URL telle
 * quelle) sur un média non hébergé par Cloudinary. */
function toDownloadUrl(url: string): string {
  if (!url.includes('res.cloudinary.com') || url.includes('fl_attachment')) return url;
  return url.replace('/upload/', '/upload/fl_attachment/');
}

function useMediaSummary(convId: string | undefined) {
  const [data, setData]       = useState<MediaSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!convId) { setData(null); return; }
    setLoading(true);
    return apiFetch<MediaSummary>(`/messagerie/conversations/${convId}/media-summary`)
      .then(res => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [convId]);

  useEffect(() => {
    let cancelled = false;
    if (!convId) { setData(null); return; }
    setLoading(true);
    apiFetch<MediaSummary>(`/messagerie/conversations/${convId}/media-summary`)
      .then(res => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [convId]);

  return { data, loading, refresh };
}

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
  /** Déclenche un vrai appel audio — même handler que ChatHeader (voir MessagerieCore.tsx). */
  onCall?:  () => void;
  /** Change la photo de profil du groupe (voir useDeliveryGroups.updateGroupPhoto) — absent pour un contact direct. */
  onUpdateGroupPhoto?: (groupId: string, photoUrl: string) => void;
  /** Nomme/retire un administrateur (groupe libre uniquement, voir useDeliveryGroups.setMemberAdmin). */
  onSetMemberAdmin?: (groupId: string, memberId: string, isAdmin: boolean) => void;
  /** users.id du compte connecté — sert à déterminer si CE membre est administrateur (voir GroupInfoPanel). */
  myUserId?: string;
  /** Ouvre la visionneuse plein écran IN-APP pour un média de la liste
   *  "Médias partagés" (image/vidéo/audio) — remplace window.open, voir
   *  MediaViewer.tsx. `index` permet les flèches ← → : openMedia() ci-dessous
   *  passe TOUS les médias navigables de la conversation, pas juste celui
   *  cliqué, pour qu'on puisse parcourir les autres sans refermer la vue. */
  onOpenMedia: (items: MediaViewerItem[], index: number) => void;
}

// ── Composant ─────────────────────────────────────────────────

export default function InfoPanel({ conv, user, members, onClose, onToast, onCall, onUpdateGroupPhoto, onSetMemberAdmin, myUserId, onOpenMedia }: Props) {
  if (!conv || !user) return null;

  const isGroup = !!conv.isGroup;

  return (
    <>
      {/* Visible uniquement ≤1100px (voir InfoPanel.module.css) — referme
       * le panneau au clic en dehors, comme l'overlay mobile de ConvList. */}
      <div className={s.backdrop} onClick={onClose} />
      {isGroup
        ? <GroupInfoPanel conv={conv} user={user} members={members ?? []} onClose={onClose} onToast={onToast} onUpdateGroupPhoto={onUpdateGroupPhoto} onSetMemberAdmin={onSetMemberAdmin} myUserId={myUserId} />
        : <ContactInfoPanel conv={conv} user={user} onClose={onClose} onToast={onToast} onCall={onCall} onOpenMedia={onOpenMedia} />}
    </>
  );
}

// ── Vue contact direct ─────────────────────────────────────────

function ContactInfoPanel({
  conv, user, onClose, onToast, onCall, onOpenMedia,
}: {
  conv: Conversation; user: ChatUser;
  onClose: () => void; onToast: (msg: string, type?: string) => void;
  onCall?: () => void;
  onOpenMedia: (items: MediaViewerItem[], index: number) => void;
}) {
  const { t } = useTranslation();
  const roleConfig = getRoleConfig(t);
  const rc       = roleConfig[user.role] ?? roleConfig['client'];
  const isImgAva = user.ava?.startsWith('http');
  const { data: mediaSummary, refresh: refreshMediaSummary } = useMediaSummary(conv.id);
  const [showAllMedia, setShowAllMedia] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const memberSinceLabel = user.memberSince
    ? new Date(user.memberSince).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : t('messagerie.infoPanel.dateInconnue');

  /* Vrai total (base de données), pas conv.messages.length qui ne compte
   * que les messages déjà chargés côté frontend (pagination 50 par page). */
  const totalMessages = mediaSummary?.totalMessages ?? conv.messages.length;
  const mediaItems     = mediaSummary?.media ?? [];
  const visibleMedia   = showAllMedia ? mediaItems : mediaItems.slice(0, 6);
  const isBlocked       = mediaSummary?.isBlockedByMe ?? false;

  /* BUG CORRIGÉ — ouvrait toujours window.open(url, '_blank') : une image,
   * une vidéo OU un message vocal cliqué depuis "Médias partagés" quittait
   * Shoneya vers un nouvel onglet au lieu de rester dans la conversation.
   * Image/vidéo/audio s'ouvrent maintenant dans la visionneuse IN-APP (voir
   * MediaViewer.tsx, qui réutilise VoicePlayer pour l'audio) ; seul un
   * document reste un téléchargement natif (pas de rendu PDF in-app ici).
   *
   * Flèches ← → — on passe TOUS les médias navigables (image/vidéo/audio)
   * de la conversation à la visionneuse, pas juste `visibleMedia` (les 6
   * premiers affichés ici avant "Voir plus") : s'il y en a plus, on doit
   * quand même pouvoir les parcourir depuis la visionneuse elle-même. */
  function openMedia(item: MediaSummaryItem) {
    if (!item.mediaUrl) return;
    if (item.contentType !== 'image' && item.contentType !== 'video' && item.contentType !== 'audio') {
      window.open(item.mediaUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const navigable = mediaItems.filter(
      (m): m is MediaSummaryItem & { mediaUrl: string; contentType: 'image' | 'video' | 'audio' } =>
        !!m.mediaUrl && (m.contentType === 'image' || m.contentType === 'video' || m.contentType === 'audio'),
    );
    const items = navigable.map(m => ({ url: m.mediaUrl, type: m.contentType, name: m.mediaName ?? undefined }));
    const index = navigable.findIndex(m => m.id === item.id);
    onOpenMedia(items, index === -1 ? 0 : index);
  }

  /* BUG CORRIGÉ — "Bloquer le contact" était un toast factice (aucun
   * appel réseau). Maintenant : confirmation, vrai PATCH .../block,
   * puis rafraîchit media-summary pour refléter le nouvel état (bouton
   * "Débloquer" une fois bloqué). Le blocage empêche réellement l'envoi
   * de messages dans les deux sens côté serveur (voir sendMessage()). */
  async function handleToggleBlock() {
    const next = !isBlocked;
    const confirmMsg = next
      ? t('messagerie.infoPanel.confirmerBlocage', { name: user.name })
      : t('messagerie.infoPanel.confirmerDeblocage', { name: user.name });
    if (!window.confirm(confirmMsg)) return;

    setBlocking(true);
    try {
      await apiFetch(`/messagerie/conversations/${conv.id}/block`, {
        method: 'PATCH',
        body: { blocked: next },
      });
      await refreshMediaSummary();
      onToast(next ? t('messagerie.infoPanel.contactBloque') : t('messagerie.infoPanel.contactDebloque'), 's');
    } catch {
      onToast(t('messagerie.infoPanel.erreurBlocage'), 'e');
    } finally {
      setBlocking(false);
    }
  }

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
          <button className={s.btn} onClick={onCall ?? (() => onToast(t('messagerie.infoPanel.appelIndisponible'), 'e'))}><i className="fas fa-phone" /> {t('messagerie.infoPanel.appel')}</button>
          <button className={`${s.btn} ${s.btnPrimary}`} onClick={onClose}><i className="fas fa-paper-plane" /> {t('messagerie.infoPanel.message')}</button>
        </div>
      </div>

      <div className={s.section}>
        <div className={s.sectTitle}>{t('messagerie.infoPanel.informations')}</div>
        <div className={s.row}><div className={s.rowIco}><i className="fas fa-tag" /></div><div><div className={s.rowLbl}>{t('messagerie.infoPanel.role')}</div><div className={s.rowVal}>{rc.label}</div></div></div>
        {user.context && <div className={s.row}><div className={s.rowIco}><i className="fas fa-location-dot" /></div><div><div className={s.rowLbl}>{t('messagerie.infoPanel.localisation')}</div><div className={s.rowVal}>{user.context}</div></div></div>}
        <div className={s.row}><div className={s.rowIco}><i className="fas fa-clock" /></div><div><div className={s.rowLbl}>{t('messagerie.infoPanel.membreDepuis')}</div><div className={s.rowVal}>{memberSinceLabel}</div></div></div>
        <div className={s.row}><div className={s.rowIco}><i className="fas fa-comment-dots" /></div><div><div className={s.rowLbl}>{t('messagerie.infoPanel.messagesEchanges')}</div><div className={s.rowVal}>{t('messagerie.infoPanel.messagesCount', { count: totalMessages })}</div></div></div>
      </div>

      <div className={s.section}>
        <div className={s.sectTitle}>{t('messagerie.infoPanel.mediasPartages')}</div>
        {mediaItems.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--t4)', padding: '4px 0' }}>{t('messagerie.infoPanel.aucunMedia')}</div>
        ) : (
          <>
            <div className={s.mediaList}>
              {visibleMedia.map(item => (
                <div key={item.id} className={s.mediaRow}>
                  <button className={s.mediaRowMain} onClick={() => openMedia(item)}>
                    <div className={s.mediaRowIco}>
                      {item.contentType === 'image' && item.mediaUrl
                        ? <img src={item.mediaUrl} alt="" />
                        : (MEDIA_ICON[item.contentType] ?? '📄')}
                    </div>
                    <div className={s.mediaRowInfo}>
                      <div className={s.mediaRowName}>{mediaLabel(item, t)}</div>
                      <div className={s.mediaRowMeta}>
                        {new Date(item.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  </button>
                  {item.mediaUrl && (
                    <a
                      className={s.mediaRowDl}
                      href={toDownloadUrl(item.mediaUrl)}
                      download={item.mediaName ?? true}
                      target="_blank" rel="noopener noreferrer"
                      title={t('messagerie.infoPanel.telecharger')}
                      onClick={e => e.stopPropagation()}
                    >
                      <i className="fas fa-download" />
                    </a>
                  )}
                </div>
              ))}
            </div>
            {mediaItems.length > 6 && (
              <button className={s.mediaAllBtn} onClick={() => setShowAllMedia(v => !v)}>
                {showAllMedia ? t('messagerie.infoPanel.voirMoins') : t('messagerie.infoPanel.voirTout')}
              </button>
            )}
          </>
        )}
      </div>

      {/*
        Épingler / Couper les notifications / Supprimer la conversation sont
        de VRAIES actions dans le menu "⋮" du ChatHeader (au-dessus) — pas
        dupliquées ici. "Bloquer le contact" est réellement branché (PATCH
        .../block, voir handleToggleBlock ci-dessus) : bloque l'envoi de
        messages dans les deux sens côté serveur. */}
      <div className={s.section}>
        <div className={s.sectTitle}>{t('messagerie.infoPanel.options')}</div>
        <div className={s.optionsWrap}>
          <button className={`${s.optionBtn} ${s.danger}`} disabled={blocking} onClick={handleToggleBlock}>
            <i className={`fas ${isBlocked ? 'fa-circle-check' : 'fa-ban'}`} />
            {isBlocked ? t('messagerie.infoPanel.debloquerContact') : t('messagerie.infoPanel.bloquerContact')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vue groupe : liste membres + détail acteur ─────────────────

function GroupInfoPanel({
  conv, user, members, onClose, onToast, onUpdateGroupPhoto, onSetMemberAdmin, myUserId,
}: {
  conv: Conversation; user: ChatUser;
  members: GroupMember[]; onClose: () => void;
  onToast: (msg: string, type?: string) => void;
  onUpdateGroupPhoto?: (groupId: string, photoUrl: string) => void;
  onSetMemberAdmin?: (groupId: string, memberId: string, isAdmin: boolean) => void;
  myUserId?: string;
}) {
  const { t } = useTranslation();
  /* Id plutôt que l'objet entier — permet à selectedMember de rester à jour
   * (badge Admin, etc.) si members change pendant que le détail est ouvert
   * (ex : un autre membre nommé administrateur ailleurs, voir useDeliveryGroups
   * onStatus > 'group_member_admin_changed'), au lieu d'une capture figée. */
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const selectedMember = selectedMemberId ? members.find(m => m.id === selectedMemberId) ?? null : null;

  const isCustomGroup = !!conv.isCustomGroup;
  const myIsAdmin = !!members.find(m => m.userId === myUserId)?.isAdmin;

  return (
    <div className={s.panel}>
      <div className={s.hd}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {selectedMember && (
            <button
              className={s.hdClose}
              onClick={() => setSelectedMemberId(null)}
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
        ? (
          <MemberDetail
            member={selectedMember} conv={conv} onBack={() => setSelectedMemberId(null)}
            isCustomGroup={isCustomGroup} myIsAdmin={myIsAdmin} myUserId={myUserId}
            onSetMemberAdmin={onSetMemberAdmin} onToast={onToast}
          />
        )
        : (
          <MemberList
            conv={conv} user={user} members={members} onSelect={m => setSelectedMemberId(m.id)}
            onToast={onToast} onUpdateGroupPhoto={onUpdateGroupPhoto}
            isCustomGroup={isCustomGroup} myIsAdmin={myIsAdmin}
          />
        )
      }
    </div>
  );
}

// ── Sous-vue : liste des membres ──────────────────────────────

function MemberList({
  conv, user, members, onSelect, onToast, onUpdateGroupPhoto, isCustomGroup, myIsAdmin,
}: {
  conv: Conversation; user: ChatUser;
  members: GroupMember[]; onSelect: (m: GroupMember) => void;
  onToast: (msg: string, type?: string) => void;
  onUpdateGroupPhoto?: (groupId: string, photoUrl: string) => void;
  isCustomGroup: boolean;
  myIsAdmin: boolean;
}) {
  const { t } = useTranslation();
  const statusLabel = getGroupStatusLabel(t)[conv.groupStatus ?? 'active'] ?? getGroupStatusLabel(t).active;
  /* BUG CORRIGÉ — la photo ne peut être changée QUE par un administrateur
   * pour un groupe libre (voir DeliveryGroupService.assertGroupAdmin) — un
   * groupe de commande (ORDER) n'a pas de notion d'admin, reste permissif. */
  const canEditPhoto = !isCustomGroup || myIsAdmin;

  return (
    <>
      {/* En-tête groupe — une seule photo modifiable (voir GroupAvatarEditor
       * ci-dessous), plus l'émoji figé 📦 pour tous les groupes. */}
      <div className={s.profile}>
        <GroupAvatarEditor
          groupId={conv.id}
          currentAva={user.ava}
          fallbackEmoji={isCustomGroup ? '👥' : '📦'}
          onToast={onToast}
          onUpdateGroupPhoto={canEditPhoto ? onUpdateGroupPhoto : undefined}
        />
        <div className={s.name}>{user.name}</div>
        <div className={s.roleTag} style={{ background: 'rgba(14,116,144,.1)', color: '#0E7490' }}>
          {isCustomGroup ? `👥 ${t('messagerie.infoPanel.groupeLibre')}` : `📦 ${t('messagerie.infoPanel.livraison')}`}
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
                    <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2, flexWrap:'wrap' }}>
                      <div style={{
                        display:'inline-flex', alignItems:'center', gap:4,
                        fontSize:10.5, fontWeight:700,
                        color: ac.color, background: ac.bg,
                        padding:'2px 8px', borderRadius:99,
                      }}>
                        {ac.icon} {ac.label}
                      </div>
                      {/* Badge admin — groupe libre uniquement (voir isAdmin, GroupInfoPanel.myIsAdmin) */}
                      {isCustomGroup && m.isAdmin && (
                        <div style={{
                          display:'inline-flex', alignItems:'center', gap:3,
                          fontSize:10.5, fontWeight:700,
                          color:'#B45309', background:'rgba(180,83,9,.1)',
                          padding:'2px 8px', borderRadius:99,
                        }}>
                          👑 {t('messagerie.infoPanel.admin')}
                        </div>
                      )}
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

// ── Photo de profil du groupe — une seule image, modifiable ────
// BUG CORRIGÉ — le groupe n'avait qu'un émoji figé (📦/👥), aucune vraie
// photo. Même mécanique d'upload que les médias de messagerie (voir
// uploadToServer dans chatUtils.ts) vers POST /upload/avatar (dossier
// dédié, recadré 400×400 côté Cloudinary) ; l'URL retournée est ensuite
// enregistrée via onUpdateGroupPhoto (PATCH /delivery-groups/:id).

function GroupAvatarEditor({
  groupId, currentAva, fallbackEmoji, onToast, onUpdateGroupPhoto,
}: {
  groupId:       string;
  currentAva:    string;
  fallbackEmoji: string;
  onToast:       (msg: string, type?: string) => void;
  onUpdateGroupPhoto?: (groupId: string, photoUrl: string) => void;
}) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isImgAva = currentAva.startsWith('http');

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de re-choisir le même fichier ensuite
    if (!file || !onUpdateGroupPhoto) return;
    if (!file.type.startsWith('image/')) {
      onToast(t('messagerie.infoPanel.photoTypeInvalide'), 'e');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadToServer(file, '/upload/avatar', file.name);
      onUpdateGroupPhoto(groupId, url);
      onToast(t('messagerie.infoPanel.photoModifiee'), 's');
    } catch {
      onToast(t('messagerie.infoPanel.photoEchec'), 'e');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ position: 'relative', width: 72, margin: '0 auto 12px' }}>
      <div className={s.ava} style={{
        margin: 0,
        background: isImgAva ? undefined : 'rgba(14,116,144,.12)',
        fontSize: 28, padding: isImgAva ? 0 : undefined, overflow: 'hidden',
      }}>
        {isImgAva
          ? <img src={cldAvatar(currentAva, 160)!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }} />
          : fallbackEmoji}
      </div>

      {onUpdateGroupPhoto && (
        <>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title={t('messagerie.infoPanel.modifierPhoto')}
            style={{
              position: 'absolute', right: -2, bottom: 10,
              width: 26, height: 26, borderRadius: '50%',
              background: 'var(--teal,#0E7490)', color: '#fff',
              border: '2px solid var(--white)', cursor: uploading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, boxShadow: '0 2px 6px rgba(0,0,0,.2)',
            }}
          >
            <i className={`fas ${uploading ? 'fa-spinner fa-spin' : 'fa-camera'}`} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </>
      )}
    </div>
  );
}

// ── Sous-vue : détail d'un membre ─────────────────────────────

function MemberDetail({
  member, conv, onBack, isCustomGroup, myIsAdmin, myUserId, onSetMemberAdmin, onToast,
}: {
  member: GroupMember; conv: Conversation; onBack: () => void;
  isCustomGroup: boolean;
  myIsAdmin: boolean;
  myUserId?: string;
  onSetMemberAdmin?: (groupId: string, memberId: string, isAdmin: boolean) => void;
  onToast: (msg: string, type?: string) => void;
}) {
  const { t } = useTranslation();
  const navigate    = useNavigate();
  const actorConfig = getActorConfig(t);
  const ac          = actorConfig[member.actorType] ?? actorConfig['client'];
  const profileUrl  = getProfileUrl(member);
  const joinDate    = new Date(member.joinedAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const [togglingAdmin, setTogglingAdmin] = useState(false);

  function handleViewProfile() {
    if (!profileUrl) return;
    navigate(profileUrl);
  }

  /* BUG CORRIGÉ — impossible de déléguer la gestion d'un groupe libre à
   * un autre membre (nommer un administrateur, comme WhatsApp/Telegram) —
   * voir DeliveryGroupService.setMemberAdmin. Visible uniquement pour un
   * autre administrateur, sur un groupe CUSTOM, jamais sur soi-même (on
   * ne peut pas se retirer ses propres droits depuis cet écran — évite un
   * groupe accidentellement sans administrateur). */
  const canManageAdmin = isCustomGroup && myIsAdmin && !!onSetMemberAdmin && member.userId !== myUserId;

  async function handleToggleAdmin() {
    if (!onSetMemberAdmin) return;
    const next = !member.isAdmin;
    const confirmMsg = next
      ? t('messagerie.infoPanel.confirmerNommerAdmin', { name: member.displayName })
      : t('messagerie.infoPanel.confirmerRetirerAdmin', { name: member.displayName });
    if (!window.confirm(confirmMsg)) return;

    setTogglingAdmin(true);
    try {
      await onSetMemberAdmin(conv.id, member.id, next);
      onToast(next ? t('messagerie.infoPanel.adminNomme', { name: member.displayName }) : t('messagerie.infoPanel.adminRetire', { name: member.displayName }), 's');
    } catch (err: any) {
      onToast(err?.message || t('messagerie.infoPanel.adminEchec'), 'e');
    } finally {
      setTogglingAdmin(false);
    }
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
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', justifyContent:'center' }}>
          <div className={s.roleTag} style={{ background: ac.bg, color: ac.color, marginBottom:0 }}>
            {ac.icon} {ac.label}
          </div>
          {isCustomGroup && member.isAdmin && (
            <div className={s.roleTag} style={{ background:'rgba(180,83,9,.1)', color:'#B45309', marginBottom:0 }}>
              👑 {t('messagerie.infoPanel.admin')}
            </div>
          )}
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

      {/* Gestion du groupe — nommer/retirer administrateur (groupe libre uniquement) */}
      {canManageAdmin && (
        <div className={s.section}>
          <div className={s.sectTitle}>{t('messagerie.infoPanel.gestionGroupe')}</div>
          <div className={s.optionsWrap}>
            <button className={s.optionBtn} disabled={togglingAdmin} onClick={handleToggleAdmin}>
              <i className={`fas ${member.isAdmin ? 'fa-user-minus' : 'fa-user-shield'}`} />
              {member.isAdmin ? t('messagerie.infoPanel.retirerAdmin') : t('messagerie.infoPanel.nommerAdmin')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
