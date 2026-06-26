/* ============================================================
 * FICHIER : src/modules/codes/dto/generate-and-send.dto.ts
 * RÔLE    : DTO pour la génération + envoi d'une invitation
 *           par email (bouton "＋ Créer" dans InvitationsSection).
 *
 * Flux côté super-admin :
 *   1. Remplit le formulaire (email cible, rôle, durée, note)
 *   2. Clique "Envoyer l'invitation"
 *   3. Le backend génère le code, l'envoie par email, le stocke en base
 *   4. Le destinataire clique le lien → arrive sur /register?code=XXX&role=YYY
 * ============================================================ */

import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../../common/enums/user-role.enum';

/**
 * Rôles pour lesquels le super-admin peut envoyer une invitation.
 * CLIENT est exclu (inscription libre).
 * SUPER_ADMIN est exclu (ne peut pas être créé via ce flux).
 */
export const INVITABLE_ROLES = [
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.DELIVERY,
  UserRole.PARTNER,
] as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export class GenerateAndSendCodeDto {

  @ApiProperty({
    example: 'mamadou.diallo@fashionhub.gn',
    description: 'Adresse email du destinataire qui recevra l\'invitation',
  })
  @IsEmail({}, { message: 'L\'adresse email du destinataire est invalide.' })
  @MaxLength(255)
  targetEmail: string;

  @ApiProperty({
    enum: INVITABLE_ROLES,
    example: UserRole.DELIVERY,
    description: 'Rôle que recevra le compte créé avec ce code',
  })
  @IsEnum(INVITABLE_ROLES, { message: 'Rôle invalide pour une invitation.' })
  targetRole: InvitableRole;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 30,
    default: 7,
    description: 'Durée de validité du lien en jours (défaut : 7 jours)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  validityDays?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 1,
    default: 1,
    description: 'Nombre d\'utilisations autorisées (toujours 1 pour les invitations nominatives)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1) // Une invitation nominative = usage unique
  maxUses?: number;

  @ApiPropertyOptional({
    example: 'Recrutement livreur secteur Kaloum - Juin 2025',
    description: 'Note interne visible uniquement dans le dashboard super-admin',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

/* ============================================================
 * FICHIER : src/modules/codes/dto/generate-bulk.dto.ts
 * RÔLE    : DTO pour la génération en lot de codes (modal
 *           "✨ Générer" dans InvitationsSection — sans email).
 *           Le super-admin copie et distribue manuellement les codes.
 * ============================================================ */

export class GenerateBulkCodesDto {

  @ApiProperty({ enum: INVITABLE_ROLES, example: UserRole.COMPANY })
  @IsEnum(INVITABLE_ROLES, { message: 'Rôle cible invalide.' })
  targetRole: InvitableRole;

  @ApiProperty({ minimum: 1, maximum: 40, default: 1 })
  @IsInt()
  @Min(1)
  @Max(40)
  quantity: number;

  @ApiProperty({ minimum: 1, maximum: 365, default: 30 })
  @IsInt()
  @Min(1)
  @Max(365)
  validityDays: number;

  @ApiProperty({ minimum: 1, maximum: 100, default: 1 })
  @IsInt()
  @Min(1)
  @Max(100)
  maxUses: number;

  @ApiPropertyOptional({ example: 'Campagne Conakry Q3 2025' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

/* ============================================================
 * FICHIER : src/modules/codes/dto/validate-code.dto.ts
 * RÔLE    : DTO pour la vérification d'un code à l'inscription
 *           (appelé en temps réel depuis le RegisterForm.tsx
 *            au moment où l'utilisateur saisit son code OTP).
 * ============================================================ */

import { Matches } from 'class-validator';

/* Tous les rôles qui peuvent être activés via un code d'invitation
   (super-admin → admin/partner/company/delivery ; livreur/entreprise → correspondent). */
const ALL_CODE_ROLES = [
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.DELIVERY,
  UserRole.PARTNER,
  UserRole.CORRESPONDENT,
] as const;

export class ValidateCodeDto {

  @ApiProperty({
    example: 'AB3K-PQ7R-MN',
    description: 'Code d\'invitation au format XXXX-XXXX-XX',
  })
  @IsString()
  @Matches(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/, {
    message: 'Format invalide. Attendu : XXXX-XXXX-XX (ex: AB3K-PQ7R-MN).',
  })
  code: string;

  @ApiProperty({
    enum: ALL_CODE_ROLES,
    example: UserRole.COMPANY,
    description: 'Rôle que l\'utilisateur souhaite activer avec ce code',
  })
  @IsEnum(ALL_CODE_ROLES, { message: 'Rôle invalide.' })
  role: UserRole;
}
