/* ============================================================
 * FICHIER : src/modules/commande/commande.controller.ts
 *
 * Contrôleurs de la chaîne de validation des commandes :
 *   - ClientCommandeController     → POST /client/commandes, GET /client/commandes
 *   - CommandeController           → GET/POST /commandes/:id/*
 *   - EntrepriseCommandeController → GET /entreprise/commandes
 * ============================================================ */

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, CurrentUser } from '../../common/decorators/roles.decorator';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';

import { CommandeCreationService } from './services/commande-creation.service';
import { CommandeQueryService } from './services/commande-query.service';
import { CommandeValidationService } from './services/commande-validation.service';
import { CommandeFeedbackService } from './services/commande-feedback.service';
import { CommandeLivreurAssignmentService } from './services/commande-livreur-assignment.service';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { ValiderEtapeDto } from './dto/valider-etape.dto';
import { EnvoyerNotationsDto, LitigeDto } from './dto/notation.dto';
import { RefuserMissionDto } from './dto/refuser-mission.dto';
import { AssignLivreurDto } from './dto/assign-livreur.dto';

/* ── /client/commandes ── */
@Controller('client/commandes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class ClientCommandeController {
  constructor(
    private readonly creationService: CommandeCreationService,
    private readonly queryService: CommandeQueryService,
    private readonly assignmentService: CommandeLivreurAssignmentService,
  ) {}

  @Post()
  creer(@Body() dto: CreateCommandeDto, @CurrentUser() user: User) {
    return this.creationService.creerDepuisPanier(user, dto);
  }

  @Get()
  list(@CurrentUser() user: User) {
    return this.queryService.listClient(user);
  }

  /** Choisir un autre livreur (ex. après refus du premier) */
  @Patch(':id/livreur')
  assignerLivreur(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignLivreurDto,
    @CurrentUser() user: User,
  ) {
    return this.assignmentService.assignerParClient(user, id, dto.livreurId);
  }
}

/* ── /commandes/:id — page de suivi (tous rôles authentifiés) ── */
@Controller('commandes')
@UseGuards(JwtAuthGuard)
export class CommandeController {
  constructor(
    private readonly queryService: CommandeQueryService,
    private readonly validationService: CommandeValidationService,
    private readonly feedbackService: CommandeFeedbackService,
  ) {}

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: User) {
    return this.queryService.getCommandeDetail(id, user);
  }

  @Post(':id/valider')
  valider(@Param('id') id: string, @Body() dto: ValiderEtapeDto, @CurrentUser() user: User) {
    return this.validationService.validerEtape(id, user, dto);
  }

  @Post(':id/notes')
  notes(@Param('id') id: string, @Body() dto: EnvoyerNotationsDto, @CurrentUser() user: User) {
    return this.feedbackService.envoyerNotations(id, user, dto);
  }

  @Post(':id/litige')
  litige(@Param('id') id: string, @Body() dto: LitigeDto, @CurrentUser() user: User) {
    return this.feedbackService.signalerProbleme(id, user, dto);
  }
}

/* ── GET /entreprise/commandes ── */
@Controller('entreprise/commandes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY)
export class EntrepriseCommandeController {
  constructor(
    private readonly queryService: CommandeQueryService,
    private readonly assignmentService: CommandeLivreurAssignmentService,
  ) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.queryService.listEntreprise(user);
  }

  /** Assigner ou changer le livreur sur une commande de l'entreprise */
  @Patch(':id/livreur')
  assignerLivreur(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignLivreurDto,
    @CurrentUser() user: User,
  ) {
    return this.assignmentService.assignerParEntreprise(user, id, dto.livreurId);
  }
}

/* ── GET /livreur/missions ── */
@Controller('livreur/missions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DELIVERY)
export class LivreurMissionsController {
  constructor(
    private readonly queryService: CommandeQueryService,
    private readonly assignmentService: CommandeLivreurAssignmentService,
  ) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.queryService.listLivreur(user);
  }

  /** Accepter la mission assignée — génère le code de validation LIVREUR */
  @Patch(':id/accepter')
  accepter(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.assignmentService.accepter(user, id);
  }

  /** Refuser la mission — motif obligatoire, libère le livreur de la commande */
  @Patch(':id/refuser')
  refuser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefuserMissionDto,
    @CurrentUser() user: User,
  ) {
    return this.assignmentService.refuser(user, id, dto.reason);
  }
}

/* ── GET /livreur/historique ── */
@Controller('livreur/historique')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DELIVERY)
export class LivreurHistoriqueController {
  constructor(private readonly queryService: CommandeQueryService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.queryService.listLivreurHistorique(user);
  }
}

/* ── GET /livreur/encours ── */
@Controller('livreur/encours')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DELIVERY)
export class LivreurEnCoursController {
  constructor(private readonly queryService: CommandeQueryService) {}

  @Get()
  get(@CurrentUser() user: User) {
    return this.queryService.getLivreurEnCours(user);
  }
}
