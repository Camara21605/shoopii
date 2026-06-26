/**
 * src/shared/messagerie/components/VoicePlayer.tsx
 * Lecteur audio réel pour les messages vocaux.
 * Gère play/pause, progression, seek et durée.
 */
import React, { useState, useRef } from 'react';
import s from '../styles/ChatWindow.module.css';
import { fmtDuration } from '../utils/chatUtils';

interface Props {
  url?:      string;   // URL Cloudinary — undefined si message optimiste
  duration?: string;   // durée pré-calculée (fallback si metadata pas dispo)
  isMe:      boolean;  // adapte le style (fond clair vs transparent)
}

export default function VoicePlayer({ url, duration, isMe }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);      // 0 – 100
  const [current,  setCurrent]  = useState('0:00');
  const [total,    setTotal]    = useState(duration ?? '0:00');

  /* Barres waveform générées une fois par instance (pseudo-aléatoire) */
  const bars = useRef(
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
    if (el && isFinite(el.duration)) setTotal(fmtDuration(el.duration));
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
          {bars.current.map((h, i) => <div key={i} className={s.mvTick} style={{ height: h }} />)}
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
        {bars.current.map((h, i) => (
          <div
            key={i}
            className={`${s.mvTick} ${(i / bars.current.length) * 100 <= progress ? s.active : ''}`}
            style={{ height: h }}
          />
        ))}
      </div>

      <div className={s.mvDur}>{playing ? current : total}</div>
    </div>
  );
}
