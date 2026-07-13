/**
 * src/shared/messagerie/components/GroupCallIncoming.tsx
 *
 * Carte flottante d'appel de groupe entrant.
 * S'affiche dans GroupCallContext au-dessus de toute page (z-index 1400).
 * Vibration mobile identique au P2P.
 */

import { useEffect } from 'react';
import type { GroupCallInvite } from '../data/messagerieTypes';

interface Props {
  invite:    GroupCallInvite;
  onAccept:  () => void;
  onDecline: () => void;
}

export default function GroupCallIncoming({ invite, onAccept, onDecline }: Props) {
  /* Vibration mobile */
  useEffect(() => {
    if (!('vibrate' in navigator)) return;
    const id = setInterval(() => navigator.vibrate([300, 200, 300]), 1500);
    return () => { clearInterval(id); navigator.vibrate(0); };
  }, []);

  const isVideo = invite.callType === 'video';

  return (
    <>
      {/* Fond semi-transparent */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1399,
        background: 'rgba(6,15,30,.5)',
        backdropFilter: 'blur(4px)',
      }} />

      {/* Carte centrée */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1400,
        width: 'min(92vw, 340px)',
        background: 'linear-gradient(160deg, #0d1f3c 0%, #0a1628 100%)',
        borderRadius: 24,
        padding: '32px 24px 24px',
        boxShadow: '0 24px 64px rgba(0,0,0,.6)',
        color: '#fff',
        textAlign: 'center',
        fontFamily: 'inherit',
      }}>

        {/* Icône pulsante */}
        <div style={{ position: 'relative', display: 'inline-flex', marginBottom: 20 }}>
          {/* Anneaux d'animation */}
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              position: 'absolute',
              inset: -(i + 1) * 12,
              borderRadius: '50%',
              border: '2px solid rgba(14,116,144,.4)',
              animation: `gcRing 2s ease-out ${i * 0.6}s infinite`,
            }} />
          ))}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: isVideo ? 'linear-gradient(135deg,#0e7490,#0891b2)' : 'linear-gradient(135deg,#059669,#10b981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, position: 'relative',
          }}>
            <i className={`fas ${isVideo ? 'fa-video' : 'fa-phone'}`} style={{ color: '#fff' }} />
          </div>
        </div>

        {/* Type d'appel */}
        <div style={{
          fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: isVideo ? '#38bdf8' : '#34d399',
          marginBottom: 8,
        }}>
          {isVideo ? 'Appel vidéo de groupe' : 'Appel audio de groupe'}
        </div>

        {/* Initiateur */}
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          {invite.initiatorName}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginBottom: 28 }}>
          vous invite à rejoindre un appel de groupe
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          {/* Refuser */}
          <button
            onClick={onDecline}
            style={{
              flex: 1, maxWidth: 130,
              padding: '14px 0',
              borderRadius: 50, border: 'none', cursor: 'pointer',
              background: 'rgba(239,68,68,.2)',
              color: '#f87171',
              fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background .2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,.35)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,.2)')}
          >
            <i className="fas fa-phone-slash" />
            Refuser
          </button>

          {/* Rejoindre */}
          <button
            onClick={onAccept}
            style={{
              flex: 1, maxWidth: 130,
              padding: '14px 0',
              borderRadius: 50, border: 'none', cursor: 'pointer',
              background: isVideo ? 'linear-gradient(135deg,#0e7490,#0891b2)' : 'linear-gradient(135deg,#059669,#10b981)',
              color: '#fff',
              fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 16px rgba(14,116,144,.4)',
              transition: 'opacity .2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <i className={`fas ${isVideo ? 'fa-video' : 'fa-phone'}`} />
            Rejoindre
          </button>
        </div>
      </div>

      {/* Keyframes animation anneaux */}
      <style>{`
        @keyframes gcRing {
          0%   { transform: scale(.8); opacity: .6; }
          100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </>
  );
}
