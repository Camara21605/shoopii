/**
 * Contrôles de chaque étape — mêmes règles et mêmes messages que
 * validateRegisterField (shopi-frontend/src/modules/auth/hooks/useLoginPage.ts),
 * elles-mêmes alignées sur le serveur (RegisterDto). Le serveur revérifie tout.
 */
import { isStrongPassword } from '@/features/auth/password-rules';
import { ROLE_CONFIGS, ageFrom } from '@/features/auth/roles';

import type { RegisterErrors, RegisterForm, StepKey } from './types';

/** « 12/05/1998 » → « 1998-05-12 » si c'est une vraie date passée, sinon null. */
export function parseBirthDate(v: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  const real = date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
  if (!real || y < 1900 || date.getTime() > Date.now()) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Saisie « JJ/MM/AAAA » : les barres se placent toutes seules. */
export function formatBirthInput(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export type ValidationContext = {
  /** Le rôle choisi est-il ouvert à l'inscription sans invitation ? */
  roleOpen: boolean;
  /** Nombre de catégories proposées pour le type choisi (étape Catégories). */
  categoriesAvailable: number;
};

export function validateStep(step: StepKey, f: RegisterForm, ctx: ValidationContext): RegisterErrors {
  const e: RegisterErrors = {};
  const company = f.role === 'company';

  switch (step) {
    case 'account':
      if (!ctx.roleOpen) e.role = 'Ce rôle nécessite une invitation par lien email.';
      if (!f.email.trim()) e.email = 'Email requis.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Adresse email invalide.';
      break;

    case 'identity':
      if (!company) {
        if (!f.firstName.trim()) e.firstName = 'Prénom requis.';
        else if (f.firstName.trim().length < 2) e.firstName = 'Le prénom doit contenir au moins 2 caractères.';
        if (!f.lastName.trim()) e.lastName = 'Nom requis.';
        else if (f.lastName.trim().length < 2) e.lastName = 'Le nom doit contenir au moins 2 caractères.';
      } else {
        if (!f.shopName.trim()) e.shopName = 'Nom de la boutique / entreprise requis.';
        else if (f.shopName.trim().length < 2) e.shopName = 'Le nom de la boutique doit contenir au moins 2 caractères.';
        if (!f.businessModel) e.businessModel = 'Choisissez « Produits » ou « Services ».';
        if (!f.companyTypeId) e.companyTypeId = 'Type d’entreprise requis.';
      }
      break;

    case 'categories':
      if (ctx.categoriesAvailable > 0 && f.categoryIds.length === 0) e.categoryIds = 'Choisissez au moins une catégorie.';
      break;

    case 'logo':
      break; // facultatif

    case 'profile': {
      const iso = parseBirthDate(f.birth);
      if (!f.birth.trim()) e.birth = 'Date de naissance requise.';
      else if (!iso) e.birth = 'Date invalide (JJ/MM/AAAA).';
      else {
        const min = ROLE_CONFIGS[f.role].minAge;
        if (min && ageFrom(iso) < min) e.birth = `Vous devez avoir au moins ${min} ans pour créer un compte ${ROLE_CONFIGS[f.role].label.toLowerCase()}.`;
      }
      if (!f.gender) e.gender = 'Genre requis.';
      break;
    }

    case 'contact':
      if (!f.phone.trim()) e.phone = 'Téléphone requis.';
      else if (f.phone.length < 6) e.phone = 'Numéro de téléphone trop court.';
      if (company) {
        if (!f.company) e.location = 'Choisissez la localisation de votre entreprise jusqu’au quartier.';
        else if (!f.company.quartierNom.trim())
          e.location = 'Le quartier est obligatoire : les clients doivent savoir où vous trouver.';
      } else if (!f.gps && !f.city) {
        e.location = 'La localisation est obligatoire : autorisez votre position ou choisissez votre ville.';
      }
      break;

    case 'password':
      if (f.password.length < 8) e.password = 'Mot de passe trop court (8 caractères min).';
      else if (!isStrongPassword(f.password))
        e.password = 'Doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial.';
      if (f.confirm !== f.password) e.confirm = 'Les mots de passe ne correspondent pas.';
      if (!f.terms) e.terms = 'Vous devez accepter les conditions d’utilisation pour continuer.';
      break;
  }
  return e;
}
