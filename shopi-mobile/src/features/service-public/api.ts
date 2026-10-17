/**
 * Fiche publique d'une prestation (GET /public/services/:id) — vue client.
 * Le serveur ne renvoie que les prestations publiques d'une boutique active.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().nullable().catch(null);

export const publicServiceSchema = z
  .object({
    id: z.string(),
    nom: z.string(),
    description: z.string().nullable().catch(null),
    pricingType: z.string().catch('fixe'),
    prix: num,
    prixAncien: num,
    dureeMinMinutes: num,
    dureeMaxMinutes: num,
    capaciteMax: num,
    surPlaceEntreprise: z.boolean().catch(false),
    aDomicile: z.boolean().catch(false),
    aDistance: z.boolean().catch(false),
    zoneCouverture: z.string().nullable().catch(null),
    fraisDeplacement: num,
    reservationRequise: z.boolean().catch(false),
    delaiReponse: z.string().catch('24h'),
    politiqueAnnulation: z.string().catch('moderee'),
    garantiePaiement: z.boolean().catch(false),
    garantieSatisfaction: z.boolean().catch(false),
    media: z.array(z.object({ id: z.string(), url: z.string(), ordre: z.coerce.number().catch(0), type: z.string().catch('image') }).passthrough()).catch([]),
    category: z.object({ id: z.string(), nom: z.string(), icone: z.string().nullable().catch(null) }).nullable().catch(null),
    subCategory: z.object({ id: z.string(), nom: z.string() }).nullable().catch(null),
    specs: z.array(z.object({ cle: z.string(), valeur: z.string() }).passthrough()).catch([]),
    companyId: z.string(),
    companyName: z.string().catch(''),
    companyLogo: z.string().nullable().catch(null),
    companyVerified: z.boolean().catch(false),
    companyVille: z.string().nullable().catch(null),
  })
  .passthrough();

export type PublicService = z.infer<typeof publicServiceSchema>;

export const fetchPublicService = (id: string) => apiFetch(`/public/services/${id}`, { schema: publicServiceSchema });

export const DELAY_LABEL: Record<string, string> = { immediate: 'Réponse immédiate', '24h': 'Réponse sous 24 h', '48h': 'Réponse sous 48 h', '7j': 'Réponse sous 7 jours' };
export const POLICY_LABEL: Record<string, string> = {
  flexible: 'Annulation flexible',
  moderee: 'Annulation modérée',
  stricte: 'Annulation stricte',
  non_remboursable: 'Non remboursable',
};
