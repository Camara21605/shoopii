/* ============================================================
 * FICHIER      : src/modules/company-team/dto/update-member.dto.ts
 * MODULE       : Company Team
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator';

export class UpdateTeamMemberDto {
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsString() @MaxLength(20)  phone?: string;
  @IsOptional() @IsString() @MaxLength(100) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(50)  internalRole?: string;
}

export class SuspendMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
