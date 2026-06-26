/* ============================================================
 * FICHIER : src/modules/livreurs/dto/livreur.dto.ts
 *
 * RÔLE    : Validation de toutes les données échangées entre
 *           LivreursPage.tsx et le backend.
 *
 * ─── DTOs EXPORTÉS ───────────────────────────────────────────
 *
 *  FilterLivreursDto      → GET  /livreurs
 *  UpdateLivreurDto       → PATCH /livreurs/:id
 *  InviterLivreurDto      → POST /livreurs/inviter
 *  ContacterLivreurDto    → POST /livreurs/:id/contacter
 *  SuspendreDto           → PATCH /livreurs/:id/suspendre
 *
 * ─── CORRESPONDANCE AVEC LivreursPage.tsx ────────────────────
 *
 *  Filtres toolbar :
 *    filtreAvail  → availability (available, on_delivery, offline)
 *    filtreStatut → status (active, pending, suspended)
 *    search       → search (nom, zone, email)
 *
 *  ModalInviter :
 *    nom          → fullName
 *    email        → email
 *    zone         → zone
 *    vehicule     → vehicleType
 *    message      → message (corps de l'email)
 *
 *  ModalContacter :
 *    sujet        → sujet
 *    message      → message
 *
 * ============================================================ */

import {
  IsString, IsNotEmpty, IsEnum, IsOptional,
  IsEmail, IsInt, MaxLength, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DeliveryStatus,
  DeliveryAvailability,
  VehicleType,
} from 'src/database/entities/profiles/livreur-profile.entity';

// ─────────────────────────────────────────────────────────────
// FILTRE — GET /livreurs
// ─────────────────────────────────────────────────────────────

export class FilterLivreursDto {

  /** Filtrer par disponibilité (boutons toolbar) */
  @IsOptional()
  @IsEnum(DeliveryAvailability)
  availability?: DeliveryAvailability;

  /** Filtrer par statut du compte (select) */
  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

  /** Recherche texte sur fullName, zone, email */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

// ─────────────────────────────────────────────────────────────
// MISE À JOUR — PATCH /livreurs/:id
// ─────────────────────────────────────────────────────────────

export class UpdateLivreurDto {

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  zone?: string;

  @IsOptional()
  @IsEnum(VehicleType)
  VehicleType?: VehicleType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vehiculePlaque?: string;

  /** Mise à jour de la disponibilité par le livreur lui-même */
  @IsOptional()
  @IsEnum(DeliveryAvailability)
  availability?: DeliveryAvailability;
}

// ─────────────────────────────────────────────────────────────
// INVITATION — POST /livreurs/inviter
// Correspond à ModalInviter (étapes 1 → 3) dans LivreursPage.tsx
// ─────────────────────────────────────────────────────────────

export class InviterLivreurDto {

  /**
   * Nom complet du livreur invité.
   * Utilisé dans l'email d'invitation et pré-rempli dans le profil.
   */
  @IsString()
  @IsNotEmpty({ message: 'Le nom complet est obligatoire.' })
  @MaxLength(255)
  fullName: string;

  /**
   * Email de contact — l'invitation sera envoyée ici.
   */
  @IsEmail({}, { message: 'Email invalide.' })
  @IsNotEmpty({ message: "L'email est obligatoire." })
  email: string;

  /**
   * Type de véhicule du livreur.
   * Sélectionné dans le select de ModalInviter.
   */
  @IsEnum(VehicleType, { message: 'Type de véhicule invalide.' })
  vehicleType: VehicleType;

  /**
   * Zone de livraison prévue.
   * Ex: "Kaloum, Matam, Dixinn"
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  zone?: string;

  /**
   * Message personnalisé qui accompagnera l'email d'invitation.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

// ─────────────────────────────────────────────────────────────
// CONTACTER — POST /livreurs/:id/contacter
// Correspond à ModalContacter dans LivreursPage.tsx
// ─────────────────────────────────────────────────────────────

export class ContacterLivreurDto {

  @IsString()
  @IsNotEmpty({ message: 'Le sujet est obligatoire.' })
  @MaxLength(255)
  sujet: string;

  @IsString()
  @IsNotEmpty({ message: 'Le message est obligatoire.' })
  @MaxLength(5000)
  message: string;
}

// ─────────────────────────────────────────────────────────────
// SUSPENDRE — PATCH /livreurs/:id/suspendre
// ─────────────────────────────────────────────────────────────

export class SuspendreDto {

  @IsOptional()
  @IsString()
  @MaxLength(500)
  raison?: string;
}