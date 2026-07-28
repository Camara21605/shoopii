/* ============================================================
 * FICHIER : helpers/admin.constants.ts
 *
 * Tables de correspondance statiques partagées par tous les
 * services du dashboard administrateur.
 * ============================================================ */

import { UserRole }       from '../../../../common/enums/user-role.enum';
import { ReportSeverity } from '../../../../database/entities/report.entity';

/**
 * Préfixe inséré dans le code de création selon le rôle cible.
 * Exemple : PARTNER → "PAR" → code "SHOPI-PAR-XXXXX"
 */
export const ROLE_PREFIX: Partial<Record<UserRole, string>> = {
  [UserRole.PARTNER]:       'PAR',
  [UserRole.COMPANY]:       'ENT',
  [UserRole.DELIVERY]:      'LVR',
  [UserRole.CORRESPONDENT]: 'COR',
};

/**
 * Code court du rôle envoyé au frontend (2-3 lettres minuscules).
 * Utilisé dans les objets de réponse JSON (type: 'par', 'ent'...).
 */
export const ROLE_TO_SHORT: Partial<Record<UserRole, string>> = {
  [UserRole.PARTNER]:       'par',
  [UserRole.COMPANY]:       'ent',
  [UserRole.DELIVERY]:      'lvr',
  [UserRole.CORRESPONDENT]: 'cor',
};

/**
 * Traduit la sévérité d'un signalement en libellé court frontend.
 *   CRITICAL → 'high'
 *   WARNING  → 'med'
 *   INFO     → 'low'
 */
export const SEV_TO_GRAVITE: Record<ReportSeverity, string> = {
  [ReportSeverity.CRITICAL]: 'high',
  [ReportSeverity.WARNING]:  'med',
  [ReportSeverity.INFO]:     'low',
};
