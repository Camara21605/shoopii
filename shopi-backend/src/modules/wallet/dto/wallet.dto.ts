/* ============================================================
 * FICHIER : src/modules/wallet/dto/wallet.dto.ts
 *
 * RÔLE    : DTOs du module Portefeuille (Wallet), communs
 *           à tous les rôles (chaque utilisateur a son wallet).
 * ============================================================ */

import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { WalletPaymentMethodType } from 'src/database/entities/wallet.entity';

/* ── Opération financière (dépôt / retrait / transfert) ── */
export class WalletOperationDto {
  @ApiProperty({ example: 50000, description: 'Montant en GNF (> 0)' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ description: 'Identifiant de la méthode de paiement utilisée' })
  @IsOptional()
  @IsUUID()
  methodId?: string;

  @ApiPropertyOptional({ description: 'Note libre associée à l\'opération' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

/* ── Liste des transactions ── */
export class ListWalletTransactionsDto {
  @ApiPropertyOptional({ enum: ['all', 'in', 'out'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'in', 'out'])
  type?: 'all' | 'in' | 'out';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

/* ── Graphique d'évolution ── */
export class WalletChartQueryDto {
  @ApiPropertyOptional({ enum: ['semaine', 'mois', 'annee'], default: 'mois' })
  @IsOptional()
  @IsIn(['semaine', 'mois', 'annee'])
  period?: 'semaine' | 'mois' | 'annee';
}

/* ── Ajout d'une méthode de paiement ── */
export class AddPaymentMethodDto {
  @ApiProperty({ enum: WalletPaymentMethodType })
  @IsEnum(WalletPaymentMethodType)
  type: WalletPaymentMethodType;

  @ApiProperty({ example: 'Orange Money' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(60)
  label: string;

  @ApiProperty({ example: '+224 622 00 00 01' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(60)
  number: string;
}

/* ── Activation du virement automatique ── */
export class AutoTransferDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ description: 'Méthode cible du virement automatique' })
  @IsOptional()
  @IsUUID()
  methodId?: string;
}
