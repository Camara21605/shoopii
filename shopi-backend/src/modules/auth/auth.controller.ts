/* ============================================================
 * FICHIER : src/modules/auth/auth.controller.ts
 *
 * ROUTES :
 *   POST /auth/register            → Inscription
 *   POST /auth/login               → Connexion (cookie httpOnly)
 *   POST /auth/logout              → Déconnexion (efface cookie)
 *   POST /auth/forgot-password     → Étape 1 — envoie OTP
 *   POST /auth/verify-otp          → Étape 2 — vérifie OTP → resetToken
 *   POST /auth/reset-password      → Étape 3 — nouveau mot de passe
 *   GET  /auth/google              → Lance le flux OAuth2 Google
 *   GET  /auth/google/callback     → Callback Google → code one-time → redirect
 *   POST /auth/google/exchange     → Échange code one-time → JWT + cookie
 *   GET  /auth/me                  → Profil connecté (JWT)
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
import { AuthGuard }     from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService, AuthResponse, OtpVerifyResponse } from './auth.service';
import { RegisterDto }          from './dto/register.dto';
import { LoginDto }             from './dto/login.dto';
import {
  ForgotPasswordDto,
  VerifyOtpDto,
  ResetPasswordDto,
  ExchangeOAuthCodeDto,
}                               from './dto/password.dto';
import { JwtAuthGuard }         from '../../common/guards/auth.guard';
import { CurrentUser }          from 'src/common/decorators/roles.decorator';
import { User }                 from '../../database/entities/user.entity';

// ── Helpers cookie ────────────────────────────────────────────────────────────

const COOKIE_NAME = 'access_token';

function buildCookieOptions(isProd: boolean, maxAgeMs: number) {
  return {
    httpOnly: true,
    secure:   isProd,
    sameSite: 'strict' as const,
    maxAge:   maxAgeMs,
    path:     '/',
  };
}

// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {

  private readonly isProd:      boolean;
  private readonly frontendUrl: string;

  constructor(
    private readonly authService: AuthService,
    private readonly config:      ConfigService,
  ) {
    this.isProd      = config.get<string>('NODE_ENV') === 'production';
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
  }

  // ── POST /auth/register ───────────────────────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un nouveau compte Shopi',
    description:
      'CLIENT = inscription libre. ' +
      "Autres rôles (Admin, Entreprise, Livreur, Partenaire, Correspondant) = code d'invitation requis.",
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Compte créé avec succès.' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé.' })
  @ApiResponse({ status: 400, description: 'Données invalides ou code manquant.' })
  @ApiResponse({ status: 403, description: "Email ne correspond pas au code d'invitation." })
  async register(
    @Body() dto: RegisterDto,
    @Ip()   clientIp: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.register(dto, clientIp);
    res.cookie(COOKIE_NAME, result.accessToken, buildCookieOptions(this.isProd, 7 * 24 * 60 * 60 * 1000));
    return result;
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.login(dto, clientIp);
    // Le cookie vit aussi longtemps que le JWT : 7j si rememberMe, 1h sinon.
    const maxAge = dto.rememberMe ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    res.cookie(COOKIE_NAME, result.accessToken, buildCookieOptions(this.isProd, maxAge));
    return result;
  }

  // ── POST /auth/logout ─────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Se déconnecter',
    description: 'Efface le cookie httpOnly access_token côté serveur.',
  })
  @ApiResponse({ status: 200, description: 'Déconnecté avec succès.' })
  async logout(
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure:   this.isProd,
      sameSite: 'strict',
      path:     '/',
    });
    return { message: 'Déconnexion réussie.' };
  }

  // ── POST /auth/forgot-password ────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Étape 1 — Demander un code OTP',
    description:
      "Envoie un code OTP à 6 chiffres par email (valable 10 min). " +
      "La réponse est identique qu'un compte existe ou non (anti-énumération). " +
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
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({ status: 200, description: 'Code valide — resetToken retourné.' })
  @ApiResponse({ status: 400, description: 'Code incorrect, expiré ou trop de tentatives.' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
  ): Promise<OtpVerifyResponse> {
    return this.authService.verifyOtp(dto.identifier, dto.code);
  }

  // ── POST /auth/reset-password ─────────────────────────────────────────────

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Étape 3 — Définir le nouveau mot de passe',
    description:
      "Réinitialise le mot de passe en utilisant le resetToken obtenu à l'étape 2. " +
      'Le resetToken expire après 15 minutes. ' +
      "Le nouveau mot de passe doit être différent de l'ancien.",
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Mot de passe réinitialisé avec succès.' })
  @ApiResponse({ status: 400, description: 'Token expiré, MDP trop faible ou identique.' })
  @ApiResponse({ status: 403, description: 'Token invalide.' })
  @ApiResponse({ status: 404, description: 'Compte introuvable.' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(dto.resetToken, dto.newPassword);
  }

  // ── GET /auth/google ──────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleRedirect() {
    // Passport redirige automatiquement vers la page de consentement Google.
  }

  // ── GET /auth/google/callback ─────────────────────────────────────────────
  // Google redirige ici après consentement.
  // On génère un code one-time (UUID, TTL 60s) stocké dans Redis,
  // et on redirige le navigateur vers /login?code=<uuid>.
  // Le frontend échange ensuite le code via POST /auth/google/exchange.
  // Cela évite d'exposer le JWT dans l'URL (historique, logs, Referer).

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: any,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const jwt  = await this.authService.googleLogin(req.user);
      const code = await this.authService.createGoogleOAuthCode(jwt);
      res.redirect(`${this.frontendUrl}/login?code=${code}`);
    } catch (err) {
      const msg = encodeURIComponent((err as Error).message ?? 'Erreur Google');
      res.redirect(`${this.frontendUrl}/login?error=${msg}`);
    }
  }

  // ── POST /auth/google/exchange ────────────────────────────────────────────
  // Échange le code one-time (UUID v4) contre un AuthResponse complet.
  // Le code est usage unique et expire après 60 secondes.

  @Post('google/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Échanger un code OAuth temporaire contre un JWT',
    description:
      'Échange le code UUID one-time reçu via query-param après le callback Google ' +
      "contre un AuthResponse complet. Code valable 60 secondes, usage unique.",
  })
  @ApiBody({ type: ExchangeOAuthCodeDto })
  @ApiResponse({ status: 200, description: 'JWT retourné, cookie posé.' })
  @ApiResponse({ status: 400, description: 'Code expiré ou invalide.' })
  async googleExchange(
    @Body() dto: ExchangeOAuthCodeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.exchangeGoogleOAuthCode(dto.code);
    res.cookie(COOKIE_NAME, result.accessToken, buildCookieOptions(this.isProd, 7 * 24 * 60 * 60 * 1000));
    return result;
  }

  // ── GET /auth/me ──────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Récupérer son propre profil',
    description: "Retourne les données publiques de l'utilisateur connecté (extrait du JWT).",
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
