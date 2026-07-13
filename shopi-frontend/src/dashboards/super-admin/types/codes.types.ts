// ─────────────────────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/types/codes.types.ts
//
// AJOUTS :
//   - UserRole      (réexporté depuis auth/types)
//   - UserStatus    → 'active' | 'blocked' | 'pending' | 'suspended'
//   - SectionId     → toutes les sections du dashboard
//   - User          → type de l'utilisateur dans le store
//   - SuperAdminState → état complet du hook useSuperAdminState
// ─────────────────────────────────────────────────────────────────────────────

export type { UserRole } from '../../../modules/auth/types';

/* ── Statuts utilisateur ──────────────────────────────────────────────────── */
export type UserStatus = 'active' | 'blocked' | 'pending' | 'suspended';

/* ── Sections du dashboard super-admin ───────────────────────────────────── */
export type SectionId =
  | 'overview'
  | 'users'
  | 'codes'
  | 'analytics'
  | 'finances'
  | 'portefeuille'
  | 'messages'
  | 'alerts'
  | 'admins'
  | 'audit'
  | 'health'
  // sections utilisées dans Sidebar + SuperAdminApp
  | 'invitations'
  | 'messaging'
  | 'system'
  | 'settings'
  | 'permissions'
  | 'notifications-admin'
  /* Phase 5 — Intégration Support */
  | 'support'
  /* Phase 6 — Gestion du Centre d'aide (articles, catégories, FAQ) */
  | 'help-center'
  /* Phase 7 — Référentiel Géographique (pays/régions/préfectures/communes/quartiers/zones) */
  | 'geo-referentiel'
  /* Phase 8 — Centre de Gestion des Commissions (entreprises, partenaires, livreurs, plateforme) */
  | 'commissions'
  /* Profil personnel du super-admin connecté */
  | 'profil';

/* ── Utilisateur affiché dans le store (correspond à UserListItem API) ─────── */
export interface User {
  id:       string;
  name:     string;
  email:    string;
  role:     string;
  status:   string;
  country:  string;
  phone:    string;
  date:     string;
  verified: boolean;
}

/* ── Signalements (alertes de modération) ─────────────────────────────────── */
export interface Alert {
  id:       string;
  type:     'critical' | 'warning' | 'info';
  icon:     string;
  title:    string;
  sub:      string;
  time:     string;
  resolved: boolean;
}

/* ── Journal d'audit ──────────────────────────────────────────────────────── */
export interface AuditEntry {
  id?:         string;
  icon:        string;
  user:        string;
  email?:      string | null;
  action:      string;
  time:        string;
  createdAt?:  string;        // ISO 8601 — disponible depuis la v2 du backend
  targetType?: string | null;
  targetId?:   string | null;
}

/* ── Administrateurs secondaires & permissions ───────────────────────────── */
export interface Admin {
  name:        string;
  email:       string;
  perms:       Record<string, boolean>;
  paysAssigne: string | null;
}

/* ── Santé des services (mock — non branché sur une API réelle) ────────────── */
export interface HealthService {
  name:   string;
  val:    number;
  unit:   string;
  color:  string;
  status: string;
}

/* ── Messagerie (mock — non branchée sur une API réelle) ────────────────────── */
export interface Conversation {
  id:     number;
  userId: number;
  unread: number;
  messages: { from: 'user' | 'admin'; text: string; time: string }[];
}

/* ── État global du hook useSuperAdminState ──────────────────────────────── */
export interface SuperAdminState {
  section:          SectionId;
  roleFilter:       string;
  statusFilter:     string;
  countryFilter:    string;
  search:           string;
  page:             number;
  perPage:          number;
  codeQty:          number;
  codeFilter:       string;
  codeStatusFilter: string;
  codeRoleFilter:   string;
  activeConvId:     number | null;
  convSearch:       string;
  currentUser:      User | null;
  theme:            'dark' | 'light';
}

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES CODES D'INVITATION (existants — non modifiés)
═══════════════════════════════════════════════════════════════════════════ */

export type InvitableRole =
  | 'admin'
  | 'company'
  | 'deliverer'
  | 'partner'
  | 'correspondent';

export type CodeStatus = 'valid' | 'used' | 'expired' | 'revoked';

export interface InvitationCode {
  id:          string;
  value:       string;
  role:        string;
  roleLabel:   string;
  status:      CodeStatus;
  targetEmail: string | null;
  created:     string;
  expires:     string;
  uses:        number;
  maxUses:     number;
  note:        string | null;
  emailSent:   boolean;
  usedBy?:     string;
  usedAt?:     string;
}

export interface CodeStatsPerRole {
  role:         string;
  roleLabel:    string;
  total:        number;
  valid:        number;
  used:         number;
  expired:      number;
  revoked:      number;
  totalUses:    number;
  totalMaxUses: number;
  available:    number;
  recentUsers:  { name: string; date: string }[];
}

export interface PaginatedCodes {
  data:  InvitationCode[];
  total: number;
  page:  number;
  pages: number;
}

export interface GenerateAndSendCodePayload {
  targetEmail:   string;
  targetRole:    InvitableRole;
  validityDays?: number;
  maxUses?:      number;
  note?:         string;
}

export interface GenerateBulkCodesPayload {
  targetRole:   InvitableRole;
  quantity:     number;
  validityDays: number;
  maxUses:      number;
  note?:        string;
}

export interface FilterCodesParams {
  targetRole?: InvitableRole;
  status?:     CodeStatus;
  search?:     string;
  page?:       number;
  limit?:      number;
}

export interface ValidateCodePayload {
  code: string;
  role: string;
}

export interface ValidateCodeResult {
  valid:      true;
  targetRole: string;
  codeId:     string;
}