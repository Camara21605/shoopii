/**
 * Traces d'appel dans une conversation (contentType « call »).
 *
 * Le serveur stocke le détail de l'appel en JSON dans `content`, par exemple
 * {"status":"cancelled","direction":"outgoing","callType":"audio","duration":42}.
 * Il ne doit jamais être affiché tel quel : on le traduit en une ligne lisible,
 * du point de vue de CELUI QUI LIT (l'appelant est l'expéditeur du message).
 */
import type Ionicons from '@expo/vector-icons/Ionicons';

import { Brand } from '@/constants/theme';

export interface CallLogView {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  /** Rouge (appel manqué) : à signaler visuellement. */
  alert: boolean;
}

const GREY = '#8A93A3';

function fmtDuration(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** @param fromMe vrai si c'est moi qui ai passé l'appel (j'en suis l'expéditeur). */
export function describeCallLog(content: string | null | undefined, fromMe: boolean): CallLogView {
  let meta: { status?: string; callType?: string; duration?: number } = {};
  try { meta = JSON.parse(content ?? '{}') ?? {}; } catch { /* trace ancienne ou abîmée */ }

  const video = meta.callType === 'video';
  const kind = video ? 'vidéo' : 'audio';
  const callIcon: CallLogView['icon'] = video ? 'videocam' : 'call';

  switch (meta.status) {
    case 'completed': {
      const dur = meta.duration ? ` · ${fmtDuration(Math.round(meta.duration))}` : '';
      return { label: `Appel ${kind} ${fromMe ? 'sortant' : 'entrant'}${dur}`, icon: callIcon, color: Brand.success, alert: false };
    }
    // L'appelant a raccroché avant ou personne n'a décroché : pour l'appelé, c'est un appel manqué.
    case 'cancelled':
    case 'missed':
      return fromMe
        ? { label: meta.status === 'missed' ? `Appel ${kind} sans réponse` : `Appel ${kind} annulé`, icon: callIcon, color: GREY, alert: false }
        : { label: `Appel ${kind} manqué`, icon: video ? 'videocam-off' : 'call', color: Brand.danger, alert: true };
    case 'rejected':
      return { label: fromMe ? `Appel ${kind} refusé` : `Appel ${kind} refusé par vous`, icon: callIcon, color: GREY, alert: false };
    case 'busy':
      return { label: fromMe ? 'Correspondant occupé' : `Appel ${kind} manqué (vous étiez en ligne)`, icon: callIcon, color: GREY, alert: !fromMe };
    default:
      return { label: `Appel ${kind}`, icon: callIcon, color: GREY, alert: false };
  }
}
