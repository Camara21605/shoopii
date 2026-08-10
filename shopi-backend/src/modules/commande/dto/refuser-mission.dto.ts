/* ============================================================
 * FICHIER : src/modules/commande/dto/refuser-mission.dto.ts
 * RÔLE    : Refus d'une mission par le livreur — motif obligatoire.
 * ============================================================ */

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefuserMissionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}
