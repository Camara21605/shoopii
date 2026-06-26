/* ============================================================
 * FICHIER : src/modules/auth/auth.controller.ts
 *
 * CORRECTIONS vs version précédente :
 *   ✅ POST /auth/verify-otp    → verifyOtp()    (manquait)
 *   ✅ POST /auth/reset-password→ resetPassword() (manquait)
 *
 * ROUTES COMPLÈTES :
 *   POST /auth/register           → Inscription
 *   POST /auth/login              → Connexion
 *   POST /auth/forgot-password    → Demande code OTP
 *   POST /auth/verify-otp         → Vérification OTP → resetToken
 *   POST /auth/reset-password     → Nouveau mot de passe
 *   GET  /auth/me                 → Profil connecté (JWT)
 * ============================================================ */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard }       from '@nestjs/passport';
import { ConfigService }   from '@nestjs/config';
import type { Response }   from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService, AuthResponse, OtpVerifyResponse } from './auth.service';
import { RegisterDto }     from './dto/register.dto';
import { LoginDto }        from './dto/login.dto';
import { ForgotPasswordDto } from './dto/password.dto';
import { JwtAuthGuard }    from '../../common/guards/auth.guard';
import { CurrentUser }     from 'src/common/decorators/roles.decorator';
import { User }            from '../../database/entities/user.entity';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {

  constructor(
    private readonly authService: AuthService,
    private readonly config:      ConfigService,
  ) {}

  // ── POST /auth/register ───────────────────────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un nouveau compte Shopi',
    description:
      'CLIENT = inscription libre. ' +
      'Autres rôles (Admin, Entreprise, Livreur, Partenaire, Correspondant) = code d\'invitation requis.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Compte créé avec succès.' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé.' })
  @ApiResponse({ status: 400, description: 'Données invalides ou code manquant.' })
  @ApiResponse({ status: 403, description: 'Email ne correspond pas au code d\'invitation.' })
  async register(
    @Body() dto: RegisterDto,
    @Ip()   clientIp: string,
  ): Promise<AuthResponse> {
    return this.authService.register(dto, clientIp);
  }

  // ── POST /auth/login ──────────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Se connecter à Shopi',
    description:
      'Authentification par email (ou téléphone) et mot de passe. ' +
      'Après 5 échecs, le compte est verrouillé 30 minutes.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Connexion réussie.' })
  @ApiResponse({ status: 401, description: 'Identifiants incorrects ou compte verrouillé.' })
  async login(
    @Body() dto: LoginDto,
    @Ip()   clientIp: string,
  ): Promise<AuthResponse> {
    return this.authService.login(dto, clientIp);
  }

  // ── POST /auth/forgot-password ────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Étape 1 — Demander un code OTP',
    description:
      'Envoie un code OTP à 6 chiffres par email (valable 10 min). ' +
      'La réponse est identique qu\'un compte existe ou non (anti-énumération). ' +
      'Limité à 3 demandes par fenêtre de 15 minutes.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Réponse générique (sécurité anti-énumération).' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto);
  }

  // ── POST /auth/verify-otp ─────────────────────────────────────────────────

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Étape 2 — Vérifier le code OTP',
    description:
      'Vérifie le code OTP reçu par email. ' +
      'Retourne un resetToken JWT valable 15 minutes si le code est correct. ' +
      'Le code est invalidé après 3 tentatives incorrectes.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['identifier', 'code'],
      properties: {
        identifier: { type: 'string', example: 'user@shopi.gn', description: 'Email ou téléphone' },
        code:       { type: 'string', example: '482931',         description: 'Code OTP à 6 chiffres' },
      },
    },
  })
  @ApiResponse({ status: 200,  description: 'Code valide — resetToken retourné.' })
  @ApiResponse({ status: 400,  description: 'Code incorrect, expiré ou trop de tentatives.' })
  async verifyOtp(
    @Body() body: { identifier: string; code: string },
  ): Promise<OtpVerifyResponse> {
    return this.authService.verifyOtp(body.identifier, body.code);
  }

  // ── POST /auth/reset-password ─────────────────────────────────────────────

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Étape 3 — Définir le nouveau mot de passe',
    description:
      'Réinitialise le mot de passe en utilisant le resetToken obtenu à l\'étape 2. ' +
      'Le resetToken expire après 15 minutes. ' +
      'Le nouveau mot de passe doit être différent de l\'ancien.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['resetToken', 'newPassword'],
      properties: {
        resetToken:  { type: 'string', description: 'Token JWT retourné par /verify-otp' },
        newPassword: { type: 'string', example: 'NouveauMdp2025!', description: 'Nouveau mot de passe (min 8 car., 1 maj., 1 min., 1 chiffre)' },
      },
    },
  })
  @ApiResponse({ status: 200,  description: 'Mot de passe réinitialisé avec succès.' })
  @ApiResponse({ status: 400,  description: 'Token expiré, MDP trop faible ou identique à l\'ancien.' })
  @ApiResponse({ status: 403,  description: 'Token invalide.' })
  @ApiResponse({ status: 404,  description: 'Compte introuvable.' })
  async resetPassword(
    @Body() body: { resetToken: string; newPassword: string },
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(body.resetToken, body.newPassword);
  }

  // ── GET /auth/google ─────────────────────────────────────────────────────
  // Lance le flux OAuth2 Google → redirige vers la page de consentement Google.

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleRedirect() {
    // Passport gère la redirection automatiquement.
  }

  // ── GET /auth/google/callback ─────────────────────────────────────────────
  // Google redirige ici après consentement.
  // On crée/trouve l'utilisateur et on redirige vers le frontend avec le JWT.

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req:  any,
    @Res() res:  Response,
  ): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    try {
      const token = await this.authService.googleLogin(req.user);
      res.redirect(`${frontendUrl}/login?token=${token}`);
    } catch (err) {
      const msg = encodeURIComponent((err as Error).message ?? 'Erreur Google');
      res.redirect(`${frontendUrl}/login?error=${msg}`);
    }
  }

  // ── GET /auth/me ──────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Récupérer son propre profil',
    description: 'Retourne les données publiques de l\'utilisateur connecté (extrait du JWT).',
  })
  @ApiResponse({ status: 200, description: 'Profil retourné.' })
  @ApiResponse({ status: 401, description: 'Token JWT absent ou invalide.' })
  @ApiResponse({ status: 404, description: 'Compte introuvable.' })
  async getMe(
    @CurrentUser() user: User,
  ) {
    return this.authService.getMe(user.id);
  }
}