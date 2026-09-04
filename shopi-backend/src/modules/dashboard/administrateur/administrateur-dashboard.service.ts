/* ============================================================
 * FICHIER : administrateur-dashboard.service.ts
 *
 * FAÇADE du dashboard administrateur.
 *
 * Ce fichier n'implémente aucune logique métier.
 * Il délègue chaque méthode au service de domaine approprié
 * et sert de point d'injection unique pour le contrôleur,
 * ce qui maintient le contrôleur indépendant de l'architecture
 * interne des services.
 *
 * Architecture :
 *
 *   Controller
 *     └─► AdministrateurDashboardService (façade)
 *           ├─► AdminTauxService
 *           ├─► AdminOverviewService   (+ AdminZoneService)
 *           ├─► AdminCodesService      (+ AdminZoneService)
 *           ├─► AdminActeursService    (+ AdminZoneService)
 *           ├─► AdminPartenairesService(+ AdminZoneService)
 *           ├─► AdminSignalementsService(+ AdminZoneService)
 *           ├─► AdminCommandesService  (+ AdminZoneService)
 *           └─► AdminAuditService
 * ============================================================ */

import { Injectable } from '@nestjs/common';

import { AdminTauxService }          from './services/admin-taux.service';
import { AdminOverviewService }      from './services/admin-overview.service';
import { AdminCodesService }         from './services/admin-codes.service';
import { AdminActeursService }       from './services/admin-acteurs.service';
import { AdminPartenairesService }   from './services/admin-partenaires.service';
import { AdminSignalementsService }  from './services/admin-signalements.service';
import { AdminCommandesService }     from './services/admin-commandes.service';
import { AdminAuditService }         from './services/admin-audit.service';
import { AdminClientsService }       from './services/admin-clients.service';
import { AdminStatsService }         from './services/admin-stats.service';

// Ré-export du DTO pour que le contrôleur puisse l'importer depuis ce fichier
export { GenerateCodeDto } from './dto/generate-code.dto';

@Injectable()
export class AdministrateurDashboardService {

  constructor(
    private readonly taux:         AdminTauxService,
    private readonly overview:     AdminOverviewService,
    private readonly codes:        AdminCodesService,
    private readonly acteurs:      AdminActeursService,
    private readonly partenaires:  AdminPartenairesService,
    private readonly signalements: AdminSignalementsService,
    private readonly commandes:    AdminCommandesService,
    private readonly audit:        AdminAuditService,
    private readonly clients:      AdminClientsService,
    private readonly stats:        AdminStatsService,
  ) {}

  // ── Taux de commission ───────────────────────────────────────
  getTaux()                                        { return this.taux.getTaux(); }

  // ── Profil admin (sidebar) + Vue d'ensemble ──────────────────
  getAdminProfile(userId: string)                  { return this.overview.getAdminProfile(userId); }
  getOverview(userId: string)                      { return this.overview.getOverview(userId); }

  // ── Codes de création ────────────────────────────────────────
  getCodes(userId: string, page?: number, limit?: number) { return this.codes.getCodes(userId, page, limit); }
  generateCode(userId: string, dto: any)           { return this.codes.generateCode(userId, dto); }
  revokeCode(userId: string, codeId: string)       { return this.codes.revokeCode(userId, codeId); }
  sendCodeByEmail(userId: string, codeId: string)  { return this.codes.sendCodeByEmail(userId, codeId); }

  // ── Acteurs de la zone + Validations ────────────────────────
  getActeurs(userId: string, role?: string, search?: string, page?: number, limit?: number) {
    return this.acteurs.getActeurs(userId, role, search, page, limit);
  }
  getValidations(userId: string)                   { return this.acteurs.getValidations(userId); }
  approveValidation(adminId: string, id: string)   { return this.acteurs.approveValidation(adminId, id); }
  rejectValidation(adminId: string, id: string)    { return this.acteurs.rejectValidation(adminId, id); }
  suspendActeur(adminId: string, id: string, motif?: string) { return this.acteurs.suspendActeur(adminId, id, motif); }
  reactivateActeur(adminId: string, id: string) { return this.acteurs.reactivateActeur(adminId, id); }

  // ── Partenaires ──────────────────────────────────────────────
  getPartenaires(userId: string, tier?: string, search?: string, page?: number, limit?: number) {
    return this.partenaires.getPartenaires(userId, tier, search, page, limit);
  }

  // ── Signalements ─────────────────────────────────────────────
  getSignalements(userId: string, page?: number, limit?: number) {
    return this.signalements.getSignalements(userId, page, limit);
  }
  getSignalementById(userId: string, id: string) { return this.signalements.getSignalementById(userId, id); }
  resolveSignalement(adminId: string, id: string)  { return this.signalements.resolveSignalement(adminId, id); }
  investigateSignalement(adminId: string, id: string) { return this.signalements.investigateSignalement(adminId, id); }
  warnSignalement(adminId: string, id: string) { return this.signalements.warnSignalement(adminId, id); }
  rejectSignalement(adminId: string, id: string, reason?: string) { return this.signalements.rejectSignalement(adminId, id, reason); }

  // ── Commandes + Finances ─────────────────────────────────────
  getCommandes(userId: string, onglet?: 'toutes' | 'encours' | 'litiges', page?: number, limit?: number) {
    return this.commandes.getCommandes(userId, onglet, page, limit);
  }
  getFinances(userId: string)                      { return this.commandes.getFinances(userId); }

  // ── Journal d'audit ──────────────────────────────────────────
  getAudit(userId: string, page?: number, limit?: number) { return this.audit.getAudit(userId, page, limit); }

  // ── Clients de la zone (lecture seule) ───────────────────────
  getClients(userId: string, search?: string, page?: number, limit?: number) {
    return this.clients.getClients(userId, search, page, limit);
  }

  // ── Statistiques complémentaires ─────────────────────────────
  getStats(userId: string)                         { return this.stats.getStats(userId); }
}
