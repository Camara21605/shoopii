/* ============================================================
 * FICHIER      : src/modules/company-team/dto/invitation.dto.ts
 * MODULE       : Company Team
 * ROLE         : DTOs pour la gestion des invitations de collaborateurs.
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  IsEmail, IsOptional, IsString, IsUUID,
  MaxLength, IsObject,
} from 'class-validator';

/** Créer une invitation */
export class CreateInvitationDto {
  @IsEmail({}, { message: 'Email invalide.' })
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  internalRole?: string;

  /** Permissions pré-chargées à appliquer lors de l'acceptation */
  @IsOptional()
  @IsObject()
  initialPermissions?: Record<string, Record<string, boolean>>;

  /** Identifiant d'un modèle de permissions à appliquer */
  @IsOptional()
  @IsUUID()
  templateId?: string;
}

/** Accepter une invitation (formulaire soumis par le nouveau collaborateur) */
export class AcceptInvitationDto {
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  /** Mot de passe choisi par le collaborateur */
  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
