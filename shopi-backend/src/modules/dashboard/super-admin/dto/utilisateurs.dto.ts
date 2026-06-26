/* ============================================================
 * FICHIER : src/modules/utilisateurs/dto/utilisateurs.dto.ts
 *
 * RÔLE    : DTOs (Data Transfer Objects) pour la gestion des
 *           utilisateurs dans le dashboard super-admin.
 *
 * CORRESPONDANCE AVEC UsersSection.tsx :
 *   ┌────────────────────────────────┬──────────────────────────┐
 *   │ Frontend (UsersSection.tsx)    │ DTO / Service            │
 *   ├────────────────────────────────┼──────────────────────────┤
 *   │ state.search                   │ FilterUsersDto.search    │
 *   │ state.statusFilter             │ FilterUsersDto.status    │
 *   │ state.roleFilter               │ FilterUsersDto.role      │
 *   │ state.countryFilter            │ FilterUsersDto.country   │
 *   │ state.page / state.perPage     │ FilterUsersDto.page/limit│
 *   │ store.toggleBlockUser(id)      │ PATCH /users/:id/block   │
 *   │ store.openUserModal(u)         │ GET   /users/:id         │
 *   │ "⬇ Export CSV"                │ GET   /users/export      │
 *   └────────────────────────────────┴──────────────────────────┘
 *
 * PLACEMENT : src/modules/utilisateurs/dto/utilisateurs.dto.ts
 * ============================================================ */

import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────
// TYPES ALIGNÉS SUR UsersSection.tsx
// ─────────────────────────────────────────────────────────────

/**
 * Rôles affichés dans les onglets ROLE_TABS de UsersSection.tsx.
 * 'all' est géré côté service (pas de filtre appliqué).
 */
export type RoleFilter =
  | 'all'
  | 'company'
  | 'delivery'
  | 'customer'
  | 'partner'
  | 'admin'
  | 'correspondent';

/**
 * Statuts affichés dans le select statusFilter de UsersSection.tsx.
 */
export type StatusFilter = 'all' | 'active' | 'blocked' | 'pending' | 'suspended';

/**
 * Pays affichés dans le select countryFilter de UsersSection.tsx.
 */
export type CountryFilter = 'all' | 'GN' | 'SN' | 'ML' | 'CI';

// ─────────────────────────────────────────────────────────────
// DTO FILTRE + PAGINATION
// ─────────────────────────────────────────────────────────────

/**
 * FilterUsersDto
 *
 * Utilisé pour : GET /utilisateurs
 *
 * Tous les paramètres sont des query params :
 *   GET /utilisateurs?search=mamadou&role=delivery&status=active&page=2&limit=20
 *
 * Champs optionnels — si absents, aucun filtre n'est appliqué.
 */
export class FilterUsersDto {

  /**
   * Recherche textuelle sur nom, email ou téléphone.
   * Correspond au champ search de UsersSection.tsx.
   * Ex: "mamadou", "techstore", "+224"
   */
  @ApiPropertyOptional({ example: 'mamadou' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /**
   * Filtre par rôle.
   * Correspond aux onglets ROLE_TABS dans UsersSection.tsx.
   * 'all' → aucun filtre rôle appliqué.
   */
  @ApiPropertyOptional({
    enum: ['all', 'company', 'delivery', 'customer', 'partner', 'admin', 'correspondent'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'company', 'delivery', 'customer', 'partner', 'admin', 'correspondent'])
  role?: RoleFilter;

  /**
   * Filtre par statut.
   * Correspond au select statusFilter dans UsersSection.tsx.
   * 'all' → aucun filtre statut appliqué.
   */
  @ApiPropertyOptional({
    enum: ['all', 'active', 'blocked', 'pending', 'suspended'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'active', 'blocked', 'pending', 'suspended'])
  status?: StatusFilter;

  /**
   * Filtre par pays.
   * Correspond au select countryFilter dans UsersSection.tsx.
   * 'all' → aucun filtre pays appliqué.
   */
  @ApiPropertyOptional({
    enum: ['all', 'GN', 'SN', 'ML', 'CI'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'GN', 'SN', 'ML', 'CI'])
  country?: CountryFilter;

  /**
   * Numéro de page (commence à 1).
   * Correspond à state.page dans useSuperAdminState.ts.
   * @Type(() => Number) → conversion auto du query param string → number
   */
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;

  /**
   * Nombre d'utilisateurs par page.
   * Correspond à state.perPage dans useSuperAdminState.ts.
   * Valeur par défaut : 20 (alignée sur le frontend).
   */
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number = 20;
}