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
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ChatUser, GroupMember }  from '../data/messagerieTypes';
import { getRoleConfig }                from '../data/messagerieTypes';
import { cldAvatar }                    from '../utils/chatUtils';
import { apiFetch }                     from '../../services/apiFetch';
import s from '../styles/ChatWindow.module.css';

// ── Recherche dans la conversation ────────────────────────────

interface SearchResult {
  id:          string;
  contentType: string;
  content:     string | null;
  mediaName:   string | null;
  senderId:    string;
  senderType:  string;
  fromMe:      boolean;
  createdAt:   string;
}

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

function getActorConfig(t: TFunction): Record<string, { label: string; icon: string; color: string; bg: string; initBg: string }> {
  return {
    client:        { label: t('messagerie.actorConfig.client'),        icon: '🛍️', color: '#1A4FC4', bg: 'rgba(26,79,196,.1)',   initBg: 'rgba(26,79,196,.82)'   },
    company:       { label: t('messagerie.actorConfig.company'),       icon: '🏪', color: '#047857', bg: 'rgba(4,120,87,.1)',    initBg: 'rgba(4,120,87,.82)'    },
    delivery:      { label: t('messagerie.actorConfig.delivery'),      icon: '🛵', color: '#0E7490', bg: 'rgba(14,116,144,.1)',  initBg: 'rgba(14,116,144,.82)'  },
    correspondent: { label: t('messagerie.actorConfig.correspondent'), icon: '📍', color: '#B45309', bg: 'rgba(180,83,9,.1)',    initBg: 'rgba(180,83,9,.82)'    },
  };
}

// ── Props ──────────────────────────────────────────────────────

interface Props {
  convId:         string;
  user:           ChatUser;
  members?:       GroupMember[];
  infoPanelOpen:  boolean;
  onToggleInfo:   () => void;
  onToast:        (msg: string, type?: string) => void;
  onCall?:        () => void;
  onVideoCall?:   () => void;
  onMobileMenu?:  () => void;
  /** Optionnel — fait défiler la liste jusqu'au message sélectionné dans les résultats de recherche, s'il est déjà chargé. */
  onJumpToMessage?: (msgId: string) => void;
  /** État initial épinglé/muet de CETTE conversation pour CE participant — voir ConvListItem.pinned/muted côté backend. */
  convPinned?:    boolean;
  convMuted?:     boolean;
  /** Absents pour les groupes de livraison (pas de conversation 1:1 sous-jacente) — voir MessagerieCore. */
  onArchiveConv?: (convId: string) => void;
  onDeleteConv?:  (convId: string) => void;
  /** Ouvre le sélecteur de fond d'écran — préférence globale (voir useWallpaper), pas propre à cette conversation. */
  onOpenWallpaper?: () => void;
  /** true si un fond d'écran est actif — l'en-tête devient transparent (le motif de .window
   *  continue derrière elle, voir ChatWindow.tsx) et ses textes/icônes passent en clair. */
  hasWallpaper?: boolean;
  /* BUG CORRIGÉ — "Paramètres" s'affichait comme une fenêtre modale
   * centrée (voir SettingsPanel.tsx avant ce correctif) alors que
   * l'utilisateur voulait le même traitement que le panneau
   * "Informations" (colonne latérale, voir InfoPanel.tsx) : l'état
   * settingsOpen et le rendu de SettingsPanel remontent maintenant dans
   * MessagerieCore, au même niveau que infoPanelOpen — ChatHeader se
   * contente de déclencher l'ouverture via ce callback. */
  onOpenSettings?: () => void;
  /** Description actuelle du groupe (commande ou groupe libre) — affichée/éditable
   *  via le petit bouton d'en-tête ci-dessous. Absent pour une conversation 1:1. */
  groupDescription?: string;
  /** BUG CORRIGÉ — la description se modifiait via une énorme bannière profil
   *  affichée en permanence au-dessus des messages (voir l'ancien
   *  GroupProfileBanner de MessagesZone.tsx) ; remplacée par ce petit bouton
   *  d'en-tête, visible uniquement pour les groupes, qui ouvre le même
   *  panneau d'édition (voir GroupDescriptionEditor ci-dessous). */
  onUpdateGroupDescription?: (desc: string) => void;
  /** BUG CORRIGÉ — le badge de rôle affichait toujours "📦 Livraison", même
   *  pour un groupe libre (voir DeliveryGroupKind.CUSTOM / Conversation.
   *  isCustomGroup) — même correctif que ConvList.tsx / InfoPanel.tsx. */
  isCustomGroup?: boolean;
}

