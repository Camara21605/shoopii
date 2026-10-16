/**
 * src/shared/messagerie/components/CallRoomLayer.tsx
 *
 * Appels à plusieurs sur le site (jusqu'à 4) — affiché par GlobalCallProvider
 * au-dessus de CallOverlay :
 *   - « Ajouter » pendant un appel 1:1 connecté ;
 *   - invitation reçue : carte qui sonne (Rejoindre / Refuser) ;
 *   - appel à plusieurs : grille de tuiles (vidéo ou photo), invités qui
 *     sonnent, micro / caméra / ajouter / quitter.
 * La logique (connexions, signalisation) est dans hooks/callRoom.ts.
 */
import { memo, useEffect, useRef, useState } from 'react';

import {
  acceptInvite, declineInvite, inviteToCall, leaveRoom, ROOM_MAX, toggleRoomMute, toggleRoomVideo, useCallRoom,
} from '../hooks/callRoom';
import { cldAvatar } from '../utils/chatUtils';
import { demarrerSonnerie } from '../utils/callTones';
import { apiFetch } from '../../services/apiFetch';
import { getUserIdFromToken } from '../../services/authUtils';
import s from '../styles/CallRoomLayer.module.css';

interface DirectProps {
  connected: boolean;
  active: boolean;
  remoteUserId: string | null;
  remoteName: string;
  remoteAvatar?: string | null;
  remoteStream: MediaStream | null;
  hasRemoteVideo: boolean;
  isMuted: boolean;
  duration: number;
  onToggleMute: () => void;
  onHangUp: () => void;
}

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}
function fmt(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** Tuile : vidéo si présente, sinon photo. `muted` = son déjà joué ailleurs (appel 1:1). */
const MediaTile = memo(function MediaTile({ name, avatar, stream, video, muted, status, mirror }: {
  name: string; avatar?: string | null; stream?: MediaStream | null; video?: boolean; muted?: boolean; status?: string; mirror?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== (stream ?? null)) el.srcObject = stream ?? null;
    if (stream) void el.play().catch(() => undefined);
  }, [stream]);
  const showVideo = !!stream && !!video;
  const pic = cldAvatar(avatar, 160);
  return (
    <div className={s.tile}>
      {/* Toujours monté : il porte aussi le son de la personne. */}
      <video ref={ref} autoPlay playsInline muted={muted} className={`${s.video} ${showVideo ? '' : s.hidden} ${mirror ? s.mirror : ''}`} />
      {!showVideo && (
        <div className={s.noVideo}>
          <div className={s.avatar}>{pic ? <img src={pic} alt="" /> : <span>{initials(name)}</span>}</div>
        </div>
      )}
      <div className={s.caption}>
        <span className={s.name}>{name}</span>
        {status && <span className={s.status}>{status}</span>}
      </div>
    </div>
  );
});

interface Contact { id: string; contactUserId?: string | null; contactName: string; contactLogo?: string | null; contactSubtitle?: string | null }

