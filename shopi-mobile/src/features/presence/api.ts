/**
 * Présence à trois états — mêmes routes que le site :
 *   GET  /presence/device-credentials           jeton confié au téléphone (signal « joignable »)
 *   POST /presence/probe { userIds }            état + vérification silencieuse (connecté)
 *   GET  /presence/users?ids=a,b                état (visiteur)
 *   GET  /presence/actor/:type/:id              état du propriétaire d'un profil public
 * Temps réel : événement socket `presence`, et 'presence:watch' pour suivre
 * des personnes qui ne sont pas des contacts.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

/** online = dans l'appli · reachable = appli fermée, internet actif · offline = pas de réseau */
export type PresenceStatus = 'online' | 'reachable' | 'offline';

const viewSchema = z.object({
  status: z.enum(['online', 'reachable', 'offline']).catch('offline'),
  lastSeen: z.string().nullable().optional().catch(null),
  reachableUntil: z.string().nullable().optional().catch(null),
  checking: z.boolean().optional().catch(false),
});
export type PresenceView = z.infer<typeof viewSchema>;

export const fetchDeviceCredentials = () =>
  apiFetch('/presence/device-credentials', {
    schema: z.object({ token: z.string(), url: z.string().nullable(), intervalMinutes: z.coerce.number().catch(15) }),
  });

export const probePresence = (userIds: string[]) =>
  apiFetch('/presence/probe', { method: 'POST', body: { userIds }, schema: z.record(z.string(), viewSchema) });

export const fetchPresence = (ids: string[]) =>
  apiFetch('/presence/users', { auth: false, query: { ids: ids.join(',') }, schema: z.record(z.string(), viewSchema) });

export type ActorKind = 'client' | 'company' | 'delivery' | 'correspondent' | 'partner';
export const fetchActorPresence = (type: ActorKind, id: string) =>
  apiFetch(`/presence/actor/${type}/${id}`, { schema: viewSchema.extend({ userId: z.string() }) });
