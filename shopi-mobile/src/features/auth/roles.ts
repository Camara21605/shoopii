/**
 * Rôles proposés à l'inscription — copie fidèle de
 * shopi-frontend/src/modules/auth/roleConfigs.ts (icônes, textes, codes)
 * et des règles de disponibilité de RoleSelector.tsx :
 *   sans lien d'invitation, seul « Client » est ouvert (si l'inscription
 *   client est ouverte), plus « Entreprise » quand la plateforme n'exige
 *   pas de code pour elle ; les autres rôles demandent un lien d'invitation.
 * Âges minimums : MIN_AGE_BY_ROLE du serveur (min-age-for-role.validator.ts).
 */
export type RegisterRole = 'client' | 'company' | 'delivery' | 'partner' | 'correspondent' | 'admin';

export type RoleConfig = {
  icon: string;
  label: string;
  sub: string;
  info: string;
  code: boolean;
  codeLabel?: string;
  codeNote?: string;
  codePlaceholder?: string;
  codeFrom?: string;
  minAge?: number;
};

export const ROLE_CONFIGS: Record<RegisterRole, RoleConfig> = {
  client: {
    icon: '🛍️',
    label: 'Client',
    sub: 'Acheter',
    info: 'Parcourez des milliers de produits, passez commande et suivez vos livraisons en temps réel.',
    code: false,
    minAge: 18,
  },
  company: {
    icon: '🏪',
    label: 'Entreprise',
    sub: 'Vendre',
    info: 'Gérez votre boutique, catalogue, commandes et livreurs depuis un tableau de bord complet.',
    code: true,
    codeLabel: 'Code d’activation boutique',
    codeNote: 'Ce code vous est remis par le Partenaire ou l’Administrateur Shoneya qui vous a enregistré sur la plateforme.',
    codePlaceholder: 'SHOPX9',
    codeFrom: 'Partenaire ou Administrateur',
    minAge: 18,
  },
  delivery: {
    icon: '🛵',
    label: 'Livreur',
    sub: 'Livrer',
    info: 'Consultez vos missions, suivez vos revenus et communiquez avec entreprises et clients.',
    code: true,
    minAge: 18,
  },
  partner: {
    icon: '🤝',
    label: 'Partenaire',
    sub: 'Superviser',
    info: 'Supervisez votre réseau d’entreprises et de livreurs.',
    code: true,
    minAge: 20,
  },
  correspondent: {
    icon: '📍',
    label: 'Correspondant',
    sub: 'Relayer',
    info: 'Aidez les clients à recevoir leurs commandes et représentez une Entreprise ou un Livreur dans votre ville.',
    code: true,
    minAge: 18,
  },
  admin: {
    icon: '🔑',
    label: 'Admin',
    sub: 'Gérer',
    info: 'Créez et surveillez les entreprises et livreurs de votre réseau.',
    code: true,
    minAge: 25,
  },
};

export const REGISTER_ROLES = Object.keys(ROLE_CONFIGS) as RegisterRole[];

/** Politique publique (GET /public/registration-policy). */
export type RegistrationPolicy = { openSignup: boolean; codeRequiredForCompany: boolean };

/** Rôle sélectionnable sans lien d'invitation ? (même règle que RoleSelector.isDisabled) */
export function isRoleOpen(role: RegisterRole, policy: RegistrationPolicy | undefined): boolean {
  if (role === 'client') return policy?.openSignup !== false;
  /* Tant que la politique n'a pas répondu : code exigé (comportement historique du site). */
  if (role === 'company') return policy ? !policy.codeRequiredForCompany : false;
  return false;
}

/** Âge en années révolues à partir de « AAAA-MM-JJ ». */
export function ageFrom(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}
