/* ============================================================
 * FICHIER      : src/modules/company-team/company-team.controller.ts
 * MODULE       : Company Team
 * ROLE         : Points d'entrée HTTP pour la gestion de l'équipe entreprise.
 *
 * ROUTES PHASE 1 :
 *   GET    /company-team/stats                         — statistiques équipe
 *   GET    /company-team/members                       — liste des membres
 *   POST   /company-team/members                       — ajouter un membre
 *   GET    /company-team/members/:id                   — détail d'un membre
 *   PATCH  /company-team/members/:id                   — modifier un membre
 *   DELETE /company-team/members/:id                   — supprimer (soft)
 *   POST   /company-team/members/:id/suspend           — suspendre
 *   POST   /company-team/members/:id/reactivate        — réactiver
 *   POST   /company-team/members/:id/reset-password    — réinitialiser MDP
 *   PATCH  /company-team/members/:id/permissions       — modifier permissions
 *   GET    /company-team/members/:id/activity          — journal activité
 *   GET    /company-team/audit-log                     — journal audit
 *
 * ROUTES PHASE 2 (Extensions) :
 *   GET    /company-team/my-permissions                — permissions du user courant
 *   GET    /company-team/permission-schema             — schéma dynamique de permissions
 *   GET    /company-team/plan                          — plan actif de l'entreprise
 *   GET    /company-team/invitations                   — liste des invitations
 *   POST   /company-team/invitations                   — créer une invitation
 *   POST   /company-team/invitations/:id/resend        — renvoyer
 *   DELETE /company-team/invitations/:id               — annuler
 *   GET    /company-team/invitations/accept/:token     — info invitation (public)
 *   POST   /company-team/invitations/accept/:token     — accepter invitation (public)
 *   GET    /company-team/permission-templates          — liste des modèles
 *   POST   /company-team/permission-templates          — créer un modèle
 *   PATCH  /company-team/permission-templates/:id      — modifier un modèle
 *   DELETE /company-team/permission-templates/:id      — supprimer un modèle
 *   POST   /company-team/permission-templates/:id/apply/:memberId — appliquer
 *
 * SÉCURITÉ :
 *   - JwtAuthGuard (global) — toutes les routes privées requièrent un JWT
 *   - @Roles(UserRole.COMPANY) — réservé aux utilisateurs company
 *   - TeamOwnerGuard — modifications réservées au propriétaire
 *   - Routes d'acceptation d'invitation : PUBLIC (pas de JWT)
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Req,
  ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';

import { JwtAuthGuard }    from '../../common/guards/auth.guard';
import { RolesGuard }      from '../../common/guards/roles.guard';
import { Roles }           from '../../common/decorators/roles.decorator';
import { UserRole }        from '../../common/enums/user-role.enum';
import { TeamOwnerGuard }  from './guards/team-owner.guard';
import { User }            from '../../database/entities/user.entity';
import { Public }          from '../../common/decorators/public.decorator';

import { CompanyTeamService }                from './services/company-team.service';
import { CompanyTeamActivityService }        from './services/company-team-activity.service';
import { CompanyTeamAuditService }           from './services/company-team-audit.service';
import { CompanyTeamInvitationService }      from './services/company-team-invitation.service';
import { TeamPlanConfigService }             from './services/team-plan-config.service';
import { TeamPermissionDefinitionService }   from './services/team-permission-definition.service';
import { TeamPermissionTemplateService }     from './services/team-permission-template.service';

import { CreateTeamMemberDto }     from './dto/create-member.dto';
import { UpdateTeamMemberDto, SuspendMemberDto } from './dto/update-member.dto';
import { UpdatePermissionDto }     from './dto/update-permission.dto';
import { QueryTeamDto, QueryActivityDto } from './dto/query-team.dto';
import { CreateInvitationDto, AcceptInvitationDto } from './dto/invitation.dto';
import { CreatePermissionTemplateDto, UpdatePermissionTemplateDto } from './dto/permission-template.dto';

type AuthRequest = Request & {
  user: User & { actorId?: string };
  resolvedCompanyId?: string;
};

@Controller('company-team')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY)
export class CompanyTeamController {

  constructor(
    private readonly teamService:            CompanyTeamService,
    private readonly activityService:        CompanyTeamActivityService,
    private readonly auditService:           CompanyTeamAuditService,
    private readonly invitationService:      CompanyTeamInvitationService,
    private readonly planConfigService:      TeamPlanConfigService,
    private readonly permDefinitionService:  TeamPermissionDefinitionService,
    private readonly templateService:        TeamPermissionTemplateService,
  ) {}

  // ── Helpers ────────────────────────────────────────────────

  private resolveCompanyId(req: AuthRequest): string {
    const id = req.resolvedCompanyId ?? req.user?.actorId;
    if (!id) throw new Error('Impossible de résoudre le companyId depuis la requête.');
    return id;
  }

  private getIp(req: AuthRequest): string | undefined {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip ?? undefined;
  }

  private getUA(req: AuthRequest): string | undefined {
    return req.headers['user-agent'] as string | undefined;
  }

  // ════════════════════════════════════════════════════════════
  // PHASE 1 — STATISTIQUES
  // ════════════════════════════════════════════════════════════

  @Get('stats')
  async getStats(@Req() req: AuthRequest) {
    const companyId = this.resolveCompanyId(req);
    return this.teamService.getTeamStats(companyId);
  }

  // ════════════════════════════════════════════════════════════
  // PHASE 1 — MEMBRES
  // ════════════════════════════════════════════════════════════

  @Get('members')
  async getMembers(@Req() req: AuthRequest, @Query() query: QueryTeamDto) {
    const companyId = this.resolveCompanyId(req);
    return this.teamService.getMembers(companyId, query);
  }

  @Post('members')
  @UseGuards(TeamOwnerGuard)
  @HttpCode(HttpStatus.CREATED)
  async addMember(@Req() req: AuthRequest, @Body() dto: CreateTeamMemberDto) {
    const companyId = this.resolveCompanyId(req);
    return this.teamService.addMember(companyId, req.user.id, dto, this.getIp(req), this.getUA(req));
  }

  @Get('members/:id')
  async getMember(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) memberId: string) {
    const companyId = this.resolveCompanyId(req);
    return this.teamService.getMember(companyId, memberId);
  }

  @Patch('members/:id')
  @UseGuards(TeamOwnerGuard)
  async updateMember(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    const companyId = this.resolveCompanyId(req);
    return this.teamService.updateMember(companyId, memberId, req.user.id, dto, this.getIp(req));
  }

  @Delete('members/:id')
  @UseGuards(TeamOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async removeMember(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) memberId: string) {
    const companyId = this.resolveCompanyId(req);
    return this.teamService.removeMember(companyId, memberId, req.user.id, this.getIp(req));
  }

  @Post('members/:id/suspend')
  @UseGuards(TeamOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async suspendMember(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) memberId: string,
    @Body() dto: SuspendMemberDto,
  ) {
    const companyId = this.resolveCompanyId(req);
    return this.teamService.suspendMember(companyId, memberId, req.user.id, dto, this.getIp(req));
  }

  @Post('members/:id/reactivate')
  @UseGuards(TeamOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async reactivateMember(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) memberId: string) {
    const companyId = this.resolveCompanyId(req);
    return this.teamService.reactivateMember(companyId, memberId, req.user.id, this.getIp(req));
  }

  @Post('members/:id/reset-password')
  @UseGuards(TeamOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Req() req: AuthRequest, @Param('id', ParseUUIDPipe) memberId: string) {
    const companyId = this.resolveCompanyId(req);
    return this.teamService.resetMemberPassword(companyId, memberId, req.user.id, this.getIp(req));
  }

  @Patch('members/:id/permissions')
  @UseGuards(TeamOwnerGuard)
  async updatePermissions(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    const companyId = this.resolveCompanyId(req);
    return this.teamService.updatePermissions(companyId, memberId, req.user.id, dto, this.getIp(req));
  }

  @Get('members/:id/activity')
  async getMemberActivity(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) memberId: string,
    @Query() query: QueryActivityDto,
  ) {
    const companyId = this.resolveCompanyId(req);
    await this.teamService.getMember(companyId, memberId);
    return this.activityService.getMemberActivity(memberId, query);
  }

  @Get('audit-log')
  @UseGuards(TeamOwnerGuard)
  async getAuditLog(
    @Req() req: AuthRequest,
    @Query('page')  page?: number,
    @Query('limit') limit?: number,
  ) {
    const companyId = this.resolveCompanyId(req);
    return this.auditService.getCompanyAuditLog(
      companyId,
      page  ? Number(page)  : 1,
      limit ? Number(limit) : 30,
    );
  }

  // ════════════════════════════════════════════════════════════
  // PHASE 2 — MES PERMISSIONS (propriétaire OU collaborateur)
  // ════════════════════════════════════════════════════════════

  /**
   * Retourne les permissions du user courant.
   * - Propriétaire → { isOwner: true, permissions: null }
   * - Collaborateur → { isOwner: false, permissions: {...} }
   */
  @Get('my-permissions')
  async getMyPermissions(@Req() req: AuthRequest) {
    const companyId = this.resolveCompanyId(req);
    return this.teamService.getMyPermissions(companyId, req.user.id);
  }

  // ════════════════════════════════════════════════════════════
  // PHASE 2 — SCHÉMA DE PERMISSIONS DYNAMIQUE
  // ════════════════════════════════════════════════════════════

  @Get('permission-schema')
  async getPermissionSchema() {
    return this.permDefinitionService.getActiveSchema();
  }

  // ════════════════════════════════════════════════════════════
  // PHASE 2 — PLAN DE L'ENTREPRISE
  // ════════════════════════════════════════════════════════════

  @Get('plan')
  async getCompanyPlan(@Req() req: AuthRequest) {
    const companyId = this.resolveCompanyId(req);
    const plan      = await this.planConfigService.getCompanyPlan(companyId);
    try {
      const config = await this.planConfigService.getConfig(plan);
      return {
        plan:       config.planSlug,
        name:       config.name,
        maxMembers: config.maxMembers,
        features:   config.features ?? [],
      };
    } catch {
      /* Table team_plan_configs non seedée — retourner des valeurs par défaut */
      return { plan, name: 'Standard', maxMembers: 5, features: [] };
    }
  }

  // ════════════════════════════════════════════════════════════
  // PHASE 2 — INVITATIONS
  // ════════════════════════════════════════════════════════════

  @Get('invitations')
  @UseGuards(TeamOwnerGuard)
  async getInvitations(@Req() req: AuthRequest, @Query('all') all?: string) {
    const companyId = this.resolveCompanyId(req);
    return all === 'true'
      ? this.invitationService.getAll(companyId)
      : this.invitationService.getPending(companyId);
  }

  @Post('invitations')
  @UseGuards(TeamOwnerGuard)
  @HttpCode(HttpStatus.CREATED)
  async createInvitation(@Req() req: AuthRequest, @Body() dto: CreateInvitationDto) {
    const companyId = this.resolveCompanyId(req);
    return this.invitationService.create(companyId, req.user.id, dto);
  }

  @Post('invitations/:id/resend')
  @UseGuards(TeamOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async resendInvitation(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) invitationId: string,
  ) {
    const companyId = this.resolveCompanyId(req);
    return this.invitationService.resend(invitationId, companyId, req.user.id);
  }

  @Delete('invitations/:id')
  @UseGuards(TeamOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async cancelInvitation(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) invitationId: string,
  ) {
    const companyId = this.resolveCompanyId(req);
    return this.invitationService.cancel(invitationId, companyId, req.user.id);
  }

  /* ── Endpoints PUBLICS pour l'acceptation d'invitation ── */

  /**
   * Retourne les informations publiques d'une invitation.
   * Pas de JWT requis — utilisé par la page d'acceptation frontend.
   */
  @Get('invitations/accept/:token')
  @Public()
  @SkipThrottle()
  async getInvitationInfo(@Param('token') token: string) {
    return this.invitationService.getPublicInfo(token);
  }

  /**
   * Accepte l'invitation et crée le compte collaborateur.
   * Pas de JWT requis — le token dans l'URL sert d'authentification.
   */
  @Post('invitations/accept/:token')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async acceptInvitation(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? (req as any).ip;
    return this.invitationService.accept(token, dto, ip);
  }

  // ════════════════════════════════════════════════════════════
  // PHASE 2 — MODÈLES DE PERMISSIONS
  // ════════════════════════════════════════════════════════════

  @Get('permission-templates')
  async getTemplates(@Req() req: AuthRequest) {
    const companyId = this.resolveCompanyId(req);
    return this.templateService.getAll(companyId);
  }

  @Post('permission-templates')
  @UseGuards(TeamOwnerGuard)
  @HttpCode(HttpStatus.CREATED)
  async createTemplate(@Req() req: AuthRequest, @Body() dto: CreatePermissionTemplateDto) {
    const companyId = this.resolveCompanyId(req);
    return this.templateService.create(companyId, req.user.id, dto);
  }

  @Patch('permission-templates/:id')
  @UseGuards(TeamOwnerGuard)
  async updateTemplate(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) templateId: string,
    @Body() dto: UpdatePermissionTemplateDto,
  ) {
    const companyId = this.resolveCompanyId(req);
    return this.templateService.update(templateId, companyId, dto);
  }

  @Delete('permission-templates/:id')
  @UseGuards(TeamOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async deleteTemplate(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) templateId: string,
  ) {
    const companyId = this.resolveCompanyId(req);
    return this.templateService.delete(templateId, companyId);
  }

  @Post('permission-templates/:id/apply/:memberId')
  @UseGuards(TeamOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async applyTemplate(
    @Req() req: AuthRequest,
    @Param('id',       ParseUUIDPipe) templateId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    const companyId = this.resolveCompanyId(req);
    return this.templateService.applyToMember(templateId, memberId, companyId);
  }
}
