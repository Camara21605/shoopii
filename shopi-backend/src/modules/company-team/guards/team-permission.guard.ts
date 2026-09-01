/* ============================================================
 * FICHIER      : src/modules/company-team/guards/team-permission.guard.ts
 * MODULE       : Company Team
 * ROLE         : Applique RÉELLEMENT les permissions granulaires d'un
 *                collaborateur — jusqu'ici, les cases cochées dans le
 *                panneau "Permissions" (Produits, Commandes, Paiements,
 *                Portefeuille…) étaient enregistrées en base mais
 *                n'étaient JAMAIS vérifiées par aucun endpoint : un
 *                collaborateur avait accès à tout, quelles que soient
 *                ses permissions configurées.
 *
 * COMMENT ÇA MARCHE :
 *   - Aucune métadonnée @RequiresTeamPermission sur la route → laisse
 *     passer (comportement inchangé pour toutes les routes non migrées).
 *   - Utilisateur PROPRIÉTAIRE (Company.userId = user.id) → accès
 *     complet inconditionnel, jamais bloqué par ce garde.
 *   - Utilisateur COLLABORATEUR (CompanyTeamMember.userId = user.id) →
 *     vérifie CompanyTeamPermissionService.hasPermission(memberId,
 *     group, action) ; refuse (403) si absente.
 *   - Ni propriétaire ni membre d'équipe connu → refuse (ne devrait
 *     normalement jamais arriver derrière @Roles(UserRole.COMPANY),
 *     filet de sécurité).
 *
 * UTILISATION (voir requires-team-permission.decorator.ts) :
 *   @UseGuards(JwtAuthGuard, RolesGuard, TeamPermissionGuard)
 *   @RequiresTeamPermission('payments', 'view')
 *   @Get('finances')
 *
 * IMPORTANT — CompanyTeamModule doit être importé par le module qui
 * utilise ce garde (il fournit TeamPermissionGuard, CompanyTeamPermissionService
 * et les repos Company/CompanyTeamMember dont il dépend).
 *
 * AUTEUR       : Shopi03
 * ============================================================ */

import {
  Injectable, CanActivate, ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector }        from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { Company }           from '../../../database/entities/profiles/entreprise-profile.entity';
import { CompanyTeamMember } from '../../../database/entities/company-team/company-team-member.entity';
import { CompanyTeamPermissionService } from '../services/company-team-permission.service';
import { TEAM_PERMISSION_KEY, RequiredTeamPermission } from '../decorators/requires-team-permission.decorator';

@Injectable()
export class TeamPermissionGuard implements CanActivate {

  constructor(
    private readonly reflector: Reflector,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(CompanyTeamMember)
    private readonly memberRepo: Repository<CompanyTeamMember>,

    private readonly permissionService: CompanyTeamPermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<RequiredTeamPermission | undefined>(
      TEAM_PERMISSION_KEY, context.getHandler(),
    );
    /* Route non annotée → ce garde ne change rien (comportement identique
     * à avant sa mise en place — migration route par route, pas d'un coup). */
    if (!required) return true;

    const req  = context.switchToHttp().getRequest();
    const user = req.user as { id?: string } | undefined;
    if (!user?.id) throw new ForbiddenException('Authentification requise.');

    /* Propriétaire → accès complet, jamais soumis aux permissions
     * granulaires (mêmes critères que TeamOwnerGuard). */
    const owned = await this.companyRepo.findOne({
      where: { userId: user.id }, select: ['id'],
    });
    if (owned) return true;

    /* Collaborateur → vérifie sa permission précise pour cette route. */
    const member = await this.memberRepo.findOne({
      where: { userId: user.id }, select: ['id'],
    });
    if (!member) {
      throw new ForbiddenException("Vous n'avez pas accès à cette ressource.");
    }

    const allowed = await this.permissionService.hasPermission(
      member.id, required.group, required.action,
    );
    if (!allowed) {
      throw new ForbiddenException(
        `Votre accès ne couvre pas cette action (${required.group}.${required.action}). ` +
        'Contactez le propriétaire de la boutique pour l\'obtenir.',
      );
    }

    return true;
  }
}
