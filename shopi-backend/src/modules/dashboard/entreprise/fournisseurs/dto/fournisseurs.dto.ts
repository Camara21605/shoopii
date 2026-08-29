/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/fournisseurs/dto/fournisseurs.dto.ts
 * RÔLE    : DTO de connexion à un fournisseur (entreprise Shopi
 *           vendant en gros).
 * ============================================================ */

import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ConnectSupplierDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: "UUID de l'entreprise fournisseur à connecter" })
  @IsUUID()
  supplierCompanyId: string;
}
