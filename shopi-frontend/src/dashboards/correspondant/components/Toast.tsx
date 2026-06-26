// components/Toast.tsx
import React, { useEffect, useState } from 'react';
import s from '../styles/Toast.module.css';

export type ToastType = 's' | 'i' | 'w' | 'e';
export interface ToastMsg { id: number; text: string; type: ToastType; }

const ICONS: Record<ToastType, string> = {
  s: 'fa-circle-check', i: 'fa-circle-info', w: 'fa-triangle-exclamation', e: 'fa-circle-xmark',
};

function ToastItem({ msg, onDone }: { msg: ToastMsg; onDone: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 400); }, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className={`${s.msg} ${visible ? s.show : ''}`}>
      <i className={`fas ${ICONS[msg.type]} ${s[msg.type]}`} style={{ fontSize: 14, flexShrink: 0 }} />
      <span>{msg.text}</span>
    </div>
  );
}

let _set: React.Dispatch<React.SetStateAction<ToastMsg[]>> | null = null;
export const pop = (text: string, type: ToastType = 'i') =>
  _set?.(prev => [...prev, { id: Date.now() + Math.random(), text, type }]);

export default function Toast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  _set = setToasts;
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', pointerEvents: 'none' }}>
      {toasts.map(t => (
        <ToastItem key={t.id} msg={t} onDone={() => setToasts(p => p.filter(x => x.id !== t.id))} />
      ))}
    </div>
  );
}