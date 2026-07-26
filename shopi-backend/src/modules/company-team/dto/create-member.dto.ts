/* ============================================================
 * FICHIER      : src/modules/company-team/dto/create-member.dto.ts
 * MODULE       : Company Team
 * ROLE         : DTO de création d'un nouveau membre de l'équipe.
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  IsEmail, IsString, IsOptional, MinLength,
  MaxLength, IsEnum, ValidateNested, IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TeamPermissions, DEFAULT_TEAM_PERMISSIONS } from '../../../database/entities/company-team/company-team-permission.entity';

export class CreateTeamMemberDto {

  /** Prénom du collaborateur */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName!: string;

  /** Nom de famille */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName!: string;

  /** Email professionnel — doit être unique dans Shopi */
  @IsEmail()
  email!: string;

  /** Numéro de téléphone (optionnel) */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  /** Poste occupé dans l'entreprise (optionnel) */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  /** Rôle organisationnel interne (optionnel) */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  internalRole?: string;

  /**
   * Permissions initiales accordées au membre.
   * Si absent, DEFAULT_TEAM_PERMISSIONS est utilisé (tout à false).
   */
  @IsOptional()
  permissions?: Partial<TeamPermissions>;

  /**
   * true = envoyer un email d'invitation au collaborateur.
   * L'email contient le mot de passe temporaire généré.
   */
  @IsOptional()
  @IsBoolean()
  sendInvitationEmail?: boolean;
}
