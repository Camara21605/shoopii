/**
 * Recherche globale de l'espace entreprise — mêmes routes que la Topbar du
 * site, interrogées en parallèle (chaque backend accepte déjà ?search=) :
 *   GET /produits                     → { data: Produit[] }
 *   GET /entreprise/commandes         → Commande[] (sans enveloppe)
 *   GET /dashboard/entreprise/clients → { data: Client[] }
 *   GET /livreurs · /correspondants   → { data: [...] }
 * Une famille indisponible (droit manquant, erreur) n'empêche pas les autres.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const s = z.string().nullable().optional().catch(null);
const num = z.coerce.number().catch(0);

const produit = z.object({ id: z.string(), nom: z.string().catch(''), prix: num, images: z.array(z.object({ url: z.string() }).passthrough()).optional().catch([]) }).passthrough();
const commande = z.object({ uuid: z.string(), id: z.string().catch(''), client: z.string().catch(''), price: num }).passthrough();
const client = z.object({ id: z.string(), fullName: z.string().catch(''), email: s, profilePicture: s }).passthrough();
const livreur = z.object({ id: z.string(), fullName: z.string().catch(''), zone: s, avatarEmoji: s }).passthrough();
const correspondant = z.object({ id: z.string(), fullName: z.string().catch(''), ville: s, avatarEmoji: s }).passthrough();

const wrapped = <T extends z.ZodTypeAny>(item: T) => z.object({ data: z.array(item).catch([]) }).passthrough();

async function safe<T>(p: Promise<T>, empty: T): Promise<{ ok: boolean; value: T }> {
  try {
    return { ok: true, value: await p };
  } catch {
    return { ok: false, value: empty };
  }
}

export type SearchResults = Awaited<ReturnType<typeof searchCompany>>;

export async function searchCompany(search: string, signal?: AbortSignal) {
  const query = { search, limit: 4 };
  const [p, c, cl, l, co] = await Promise.all([
    safe(apiFetch('/produits', { query, signal, schema: wrapped(produit) }).then((r) => r.data), []),
    safe(apiFetch('/entreprise/commandes', { query, signal, schema: z.array(commande).catch([]) }), []),
    safe(apiFetch('/dashboard/entreprise/clients', { query, signal, schema: wrapped(client) }).then((r) => r.data), []),
    safe(apiFetch('/livreurs', { query, signal, schema: wrapped(livreur) }).then((r) => r.data), []),
    safe(apiFetch('/correspondants', { query, signal, schema: wrapped(correspondant) }).then((r) => r.data), []),
  ]);
  const all = [p, c, cl, l, co];
  return {
    produits: p.value.slice(0, 4),
    commandes: c.value.slice(0, 4),
    clients: cl.value.slice(0, 4),
    livreurs: l.value.slice(0, 4),
    correspondants: co.value.slice(0, 4),
    /** true si TOUTES les familles ont échoué (réseau coupé, serveur injoignable). */
    failed: all.every((x) => !x.ok),
  };
}
