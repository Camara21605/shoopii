/* ============================================================
 * FICHIER      : src/modules/company-team/decorators/requires-team-permission.decorator.ts
 * MODULE       : Company Team
 * ROLE         : Décorateur marquant une route comme exigeant une
 *                permission granulaire précise pour un collaborateur.
 *
 * UTILISATION :
 *   @UseGuards(JwtAuthGuard, RolesGuard, TeamPermissionGuard)
 *   @RequiresTeamPermission('payments', 'view')
 *   @Get('finances')
 *   getFinances(...) { ... }
 *
 * Le PROPRIÉTAIRE de l'entreprise n'est jamais bloqué par ce décorateur
 * (accès complet inconditionnel — voir TeamPermissionGuard). Il ne
 * s'applique qu'aux collaborateurs (CompanyTeamMember).
 *
 * AUTEUR       : Shopi03
 * ============================================================ */

import { SetMetadata } from '@nestjs/common';
import type { TeamPermissions } from '../../../database/entities/company-team/company-team-permission.entity';

export const TEAM_PERMISSION_KEY = 'requiresTeamPermission';

export interface RequiredTeamPermission {
  group:  keyof TeamPermissions;
  action: string;
}

export const RequiresTeamPermission = (group: keyof TeamPermissions, action: string) =>
  SetMetadata(TEAM_PERMISSION_KEY, { group, action } as RequiredTeamPermission);
