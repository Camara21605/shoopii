/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/dto/update-paiement.dto.ts
 *
 * ✅ CORRECTIONS :
 *   - @IsIn([...]) rejetait "" pour receptionMethod → 400
 *   - @Min(50000) rejetait 0 si payoutMinAmount non renseigné
 * ============================================================ */

import {
  IsOptional, IsString, IsArray, IsNumber,
  IsIn, MaxLength, Min, ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

const emptyStringToNull = ({ value }: { value: unknown }) =>
  value === '' ? null : value;

export class UpdatePaiementDto {

  @IsOptional()
  @IsArray()
  paymentMethods?: Record<string, unknown>[];

  /* ✅ receptionMethod : "" → null, null ignoré par @IsIn() */
  @IsOptional()
  @Transform(emptyStringToNull)
  @ValidateIf(o => o.receptionMethod !== null && o.receptionMethod !== undefined)
  @IsString()
  @IsIn(['orange_money','mtn_momo','wave','virement_bancaire'])
  receptionMethod?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  receptionNumber?: string;

  /* ✅ payoutFrequency : "" → null, null ignoré */
  @IsOptional()
  @Transform(emptyStringToNull)
  @ValidateIf(o => o.payoutFrequency !== null && o.payoutFrequency !== undefined)
  @IsString()
  @IsIn(['daily','weekly','bimonthly','monthly'])
  payoutFrequency?: string | null;

  /* ✅ payoutMinAmount : accepte 0 (Min retiré, on laisse la BDD gérer le défaut) */
  @IsOptional()
  @Transform(({ value }) => value === '' || value === null ? undefined : Number(value))
  @IsNumber()
  payoutMinAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nif?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  rccm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  raisonSociale?: string;
}