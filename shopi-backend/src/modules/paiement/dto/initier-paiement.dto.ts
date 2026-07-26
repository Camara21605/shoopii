/* ============================================================
 * FICHIER : src/modules/paiement/dto/initier-paiement.dto.ts
 * ============================================================ */

import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { MethodePaiementSession } from '../../../database/entities/paiement/paiement-session.entity';

export class InitierPaiementDto {

  /**
   * UUID de la commande à payer.
   * La commande doit être dans le status PENDING.
   */
  @IsUUID()
  @IsNotEmpty()
  commandeId: string;

  /**
   * Méthode de paiement choisie par le client.
   * Détermine le provider utilisé.
   */
  @IsEnum(MethodePaiementSession, {
    message: `methode doit être une valeur parmi: ${Object.values(MethodePaiementSession).join(', ')}`,
  })
  methode: MethodePaiementSession;

  /**
   * Numéro de téléphone mobile utilisé pour le paiement.
   * Obligatoire pour Orange Money, MTN Money, Wave.
   * Format international : +224XXXXXXXXX ou 00224XXXXXXXXX
   */
  @IsOptional()
  @IsString()
  @Matches(/^(\+|00)?[0-9]{8,15}$/, {
    message: 'phone doit être un numéro de téléphone valide',
  })
  phone?: string;
}
