/* ============================================================
 * FICHIER : src/modules/location/dto/client-address.dto.ts
 * RÔLE    : DTOs pour la gestion des adresses client
 *           (utilise l'entité Localisation existante).
 * ============================================================ */

import {
  IsEnum, IsNotEmpty, IsNumber, IsOptional,
  IsString, Max, MaxLength, Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { TypeAdresse } from '../../../database/entities/localisation.entity';

export class CreateClientAddressDto {

  /** Type d'adresse : domicile, bureau, boutique… */
  @IsEnum(TypeAdresse, { message: "Type d'adresse invalide." })
  typeAdresse: TypeAdresse = TypeAdresse.DOMICILE;

  /** Libellé personnalisé : "Maison", "Bureau Kaloum"… */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  libelle?: string;

  /** Rue / numéro */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  rue?: string;

  /** Quartier */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  quartier?: string;

  /** Commune / arrondissement */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  commune?: string;

  /** Ville */
  @IsNotEmpty({ message: 'La ville est obligatoire.' })
  @IsString()
  @MaxLength(100)
  ville: string;

  /** Préfecture / département */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  prefecture?: string;

  /** Région administrative */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  /** Pays (code ISO-2 ou nom) */
  @IsString()
  @MaxLength(100)
  pays: string = 'GN';

  /** Code postal */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  codePostal?: string;

  /** Latitude GPS */
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  /** Longitude GPS */
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  /** Instructions de livraison */
  @IsOptional()
  @IsString()
  instructions?: string;

  /** Téléphone de contact pour cette adresse */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telephone?: string;

  /** Définir comme adresse par défaut */
  @IsOptional()
  estDefaut?: boolean;
}

export class UpdateClientAddressDto extends PartialType(CreateClientAddressDto) {}
