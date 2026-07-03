/* ============================================================
 * FICHIER : partenaire-dashboard.module.ts
 *
 * MODULE racine du dashboard partenaire.
 * Miroir du LivreurDashboardModule — assemble le(s) sous-module(s)
 * et les exporte pour que DashboardModule y ait accès.
 *
 * Structure actuelle :
 *   PartenaireDashboardModule
 *     └── PartenaireParametresModule  ← paramètres complets
 *
 * Évolutions futures (à ajouter ici) :
 *   - Stats de recrutement (GET /dashboard/partenaire/stats)
 *   - Historique de commissions (GET /dashboard/partenaire/commissions)
 *
 * Intégration :
 *   DashboardModule → imports: [PartenaireDashboardModule]
 * ============================================================ */

import { Module } from '@nestjs/common';

import { PartenaireParametresModule } from './partenaire-parametres.module';

@Module({
  imports: [
    PartenaireParametresModule,
  ],

  exports: [
    PartenaireParametresModule,
  ],
})
export class PartenaireDashboardModule {}
