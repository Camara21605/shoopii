/* ============================================================
 * FICHIER : src/shared/presence/PresenceUI.tsx
 *
 * Affichage des trois états, partout pareil :
 *   🟢 En ligne · 🟠 Joignable (application fermée, internet actif) ·
 *   ⚪ Hors ligne · vu il y a …
 *   PresenceDot        point (photo, liste)
 *   presenceLabel()    texte d'état
 *   PresenceChip       pastille d'un profil public ; clic = légende
 *   ActorPresenceChip  pastille du propriétaire d'un profil (vérification à l'ouverture)
 * ============================================================ */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PRESENCE_COLOR, presenceLabel } from './presenceFormat';
import type { PresenceStatus } from './presenceStore';
import { useActorPresence, type ActorKind } from './usePresence';
import s from './PresenceUI.module.css';

export function PresenceDot({ status, size = 10, showOffline = false, className }: { status: PresenceStatus; size?: number; showOffline?: boolean; className?: string }) {
  const { t } = useTranslation();
  if (status === 'offline' && !showOffline) return null;
  const title = t(`messagerie.presence.${status === 'online' ? 'enLigne' : status === 'reachable' ? 'joignable' : 'horsLigne'}`);
  return (
    <span
      className={`${s.dot} ${className ?? ''}`}
      style={{ width: size, height: size, background: PRESENCE_COLOR[status] }}
      title={title}
      aria-label={title}
      role="img"
    />
  );
}

export function PresenceLegend({ current, onClose }: { current?: PresenceStatus; onClose: () => void }) {
  const { t } = useTranslation();
  const rows: { s: PresenceStatus; title: string; help: string }[] = [
    { s: 'online', title: t('messagerie.presence.enLigne'), help: t('messagerie.presence.enLigneAide') },
    { s: 'reachable', title: t('messagerie.presence.joignable'), help: t('messagerie.presence.joignableAide') },
    { s: 'offline', title: t('messagerie.presence.horsLigne'), help: t('messagerie.presence.horsLigneAide') },
  ];
  return (
    <div className={s.backdrop} onClick={onClose} role="presentation">
      <div className={s.sheet} role="dialog" aria-modal="true" aria-label={t('messagerie.presence.legendeTitre')} onClick={e => e.stopPropagation()}>
        <div className={s.sheetHead}>
          <strong>{t('messagerie.presence.legendeTitre')}</strong>
          <button type="button" className={s.close} onClick={onClose} aria-label={t('messagerie.presence.fermer')}>×</button>
        </div>
        {rows.map(r => (
          <div key={r.s} className={`${s.row} ${current === r.s ? s.rowOn : ''}`}>
            <PresenceDot status={r.s} size={12} showOffline />
            <div>
              <div className={s.rowTitle} style={{ color: r.s === 'offline' ? undefined : PRESENCE_COLOR[r.s] }}>{r.title}</div>
              <div className={s.rowHelp}>{r.help}</div>
            </div>
          </div>
        ))}
        <p className={s.note}>{t('messagerie.presence.note')}</p>
      </div>
    </div>
  );
}

export function PresenceChip({ status, lastSeen, checking }: { status: PresenceStatus; lastSeen: string | null; checking?: boolean }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const color = PRESENCE_COLOR[status];
  return (
    <>
      <button
        type="button"
        className={`${s.chip} ${status === 'online' ? s.pulse : ''}`}
        style={{ borderColor: `${color}66`, background: `${color}14`, color: status === 'offline' ? 'var(--t3, #737373)' : color }}
        onClick={() => setOpen(true)}
        title={t('messagerie.presence.legendeTitre')}
      >
        <PresenceDot status={status} size={9} showOffline />
        <span>{presenceLabel(status, lastSeen, t, i18n.language)}</span>
        {checking ? <i className={`fas fa-circle-notch fa-spin ${s.spin}`} aria-label={t('messagerie.presence.verification')} /> : <i className="far fa-circle-question" aria-hidden />}
      </button>
      {open ? <PresenceLegend current={status} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function ActorPresenceChip({ type, id, hidden }: { type: ActorKind; id: string | null | undefined; hidden?: boolean }) {
  const p = useActorPresence(hidden ? null : type, hidden ? null : id);
  if (hidden || (!p.known && !p.checking)) return null;
  return <PresenceChip status={p.status} lastSeen={p.lastSeen} checking={p.checking} />;
}
