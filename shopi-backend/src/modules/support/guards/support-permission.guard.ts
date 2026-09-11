/* ============================================================
 * FICHIER      : src/modules/support/guards/support-permission.guard.ts
 * MODULE       : Support
 * ROLE         : Applique RÉELLEMENT la permission "support" — jusqu'ici,
 *                le toggle "Support" du panneau super-admin "Permissions"
 *                (PermissionsSection.tsx, AdminsService.DEFAULT_PERMISSIONS
 *                .support) était enregistré en base mais jamais vérifié
 *                par SupportAgentController : n'importe quel ADMIN avait
 *                accès à /support/agent/* quel que soit ce toggle. Même
 *                classe de bug que geo_zones (voir geo.service.ts
 *                assertZonePermission) et payments/wallet côté company-team
 *                (voir TeamPermissionGuard).
 *
 * COMMENT ÇA MARCHE :
 *   - SUPER_ADMIN → accès complet inconditionnel (portée globale par
 *     conception, voir SupportPermissionService).
 *   - PARTNER → accès complet inconditionnel : sa portée est déjà limitée
 *     à son réseau par SupportPermissionService.resolvePartnerScope(), qui
 *     ne dépend pas de Admin.permissions (Partner n'a pas cette colonne).
 *   - ADMIN → vérifie Admin.permissions.support ; refuse (403) si absente
 *     ou désactivée.
 *   - Autre rôle → ne devrait jamais arriver derrière
 *     @Roles(SUPER_ADMIN, ADMIN, PARTNER) au niveau contrôleur, filet de
 *     sécurité : refuse.
 *
 * UTILISATION :
 *   @UseGuards(JwtAuthGuard, RolesGuard, SupportPermissionGuard)
 *   appliqué au niveau du contrôleur SupportAgentController — couvre
 *   toutes les routes (lecture, mutation, pièces jointes, stats, export).
 *
 * IMPORTANT — SupportModule doit fournir Admin au TypeOrmModule.forFeature
 * (ce garde en dépend directement).
 * ============================================================ */

import {
  Injectable, CanActivate, ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Admin }    from '../../../database/entities/profiles/admin-profile.entity';
import { UserRole } from '../../../common/enums/user-role.enum';

@Injectable()
export class SupportPermissionGuard implements CanActivate {

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req  = context.switchToHttp().getRequest();
    const user = req.user as { id?: string; role?: string } | undefined;
    if (!user?.id) throw new ForbiddenException('Authentification requise.');

    /* SUPER_ADMIN : portée globale, jamais soumis à ce garde. */
    if (user.role === UserRole.SUPER_ADMIN) return true;

    /* PARTNER : portée déjà limitée à son réseau par
     * SupportPermissionService, indépendamment de ce flag (les partenaires
     * n'ont pas de colonne Admin.permissions). */
    if (user.role === UserRole.PARTNER) return true;

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Vous n'avez pas accès au support.");
    }

    const admin = await this.adminRepo.findOne({
      where: { userId: user.id }, select: ['permissions'],
    });
    const perms = admin?.permissions as Record<string, boolean> | null;
    if (!perms?.support) {
      throw new ForbiddenException(
        "Vous n'avez pas la permission de gérer le support client. Contactez le super-administrateur.",
      );
    }

    return true;
  }
}
