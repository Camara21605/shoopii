/* ============================================================
 * FICHIER : src/modules/paiement/paiement.controller.ts
 *
 * ROUTES
 * ─────────────────────────────────────────────────────────────
 *  POST   /api/paiement/initier           — initier un paiement
 *  GET    /api/paiement/session/:id       — statut d'une session
 *  POST   /api/paiement/webhook/:provider — webhook provider
 *
 * ─────────────────────────────────────────────────────────────
 * SÉCURITÉ
 * ─────────────────────────────────────────────────────────────
 *
 *  - /initier et /session/:id → JWT obligatoire (JwtAuthGuard)
 *  - /webhook/:provider       → PUBLIC (pas de JWT)
 *    mais signature HMAC vérifiée dans le provider.parseWebhook()
 *
 * ─────────────────────────────────────────────────────────────
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/modules/paiement/paiement.controller.ts
 * ============================================================ */

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard }  from '../../common/guards/auth.guard';
import { CurrentUser }   from '../../common/decorators/roles.decorator';
import { User }          from '../../database/entities/user.entity';

import { InitierPaiementDto }        from './dto/initier-paiement.dto';
import { PaiementInitiationService } from './services/paiement-initiation.service';
import { PaiementWebhookService }    from './services/paiement-webhook.service';

@Controller('paiement')
export class PaiementController {

  constructor(
    private readonly initiationService: PaiementInitiationService,
    private readonly webhookService:    PaiementWebhookService,
  ) {}

  /* ── POST /paiement/initier ─────────────────────────────── */

  /**
   * Initie un paiement pour une commande PENDING.
   *
   * Le client envoie la commande à payer + la méthode de paiement.
   * Retourne les données nécessaires pour rediriger le client
   * ou afficher le code USSD à composer.
   *
   * @requires JWT Bearer token (rôle CLIENT)
   */
  @UseGuards(JwtAuthGuard)
  @Post('initier')
  async initierPaiement(
    @CurrentUser() user: User,
    @Body() dto:         InitierPaiementDto,
  ) {
    return this.initiationService.initier(user, dto);
  }

  /* ── GET /paiement/session/:id ──────────────────────────── */

  /**
   * Retourne le statut d'une session de paiement.
   * Utilisé par le frontend pour poller l'état du paiement.
   *
   * @requires JWT Bearer token
   */
  @UseGuards(JwtAuthGuard)
  @Get('session/:id')
  async getSessionStatus(@Param('id') sessionId: string, @CurrentUser() user: User) {
    return this.initiationService.getStatus(sessionId, user);
  }

  /* ── POST /paiement/webhook/:provider ──────────────────── */

  /**
   * Endpoint public appelé par le provider de paiement
   * pour confirmer ou refuser un paiement.
   *
   * ⚠️ PAS de JwtAuthGuard ici — le provider ne connaît pas le JWT.
   * La sécurité est assurée par la signature HMAC dans le provider.
   *
   * Le corps est lu brut (Buffer) pour permettre la vérification
   * de la signature HMAC (qui doit se faire sur le body non parsé).
   */
  @Post('webhook/:provider')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('provider') providerName: string,
    @Req()             req:          Record<string, unknown>,
    @Headers()         headers:      Record<string, string>,
  ) {
    /*
     * rawBody: corps HTTP brut pour la vérification HMAC.
     * Disponible si main.ts configure rawBody: true dans NestFactory.create().
     * Fallback : sérialisation du body parsé.
     */
    const rawBody = (req['rawBody'] as Buffer | undefined)?.toString('utf-8')
      ?? JSON.stringify(req['body'])
      ?? '';

    return this.webhookService.handleWebhook(providerName, rawBody, headers);
  }
}
