/**
 * API du répertoire Shoneya (shopi-backend/src/modules/messagerie/contacts) :
 *   POST   /contacts/sync    { contacts: [{ hash, displayName }], incremental: true }
 *   POST   /contacts/remove  { hashes }        — numéros retirés du téléphone
 *   GET    /contacts/shopi   → { contacts, uploaded } — mes contacts sur Shoneya
 *   DELETE /contacts                          — tout effacer du serveur
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const contactSchema = z.object({
  id: z.string(),
  type: z.enum(['client', 'company', 'delivery', 'correspondent', 'partner']),
  userId: z.string(),
  name: z.string(),
  logo: z.string().nullable().catch(null),
  localName: z.string().nullable().catch(null),
  online: z.boolean().catch(false),
  joinedAt: z.string().nullable().catch(null),
});
export type ShoneyaContact = z.infer<typeof contactSchema>;

const listSchema = z.object({
  contacts: z.array(contactSchema.nullable().catch(null)).transform((l) => l.filter((c): c is ShoneyaContact => c !== null)),
  uploaded: z.number().catch(0),
});
export type ShoneyaContactsList = z.infer<typeof listSchema>;

export function fetchShoneyaContacts(signal?: AbortSignal) {
  return apiFetch('/contacts/shopi', { schema: listSchema, signal });
}

export function uploadContacts(contacts: { hash: string; displayName?: string }[]) {
  return apiFetch('/contacts/sync', {
    method: 'POST',
    body: { contacts, incremental: true },
    schema: z.object({ matched: z.number().catch(0), newMatches: z.number().catch(0) }).passthrough(),
    timeoutMs: 30_000,
  });
}

export function removeContacts(hashes: string[]) {
  return apiFetch('/contacts/remove', { method: 'POST', body: { hashes }, timeoutMs: 30_000 });
}

export function deleteAllContacts() {
  return apiFetch('/contacts', { method: 'DELETE' });
}
