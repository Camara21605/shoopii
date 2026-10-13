/**
 * Espace correspondant (point relais) — mêmes routes que le site
 * (dashboards/correspondant/*) :
 *   GET  /correspondant/parametres               identité (nom, photo, id du point relais, type, dépôt)
 *   GET  /dashboard/correspondant/overview       chiffres, flux, activité, colis urgent, compteurs
 *   GET  /dashboard/correspondant/colis          colis où CE point relais intervient + compteurs par statut
 *   GET  /dashboard/correspondant/boutiques      boutiques avec qui il a traité des colis
 *   GET  /dashboard/correspondant/livreurs       livreurs à qui il a remis des colis
 *   GET  /dashboard/correspondant/clients        clients dont une commande est passée par lui
 *   GET  /dashboard/correspondant/revenus        taux, totaux, commission, transactions, graphes semaine / mois
 *   GET  /dashboard/correspondant/zone           zones actives, communes, couverture
 *   GET  /dashboard/correspondant/evaluation     note moyenne, missions
 *   GET  /dashboard/correspondant/avis  ·  POST …/avis/:id/reponse { reponse }
 *   GET  /commandes/:uuid  ·  POST /commandes/:uuid/valider { role: 'correspondant', code }
 * Statut d'un colis (calculé par le serveur) : att = pas encore réceptionné
 * (code du point relais non validé) · stock = réceptionné, attend le retrait
 * du client · dep = réceptionné puis confié à un livreur · livr = livré ·
 * ret = annulé / remboursé / litige / code expiré.
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);
const str = z.string().nullable().optional().catch(null);

/* ── Identité ── */

const meSchema = z
  .object({
    id: z.string().catch(''),
    firstName: z.string().nullable().catch(''),
    lastName: z.string().nullable().catch(''),
    fullName: str,
    profilePicture: str,
    typeCorrespondant: str,
    zone: str,
    depotVille: str,
  })
  .passthrough()
  .transform((d) => ({ ...d, name: [d.firstName, d.lastName].filter(Boolean).join(' ') || d.fullName || '' }));
export type CorrespondantMe = z.infer<typeof meSchema>;
export const fetchMe = () => apiFetch('/correspondant/parametres', { schema: meSchema });

/* ── Vue d'ensemble ── */

const countsSchema = z.object({ att: num, stock: num, dep: num, ret: num }).catch({ att: 0, stock: 0, dep: 0, ret: 0 });

const colisSchema = z.object({
  id: z.string().catch(''),
  uuid: z.string().catch(''),
  nm: z.string().catch('Colis'),
  boutique: z.string().catch('Boutique'),
  client: z.string().catch('Client'),
  valeur: num,
  date: z.string().catch(''),
  status: z.enum(['att', 'stock', 'dep', 'ret', 'livr']).catch('att'),
  urgent: z.boolean().catch(false),
  livreur: str,
  motif: str,
});
export type Colis = z.infer<typeof colisSchema>;
export type ColisStatus = Colis['status'];

const overviewSchema = z.object({
  zoneNom: z.string().catch(''),
  kpis: z.object({ missionsTotales: num, revenusCeMois: num, tauxSucces: num, partenairesActifs: num }).catch({ missionsTotales: 0, revenusCeMois: 0, tauxSucces: 0, partenairesActifs: 0 }),
  relayFlow: z.object({ sources: num, destinations: num }).catch({ sources: 0, destinations: 0 }),
  activite: z.array(z.object({ msg: z.string().catch(''), highlight: str, t: z.string().catch('') })).catch([]),
  colisUrgent: colisSchema.partial({ uuid: true }).nullable().catch(null),
  colisCounts: countsSchema,
  livresCeMois: num,
  objectifs: z.object({ missionsCeMois: num, revenusCeMois: num, tauxSucces: num }).catch({ missionsCeMois: 0, revenusCeMois: 0, tauxSucces: 0 }),
});
export type Overview = z.infer<typeof overviewSchema>;
export const fetchOverview = () => apiFetch('/dashboard/correspondant/overview', { schema: overviewSchema });

/* ── Colis ── */

const colisListSchema = z.object({
  items: z.array(colisSchema).catch([]),
  counts: z.object({ all: num, att: num, stock: num, dep: num, ret: num, livr: num }).catch({ all: 0, att: 0, stock: 0, dep: 0, ret: 0, livr: 0 }),
});
export type ColisList = z.infer<typeof colisListSchema>;
export const fetchColis = () => apiFetch('/dashboard/correspondant/colis', { schema: colisListSchema });

/** Valide SON étape (réception du colis au point relais) avec SON code. */
export const validateCorrespondantStep = (uuid: string, code: string) => apiFetch(`/commandes/${uuid}/valider`, { method: 'POST', body: { role: 'correspondant', code: code.trim().toUpperCase() } });

/* ── Relations ── */

const boutiquesSchema = z.object({
  items: z
    .array(
      z.object({ id: z.string().catch(''), nm: z.string().catch('Boutique'), em: z.string().catch('🏪'), cat: z.string().catch(''), rat: num, colis: num, pending: num, since: z.string().catch('') }),
    )
    .catch([]),
  stats: z.object({ total: num, colisActifs: num, enAttente: num, noteMoyenne: num }).catch({ total: 0, colisActifs: 0, enAttente: 0, noteMoyenne: 0 }),
});
export type Boutiques = z.infer<typeof boutiquesSchema>;
export const fetchBoutiques = () => apiFetch('/dashboard/correspondant/boutiques', { schema: boutiquesSchema });

const livreursSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().catch(''),
        nm: z.string().catch('Livreur'),
        em: z.string().catch('🛵'),
        zone: z.string().catch(''),
        rat: num,
        missions: num,
        online: z.boolean().catch(false),
        pending: num,
      }),
    )
    .catch([]),
  stats: z.object({ total: num, enLigne: num, missionsCeMois: num }).catch({ total: 0, enLigne: 0, missionsCeMois: 0 }),
});
export type Livreurs = z.infer<typeof livreursSchema>;
export const fetchLivreurs = () => apiFetch('/dashboard/correspondant/livreurs', { schema: livreursSchema });

const clientsSchema = z
  .array(
    z.object({
      id: z.string().catch(''),
      nm: z.string().catch('Client'),
      tel: z.string().catch(''),
      colis: num,
      dernier: z.string().catch(''),
      val: num,
      status: z.enum(['att', 'retour', 'ok']).catch('ok'),
    }),
  )
  .catch([]);
export type Client = z.infer<typeof clientsSchema>[number];
export const fetchClients = () => apiFetch('/dashboard/correspondant/clients', { schema: clientsSchema });

/* ── Finances ── */

const point = z.object({ j: z.string().catch(''), v: num, today: z.boolean().optional().catch(false) });
const revenusSchema = z.object({
  tauxCommission: num,
  totalRevenus: num,
  revenusThisMonth: num,
  commissionThisMonth: num,
  transactions: z.array(z.object({ id: z.string(), source: z.string().catch('Relais colis'), montant: num, date: z.string().catch(''), statut: z.string().catch('') })).catch([]),
  chartWeek: z.array(point).catch([]),
  chartMonth: z.array(point).catch([]),
});
export type Revenus = z.infer<typeof revenusSchema>;
export const fetchRevenus = () => apiFetch('/dashboard/correspondant/revenus', { schema: revenusSchema });

/* ── Zone ── */

const zoneSchema = z.object({
  typeCorrespondant: z.string().catch(''),
  zonesActives: z.array(z.string()).catch([]),
  /* succes / tauxCouverture : texte du serveur (« 85% », « — » s'il n'y a encore aucun colis terminé) */
  communes: z.array(z.object({ commune: z.string().catch(''), colis: num, livreurs: num, succes: z.coerce.string().catch('—') })).catch([]),
  stats: z.object({ communesCouvertes: num, livreursActifs: num, tauxCouverture: z.coerce.string().catch('—') }).catch({ communesCouvertes: 0, livreursActifs: 0, tauxCouverture: '—' }),
});
export type Zone = z.infer<typeof zoneSchema>;
export const fetchZone = () => apiFetch('/dashboard/correspondant/zone', { schema: zoneSchema });

/* ── Évaluation ── */

export const fetchEvaluation = () => apiFetch('/dashboard/correspondant/evaluation', { schema: z.object({ averageRating: num, totalMissions: num }) });

const avisSchema = z.object({
  avis: z
    .array(
      z
        .object({
          id: z.string(),
          clientNom: z.string().catch('Client'),
          clientInitiales: str,
          commandeRef: z.string().catch(''),
          note: num,
          commentaire: z
            .string()
            .nullable()
            .catch('')
            .transform((v) => v ?? ''),
          date: z.string().catch(''),
          reponse: str,
          commandeId: str,
        })
        .passthrough(),
    )
    .catch([]),
  stats: z
    .object({ moyenne: num, total: num, distribution: z.record(z.string(), z.coerce.number()).catch({}), tauxReponse: z.coerce.number().optional().catch(undefined) })
    .catch({ moyenne: 0, total: 0, distribution: {}, tauxReponse: undefined }),
});
export type AvisData = z.infer<typeof avisSchema>;
export type Avis = AvisData['avis'][number];
export const fetchAvis = () => apiFetch('/dashboard/correspondant/avis', { schema: avisSchema });
export const replyAvis = (id: string, reponse: string) => apiFetch(`/dashboard/correspondant/avis/${id}/reponse`, { method: 'POST', body: { reponse } });

/* ── Affichage ── */

export const gnf = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} GNF`;
export function short(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}
export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '🏢';

export type Tone = { label: string; color: string; bg: string };
export const COLIS_STATUS: Record<ColisStatus, Tone> = {
  att: { label: 'À réceptionner', color: '#B45309', bg: '#FEF3E2' },
  stock: { label: 'En stock', color: '#1D4ED8', bg: '#E8EFFD' },
  dep: { label: 'Confié au livreur', color: '#6D28D9', bg: '#F1EBFD' },
  livr: { label: 'Livré', color: '#0F7B45', bg: '#E7F6EE' },
  ret: { label: 'Retour', color: '#B42318', bg: '#FDECEC' },
};
export const CLIENT_STATUS: Record<Client['status'], Tone> = {
  att: { label: 'Colis en cours', color: '#B45309', bg: '#FEF3E2' },
  retour: { label: 'Retour', color: '#B42318', bg: '#FDECEC' },
  ok: { label: 'Livré', color: '#0F7B45', bg: '#E7F6EE' },
};
export const REVENUE_STATUS: Record<string, { label: string; color: string }> = {
  released: { label: 'Versé', color: '#0F7B45' },
  escrow: { label: 'En attente de livraison', color: '#B45309' },
  cancelled: { label: 'Annulé', color: '#B42318' },
  refunded: { label: 'Remboursé', color: '#4B5563' },
};
export const RELAY_TYPE: Record<string, string> = { regional: 'Régional', zonal: 'Zonal', national: 'National', international: 'International' };
