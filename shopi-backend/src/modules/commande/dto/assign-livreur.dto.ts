/* ============================================================
 * FICHIER : src/modules/commande/dto/assign-livreur.dto.ts
 * RÔLE    : Assignation/réassignation du livreur sur une commande,
 *           par l'entreprise ou par le client.
 * ============================================================ */

import { IsUUID } from 'class-validator';

export class AssignLivreurDto {
  @IsUUID()
  livreurId: string;
}
