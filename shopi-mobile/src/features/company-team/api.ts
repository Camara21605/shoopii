/**
 * Gestion de l'équipe (espace entreprise) — mêmes routes que le site
 * (dashboards/entreprise/pages/EquipePage.tsx) :
 *   GET    /company-team/stats                        compteurs + limite du plan
 *   GET    /company-team/plan                         plan actif (nom, maxMembers)
 *   GET    /company-team/members?page&limit&search    membres (paginé)
 *   GET    /company-team/members/:id                  un membre (permissions à jour)
 *   POST   /company-team/members                      création directe → MDP temporaire   [propriétaire]
 *   POST   /company-team/members/:id/suspend          { reason? }                         [propriétaire]
 *   POST   /company-team/members/:id/reactivate                                           [propriétaire]
 *   POST   /company-team/members/:id/reset-password   → MDP temporaire                    [propriétaire]
 *   DELETE /company-team/members/:id                  révoque l'accès                     [propriétaire]
 *   PATCH  /company-team/members/:id/permissions      { permissions: { groupe: { action } } } (fusion) [propriétaire]
 *   GET    /company-team/members/:id/activity?limit   journal d'activité
 *   GET    /company-team/invitations                  invitations en attente              [propriétaire]
 *   POST   /company-team/invitations                  → lien /login?collabToken=…         [propriétaire]
 *   POST   /company-team/invitations/:id/resend                                           [propriétaire]
 *   DELETE /company-team/invitations/:id                                                  [propriétaire]
 *   GET    /company-team/permission-templates         modèles (système + boutique)
 *   POST   /company-team/permission-templates/:id/apply/:memberId  remplace les permissions [propriétaire]
 *
 * [propriétaire] = TeamOwnerGuard : un collaborateur (même avec team.view)
 * reçoit 403 ; l'écran ne lui propose donc pas ces actions.
 *
 * Plan illimité (Enterprise) : le serveur calcule Infinity, que JSON transmet
 * en `null` → maxAllowed / remainingSlots = null signifie « illimité ».
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const str = z.string().nullable().optional().catch(null);
const permsSchema = z.record(z.string(), z.record(z.string(), z.boolean())).nullable().optional().catch(null);
export type Permissions = Record<string, Record<string, boolean>>;

/* ── Statistiques & plan ── */

const statsSchema = z
  .object({
    activeCount: z.coerce.number().catch(0),
    suspendedCount: z.coerce.number().catch(0),
    totalCount: z.coerce.number().catch(0),
    maxAllowed: z.number().nullable().catch(null),
    canAddMore: z.boolean().catch(false),
    remainingSlots: z.number().nullable().catch(null),
  })
  .passthrough();
export type TeamStats = z.infer<typeof statsSchema>;
export const fetchStats = () => apiFetch('/company-team/stats', { schema: statsSchema });

const planSchema = z.object({ plan: z.string().catch(''), name: z.string().catch('Standard'), maxMembers: z.number().nullable().catch(null) }).passthrough();
export type PlanInfo = z.infer<typeof planSchema>;
export const fetchPlan = () => apiFetch('/company-team/plan', { schema: planSchema });

/* ── Membres ── */

export type MemberStatus = 'active' | 'suspended' | 'pending' | 'revoked';

const memberSchema = z
  .object({
    id: z.string(),
    userId: z.string().catch(''),
    status: z.enum(['active', 'suspended', 'pending', 'revoked']).catch('revoked'),
    firstName: z.string().nullable().catch('').transform((v) => v ?? ''),
    lastName: z.string().nullable().catch('').transform((v) => v ?? ''),
    email: z.string().nullable().catch('').transform((v) => v ?? ''),
    phone: str,
    jobTitle: str,
    internalRole: str,
    lastLoginAt: str,
    mustChangePassword: z.boolean().catch(false),
    suspensionReason: str,
    createdAt: z.string().catch(''),
    permissions: permsSchema,
    profilePicture: str,
  })
  .passthrough();
export type TeamMember = z.infer<typeof memberSchema>;

export const PAGE_SIZE = 20;
const pageSchema = z.object({
  items: z.array(memberSchema).catch([]),
  total: z.coerce.number().catch(0),
  page: z.coerce.number().catch(1),
  totalPages: z.coerce.number().catch(1),
});
export type MembersPage = z.infer<typeof pageSchema>;

export const fetchMembers = (page: number, search: string) =>
  apiFetch('/company-team/members', { query: { page, limit: PAGE_SIZE, ...(search ? { search } : {}) }, schema: pageSchema });

export const fetchMember = (id: string) => apiFetch(`/company-team/members/${id}`, { schema: memberSchema });

export type NewMember = { firstName: string; lastName: string; email: string; phone?: string; jobTitle?: string; internalRole?: string };

/** Création directe. `templateId` n'existe pas dans CreateTeamMemberDto (le serveur
 *  refuse les champs inconnus) : le modèle choisi est appliqué juste après. */
