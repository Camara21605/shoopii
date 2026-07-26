/* ============================================================
 * FICHIER      : src/modules/company-team/services/team-permission-template.service.ts
 * MODULE       : Company Team
 * ROLE         : Gestion des modèles de permissions réutilisables.
 *
 * RESPONSABILITES :
 *   - Lister les modèles système + les modèles personnalisés d'une entreprise.
 *   - Créer / modifier / supprimer des modèles personnalisés.
 *   - Appliquer un modèle à un membre (copie les permissions).
 *   - Empêcher la modification des modèles système par les entreprises.
 *
 * RÈGLE MÉTIER :
 *   - Un modèle système (isSystem = true) est en lecture seule pour les entreprises.
 *   - L'application d'un modèle ÉCRASE les permissions actuelles du membre.
 *   - Le propriétaire peut ensuite affiner les permissions individuellement.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  ForbiddenException, Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Or, Repository } from 'typeorm';

import { TeamPermissionTemplate }  from '../../../database/entities/company-team/team-permission-template.entity';
import { CompanyTeamPermissionService } from './company-team-permission.service';

import { CreatePermissionTemplateDto, UpdatePermissionTemplateDto } from '../dto/permission-template.dto';

@Injectable()
export class TeamPermissionTemplateService {

  constructor(
    @InjectRepository(TeamPermissionTemplate)
    private readonly templateRepo: Repository<TeamPermissionTemplate>,

    private readonly permissionService: CompanyTeamPermissionService,
  ) {}

  // ════════════════════════════════════════════════════════════
  // LISTE
  // ════════════════════════════════════════════════════════════

  /**
   * Retourne les modèles disponibles pour une entreprise :
   * - Tous les modèles système (companyId = null)
   * - Les modèles personnalisés de cette entreprise
   */
  async getAll(companyId: string): Promise<TeamPermissionTemplate[]> {
    return this.templateRepo.find({
      where: [
        { companyId: IsNull() },
        { companyId },
      ],
      order: { isSystem: 'DESC', name: 'ASC' },
    });
  }

  /** Retourne un modèle par son identifiant */
  async getById(id: string, companyId?: string): Promise<TeamPermissionTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });

    if (!template) throw new NotFoundException('Modèle de permissions introuvable.');

    /* Vérifier que le modèle appartient à cette entreprise ou est système */
    if (!template.isSystem && companyId && template.companyId !== companyId) {
      throw new ForbiddenException('Accès refusé à ce modèle de permissions.');
    }

    return template;
  }

  // ════════════════════════════════════════════════════════════
  // CRÉATION / MODIFICATION / SUPPRESSION
  // ════════════════════════════════════════════════════════════

  /** Crée un modèle personnalisé pour une entreprise */
  async create(
    companyId: string,
    ownerUserId: string,
    dto: CreatePermissionTemplateDto,
  ): Promise<TeamPermissionTemplate> {
    const template = this.templateRepo.create({
      companyId,
      name:             dto.name,
      description:      dto.description,
      permissions:      dto.permissions,
      isSystem:         false,
      createdByUserId:  ownerUserId,
    });

    return this.templateRepo.save(template);
  }

  /** Met à jour un modèle personnalisé */
  async update(
    id: string,
    companyId: string,
    dto: UpdatePermissionTemplateDto,
  ): Promise<TeamPermissionTemplate> {
    const template = await this.getById(id, companyId);

    if (template.isSystem) {
      throw new ForbiddenException('Les modèles système ne peuvent pas être modifiés.');
    }

    if (dto.name)        template.name        = dto.name;
    if (dto.description) template.description = dto.description;
    if (dto.permissions) template.permissions = dto.permissions;

    return this.templateRepo.save(template);
  }

  /** Supprime un modèle personnalisé */
  async delete(id: string, companyId: string): Promise<{ message: string }> {
    const template = await this.getById(id, companyId);

    if (template.isSystem) {
      throw new ForbiddenException('Les modèles système ne peuvent pas être supprimés.');
    }

    await this.templateRepo.remove(template);
    return { message: 'Modèle supprimé.' };
  }

  // ════════════════════════════════════════════════════════════
  // APPLICATION D'UN MODÈLE
  // ════════════════════════════════════════════════════════════

  /**
   * Applique les permissions d'un modèle à un membre.
   * Les permissions actuelles du membre sont entièrement remplacées.
   */
  async applyToMember(
    templateId: string,
    memberId:   string,
    companyId:  string,
  ): Promise<{ message: string }> {
    const template = await this.getById(templateId, companyId);

    await this.permissionService.update(memberId, template.permissions);

    return { message: `Modèle "${template.name}" appliqué au membre.` };
  }
}
