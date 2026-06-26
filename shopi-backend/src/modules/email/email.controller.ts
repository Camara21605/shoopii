/* ============================================================
 * FICHIER : src/modules/mail/mail.controller.ts
 * RÔLE    : Points d'entrée HTTP pour les emails transactionnels Shopi.
 *
 * ─── ROUTES ──────────────────────────────────────────────────
 *  POST /mail/invitation     → Envoie un email d'invitation avec code
 *  POST /mail/welcome        → Envoie un email de bienvenue
 *  POST /mail/reset-password → Envoie un email de réinitialisation
 *
 * ⚠️  Toutes les routes sont protégées par JwtAuthGuard + RolesGuard(ADMIN).
 *     Elles sont destinées à l'usage interne (super-admin, tests, etc.).
 *     En production, ces emails sont déclenchés automatiquement par
 *     AuthService et CodeCreationService — pas directement par le frontend.
 * ============================================================ */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

// ✅ Après (corrigé)
import { MailService } from './email.service';
import type {
  SendInvitationEmailParams,
  SendWelcomeEmailParams,
  SendPasswordResetEmailParams,
} from './email.service';
import { JwtAuthGuard,RolesGuard }  from '../auth/guards/guards';
import { Roles }         from 'src/common/decorators/roles.decorator';
import { UserRole }      from 'src/common/enums/user-role.enum';

// ─────────────────────────────────────────────────────────────────────────────
// CONTRÔLEUR
// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Emails transactionnels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('mail')
export class MailController {

  constructor(private readonly mailService: MailService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // POST /mail/invitation
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Déclenche l'envoi d'un email d'invitation avec le code d'activation.
   *
   * Normalement appelé automatiquement par CodeCreationService après
   * la création d'un code. Exposé ici pour permettre le renvoi manuel
   * d'une invitation depuis le panneau d'administration.
   */
  @Post('invitation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Envoyer un email d'invitation",
    description:
      "Envoie un email contenant le code d'activation et le lien d'inscription " +
      'pré-rempli. Réservé aux administrateurs Shopi.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['toEmail', 'code', 'targetRole', 'expiresAt', 'senderName'],
      properties: {
        toEmail:    { type: 'string', format: 'email',   example: 'invite@example.com' },
        code:       { type: 'string',                    example: 'ABCD-1234-XY' },
        targetRole: { type: 'string', enum: Object.values(UserRole), example: 'company' },
        expiresAt:  { type: 'string', format: 'date-time' },
        senderName: { type: 'string',                    example: 'Mamadou Diallo' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.OK,           description: "Email d'invitation envoyé." })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED,  description: 'Token JWT absent ou invalide.' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN,     description: 'Accès réservé aux administrateurs.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST,   description: 'Paramètres invalides.' })
  async sendInvitation(
    @Body() dto: SendInvitationEmailParams,
  ): Promise<{ message: string }> {
    // Assure que expiresAt est bien un objet Date (le body JSON transmet une string)
    await this.mailService.sendInvitationEmail({
      ...dto,
      expiresAt: new Date(dto.expiresAt),
    });
    return { message: `Email d'invitation envoyé à ${dto.toEmail}.` };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST /mail/welcome
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Déclenche l'envoi d'un email de bienvenue.
   *
   * Normalement appelé en fire-and-forget par AuthService.register().
   * Exposé ici pour permettre le renvoi manuel (ex : email non reçu).
   */
  @Post('welcome')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Envoyer un email de bienvenue',
    description:
      'Envoie un email de confirmation de création de compte. ' +
      'Réservé aux administrateurs Shopi.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['toEmail', 'firstName', 'role', 'loginUrl'],
      properties: {
        toEmail:   { type: 'string', format: 'email', example: 'user@example.com' },
        firstName: { type: 'string',                  example: 'Fatoumata' },
        role:      { type: 'string', enum: Object.values(UserRole), example: 'client' },
        loginUrl:  { type: 'string', format: 'uri',   example: 'https://shopi.gn/login' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.OK,          description: 'Email de bienvenue envoyé.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Token JWT absent ou invalide.' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN,    description: 'Accès réservé aux administrateurs.' })
  async sendWelcome(
    @Body() dto: SendWelcomeEmailParams,
  ): Promise<{ message: string }> {
    await this.mailService.sendWelcomeEmail(dto);
    return { message: `Email de bienvenue envoyé à ${dto.toEmail}.` };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST /mail/reset-password
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Déclenche l'envoi d'un email de réinitialisation de mot de passe.
   *
   * Normalement appelé en fire-and-forget par AuthService.forgotPassword().
   * Exposé ici pour les tests et le débogage en environnement admin.
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Envoyer un email de réinitialisation de mot de passe',
    description:
      'Envoie un lien de réinitialisation valable 15 minutes. ' +
      'Réservé aux administrateurs Shopi.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['toEmail', 'firstName', 'resetUrl', 'expiresAt'],
      properties: {
        toEmail:   { type: 'string', format: 'email',    example: 'user@example.com' },
        firstName: { type: 'string',                     example: 'Ibrahim' },
        resetUrl:  { type: 'string', format: 'uri',      example: 'https://shopi.gn/reset-password?token=abc123' },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.OK,          description: 'Email de réinitialisation envoyé.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Token JWT absent ou invalide.' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN,    description: 'Accès réservé aux administrateurs.' })
  async sendPasswordReset(
    @Body() dto: SendPasswordResetEmailParams,
  ): Promise<{ message: string }> {
    await this.mailService.sendPasswordResetEmail({
      ...dto,
      expiresAt: new Date(dto.expiresAt),
    });
    return { message: `Email de réinitialisation envoyé à ${dto.toEmail}.` };
  }
}