export async function createMember(body: NewMember, templateId?: string) {
  const res = await apiFetch('/company-team/members', {
    method: 'POST',
    body,
    schema: z.object({ member: memberSchema.partial().passthrough().catch({}), temporaryPassword: z.string() }).passthrough(),
  });
  let templateError: unknown = null;
  const memberId = (res.member as { id?: string }).id;
  if (templateId && memberId) await applyTemplate(templateId, memberId).catch((e: unknown) => (templateError = e));
  return { temporaryPassword: res.temporaryPassword, templateError };
}

export const suspendMember = (id: string, reason?: string) =>
  apiFetch(`/company-team/members/${id}/suspend`, { method: 'POST', body: reason ? { reason } : {} });
export const reactivateMember = (id: string) => apiFetch(`/company-team/members/${id}/reactivate`, { method: 'POST' });
export const deleteMember = (id: string) => apiFetch(`/company-team/members/${id}`, { method: 'DELETE' });
export const resetPassword = (id: string) =>
  apiFetch(`/company-team/members/${id}/reset-password`, { method: 'POST', schema: z.object({ temporaryPassword: z.string() }).passthrough() });

/** N'envoie que les cases modifiées (fusion côté serveur), comme le site :
 *  une case, ou tout un groupe en une seule requête (« Tout autoriser »). */
export const setPermissions = (id: string, group: string, actions: Record<string, boolean>) =>
  apiFetch(`/company-team/members/${id}/permissions`, { method: 'PATCH', body: { permissions: { [group]: actions } } });

/* ── Journal d'activité ── */

const activitySchema = z.object({
  items: z
    .array(z.object({ id: z.string(), action: z.string().catch(''), description: str, createdAt: z.string().catch('') }).passthrough())
    .catch([]),
});
export type ActivityEntry = z.infer<typeof activitySchema>['items'][number];
export const fetchActivity = (id: string) =>
  apiFetch(`/company-team/members/${id}/activity`, { query: { limit: 30 }, schema: activitySchema }).then((r) => r.items);

const ACTIVITY_LABELS: Record<string, string> = {
  'team.member.created': 'Compte créé',
  'team.member.updated': 'Profil modifié',
  'team.member.suspended': 'Accès suspendu',
  'team.member.reactivated': 'Accès réactivé',
  'team.member.deleted': 'Accès révoqué',
  'team.permission.updated': 'Permissions modifiées',
  'team.member.logged_in': 'Connexion',
  'team.member.logged_out': 'Déconnexion',
  'team.password.reset': 'Mot de passe réinitialisé',
  'invitation.created': 'Invitation créée',
  'invitation.cancelled': 'Invitation annulée',
};
export const activityLabel = (action: string) => ACTIVITY_LABELS[action] ?? action;

/* ── Invitations ── */

const invitationSchema = z
  .object({
    id: z.string(),
    email: z.string().catch(''),
    firstName: str,
    lastName: str,
    jobTitle: str,
    status: z.string().catch('pending'),
    expiresAt: z.string().catch(''),
    createdAt: z.string().catch(''),
  })
  .passthrough();
export type Invitation = z.infer<typeof invitationSchema>;
export const fetchInvitations = () => apiFetch('/company-team/invitations', { schema: z.array(invitationSchema).catch([]) });

/** Le serveur renvoie un lien relatif (/login?collabToken=…) : à préfixer par l'adresse du site. */
export const createInvitation = (body: Omit<NewMember, 'phone'> & { templateId?: string }) =>
  apiFetch('/company-team/invitations', { method: 'POST', body, schema: z.object({ invitationLink: z.string() }).passthrough() });
export const resendInvitation = (id: string) => apiFetch(`/company-team/invitations/${id}/resend`, { method: 'POST' });
export const cancelInvitation = (id: string) => apiFetch(`/company-team/invitations/${id}`, { method: 'DELETE' });

/* ── Modèles de permissions ── */

const templateSchema = z
  .object({ id: z.string(), name: z.string().catch('Modèle'), description: str, isSystem: z.boolean().catch(false), permissions: permsSchema })
  .passthrough();
export type PermissionTemplate = z.infer<typeof templateSchema>;
export const fetchTemplates = () => apiFetch('/company-team/permission-templates', { schema: z.array(templateSchema).catch([]) });
export const applyTemplate = (templateId: string, memberId: string) =>
  apiFetch(`/company-team/permission-templates/${templateId}/apply/${memberId}`, { method: 'POST' });

/* ── Libellés (mêmes textes que le site, locales/fr/entreprise/equipe.json) ── */

export const STATUS: Record<MemberStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'Actif', color: '#0F7B45', bg: '#E7F6EE' },
  suspended: { label: 'Suspendu', color: '#B45309', bg: '#FEF3E2' },
  pending: { label: 'En attente', color: '#6B6B6B', bg: '#F2F2F2' },
  revoked: { label: 'Révoqué', color: '#B42318', bg: '#FDECEC' },
};

