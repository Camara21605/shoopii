/* ============================================================
 * FICHIER : src/common/utils/invitation-email.util.ts
 *
 * RÔLE : garde-fou partagé par tous les flux "code de création /
 * invitation par email" (admin de zone, partenaire, entreprise,
 * super-admin…) — refuse d'inviter une adresse déjà utilisée par un
 * compte, avec un message clair pour la personne qui invite.
 *
 * RÈGLE :
 *   - Une adresse qui possède DÉJÀ un compte professionnel (partenaire,
 *     entreprise, livreur, correspondant, admin, super admin) ne peut
 *     recevoir aucune invitation, quel que soit le rôle visé. (Une
 *     première version ne contrôlait que le rôle identique : une adresse
 *     de super admin pouvait donc encore recevoir un code partenaire.)
 *   - Seule exception : un compte CLIENT seul n'empêche pas d'inviter vers
 *     un rôle pro — l'inscription autorise les comptes liés client + pro
 *     (UNIQ_user_email_role, voir AuthService.register). L'appelant en est
 *     informé via `linkedClient` pour prévenir l'inviteur.
 *   - Un compte du MÊME rôle est toujours bloquant, client compris.
 *   - withDeleted: true : un compte supprimé (soft-delete) occupe toujours
 *     la contrainte UNIQUE en base, l'inscription échouerait de toute façon.
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

export interface InvitationEmailCheck {
  /** true si l'adresse a un compte CLIENT (autorisé : compte lié possible). */
  linkedClient: boolean;
}

/**
 * @throws ConflictException (409) si l'adresse est déjà utilisée par un
 *         compte qui interdit l'invitation — message affichable tel quel.
 */
export async function assertNoAccountForInvitation(
  userRepo: Repository<User>,
  email: string,
  targetRole: UserRole,
): Promise<InvitationEmailCheck> {
  const normalized = normalizeEmail(email);
  const accounts = await userRepo
    .createQueryBuilder('u')
    .withDeleted()
    .select(['u.id', 'u.role'])
    .where('LOWER(u.email) = :email', { email: normalized })
    .getMany();

  const sameRole = accounts.find(a => a.role === targetRole);
  if (sameRole) {
    const label = ROLE_LABEL[targetRole] ?? 'Shopi';
    throw new ConflictException(
      `Un compte ${label} existe déjà avec l'adresse ${normalized}. ` +
      `Impossible d'envoyer une invitation à cette adresse.`,
    );
  }

  const proAccount = accounts.find(a => a.role !== UserRole.CLIENT);
  if (proAccount) {
    const label = ROLE_LABEL[proAccount.role as UserRole] ?? 'Shopi';
    throw new ConflictException(
      `L'adresse ${normalized} est déjà utilisée par un compte ${label}. ` +
      `Impossible d'envoyer une invitation à cette adresse.`,
    );
  }

  return { linkedClient: accounts.some(a => a.role === UserRole.CLIENT) };
}
