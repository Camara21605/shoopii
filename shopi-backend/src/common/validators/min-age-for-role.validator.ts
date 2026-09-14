/* ============================================================
 * FICHIER : src/common/validators/min-age-for-role.validator.ts
 *
 * RÔLE : Âge minimum à l'inscription, différent selon le rôle choisi.
 *   - Livreur, entreprise, correspondant : 18 ans
 *   - Partenaire                          : 20 ans
 *   - Administrateur                      : 25 ans
 *   - Client                              : aucune restriction
 *
 * Implémenté en class-validator custom constraint (plutôt qu'un
 * @Min/@Max classique) car le seuil dépend d'un AUTRE champ du DTO
 * (`role`) — même principe que les @ValidateIf(o => o.role === X)
 * déjà utilisés pour shopName/companyTypeId dans RegisterDto, mais
 * ici la condition ET le message d'erreur dépendent tous deux du rôle.
 * ============================================================ */

import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export const MIN_AGE_BY_ROLE: Partial<Record<UserRole, number>> = {
  [UserRole.CLIENT]:        18,
  [UserRole.DELIVERY]:      18,
  [UserRole.COMPANY]:       18,
  [UserRole.CORRESPONDENT]: 18,
  [UserRole.PARTNER]:       20,
  [UserRole.ADMIN]:         25,
};

const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]:   'super-administrateur',
  [UserRole.ADMIN]:         'administrateur',
  [UserRole.COMPANY]:       'entreprise',
  [UserRole.DELIVERY]:      'livreur',
  [UserRole.PARTNER]:       'partenaire',
  [UserRole.CORRESPONDENT]: 'correspondant',
  [UserRole.CLIENT]:        'client',
};

/** Âge en années révolues à la date du jour — précision mois/jour, pas
 *  une simple soustraction d'années (un anniversaire pas encore passé
 *  cette année ne doit pas compter). */
export function computeAge(birthDateStr: string, atDate: Date = new Date()): number {
  const birth = new Date(birthDateStr);
  let age = atDate.getFullYear() - birth.getFullYear();
  const monthDiff = atDate.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && atDate.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

@ValidatorConstraint({ name: 'minAgeForRole', async: false })
class MinAgeForRoleConstraint implements ValidatorConstraintInterface {
  validate(birthDate: unknown, args: ValidationArguments): boolean {
    if (typeof birthDate !== 'string' || !birthDate) return true; // @IsNotEmpty/@IsDateString gèrent déjà ce cas
    const role = (args.object as { role?: UserRole }).role;
    const minAge = role ? MIN_AGE_BY_ROLE[role] : undefined;
    if (!minAge) return true; // pas de seuil pour ce rôle (ex. client)

    const parsed = new Date(birthDate);
    if (Number.isNaN(parsed.getTime())) return true; // @IsDateString gère déjà le format invalide

    return computeAge(birthDate) >= minAge;
  }

  defaultMessage(args: ValidationArguments): string {
    const role = (args.object as { role?: UserRole }).role;
    const minAge = role ? MIN_AGE_BY_ROLE[role] : undefined;
    const label = role ? ROLE_LABEL[role] : 'ce rôle';
    return `Vous devez avoir au moins ${minAge} ans pour vous inscrire en tant que ${label}.`;
  }
}

export function MinAgeForRole(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: MinAgeForRoleConstraint,
    });
  };
}
