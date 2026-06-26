/* ============================================================
 * FICHIER : src/modules/commande/dto/valider-etape.dto.ts
 * RÔLE    : Validation d'une étape de la chaîne (code acteur).
 * ============================================================ */

import { IsIn, IsString, Length } from 'class-validator';

export class ValiderEtapeDto {
  @IsIn(['entreprise', 'livreur', 'correspondant', 'client'])
  role: 'entreprise' | 'livreur' | 'correspondant' | 'client';

  @IsString()
  @Length(1, 20)
  code: string;
}
