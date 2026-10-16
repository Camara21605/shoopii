/**
 * Monté une fois à la racine (app/_layout.tsx), compte connecté :
 *   - confie au téléphone son jeton de présence (signal « joignable » quand
 *     l'appli est fermée : tâche Android toutes les 15 min avec réseau, et à
 *     chaque push reçu) — renouvelé à chaque ouverture et changement de compte ;
 *   - signale « joignable » au moment où l'appli passe en arrière-plan ;
 *   - écoute l'événement temps réel `presence` (contacts et personnes suivies)
 *     et renvoie la liste suivie après chaque reconnexion du socket ;
 *   - tient à jour le CHIFFRE SUR L'ICÔNE (messages + notifications non lus),
 *     que le serveur met aussi à jour application fermée, à chaque push.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { useSession } from '@/features/auth/session-store';
import { fetchUnreadMessages } from '@/features/catalog/api';
import { fetchUnreadNotifications } from '@/features/notifications/api';
import { qk } from '@/lib/query-keys';
import { connectRealtime } from '@/lib/realtime/socket';

import { nativeCallsAvailable, pingPresence, setBadgeCount, setPresenceCredentials } from '../../../modules/shopi-calls';
import { fetchDeviceCredentials, type PresenceStatus } from './api';
import { ingestRealtime } from './store';
import { flushWatch } from './watch';

type WsPresence = { userId: string; online: boolean; lastSeen?: string | null; status?: PresenceStatus; reachableUntil?: string | null };

export function PresenceProvider() {
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const signedIn = status === 'signedIn';
  const accountKey = user ? `${user.id}:${user.role}` : null;

  /* Jeton de présence du téléphone (compte actif). */
  useEffect(() => {
    if (!signedIn || !accountKey || Platform.OS !== 'android' || !nativeCallsAvailable) return;
    let alive = true;
    fetchDeviceCredentials()
      .then((c) => {
        if (alive && c.url) setPresenceCredentials(c.url, c.token, c.intervalMinutes);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [signedIn, accountKey]);

  /* Appli en arrière-plan : « joignable » tout de suite (le socket va se fermer). */
  useEffect(() => {
    if (!signedIn) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') pingPresence();
    });
    return () => sub.remove();
  }, [signedIn]);

  /* Temps réel : présence des contacts et des personnes suivies. */
  useEffect(() => {
    if (!signedIn) return;
    const socket = connectRealtime();
    const onPresence = (p: WsPresence) => {
      if (p && typeof p.userId === 'string') ingestRealtime(p);
    };
    const onConnect = () => flushWatch();
    socket.on('presence', onPresence);
    socket.on('connect', onConnect);
    return () => {
      socket.off('presence', onPresence);
      socket.off('connect', onConnect);
    };
  }, [signedIn, accountKey]);

  /* Chiffre sur l'icône = messages non lus + notifications non lues (même calcul que le serveur). */
  const messages = useQuery({ queryKey: qk.messages.unread, queryFn: fetchUnreadMessages, enabled: signedIn, refetchInterval: 60_000 });
  const notifications = useQuery({ queryKey: qk.notifications.unread, queryFn: fetchUnreadNotifications, enabled: signedIn, refetchInterval: 60_000 });
  const total = (messages.data ?? 0) + (notifications.data ?? 0);
  const ready = messages.isSuccess && notifications.isSuccess;
  useEffect(() => {
    if (signedIn && ready) setBadgeCount(total);
  }, [signedIn, ready, total]);

  return null;
}
