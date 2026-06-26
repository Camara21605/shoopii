/* ============================================================
 * FICHIER : src/modules/promotions/promotions.controller.ts
 *
 * RÔLE    : Controller unique pour toutes les routes promotions.
 *           Délègue à PromotionsService et PromoCodeService
 *           selon la route appelée.
 *
 * ─── ROUTES EXPOSÉES ─────────────────────────────────────────
 *
 *  CRUD PROMOTIONS (entreprise connectée) :
 *  ┌─────────────────────────────────────────────────────────┐
 *  │ POST   /promotions              → créer une promo        │
 *  │ GET    /promotions              → lister ses promos      │
 *  │ GET    /promotions/stats        → KPIs du dashboard      │
 *  │ GET    /promotions/:id          → détail d'une promo     │
 *  │ PATCH  /promotions/:id          → modifier une promo     │
 *  │ DELETE /promotions/:id          → supprimer une promo    │
 *  │ PATCH  /promotions/:id/activate → activer une promo      │
 *  │ PATCH  /promotions/:id/pause    → mettre en pause        │
 *  │ PATCH  /promotions/:id/end      → terminer manuellement  │
 *  └─────────────────────────────────────────────────────────┘
 *
 *  VALIDATION CODE (checkout client) :
 *  ┌─────────────────────────────────────────────────────────┐
 *  │ POST   /promotions/validate-code → valider un code promo │
 *  └─────────────────────────────────────────────────────────┘
 *
 * ─── SÉCURITÉ ────────────────────────────────────────────────
 *
 *  Toutes les routes sont protégées par JwtAuthGuard.
 *  Les routes CRUD exigent le rôle COMPANY.
 *  La route validate-code accepte aussi le rôle CLIENT.
 *
 * ─── CORRESPONDANCE AVEC PromotionsPage.tsx ──────────────────
 *
 *  "Créer une promotion" button    → POST   /promotions
 *  Onglets filtres (Actives…)      → GET    /promotions?status=active
 *  Bouton "Activer" sur une carte  → PATCH  /promotions/:id/activate
 *  Bouton "Suspendre" sur une carte→ PATCH  /promotions/:id/pause
 *  Bouton "Modifier"               → PATCH  /promotions/:id
 *  KPI cards (4 métriques)         → GET    /promotions/stats
 *  Checkout client (code promo)    → POST   /promotions/validate-code
 *
 * ============================================================ */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard }    from 'src/common/guards/auth.guard';
import { RolesGuard }      from 'src/common/guards/roles.guard';
import { Roles }           from 'src/common/decorators/roles.decorator';
import { UserRole }        from 'src/common/enums/user-role.enum';

import { PromotionsService }  from './services/promotions.service';
import { PromoCodeService }   from './services/promo-code.service';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  ValidateCodeDto,
  FilterPromotionsDto,
} from './dto/promotion.dto';

// ─────────────────────────────────────────────────────────────
// CONTROLLER
// ─────────────────────────────────────────────────────────────

@Controller('promotions')
@UseGuards(JwtAuthGuard, RolesGuard)  // tous les endpoints protégés par JWT
export class PromotionsController {

  constructor(
    // Service CRUD principal des promotions
    private readonly promotionsService: PromotionsService,
    // Service de validation des codes promo au checkout
    private readonly promoCodeService:  PromoCodeService,
  ) {}

  // ════════════════════════════════════════════════════════════
  // STATS — GET /promotions/stats
  //
  // ⚠️ IMPORTANT : cette route DOIT être AVANT /:id
  //    sinon Express interprète "stats" comme un UUID et
  //    tombe sur la route GET /promotions/:id avec un 400.
  //
  // Retourne les 4 KPI cards de PromotionsPage.tsx :
  //   total, actives, planifiées, brouillons, totalUses, totalCa
  //
  // Rôle requis : COMPANY
  // ════════════════════════════════════════════════════════════

  @Get('stats')
  @Roles(UserRole.COMPANY)
  async getStats(@Req() req: any) {
    return this.promotionsService.getStats(req.user);
  }

  // ════════════════════════════════════════════════════════════
  // VALIDATE CODE — POST /promotions/validate-code
  //
  // ⚠️ IMPORTANT : cette route DOIT être AVANT /:id
  //    pour la même raison que "stats".
  //
  // Appelé par le frontend au checkout quand le client
  // saisit un code promo dans son panier.
  //
  // Corps : { code, companyId, cartTotal, productIds?, clientId? }
  //
  // Retourne :
  //   { valid, discount, newTotal, freeShipping, label, promo }
  //
  // Rôle requis : CLIENT ou COMPANY (pour tester)
  // ════════════════════════════════════════════════════════════

  @Post('validate-code')
  @HttpCode(HttpStatus.OK)  // 200 et non 201 (pas de ressource créée)
  @Roles(UserRole.CLIENT, UserRole.COMPANY, UserRole.SUPER_ADMIN)
  async validateCode(@Body() dto: ValidateCodeDto) {
    return this.promoCodeService.validateCode(dto);
  }

