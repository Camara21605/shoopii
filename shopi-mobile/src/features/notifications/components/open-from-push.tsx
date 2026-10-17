/**
 * Notification touchée sur le téléphone (application fermée ou non) :
 * le serveur ouvre directement l'écran concerné (mission, gains, avis…) avec
 * `?notif=<id>` dans le lien. Ce composant, monté une seule fois dans
 * l'espace de l'application, la marque alors comme LUE — sinon elle restait
 * « non lue » dans la cloche alors que le livreur l'avait déjà ouverte.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useGlobalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useSession } from '@/features/auth/session-store';
import { qk } from '@/lib/query-keys';

import { markNotificationRead } from '../api';

export function OpenFromPush() {
  const { notif } = useGlobalSearchParams<{ notif?: string }>();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const qc = useQueryClient();
  const done = useRef(new Set<string>());

  useEffect(() => {
    const id = typeof notif === 'string' ? notif : null;
    if (!signedIn || !id || done.current.has(id)) return;
    done.current.add(id);
    void markNotificationRead(id)
      .catch(() => undefined)
      .finally(() => {
        void qc.invalidateQueries({ queryKey: qk.notifications.all });
        void qc.invalidateQueries({ queryKey: qk.notifications.unread });
      });
  }, [notif, signedIn, qc]);

  return null;
}
