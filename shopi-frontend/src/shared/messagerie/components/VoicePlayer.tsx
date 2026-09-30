/**
 * src/shared/messagerie/components/VoicePlayer.tsx
 * Lecteur audio réel pour les messages vocaux.
 * Gère play/pause, progression, seek, durée et vitesse de lecture
 * (1× → 1,5× → 2× — comme WhatsApp/Telegram, pour écouter plus vite).
 */
import React, { useState, useRef } from 'react';
import s from '../styles/ChatWindow.module.css';
import { fmtDuration } from '../utils/chatUtils';

interface Props {
  url?:      string;   // URL Cloudinary — undefined si message optimiste
  duration?: string;   // durée pré-calculée (fallback si metadata pas dispo)
  isMe:      boolean;  // adapte le style (fond clair vs transparent)
}

/** Cycle des vitesses de lecture — même choix que WhatsApp (1× / 1,5× / 2×). */
const SPEEDS = [1, 1.5, 2] as const;

export default function VoicePlayer({ url, duration, isMe }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);      // 0 – 100
  const [current,  setCurrent]  = useState('0:00');
  const [total,    setTotal]    = useState(duration ?? '0:00');
  const [speed,    setSpeed]    = useState<typeof SPEEDS[number]>(1);

  /* La vitesse se règle en direct sur l'élément <audio> — persiste tant que
   * cette bulle reste montée (un changement de conversation la réinitialise,
   * comme WhatsApp/Telegram qui ne retiennent pas la vitesse entre messages). */
  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  /* Barres waveform générées une fois par instance (pseudo-aléatoire) — un
   * état à initialisation paresseuse plutôt qu'un ref : cette valeur est LUE
   * pendant le rendu (voir bars.map ci-dessous), ce qu'un ref ne garantit pas
   * de façon fiable (React ne re-rend jamais sur un changement de ref, et
   * les règles React 19 interdisent de lire un ref pendant le rendu). */
  const [bars] = useState(() =>
    Array.from({ length: 28 }, () => Math.floor(Math.random() * 18) + 4),
  );

  const toggle = () => {
    if (!audioRef.current || !url) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else         { audioRef.current.play();  setPlaying(true);  }
  };

  const onTimeUpdate = () => {
    const el = audioRef.current;
    if (!el?.duration) return;
    setProgress((el.currentTime / el.duration) * 100);
    setCurrent(fmtDuration(el.currentTime));
  };

  const onLoadedMetadata = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isFinite(el.duration)) setTotal(fmtDuration(el.duration));
    el.playbackRate = speed; // ré-applique la vitesse choisie si l'élément <audio> a été recréé
  };

  const onEnded = () => { setPlaying(false); setProgress(0); setCurrent('0:00'); };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !url) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * el.duration;
  };

  if (!url) {
    /* Placeholder pendant l'upload */
    return (
      <div className={`${s.msgVoice} ${isMe ? s.msgVoiceMe : ''}`}>
        <div className={s.mvBtn}><i className="fas fa-play" style={{ fontSize: 11, marginLeft: 2 }} /></div>
        <div className={s.mvBar}>
          {bars.map((h, i) => <div key={i} className={s.mvTick} style={{ height: h }} />)}
        </div>
        <div className={s.mvDur}>{duration ?? '0:00'}</div>
      </div>
    );
  }

  return (
    <div className={`${s.msgVoice} ${isMe ? s.msgVoiceMe : ''}`}>
      <audio
        ref={audioRef} src={url} preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
      />

      <button className={s.mvBtn} onClick={toggle} title={playing ? 'Pause' : 'Lecture'}>
        <i className={`fas ${playing ? 'fa-pause' : 'fa-play'}`}
           style={{ fontSize: 11, marginLeft: playing ? 0 : 2 }} />
      </button>

      {/* Waveform cliquable = seek */}
      <div className={s.mvBar} onClick={seek} style={{ cursor: 'pointer' }}>
        {bars.map((h, i) => (
          <div
            key={i}
            className={`${s.mvTick} ${(i / bars.length) * 100 <= progress ? s.active : ''}`}
            style={{ height: h }}
          />
        ))}
      </div>

      <div className={s.mvDur}>{playing ? current : total}</div>

      {/* Vitesse de lecture — visible dès qu'on écoute (comme WhatsApp/Telegram),
          ou dès qu'elle a déjà été changée une fois (repère persistant). */}
      {(playing || speed !== 1) && (
        <button className={s.mvSpeed} onClick={cycleSpeed} title="Vitesse de lecture">
          {speed}×
        </button>
      )}
    </div>
  );
}