// ── Composant ─────────────────────────────────────────────────

export default function ChatHeader({
  convId, user, members, infoPanelOpen, onToggleInfo, onToast, onCall, onVideoCall, onMobileMenu, onJumpToMessage,
  convPinned = false, convMuted = false, onArchiveConv, onDeleteConv, onOpenWallpaper, hasWallpaper = false,
  onOpenSettings, groupDescription, onUpdateGroupDescription, isCustomGroup = false,
}: Props) {
  const { t } = useTranslation();
  const roleConfig = getRoleConfig(t);
  const isGroupe = user.role === 'groupe';
  /* Un groupe libre n'est pas une "Livraison" — voir isCustomGroup ci-dessus. */
  const rc = isGroupe && isCustomGroup
    ? { ...roleConfig['groupe'], label: t('messagerie.infoPanel.groupeLibre'), icon: '👥' }
    : roleConfig[user.role] ?? roleConfig['client'];
  const isImgAva = user.ava?.startsWith('http');

  /* Avatars empilés — on affiche max 2 + badge "+N", UNIQUEMENT si le
   * groupe n'a pas de vraie photo de profil (voir InfoPanel.GroupAvatarEditor
   * / useDeliveryGroups.updateGroupPhoto) : une fois une photo réglée, elle
   * prime toujours sur les initiales empilées — même règle que WhatsApp. */
  const showGroupAva   = isGroupe && !isImgAva && !!members && members.length > 0;
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

  /* ── Recherche dans la conversation ── */
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone,    setSearchDone]    = useState(false);
  const searchRef       = useRef<HTMLDivElement>(null);
  const searchInputRef  = useRef<HTMLInputElement>(null);
  const searchDebounce  = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openSearch() {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 60);
  }
  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchDone(false);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
  }

  /* Ferme le panneau de recherche au changement de conversation — sinon
   * une recherche ouverte reste affichée avec des résultats de l'ancienne
   * conv pendant que la nouvelle conv se charge derrière. */
  useEffect(() => { closeSearch(); }, [convId]);

  /* Recherche live avec debounce — annule proprement les requêtes obsolètes
   * pour qu'une réponse tardive à une frappe précédente n'écrase pas les
   * résultats d'une frappe plus récente. */
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    const term = searchQuery.trim();
    if (!term) { setSearchResults([]); setSearchLoading(false); setSearchDone(false); return; }

    let ignore = false;
    searchDebounce.current = setTimeout(() => {
      setSearchLoading(true);
      apiFetch<SearchResult[]>(`/messagerie/conversations/${convId}/messages/search?q=${encodeURIComponent(term)}`)
        .then(res => { if (!ignore) setSearchResults(Array.isArray(res) ? res : []); })
        .catch(() => { if (!ignore) { setSearchResults([]); onToast(t('messagerie.chatHeader.rechercheEchec'), 'e'); } })
        .finally(() => { if (!ignore) { setSearchLoading(false); setSearchDone(true); } });
    }, 350);

    return () => { ignore = true; if (searchDebounce.current) clearTimeout(searchDebounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, convId]);

  /* Fermer au clic extérieur / Escape */
  useEffect(() => {
    if (!searchOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) closeSearch();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSearch(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen]);

  function handleResultClick(result: SearchResult) {
    onJumpToMessage?.(result.id);
    closeSearch();
  }

  /* ── Menu "⋮" (options de la conversation) ── */
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(convPinned);
  const [muted,  setMuted]  = useState(convMuted);
  const [togglingPin, setTogglingPin] = useState(false);
  const [togglingMute, setTogglingMute] = useState(false);

  /* Resynchronise si la conversation change (l'état local pinned/muted
   * ci-dessus ne doit pas "fuiter" d'une conversation vers la suivante). */
  useEffect(() => { setPinned(convPinned); setMuted(convMuted); }, [convId, convPinned, convMuted]);

  useEffect(() => {
    if (!optionsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (!optionsRef.current?.contains(e.target as Node)) setOptionsOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOptionsOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [optionsOpen]);

  async function togglePin() {
    const next = !pinned;
    setPinned(next);
    setTogglingPin(true);
    try {
      await apiFetch(`/messagerie/conversations/${convId}/pin`, { method: 'PATCH', body: { pinned: next } });
    } catch {
      setPinned(!next);
      onToast(t('messagerie.chatHeader.actionEchouee'), 'e');
    } finally {
      setTogglingPin(false);
    }
  }

  async function toggleMute() {
    const next = !muted;
    setMuted(next);
    setTogglingMute(true);
    try {
      await apiFetch(`/messagerie/conversations/${convId}/mute`, { method: 'PATCH', body: { muted: next } });
    } catch {
      setMuted(!next);
      onToast(t('messagerie.chatHeader.actionEchouee'), 'e');
    } finally {
      setTogglingMute(false);
    }
  }

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

  /* ── Édition de la description du groupe ── */
  const [descEditorOpen, setDescEditorOpen] = useState(false);

  return (
    <div className={`${s.header} ${hasWallpaper ? s.headerOnWallpaper : ''}`}>
      {/* Bouton retour liste — mobile uniquement */}
      {onMobileMenu && (
        <button className={s.hdMobileBtn} onClick={onMobileMenu} title={t('messagerie.chatHeader.conversationsTitle')}>
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
            cursor:     showGroupAva || isGroupe ? 'pointer' : 'default',
          }}
          /* BUG CORRIGÉ — "il faut mettre le profil dans la barre de la
           * conversation aussi" : une fois une vraie photo de groupe réglée
           * (voir InfoPanel.GroupAvatarEditor), showGroupAva devient false
           * (plus d'initiales empilées, voir plus haut) et cliquer sur
           * l'avatar ne faisait plus RIEN. Ouvre maintenant le panneau
           * "Informations" (même profil que celui géré depuis là), comme
           * WhatsApp/Telegram quand on touche la photo du groupe en haut
           * d'une conversation. */
          onClick={showGroupAva ? togglePopup : (isGroupe ? onToggleInfo : undefined)}
          title={showGroupAva ? t('messagerie.chatHeader.voirMembres') : isGroupe ? t('messagerie.chatHeader.informations') : undefined}
        >
          {showGroupAva ? (
            /* Initiales empilées des membres */
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {visibleMembers.map((m, i) => {
                const ac = getActorConfig(t)[m.actorType];
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
            <img src={cldAvatar(user.ava, 72)!} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }} />
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
          {user.online ? t('messagerie.chatHeader.enLigne') : t('messagerie.chatHeader.horsLigne')}
        </div>
      </div>

      {/* Boutons d'action */}
      <div className={s.hdActs}>
        <button
          className={s.hdBtn}
          onClick={onCall ?? (() => onToast(`📞 ${t('messagerie.chatHeader.appelAudio')}`, 'i'))}
          title={t('messagerie.chatHeader.appelAudio')}
        >
          <i className="fas fa-phone" />
        </button>
        <button
          className={s.hdBtn}
          onClick={onVideoCall ?? (() => onToast(`📹 ${t('messagerie.chatHeader.appelVideo')}`, 'i'))}
          title={t('messagerie.chatHeader.appelVideo')}
        >
          <i className="fas fa-video" />
        </button>
        <div ref={searchRef} style={{ position: 'relative' }}>
          <button className={`${s.hdBtn} ${searchOpen ? s.active : ''}`} onClick={() => (searchOpen ? closeSearch() : openSearch())} title={t('messagerie.chatHeader.rechercher')}>
            <i className="fas fa-magnifying-glass" />
          </button>
          {searchOpen && (
            <SearchPanel
              inputRef={searchInputRef}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              results={searchResults}
              loading={searchLoading}
              done={searchDone}
              onSelect={handleResultClick}
              onClose={closeSearch}
            />
          )}
        </div>
        <button className={`${s.hdBtn} ${infoPanelOpen ? s.active : ''}`} onClick={onToggleInfo} title={t('messagerie.chatHeader.informations')}>
          <i className="fas fa-circle-info" />
        </button>
        {/* Petit bouton "modifier la description" — groupes uniquement, voir
         * onUpdateGroupDescription ci-dessus (remplace l'ancienne bannière). */}
        {isGroupe && onUpdateGroupDescription && (
          <button
            className={`${s.hdBtn} ${descEditorOpen ? s.active : ''}`}
            onClick={() => setDescEditorOpen(true)}
            title={t('messagerie.messagesZone.modifierDescription')}
          >
            <i className="fas fa-align-left" />
          </button>
        )}
        {/* BUG CORRIGÉ — le bouton "⋮" entier était masqué pour toute
         * conversation de groupe (commande) via `{!isGroupe && ...}`.
         * Épingler/Couper les notifications ne s'appliquent en effet pas
         * aux groupes (aucun endpoint backend, voir OptionsMenuProps
         * ci-dessous), mais Archive/Supprimer sont déjà correctement
         * conditionnés sur onArchiveConv/onDeleteConv (undefined pour un
         * groupe, voir MessagerieCore.tsx), et surtout le fond d'écran
         * (préférence globale, pas propre à la conversation) devenait, lui,
         * injoignable depuis une conversation de commande sans raison. Le
         * bouton reste maintenant toujours visible ; OptionsMenu masque
         * lui-même chaque item dont le handler est absent. */}
        <div ref={optionsRef} style={{ position: 'relative' }}>
          <button className={`${s.hdBtn} ${optionsOpen ? s.active : ''}`} onClick={() => setOptionsOpen(p => !p)} title={t('messagerie.chatHeader.plus')}>
            <i className="fas fa-ellipsis-vertical" />
          </button>
          {optionsOpen && (
            <OptionsMenu
              pinned={pinned}
              muted={muted}
              togglingPin={togglingPin}
              togglingMute={togglingMute}
              onTogglePin={isGroupe ? undefined : togglePin}
              onToggleMute={isGroupe ? undefined : toggleMute}
              onWallpaper={onOpenWallpaper ? () => { onOpenWallpaper(); setOptionsOpen(false); } : undefined}
              onArchive={onArchiveConv ? () => { onArchiveConv(convId); setOptionsOpen(false); } : undefined}
              onDelete={onDeleteConv ? () => { onDeleteConv(convId); setOptionsOpen(false); } : undefined}
              onSettings={onOpenSettings ? () => { setOptionsOpen(false); onOpenSettings(); } : undefined}
            />
          )}
        </div>
      </div>

      {/* Panneau d'édition de la description — groupes uniquement */}
      {descEditorOpen && onUpdateGroupDescription && (
        <GroupDescriptionEditor
          initialValue={groupDescription ?? ''}
          onSave={onUpdateGroupDescription}
          onClose={() => setDescEditorOpen(false)}
        />
      )}
    </div>
  );
}

// ── Panneau d'édition de la description du groupe ──────────────
// BUG CORRIGÉ — ce panneau (identique) était affiché en cliquant sur une
// énorme bannière profil empilée en permanence au-dessus des messages
// (voir l'historique de MessagesZone.tsx) ; il ne s'ouvre plus que depuis
// le petit bouton d'en-tête ci-dessus.

interface GroupDescEditorProps {
  initialValue: string;
  onSave:       (desc: string) => void;
  onClose:      () => void;
}

/* Couleur de la barre de progression selon le remplissage */
function descProgressColor(len: number): string {
  if (len < 350) return '#10B981';
  if (len < 450) return '#F59E0B';
  return '#EF4444';
}

function GroupDescriptionEditor({ initialValue, onSave, onClose }: GroupDescEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initialValue);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  function handleSave() { onSave(draft.trim()); onClose(); }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') onClose();
  }

  const pct = Math.round((draft.length / 500) * 100);

  return (
    <>
      {/* Fond semi-transparent */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(6,15,30,.45)' }}
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
        <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--g200,#e5e7eb)', margin: '12px auto 0' }} />

        {/* Titre */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: 'var(--navy)' }}>
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
            onClick={onClose}
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
          <div style={{ height: 3, borderRadius: 99, background: 'var(--g100)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: descProgressColor(draft.length),
              borderRadius: 99, transition: 'width .2s, background .3s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: descProgressColor(draft.length) }}>
              {draft.length} / 500
            </span>
          </div>
        </div>

        {/* Boutons */}
        <div style={{ display: 'flex', gap: 10, padding: '12px 18px 16px' }}>
          <button
            onClick={onClose}
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
  );
}

// ── Panneau de recherche dans la conversation ─────────────────

function resultIcon(contentType: string): string {
  switch (contentType) {
    case 'image':    return 'fa-image';
    case 'video':    return 'fa-video';
    case 'file':     return 'fa-file-pdf';
    case 'audio':    return 'fa-microphone';
    case 'product':  return 'fa-box';
    case 'order':    return 'fa-cart-shopping';
    case 'location': return 'fa-location-dot';
    default:         return 'fa-comment';
  }
}

function resultSnippet(r: SearchResult, t: TFunction): string {
  if (r.content)   return r.content;
  if (r.mediaName) return r.mediaName;
  switch (r.contentType) {
    case 'image':    return t('messagerie.chatHeader.snippetPhoto');
    case 'video':    return t('messagerie.chatHeader.snippetVideo');
    case 'audio':    return t('messagerie.chatHeader.snippetVocal');
    case 'location': return t('messagerie.chatHeader.snippetPosition');
    default:         return '';
  }
}

/** Découpe le texte autour du terme recherché (insensible à la casse) pour le surligner. */
function HighlightedText({ text, term }: { text: string; term: string }) {
  const q = term.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(251,191,36,.45)', color: 'inherit', borderRadius: 2 }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

interface SearchPanelProps {
  inputRef:      React.RefObject<HTMLInputElement | null>;
  query:         string;
  onQueryChange: (q: string) => void;
  results:       SearchResult[];
  loading:       boolean;
  done:          boolean;
  onSelect:      (r: SearchResult) => void;
  onClose:       () => void;
}

function SearchPanel({ inputRef, query, onQueryChange, results, loading, done, onSelect, onClose }: SearchPanelProps) {
  const { t } = useTranslation();
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 500,
        background: 'var(--white)', border: '1px solid var(--bdr2)', borderRadius: 14,
        boxShadow: '0 8px 32px rgba(6,15,30,.16)', width: 320, maxHeight: 400,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'popupIn .18s cubic-bezier(.34,1.56,.64,1) both',
      }}
    >
      {/* Barre de recherche */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', borderBottom: '1px solid var(--bdr)', background: 'var(--g50)', flexShrink: 0,
      }}>
        <i className="fas fa-magnifying-glass" style={{ color: 'var(--t3)', fontSize: 12 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder={t('messagerie.chatHeader.rechercherPlaceholder')}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 12.5, color: 'var(--navy)', fontFamily: 'var(--fb)',
          }}
        />
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}
        >
          <i className="fas fa-xmark" />
        </button>
      </div>

      {/* Résultats */}
      <div style={{ overflowY: 'auto', padding: '4px 0' }}>
        {!query.trim() ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--t4)' }}>
            {t('messagerie.chatHeader.rechercheHint')}
          </div>
        ) : loading ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
            <i className="fas fa-spinner fa-spin" /> {t('messagerie.chatHeader.rechercheEnCours')}
          </div>
        ) : results.length === 0 && done ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
            {t('messagerie.chatHeader.aucunResultat')}
          </div>
        ) : (
          results.map(r => (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              style={{
                width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '9px 14px', background: 'transparent', border: 'none',
                cursor: 'pointer', textAlign: 'left', transition: 'background .14s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--g50)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
                background: 'var(--sky,#EEF3FD)', color: 'var(--teal,#0E7490)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
              }}>
                <i className={`fas ${resultIcon(r.contentType)}`} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, color: 'var(--navy)', lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  <HighlightedText text={resultSnippet(r, t)} term={query} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 3 }}>
                  {new Date(r.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Menu "⋮" options de la conversation ────────────────────────
// Sélection façon WhatsApp/Telegram/Messenger : épingler, notifications,
// archiver, supprimer — les actions qu'on retrouve dans leur menu "…"
// d'une conversation 1:1 (pas de "Bloquer"/"Signaler" ici : ces deux-là
// touchent la modération/confiance entre acteurs et méritent leur propre
// chantier dédié plutôt qu'un bouton qui ne ferait rien derrière).

interface OptionsMenuProps {
  pinned:        boolean;
  muted:         boolean;
  togglingPin:   boolean;
  togglingMute:  boolean;
  /* Optionnels — absents pour une conversation de groupe (commande) :
   * épingler/couper les notifications n'existent pas côté backend pour
   * les groupes de livraison (voir useDeliveryGroups.ts, pinned/muted y
   * sont figés à false, aucun endpoint PATCH .../pin ou .../mute ne
   * s'applique à un groupe). Voir ChatHeader ci-dessus. */
  onTogglePin?:  () => void;
  onToggleMute?: () => void;
  onWallpaper?:  () => void;
  onArchive?:    () => void;
  onDelete?:     () => void;
  /** "Paramètres" — toujours disponible (voir SettingsPanel), quel que soit le type de conversation. */
  onSettings?:   () => void;
}

function OptionsMenu({ pinned, muted, togglingPin, togglingMute, onTogglePin, onToggleMute, onWallpaper, onArchive, onDelete, onSettings }: OptionsMenuProps) {
  const { t } = useTranslation();

  const itemStyle: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 11,
    padding: '10px 14px', background: 'transparent', border: 'none',
    cursor: 'pointer', textAlign: 'left', fontSize: 12.5, fontWeight: 500,
    color: 'var(--t1)', transition: 'background .14s', fontFamily: 'var(--fb)',
  };
  const iconWrap: React.CSSProperties = {
    width: 26, height: 26, borderRadius: 8, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
  };

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 500,
        background: 'var(--white)', border: '1px solid var(--bdr2)', borderRadius: 14,
        boxShadow: '0 8px 32px rgba(6,15,30,.16)', width: 250, overflow: 'hidden',
        animation: 'popupIn .18s cubic-bezier(.34,1.56,.64,1) both', padding: '6px 0',
      }}
    >
      {onTogglePin && (
        <button
          style={{ ...itemStyle, opacity: togglingPin ? .6 : 1 }}
          disabled={togglingPin}
          onClick={onTogglePin}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--g50)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ ...iconWrap, background: 'rgba(180,83,9,.1)', color: '#B45309' }}>
            <i className={`fas ${pinned ? 'fa-thumbtack-slash' : 'fa-thumbtack'}`} />
          </div>
          {pinned ? t('messagerie.chatHeader.desepingler') : t('messagerie.chatHeader.epingler')}
        </button>
      )}

      {onToggleMute && (
        <button
          style={{ ...itemStyle, opacity: togglingMute ? .6 : 1 }}
          disabled={togglingMute}
          onClick={onToggleMute}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--g50)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ ...iconWrap, background: 'rgba(109,40,217,.1)', color: '#6D28D9' }}>
            <i className={`fas ${muted ? 'fa-bell' : 'fa-bell-slash'}`} />
          </div>
          {muted ? t('messagerie.chatHeader.reactiverNotifs') : t('messagerie.chatHeader.couperNotifs')}
        </button>
      )}

      {onWallpaper && (
        <button
          style={itemStyle}
          onClick={onWallpaper}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--g50)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ ...iconWrap, background: 'rgba(14,165,233,.1)', color: '#0EA5E9' }}>
            <i className="fas fa-image" />
          </div>
          {t('messagerie.wallpaper.titre')}
        </button>
      )}

      {onSettings && (
        <button
          style={itemStyle}
          onClick={onSettings}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--g50)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ ...iconWrap, background: 'rgba(107,114,128,.12)', color: '#4B5563' }}>
            <i className="fas fa-gear" />
          </div>
          {t('messagerie.chatHeader.parametres')}
        </button>
      )}

      {onArchive && (
        <button
          style={itemStyle}
          onClick={onArchive}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--g50)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ ...iconWrap, background: 'rgba(14,116,144,.1)', color: 'var(--teal,#0E7490)' }}>
            <i className="fas fa-box-archive" />
          </div>
          {t('messagerie.chatHeader.archiverConversation')}
        </button>
      )}

      {onDelete && (
        <>
          <div style={{ height: 1, background: 'var(--bdr)', margin: '4px 0' }} />
          <button
            style={{ ...itemStyle, color: 'var(--red,#DC2626)' }}
            onClick={onDelete}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,38,38,.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ ...iconWrap, background: 'rgba(220,38,38,.1)', color: 'var(--red,#DC2626)' }}>
              <i className="fas fa-trash-can" />
            </div>
            {t('messagerie.chatHeader.supprimerConversation')}
          </button>
        </>
      )}
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
  const { t } = useTranslation();
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
              title={t('messagerie.chatHeader.retour')}
            >
              <i className="fas fa-arrow-left" />
            </button>
          )}
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)', fontFamily: 'var(--fd)' }}>
            {detailMember ? t('messagerie.chatHeader.profilMembre') : t('messagerie.chatHeader.membre', { count: members.length })}
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
  const { t } = useTranslation();
  return (
    <div style={{ padding: '6px 0' }}>
      {members.map(m => {
        const actorConfig = getActorConfig(t);
        const ac = actorConfig[m.actorType] ?? actorConfig['client'];
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const actorConfig = getActorConfig(t);
  const ac       = actorConfig[member.actorType] ?? actorConfig['client'];
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
        <InfoRow icon="fa-tag"           label={t('messagerie.chatHeader.role')}     value={ac.label} />
        <InfoRow icon="fa-calendar-plus" label={t('messagerie.chatHeader.rejointLe')} value={joinDate} />
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
          {t('messagerie.chatHeader.voirProfil')}
        </button>
      ) : (
        <div style={{
          textAlign: 'center', fontSize: 11, color: 'var(--t4)',
          padding: '6px 0',
        }}>
          {t('messagerie.chatHeader.profilNonDisponible')}
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
