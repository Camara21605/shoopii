/* ============================================================
 * FICHIER : sync-contacts.dto.ts
 * DTOs pour la synchronisation des contacts téléphoniques.
 * ============================================================ */

import {
  IsArray, IsString, ArrayMaxSize,
  IsOptional, IsBoolean, MaxLength,
  ValidateNested, IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Un contact individuel envoyé par le client */
export class ContactHashDto {
  /** SHA-256 du numéro E.164 normalisé */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  hash: string;

  /** Nom d'affichage local (optionnel, fourni par le mobile) */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;
}

/** Corps de la requête de synchronisation */
export class SyncContactsDto {
  /** Tableau de hashes SHA-256 — max 10 000 contacts */
  @IsArray()
  @ArrayMaxSize(10_000)
  @ValidateNested({ each: true })
  @Type(() => ContactHashDto)
  contacts: ContactHashDto[];

  /** Si true → sync incrémentale (uniquement les nouveaux hashes) */
  @IsOptional()
  @IsBoolean()
  incremental?: boolean;
}

/** Réponse de la synchronisation */
export class SyncContactsResponseDto {
  /** Nombre de matches trouvés */
  matched: number;

  /** Nouveaux matches (pas connus avant) */
  newMatches: number;

  /** Liste des contacts qui sont sur Shopi */
  results: SyncedContactDto[];

  /** Durée de la synchronisation en ms */
  durationMs: number;
}

export class SyncedContactDto {
  /** Hash SHA-256 du numéro */
  hash: string;

  /** users.id de l'utilisateur Shopi correspondant */
  userId: string;

  /** Nom d'affichage Shopi (prénom + nom) */
  displayName: string;

  /** URL de photo de profil (optionnel) */
  avatar?: string | null;

  /** Type d'acteur (client, company…) */
  actorType: string;

  /** true si cet utilisateur est en ligne */
  online: boolean;
}
