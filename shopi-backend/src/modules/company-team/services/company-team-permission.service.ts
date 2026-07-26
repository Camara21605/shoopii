/* ============================================================
 * FICHIER      : src/modules/company-team/services/company-team-permission.service.ts
 * MODULE       : Company Team
 * ROLE         : Gestion des permissions granulaires des membres.
 *
 * RESPONSABILITES :
 *   - Initialiser les permissions d'un nouveau membre (tout à false).
 *   - Mettre à jour les permissions (deep merge).
 *   - Vérifier qu'un membre a une permission spécifique.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CompanyTeamPermission,
  TeamPermissions,
  DEFAULT_TEAM_PERMISSIONS,
} from '../../../database/entities/company-team/company-team-permission.entity';

@Injectable()
export class CompanyTeamPermissionService {

  constructor(
    @InjectRepository(CompanyTeamPermission)
    private readonly permRepo: Repository<CompanyTeamPermission>,
  ) {}

  /**
   * Crée les permissions initiales pour un nouveau membre.
   * Fusionne les permissions fournies avec les défauts (tout à false).
   */
  async create(memberId: string, initial?: Partial<TeamPermissions>): Promise<CompanyTeamPermission> {
    const permissions = this.mergeWithDefaults(initial);
    const entity = this.permRepo.create({ memberId, permissions });
    return this.permRepo.save(entity);
  }

  /**
   * Met à jour les permissions d'un membre.
   * Deep merge : seuls les champs fournis sont modifiés.
   *
   * Exemple : updatePermissions(id, { products: { view: true } })
   * → uniquement products.view passe à true, le reste est conservé.
   */
  async update(memberId: string, updates: Partial<TeamPermissions>): Promise<CompanyTeamPermission> {
    const perm = await this.permRepo.findOne({ where: { memberId } });

    if (!perm) {
      throw new NotFoundException(`Permissions introuvables pour le membre ${memberId}.`);
    }

    /* Deep merge : fusionner groupe par groupe */
    const merged: TeamPermissions = { ...perm.permissions };
    for (const [group, actions] of Object.entries(updates) as [keyof TeamPermissions, Record<string, boolean>][]) {
      if (merged[group] && typeof actions === 'object') {
        (merged[group] as Record<string, boolean>) = {
          ...(merged[group] as Record<string, boolean>),
          ...actions,
        };
      }
    }

    perm.permissions = merged;
    return this.permRepo.save(perm);
  }

  /**
   * Retourne les permissions d'un membre.
   */
  async getByMemberId(memberId: string): Promise<CompanyTeamPermission> {
    const perm = await this.permRepo.findOne({ where: { memberId } });

    if (!perm) {
      throw new NotFoundException(`Permissions introuvables pour le membre ${memberId}.`);
    }

    return perm;
  }

  /**
   * Vérifie si un membre possède une permission spécifique.
   *
   * Utilisation : await permService.hasPermission(memberId, 'products', 'create')
   */
  async hasPermission(
    memberId: string,
    group: keyof TeamPermissions,
    action: string,
  ): Promise<boolean> {
    try {
      const perm = await this.getByMemberId(memberId);
      const grp  = perm.permissions[group] as Record<string, boolean> | undefined;
      return grp?.[action] === true;
    } catch {
      return false;
    }
  }

  /**
   * Fusionne les permissions fournies avec les permissions par défaut (tout à false).
   * Garantit que tous les groupes sont présents même si le DTO est partiel.
   */
  private mergeWithDefaults(partial?: Partial<TeamPermissions>): TeamPermissions {
    if (!partial) return { ...DEFAULT_TEAM_PERMISSIONS };

    const merged: TeamPermissions = JSON.parse(JSON.stringify(DEFAULT_TEAM_PERMISSIONS));
    for (const [group, actions] of Object.entries(partial) as [keyof TeamPermissions, Record<string, boolean>][]) {
      if (merged[group] && typeof actions === 'object') {
        (merged[group] as Record<string, boolean>) = {
          ...(merged[group] as Record<string, boolean>),
          ...actions,
        };
      }
    }
    return merged;
  }
}