export const ROLES = [
  { value: 'manager', label: 'Manager' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'order_manager', label: 'Gestionnaire des commandes' },
  { value: 'logistics_manager', label: 'Responsable logistique' },
  { value: 'customer_service', label: 'Service client' },
  { value: 'accountant', label: 'Comptable' },
] as const;
export const roleLabel = (v?: string | null) => (v ? (ROLES.find((r) => r.value === v)?.label ?? v) : null);

type IconName = 'pricetag-outline' | 'construct-outline' | 'cube-outline' | 'bicycle-outline' | 'cash-outline' | 'chatbubble-ellipses-outline' | 'trending-up-outline' | 'settings-outline' | 'return-down-back-outline' | 'wallet-outline' | 'business-outline' | 'storefront-outline';
export type PermGroup = { key: string; label: string; icon: IconName; actions: { key: string; label: string }[] };

/** Groupe « Produits » OU « Services » selon le modèle de la boutique (jamais les deux),
 *  « Fournisseurs » seulement pour les produits — même règle que le site. */
export function permissionGroups(businessModel: string): PermGroup[] {
  const services = businessModel === 'services';
  const crud = [
    { key: 'view', label: 'Voir' },
    { key: 'create', label: 'Créer' },
    { key: 'edit', label: 'Modifier' },
    { key: 'delete', label: 'Supprimer' },
  ];
  return [
    services ? { key: 'services', label: 'Services', icon: 'construct-outline', actions: crud } : { key: 'products', label: 'Produits', icon: 'pricetag-outline', actions: crud },
    { key: 'orders', label: 'Commandes', icon: 'cube-outline', actions: [{ key: 'view', label: 'Voir' }, { key: 'validate', label: 'Valider' }, { key: 'cancel', label: 'Annuler' }, { key: 'edit', label: 'Modifier' }] },
    { key: 'deliveries', label: 'Livraisons', icon: 'bicycle-outline', actions: [{ key: 'view', label: 'Voir' }, { key: 'assign', label: 'Affecter' }, { key: 'edit', label: 'Modifier' }] },
    { key: 'payments', label: 'Paiements', icon: 'cash-outline', actions: [{ key: 'view', label: 'Voir' }, { key: 'viewTransactions', label: 'Transactions' }, { key: 'manageRefunds', label: 'Remboursements' }] },
    { key: 'messaging', label: 'Messagerie', icon: 'chatbubble-ellipses-outline', actions: [{ key: 'read', label: 'Lire' }, { key: 'send', label: 'Envoyer' }] },
    { key: 'statistics', label: 'Statistiques', icon: 'trending-up-outline', actions: [{ key: 'view', label: 'Voir' }] },
    { key: 'settings', label: 'Paramètres', icon: 'settings-outline', actions: [{ key: 'view', label: 'Voir' }, { key: 'edit', label: 'Modifier' }] },
    { key: 'returns', label: 'Retours & SAV', icon: 'return-down-back-outline', actions: [{ key: 'view', label: 'Voir' }, { key: 'process', label: 'Traiter' }] },
    { key: 'wallet', label: 'Portefeuille', icon: 'wallet-outline', actions: [{ key: 'view', label: 'Voir' }, { key: 'withdraw', label: 'Retrait' }] },
    ...(services
      ? []
      : [{ key: 'fournisseurs', label: 'Fournisseurs', icon: 'business-outline' as const, actions: [{ key: 'view', label: 'Voir' }, { key: 'connect', label: 'Se connecter' }, { key: 'disconnect', label: 'Se déconnecter' }] }]),
    { key: 'boutique', label: 'Ma boutique', icon: 'storefront-outline', actions: [{ key: 'view', label: 'Voir' }, { key: 'edit', label: 'Modifier' }] },
  ];
}

/** Nombre d'autorisations accordées (résumé affiché sur la fiche membre). */
export function countGranted(perms: Permissions | null | undefined, groups: PermGroup[]) {
  let on = 0;
  let total = 0;
  for (const g of groups)
    for (const a of g.actions) {
      total++;
      if (perms?.[g.key]?.[a.key]) on++;
    }
  return { on, total };
}

export const fullName = (m: { firstName?: string | null; lastName?: string | null; email?: string | null }) =>
  `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email || '—';
export const initials = (m: { firstName?: string | null; lastName?: string | null; email?: string | null }) =>
  (`${m.firstName?.[0] ?? ''}${m.lastName?.[0] ?? ''}` || m.email?.[0] || '?').toUpperCase();

export function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** « il y a 3 h », « hier », sinon la date — pour la dernière connexion. */
export function lastSeen(iso?: string | null) {
  if (!iso) return 'Jamais connecté';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (Number.isNaN(diff)) return '—';
  if (diff < 60_000) return 'À l’instant';
  if (diff < 3_600_000) return `Il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `Il y a ${Math.floor(diff / 3_600_000)} h`;
  if (diff < 2 * 86_400_000) return 'Hier';
  return formatDate(iso);
}

export const isEmail = (v: string) => /\S+@\S+\.\S+/.test(v);
