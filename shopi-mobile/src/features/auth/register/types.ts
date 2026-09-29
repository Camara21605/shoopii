/**
 * Données du formulaire d'inscription (parcours par étapes) — mêmes champs
 * et mêmes étapes que le site (shopi-frontend RegisterForm.tsx) :
 *   account → identity → [categories → logo] (entreprise) → profile → contact → password
 */
import type { Gender } from '@/features/auth/api';
import type { RegisterRole } from '@/features/auth/roles';

export type StepKey = 'account' | 'identity' | 'categories' | 'logo' | 'profile' | 'contact' | 'password';

export const STEP_INFO: Record<StepKey, { title: string; sub: string }> = {
  account: { title: 'Votre compte', sub: 'Choisissez votre rôle et entrez votre email' },
  identity: { title: 'Votre identité', sub: 'Prénom, nom et nom de votre structure' },
  categories: { title: 'Vos catégories', sub: 'Choisissez les catégories de votre activité' },
  logo: { title: 'Votre logo', sub: 'Ajoutez le logo de votre entreprise (facultatif)' },
  profile: { title: 'Votre profil', sub: 'Date de naissance et genre' },
  contact: { title: 'Vos coordonnées', sub: 'Numéro de téléphone et localisation' },
  password: { title: 'Votre mot de passe', sub: 'Sécurisez votre compte pour finaliser' },
};

export function stepsFor(role: RegisterRole): StepKey[] {
  return ['account', 'identity', ...(role === 'company' ? (['categories', 'logo'] as const) : []), 'profile', 'contact', 'password'];
}

/** Position obtenue par le GPS du téléphone (client). */
export type GpsLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  city?: string;
  district?: string;
  quartier?: string;
  region?: string;
  country?: string;
  postalCode?: string;
};

/** Localisation choisie dans le référentiel géo (entreprise), comme CompanyLocationSelect du site. */
export type CompanyLocation = {
  paysId: string;
  paysNom: string;
  regionNom: string;
  prefectureId: string;
  prefectureNom: string;
  communeNom: string;
  quartierNom: string;
};

export type RegisterForm = {
  role: RegisterRole;
  email: string;
  firstName: string;
  lastName: string;
  shopName: string;
  businessModel: 'products' | 'services' | null;
  companyTypeId: string | null;
  categoryIds: string[];
  logo: { uri: string; mimeType: string } | null;
  /** « JJ/MM/AAAA » tel que saisi */
  birth: string;
  gender: Gender | null;
  country: { code: string; name: string; dial: string; flag: string };
  /** Chiffres locaux, sans indicatif */
  phone: string;
  gps: GpsLocation | null;
  /** Ville choisie à la main quand le GPS est refusé (client) */
  city: string | null;
  company: CompanyLocation | null;
  password: string;
  confirm: string;
  terms: boolean;
};

export type RegisterErrors = Partial<Record<keyof RegisterForm | 'location' | 'general', string>>;

export type StepProps = {
  form: RegisterForm;
  errors: RegisterErrors;
  set: (patch: Partial<RegisterForm>) => void;
};
