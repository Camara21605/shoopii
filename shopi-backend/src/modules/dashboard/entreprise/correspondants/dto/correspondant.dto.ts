/* ============================================================
 * FICHIER : src/modules/correspondants/dto/correspondant.dto.ts
 *
 * RÔLE    : Validation et typage de toutes les données
 *           échangées entre CorrespondantsPage.tsx et le backend.
 *
 * ─── DTOs EXPORTÉS ───────────────────────────────────────────
 *
 *  FilterCorrespondantsDto  → GET  /correspondants
 *  UpdateCorrespondantDto   → PATCH /correspondants/:id
 *  InviterCorrespondantDto  → POST /correspondants/inviter
 *  ContacterCorrespondantDto→ POST /correspondants/:id/contacter
 *  SuspendreDto             → PATCH /correspondants/:id/suspendre
 *
 * ─── CORRESPONDANCE AVEC CorrespondantsPage.tsx ──────────────
 *
 *  Filtres toolbar :
 *    filtreType   → type (relais, entrepot, export, principal)
 *    filtreStatut → status (active, pending, suspended)
 *    search       → search (recherche sur fullName, ville, email)
 *
 *  ModalInviter (étape 1) :
 *    nom          → fullName
 *    email        → email
 *    ville        → ville
 *    quartier     → quartier (zone)
 *    type         → type
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
  CorrespondantStatus,
} from 'src/database/entities/profiles/correspondant-profile.entity';

// ─────────────────────────────────────────────────────────────
// ENUM TYPE — correspond aux 4 boutons filtres de la page
// ─────────────────────────────────────────────────────────────

/**
 * Type de point relais — correspond au sélecteur dans ModalInviter
 * et aux boutons filtres de CorrespondantsPage.tsx
 */
export enum CorrespondantType {
  RELAIS    = 'relais',      // Point relais standard (dépôt/retrait)
  ENTREPOT  = 'entrepot',    // Entrepôt régional (stockage)
  EXPORT    = 'export',      // Export international
  PRINCIPAL = 'principal',   // Hub central / correspondant principal
}

// ─────────────────────────────────────────────────────────────
// FILTRE — GET /correspondants
// ─────────────────────────────────────────────────────────────

export class FilterCorrespondantsDto {

  /**
   * Filtrer par type de point relais.
   * Correspond aux boutons filtres : Tous / Relais / Entrepôt / Export / Principal
   */
  @IsOptional()
  @IsEnum(CorrespondantType, { message: 'Type invalide : relais, entrepot, export, principal' })
  type?: CorrespondantType;

  /**
   * Filtrer par statut.
   * Correspond au select "Tous les statuts / Actifs / En attente / Suspendus"
   */
  @IsOptional()
  @IsEnum(CorrespondantStatus, { message: 'Statut invalide : active, pending, suspended' })
  status?: CorrespondantStatus;

  /**
   * Recherche texte sur le nom, la ville et l'email.
   * Correspond au champ de recherche du toolbar.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Numéro de page (défaut : 1) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Résultats par page (défaut : 20) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

// ─────────────────────────────────────────────────────────────
// MISE À JOUR — PATCH /correspondants/:id
// Utilisé pour modifier le profil d'un correspondant
// ─────────────────────────────────────────────────────────────

export class UpdateCorrespondantDto {

  /** Nom du point relais ou de la personne */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string;

  /** Numéro de téléphone */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  /**
   * Zone de couverture du correspondant.
   * Ex: "Kaloum · Dixinn · Matam"
   * Correspond au champ zone de l'entité Correspondent.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  zone?: string;

  /**
   * Adresse complète du point relais.
   * Ex: "Rue KA-012, Kaloum, Conakry"
   */
  @IsOptional()
  @IsString()
  address?: string;

  /**
   * Type de point relais.
   * Modifiable par un admin ou super-admin.
   */
  @IsOptional()
  @IsEnum(CorrespondantType)
  type?: CorrespondantType;
}

// ─────────────────────────────────────────────────────────────
// INVITATION — POST /correspondants/inviter
// Correspond aux données de ModalInviter (étape 1)
// ─────────────────────────────────────────────────────────────

export class InviterCorrespondantDto {

  /**
   * Nom du point relais ou de la personne invitée.
   * Affiché dans l'email d'invitation et pré-rempli dans le profil.
   * Ex: "RelaisPlus Kaloum"
   */
  @IsString()
  @IsNotEmpty({ message: 'Le nom du point relais est obligatoire.' })
  @MaxLength(255)
  fullName: string;

  /**
   * Email de contact — l'invitation sera envoyée ici.
   * Le code d'activation (10 chiffres) sera joint à cet email.
   */
  @IsEmail({}, { message: 'Email invalide.' })
  @IsNotEmpty({ message: 'L\'email est obligatoire.' })
  email: string;

  /**
   * Type de correspondant invité.
   * Utilisé pour configurer les permissions et le dashboard du compte.
   */
  @IsEnum(CorrespondantType, { message: 'Type invalide : relais, entrepot, export, principal' })
  type: CorrespondantType;

  /**
   * Ville du point relais.
   * Stockée dans le profil après inscription.
   * Facultatif à l'invitation — peut être complété par le correspondant.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ville?: string;

  /**
   * Quartier ou zone de couverture.
   * Ex: "Kaloum, Matam" → deviendra le champ zone dans l'entité.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  quartier?: string;

  /**
   * Message personnalisé qui accompagnera l'email d'invitation.
   * Pré-rempli dans ModalInviter mais modifiable par l'entreprise.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

// ─────────────────────────────────────────────────────────────
// CONTACTER — POST /correspondants/:id/contacter
// Correspond aux données de ModalContacter
// ─────────────────────────────────────────────────────────────

export class ContacterCorrespondantDto {

  /**
   * Sujet de l'email.
   * Ex: "Mise à jour stock disponible"
   */
  @IsString()
  @IsNotEmpty({ message: 'Le sujet est obligatoire.' })
  @MaxLength(255)
  sujet: string;

  /**
   * Corps du message envoyé au correspondant.
   * Envoyé par email depuis noreply@shopi.gn.
   */
  @IsString()
  @IsNotEmpty({ message: 'Le message est obligatoire.' })
  @MaxLength(5000)
  message: string;
}

// ─────────────────────────────────────────────────────────────
// SUSPENDRE — PATCH /correspondants/:id/suspendre
// Corps minimal — la confirmation se fait dans ModalSuspendre
// ─────────────────────────────────────────────────────────────

export class SuspendreDto {

  /**
   * Raison de la suspension (optionnelle, pour audit).
   * Ex: "Non-respect des délais de livraison"
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  raison?: string;
}