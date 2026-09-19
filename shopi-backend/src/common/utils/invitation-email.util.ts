/* ============================================================
 * FICHIER : src/common/utils/invitation-email.util.ts
 *
 * RÔLE : garde-fou partagé par tous les flux "code de création /
 * invitation par email" (admin de zone, partenaire…) — refuse d'inviter
 * une adresse qui possède DÉJÀ un compte du rôle visé, avec un message
 * clair pour la personne qui invite.
 *
 * Règle identique à l'inscription (AuthService.register) : l'unicité est
 * (email, rôle) — UNIQ_user_email_role — donc une même adresse peut avoir
 * un compte client ET un compte pro, mais pas deux comptes du même rôle.
 * withDeleted: true : un compte supprimé (soft-delete) occupe toujours
 * la contrainte UNIQUE en base, l'inscription échouerait de toute façon.
 * ============================================================ */

import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { User } from '../../database/entities/user.entity';
import { UserRole } from '../enums/user-role.enum';

const ROLE_LABEL: Partial<Record<UserRole, string>> = {
  [UserRole.PARTNER]:       'Partenaire',
  [UserRole.COMPANY]:       'Entreprise',
  [UserRole.DELIVERY]:      'Livreur',
  [UserRole.CORRESPONDENT]: 'Correspondant',
  [UserRole.CLIENT]:        'Client',
  [UserRole.ADMIN]:         'Administrateur',
  [UserRole.SUPER_ADMIN]:   'Super administrateur',
};

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * @throws ConflictException (409) si un compte existe déjà pour cet email
 *         avec le rôle visé — message destiné à être affiché tel quel.
 */
export async function assertNoAccountForInvitation(
  userRepo: Repository<User>,
  email: string,
  targetRole: UserRole,
): Promise<void> {
  const normalized = normalizeEmail(email);
  const existing = await userRepo.findOne({
    where: { email: normalized, role: targetRole },
    withDeleted: true,
    select: ['id'],
  });
  if (!existing) return;

  const label = ROLE_LABEL[targetRole] ?? 'Shopi';
  throw new ConflictException(
    `Un compte ${label} existe déjà avec l'adresse ${normalized}. ` +
    `Impossible d'envoyer une invitation à cette adresse.`,
  );
}
