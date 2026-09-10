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
import { AdminCommunicationService } from './services/admin-communication.service';
import { UpdateCommunicationDto }    from './dto/update-communication.dto';
import { AuditMeta }                 from './helpers/admin.helpers';

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
    private readonly communication: AdminCommunicationService,
  ) {}

  // ── Taux de commission ───────────────────────────────────────
  getTaux()                                        { return this.taux.getTaux(); }

  // ── Profil admin (sidebar) + Vue d'ensemble ──────────────────
  getAdminProfile(userId: string)                  { return this.overview.getAdminProfile(userId); }
  getOverview(userId: string)                      { return this.overview.getOverview(userId); }

  // ── Codes de création ────────────────────────────────────────
  getCodes(userId: string, page?: number, limit?: number) { return this.codes.getCodes(userId, page, limit); }
  generateCode(userId: string, dto: any, meta?: AuditMeta)          { return this.codes.generateCode(userId, dto, meta); }
  revokeCode(userId: string, codeId: string, meta?: AuditMeta)      { return this.codes.revokeCode(userId, codeId, meta); }
  sendCodeByEmail(userId: string, codeId: string, meta?: AuditMeta) { return this.codes.sendCodeByEmail(userId, codeId, meta); }

  // ── Acteurs de la zone + Validations ────────────────────────
  getActeurs(userId: string, role?: string, search?: string, page?: number, limit?: number) {
    return this.acteurs.getActeurs(userId, role, search, page, limit);
  }
  getValidations(userId: string)                   { return this.acteurs.getValidations(userId); }
  approveValidation(adminId: string, id: string, meta?: AuditMeta)   { return this.acteurs.approveValidation(adminId, id, meta); }
  rejectValidation(adminId: string, id: string, meta?: AuditMeta)    { return this.acteurs.rejectValidation(adminId, id, meta); }
  suspendActeur(adminId: string, id: string, motif?: string, meta?: AuditMeta) { return this.acteurs.suspendActeur(adminId, id, motif, meta); }
  reactivateActeur(adminId: string, id: string, meta?: AuditMeta) { return this.acteurs.reactivateActeur(adminId, id, meta); }

  // ── Partenaires ──────────────────────────────────────────────
  getPartenaires(userId: string, tier?: string, search?: string, page?: number, limit?: number) {
    return this.partenaires.getPartenaires(userId, tier, search, page, limit);
  }

  // ── Signalements ─────────────────────────────────────────────
  getSignalements(userId: string, page?: number, limit?: number) {
    return this.signalements.getSignalements(userId, page, limit);
  }
  getSignalementById(userId: string, id: string) { return this.signalements.getSignalementById(userId, id); }
  resolveSignalement(adminId: string, id: string, meta?: AuditMeta)  { return this.signalements.resolveSignalement(adminId, id, meta); }
  investigateSignalement(adminId: string, id: string, meta?: AuditMeta) { return this.signalements.investigateSignalement(adminId, id, meta); }
  warnSignalement(adminId: string, id: string, meta?: AuditMeta) { return this.signalements.warnSignalement(adminId, id, meta); }
  rejectSignalement(adminId: string, id: string, reason?: string, meta?: AuditMeta) { return this.signalements.rejectSignalement(adminId, id, reason, meta); }

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

  // ── Communication (message/signature d'invitation + modèles) ─
  getCommunication(userId: string)                              { return this.communication.getSettings(userId); }
  updateCommunication(userId: string, dto: UpdateCommunicationDto) { return this.communication.updateSettings(userId, dto); }
}