  // ════════════════════════════════════════════════════════════
  // CREATE — POST /promotions
  //
  // Crée une nouvelle promotion en statut DRAFT.
  // Correspond au bouton "Créer la promotion" de la modale
  // dans PromotionsPage.tsx.
  //
  // Corps : CreatePromotionDto (nom, code, type, scope, productIds…)
  //
  // Rôle requis : COMPANY
  // ════════════════════════════════════════════════════════════

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.COMPANY)
  async create(
    @Body() dto: CreatePromotionDto,
    @Req()  req: any,
  ) {
    return this.promotionsService.create(dto, req.user);
  }

  // ════════════════════════════════════════════════════════════
  // LIST — GET /promotions
  //
  // Liste toutes les promotions de l'entreprise connectée.
  // Supporte le filtrage via query params.
  //
  // Query params :
  //   ?status=active       → filtre par statut
  //   ?type=discount       → filtre par type
  //   ?scope=products      → filtre par portée
  //   ?search=soldes       → recherche sur nom ou code
  //   ?page=1&limit=20     → pagination
  //
  // Correspond aux onglets "Actives / Planifiées / Brouillons"
  // dans PromotionsPage.tsx.
  //
  // Rôle requis : COMPANY
  // ════════════════════════════════════════════════════════════

  @Get()
  @Roles(UserRole.COMPANY)
  async findAll(
    @Query() dto: FilterPromotionsDto,
    @Req()   req: any,
  ) {
    return this.promotionsService.findAll(dto, req.user);
  }

  // ════════════════════════════════════════════════════════════
  // GET ONE — GET /promotions/:id
  //
  // Retourne le détail complet d'une promotion.
  // Vérifie que la promo appartient à l'entreprise connectée.
  //
  // Rôle requis : COMPANY
  // ════════════════════════════════════════════════════════════

  @Get(':id')
  @Roles(UserRole.COMPANY)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req()                      req: any,
  ) {
    return this.promotionsService.findOne(id, req.user);
  }

  // ════════════════════════════════════════════════════════════
  // UPDATE — PATCH /promotions/:id
  //
  // Modifie une promotion existante.
  // Tous les champs sont optionnels (PartialType).
  //
  // Peut modifier :
  //   - Le nom, code, type, valeur, dates
  //   - La portée et les produits ciblés
  //   - Le stock flash, les conditions bundle
  //
  // Rôle requis : COMPANY
  // ════════════════════════════════════════════════════════════

  @Patch(':id')
  @Roles(UserRole.COMPANY)
  async update(
    @Param('id', ParseUUIDPipe) id:  string,
    @Body()                     dto: UpdatePromotionDto,
    @Req()                      req: any,
  ) {
    return this.promotionsService.update(id, dto, req.user);
  }

  // ════════════════════════════════════════════════════════════
  // DELETE — DELETE /promotions/:id
  //
  // Supprime définitivement une promotion.
  // ⚠️ Impossible si status = ACTIVE → mettre en pause d'abord.
  //
  // Rôle requis : COMPANY
  // ════════════════════════════════════════════════════════════

  @Delete(':id')
  @Roles(UserRole.COMPANY)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req()                      req: any,
  ) {
    return this.promotionsService.remove(id, req.user);
  }

  // ════════════════════════════════════════════════════════════
  // ACTIVATE — PATCH /promotions/:id/activate
  //
  // Passe la promotion de DRAFT ou PAUSED → ACTIVE.
  // Correspond au bouton "Activer" sur les cartes brouillons
  // dans PromotionsPage.tsx.
  //
  // Vérifie avant l'activation :
  //   - endDate non dépassée
  //   - scope = products → au moins 1 produit ciblé
  //
  // Rôle requis : COMPANY
  // ════════════════════════════════════════════════════════════

  @Patch(':id/activate')
  @Roles(UserRole.COMPANY)
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req()                      req: any,
  ) {
    return this.promotionsService.activate(id, req.user);
  }

  // ════════════════════════════════════════════════════════════
  // PAUSE — PATCH /promotions/:id/pause
  //
  // Passe la promotion de ACTIVE → PAUSED.
  // Correspond au bouton "Suspendre" (icône pause) sur les
  // cartes actives dans PromotionsPage.tsx.
  //
  // Rôle requis : COMPANY
  // ════════════════════════════════════════════════════════════

  @Patch(':id/pause')
  @Roles(UserRole.COMPANY)
  async pause(
    @Param('id', ParseUUIDPipe) id: string,
    @Req()                      req: any,
  ) {
    return this.promotionsService.pause(id, req.user);
  }

  // ════════════════════════════════════════════════════════════
  // END — PATCH /promotions/:id/end
  //
  // Termine manuellement une promotion → status = ENDED.
  // Utile pour arrêter une promo avant sa date d'expiration.
  //
  // Rôle requis : COMPANY
  // ════════════════════════════════════════════════════════════

  @Patch(':id/end')
  @Roles(UserRole.COMPANY)
  async end(
    @Param('id', ParseUUIDPipe) id: string,
    @Req()                      req: any,
  ) {
    return this.promotionsService.end(id, req.user);
  }
}