function AddDialog({ exclude, onClose }: { exclude: string[]; onClose: () => void }) {
  const [list, setList] = useState<Contact[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    apiFetch<{ data: Contact[] }>('/messagerie/conversations', { params: { limit: 30 } })
      .then(r => setList(r.data ?? []))
      .catch(() => setList([]));
  }, []);
  const needle = q.trim().toLowerCase();
  const rows = (list ?? [])
    .filter(c => c.contactUserId && !exclude.includes(c.contactUserId))
    .filter(c => !needle || c.contactName.toLowerCase().includes(needle));

  return (
    <div className={s.dialogBackdrop} onClick={onClose}>
      <div className={s.dialog} role="dialog" aria-label="Ajouter à l’appel" onClick={e => e.stopPropagation()}>
        <div className={s.dialogHead}>
          <strong>Ajouter à l’appel</strong>
          <button className={s.iconBtn} onClick={onClose} aria-label="Fermer"><i className="fas fa-xmark" /></button>
        </div>
        <p className={s.dialogSub}>4 personnes maximum, vous compris.</p>
        <input className={s.search} value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un contact" autoFocus />
        <div className={s.contacts}>
          {list === null && <p className={s.empty}>Chargement…</p>}
          {list !== null && rows.length === 0 && <p className={s.empty}>Aucun contact disponible.</p>}
          {rows.map(c => {
            const pic = cldAvatar(c.contactLogo, 80);
            return (
              <button key={c.id} className={s.contact} onClick={() => { inviteToCall(c.contactUserId!); onClose(); }}>
                <span className={s.contactPic}>{pic ? <img src={pic} alt="" /> : initials(c.contactName)}</span>
                <span className={s.contactText}>
                  <span className={s.contactName}>{c.contactName}</span>
                  {c.contactSubtitle && <span className={s.contactSub}>{c.contactSubtitle}</span>}
                </span>
                <span className={s.contactAdd}><i className="fas fa-phone" /></span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CallRoomLayer({ direct }: { direct: DirectProps }) {
  const room = useCallRoom();
  const myId = getUserIdFromToken() ?? '';
  const [addOpen, setAddOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const pending = room.invited.filter(m => m.userId !== myId && !room.peers.some(p => p.userId === m.userId));
  const group = !!room.roomId && (room.peers.length > 0 || pending.length > 0 || room.joining || !direct.active);
  const inCall = 1 + (direct.active ? 1 : 0) + room.peers.length;
  const canAdd = (direct.connected || room.peers.some(p => p.state === 'connected')) && inCall + pending.length < ROOM_MAX;
  const exclude = [myId, direct.remoteUserId ?? '', ...room.peers.map(p => p.userId), ...pending.map(m => m.userId)];

  /* Sonnerie de l'invitation. */
  useEffect(() => {
    if (!room.incomingInvite) return;
    return demarrerSonnerie('entrante');
  }, [room.incomingInvite]);

  /* Durée quand l'appel 1:1 n'est plus là pour la donner. */
  useEffect(() => {
    if (!group || direct.active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [group, direct.active]);
  const elapsed = room.startedAt ? Math.max(0, Math.floor((now - room.startedAt) / 1000)) : 0;

  const muted = direct.active ? direct.isMuted : room.muted;

  return (
    <>
      {/* ── Invitation reçue ── */}
      {room.incomingInvite && (
        <div className={s.inviteBackdrop}>
          <div className={s.inviteCard} role="alertdialog" aria-label="Invitation à un appel">
            <div className={s.inviteAvatar}>
              {cldAvatar(room.incomingInvite.inviter.avatar, 160)
                ? <img src={cldAvatar(room.incomingInvite.inviter.avatar, 160)!} alt="" />
                : <span>{initials(room.incomingInvite.inviter.name)}</span>}
            </div>
            <strong className={s.inviteName}>{room.incomingInvite.inviter.name}</strong>
            <p className={s.inviteText}>
              vous invite à un appel {room.incomingInvite.callType === 'video' ? 'vidéo' : 'audio'} avec{' '}
              {room.incomingInvite.participants.filter(p => p.userId !== room.incomingInvite!.inviter.userId).map(p => p.name).join(', ') || 'd’autres personnes'}
            </p>
            <div className={s.inviteActions}>
              <button className={`${s.roundBtn} ${s.danger}`} onClick={declineInvite} aria-label="Refuser"><i className="fas fa-phone-slash" /></button>
              <button className={`${s.roundBtn} ${s.success}`} onClick={() => void acceptInvite()} aria-label="Rejoindre"><i className="fas fa-phone" /></button>
            </div>
            <div className={s.inviteLabels}><span>Refuser</span><span>Rejoindre</span></div>
          </div>
        </div>
      )}

      {/* ── Bouton « Ajouter » pendant un appel 1:1 ── */}
      {!group && direct.connected && canAdd && (
        <button className={s.addPill} onClick={() => setAddOpen(true)}>
          <i className="fas fa-user-plus" /> Ajouter une personne
        </button>
      )}

      {/* ── Appel à plusieurs ── */}
      {group && (
        <div className={s.groupOverlay}>
          <header className={s.groupHead}>
            <span className={s.secure}><i className="fas fa-lock" /> Chiffré de bout en bout</span>
            <strong>Appel à {inCall}</strong>
            <span className={s.groupTime}>{room.joining ? 'Connexion…' : fmt(direct.active ? direct.duration : elapsed)}</span>
          </header>

          {room.notice && <div className={s.notice}>{room.notice}</div>}

          <div className={`${s.grid} ${inCall + pending.length > 2 ? s.grid4 : ''}`}>
            {direct.active && (
              <MediaTile name={direct.remoteName} avatar={direct.remoteAvatar} stream={direct.remoteStream} video={direct.hasRemoteVideo} muted />
            )}
            {room.peers.map(p => (
              <MediaTile key={p.userId} name={p.name} avatar={p.avatar} stream={p.stream} video={p.video}
                status={p.state === 'connecting' ? 'Connexion…' : p.state === 'lost' ? 'Connexion perdue' : undefined} />
            ))}
            {pending.map(m => <MediaTile key={`inv-${m.userId}`} name={m.name} avatar={m.avatar} status="Ça sonne…" />)}
          </div>

          {room.videoOn && room.localStream && (
            <div className={s.pip}><MediaTile name="Vous" stream={room.localStream} video muted mirror /></div>
          )}

          <footer className={s.controls}>
            <button className={`${s.ctrl} ${muted ? s.ctrlOn : ''}`} onClick={direct.active ? direct.onToggleMute : toggleRoomMute} aria-label="Micro">
              <i className={`fas ${muted ? 'fa-microphone-slash' : 'fa-microphone'}`} /><span>{muted ? 'Micro coupé' : 'Micro'}</span>
            </button>
            <button className={`${s.ctrl} ${room.videoOn ? s.ctrlOn : ''}`} onClick={() => void toggleRoomVideo()} aria-label="Caméra">
              <i className={`fas ${room.videoOn ? 'fa-video' : 'fa-video-slash'}`} /><span>Caméra</span>
            </button>
            {canAdd && (
              <button className={s.ctrl} onClick={() => setAddOpen(true)} aria-label="Ajouter">
                <i className="fas fa-user-plus" /><span>Ajouter</span>
              </button>
            )}
            <button className={`${s.ctrl} ${s.leave}`} onClick={() => { leaveRoom(); if (direct.active) direct.onHangUp(); }} aria-label="Quitter l’appel">
              <i className="fas fa-phone-slash" /><span>Quitter</span>
            </button>
          </footer>
        </div>
      )}

      {addOpen && <AddDialog exclude={exclude} onClose={() => setAddOpen(false)} />}
    </>
  );
}
