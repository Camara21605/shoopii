/* ============================================================
 * FICHIER : src/modules/auth/auth.controller.ts
 *
 * ROUTES :
 *   POST /auth/register            → Inscription (5 req/min)
 *   POST /auth/login               → Connexion (10 req/min)
 *   POST /auth/logout              → Déconnexion — révoque refresh tokens + efface cookies
 *   POST /auth/refresh             → Rotation du refresh token (cookie httpOnly)
 *   POST /auth/forgot-password     → Étape 1 — envoie OTP (5 req/min)
 *   POST /auth/verify-otp          → Étape 2 — vérifie OTP → resetToken (10 req/min)
 *   POST /auth/reset-password      → Étape 3 — nouveau mot de passe (5 req/min)
 *   GET  /auth/google              → Lance le flux OAuth2 Google
 *   GET  /auth/google/callback     → Callback Google → code one-time → redirect
 *   POST /auth/google/exchange     → Échange code one-time → JWT + cookies
 *   GET  /auth/me                  → Profil connecté (JWT)
 *   GET  /auth/client-account/status  → État du compte client lié ("Mon espace")
 *   POST /auth/create-linked-client   → Création rapide du compte client lié (10 req/min)
 *   POST /auth/link-existing-client   → Liaison à un compte client préexistant (5 req/min)
 *   POST /auth/switch-account         → Bascule pro ↔ client sans réauthentification (20 req/min)
 *   DELETE /auth/account-link         → Délie le compte connecté (marque le lien "revoked")
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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard }     from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService, AuthResponse, AuthServiceResult, OtpVerifyResponse, AccountChoiceResult } from './auth.service';
import { AccountLinkService, ClientAccountStatus } from './account-link.service';
import { RegisterDto }          from './dto/register.dto';
import { LoginDto, ChooseAccountDto } from './dto/login.dto';
import {
  ForgotPasswordDto,
  VerifyOtpDto,
  ResetPasswordDto,
  ExchangeOAuthCodeDto,
}                               from './dto/password.dto';
import { CreateLinkedClientDto, LinkExistingClientDto } from './dto/account-link.dto';
import { JwtAuthGuard }         from '../../common/guards/auth.guard';
import { CurrentUser }          from 'src/common/decorators/roles.decorator';
import { User }                 from '../../database/entities/user.entity';
import { TwoFaService }         from './twofa/twofa.service';
import { ConfirmTwoFaDto, DisableTwoFaDto, VerifyTwoFaLoginDto } from './twofa/dto/twofa.dto';

// ── Noms des cookies ──────────────────────────────────────────────────────────

const ACCESS_COOKIE   = 'access_token';
const REFRESH_COOKIE  = 'refresh_token';

// ── Helpers cookies ───────────────────────────────────────────────────────────

/* SameSite=Strict bloque le cookie sur TOUTE requête cross-site — pas
 * seulement les navigations, mais aussi les fetch/XHR envoyés par le SPA.
 * En prod, le frontend (Vercel) et le backend (Render) sont sur des domaines
 * différents (cross-site), donc Strict empêchait le cookie de partir sur le
 * moindre appel API après le login : la connexion "réussissait" (cookies
 * posés par la réponse de /auth/login), puis le tout premier appel du
 * dashboard partait sans cookie → 401 → refresh échoue (lui aussi sans
 * cookie) → apiFetch.ts redirige en dur vers /login. En dev, frontend et
 * backend sont sur des ports différents mais le MÊME site (localhost), donc
 * Lax/Strict ne changent rien localement — seul le comportement en prod
 * était cassé. */
function buildAccessCookieOptions(isProd: boolean, maxAgeMs: number) {
  return {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    maxAge:   maxAgeMs,
    path:     '/',
  };
}

function buildRefreshCookieOptions(isProd: boolean, maxAgeMs: number) {
  return {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    maxAge:   maxAgeMs,
    /* Restreint aux seules routes /api/auth pour limiter l'exposition
     * du refresh token aux endpoints qui en ont réellement besoin. */
    path:     '/api/auth',
  };
}

function clearAccessCookie(res: Response, isProd: boolean) {
  res.clearCookie(ACCESS_COOKIE, {
    httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/',
  });
}

function clearRefreshCookie(res: Response, isProd: boolean) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/api/auth',
  });
}

function setAuthCookies(
  res: Response, isProd: boolean,
  accessToken: string, accessMaxAgeMs: number,
  refreshToken: string | null, refreshMaxAgeMs: number,
) {
  res.cookie(ACCESS_COOKIE, accessToken, buildAccessCookieOptions(isProd, accessMaxAgeMs));
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, buildRefreshCookieOptions(isProd, refreshMaxAgeMs));
  }
}

// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {

  private readonly isProd:      boolean;
  private readonly frontendUrl: string;

  constructor(
    private readonly authService:        AuthService,
    private readonly accountLinkService: AccountLinkService,
    private readonly config:             ConfigService,
    private readonly twoFaService:       TwoFaService,
  ) {
    this.isProd      = config.get<string>('NODE_ENV') === 'production';
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
  }

  // ── POST /auth/register ───────────────────────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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
  @ApiResponse({ status: 429, description: 'Trop de tentatives.' })
  async register(
    @Body() dto: RegisterDto,
    @Ip()   clientIp: string,
    @Req()  req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const userAgent = req.headers['user-agent'] ?? null;
    const result = await this.authService.register(dto, clientIp, userAgent);
    setAuthCookies(
      res, this.isProd,
      result.accessToken, 60 * 60 * 1000,          // accès : 1h
      result.refreshToken, result.refreshTtlMs,
    );
    const { refreshToken: _rt, refreshTtlMs: _ms, ...publicResult } = result;
    return publicResult;
  }

  // ── POST /auth/login ──────────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Se connecter à Shopi',
    description:
      'Authentification par email (ou téléphone) et mot de passe. ' +
      'Après 5 échecs, le compte est verrouillé 30 minutes.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Connexion réussie.' })
  @ApiResponse({ status: 401, description: 'Identifiants incorrects ou compte verrouillé.' })
  @ApiResponse({ status: 429, description: 'Trop de tentatives.' })
  async login(
    @Body() dto: LoginDto,
    @Ip()   clientIp: string,
    @Req()  req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse | { requiresTwoFa: true; challengeToken: string } | AccountChoiceResult> {
    const userAgent = req.headers['user-agent'] ?? null;
    const result = await this.authService.login(dto, clientIp, userAgent);

    /* Compte avec 2FA active : aucun cookie posé — le frontend doit
     * échanger challengeToken + code via POST /auth/2fa/verify-login. */
    if ('requiresTwoFa' in result) {
      return result;
    }
    /* Identifiant + mot de passe partagés par un compte pro et son compte
     * client lié (coïncidence) : aucun cookie posé — le frontend doit
     * rappeler POST /auth/login/choose-account avec le userId choisi. */
    if ('requiresAccountChoice' in result) {
      return result;
    }

    /* Access token : TTL identique au JWT (1h pour tous, 4h pour SUPER_ADMIN).
     * Refresh token : 24h session normale, 7j si rememberMe. */
    const accessMaxAge = dto.rememberMe ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    setAuthCookies(
      res, this.isProd,
      result.accessToken, accessMaxAge,
      result.refreshToken, result.refreshTtlMs,
    );
    const { refreshToken: _rt, refreshTtlMs: _ms, ...publicResult } = result;
    return publicResult;
  }

  // ── POST /auth/login/choose-account ───────────────────────────────────────
  // Termine la connexion quand /auth/login a répondu requiresAccountChoice.

  @Post('login/choose-account')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Choisir le compte visé après un requiresAccountChoice',
    description:
      'Un même email/téléphone + mot de passe correspondait à deux comptes ' +
      'liés (pro + client) — termine la connexion pour celui choisi.',
  })
  @ApiBody({ type: ChooseAccountDto })
  @ApiResponse({ status: 200, description: 'Connexion réussie.' })
  @ApiResponse({ status: 401, description: 'Identifiants incorrects.' })
  async loginChooseAccount(
    @Body() dto: ChooseAccountDto,
    @Ip()   clientIp: string,
    @Req()  req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse | { requiresTwoFa: true; challengeToken: string }> {
    const userAgent = req.headers['user-agent'] ?? null;
    const result = await this.authService.loginChooseAccount(
      dto.identifier, dto.password, dto.userId, dto.rememberMe ?? false, clientIp, userAgent,
    );

    if ('requiresTwoFa' in result) {
      return result;
    }

    const accessMaxAge = dto.rememberMe ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    setAuthCookies(
      res, this.isProd,
      result.accessToken, accessMaxAge,
      result.refreshToken, result.refreshTtlMs,
    );
    const { refreshToken: _rt, refreshTtlMs: _ms, ...publicResult } = result;
    return publicResult;
  }

  // ── POST /auth/2fa/verify-login ───────────────────────────────────────────

  @Post('2fa/verify-login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Étape 2 du login — vérifier le code 2FA',
    description:
      'Échange le challengeToken (retourné par /auth/login quand requiresTwoFa=true) ' +
      'et un code TOTP à 6 chiffres contre les tokens de session complets.',
  })
  @ApiBody({ type: VerifyTwoFaLoginDto })
  @ApiResponse({ status: 200, description: 'Connexion terminée.' })
  @ApiResponse({ status: 401, description: 'Code invalide ou challengeToken expiré.' })
  async verifyTwoFaLogin(
    @Body() dto: VerifyTwoFaLoginDto,
    @Ip()   clientIp: string,
    @Req()  req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const userAgent = req.headers['user-agent'] ?? null;
    const result = await this.authService.verifyTwoFaLogin(dto.challengeToken, dto.code, clientIp, userAgent);
    setAuthCookies(
      res, this.isProd,
      result.accessToken, 60 * 60 * 1000,
      result.refreshToken, result.refreshTtlMs,
    );
    const { refreshToken: _rt, refreshTtlMs: _ms, ...publicResult } = result;
    return publicResult;
  }

  // ── POST /auth/2fa/setup ──────────────────────────────────────────────────

  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Générer un secret TOTP (2FA)',
    description:
      "Génère un secret et une URI otpauth:// pour affichage en QR code. " +
      "N'active PAS encore la 2FA — il faut ensuite confirmer avec un code via /auth/2fa/confirm.",
  })
  async setupTwoFa(@CurrentUser() user: User) {
    return this.twoFaService.setup(user);
  }

  // ── POST /auth/2fa/confirm ────────────────────────────────────────────────

  @Post('2fa/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Confirmer et activer la 2FA',
    description: 'Vérifie le premier code généré par l\'application d\'authentification, puis active la 2FA.',
  })
  @ApiBody({ type: ConfirmTwoFaDto })
  async confirmTwoFa(@CurrentUser() user: User, @Body() dto: ConfirmTwoFaDto) {
    return this.twoFaService.confirm(user, dto.code);
  }

  // ── POST /auth/2fa/disable ────────────────────────────────────────────────

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Désactiver la 2FA', description: 'Nécessite le mot de passe actuel.' })
  @ApiBody({ type: DisableTwoFaDto })
  async disableTwoFa(@CurrentUser() user: User, @Body() dto: DisableTwoFaDto) {
    return this.twoFaService.disable(user, dto.currentPassword);
  }

  // ── POST /auth/refresh ────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Renouveler les tokens via le refresh token',
    description:
      'Lit le cookie httpOnly « refresh_token », émet un nouvel access token ' +
      'et un nouveau refresh token (Refresh Token Rotation). ' +
      'Chaque refresh token est à usage unique — la réutilisation déclenche une révocation globale.',
  })
  @ApiResponse({ status: 200, description: 'Tokens renouvelés avec succès.' })
  @ApiResponse({ status: 401, description: 'Refresh token absent, expiré ou révoqué.' })
  async refresh(
    @Req()  req: Request,
    @Ip()   clientIp: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const rawRefreshToken = (req.cookies as Record<string, string>)?.[REFRESH_COOKIE];
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Session expirée. Veuillez vous reconnecter.');
    }
    const userAgent = req.headers['user-agent'] ?? null;
    const result = await this.authService.refreshTokens(rawRefreshToken, clientIp, userAgent);
    setAuthCookies(
      res, this.isProd,
      result.accessToken, 60 * 60 * 1000,
      result.refreshToken, result.refreshTtlMs,
    );
    const { refreshToken: _rt, refreshTtlMs: _ms, ...publicResult } = result;
    return publicResult;
  }

  // ── POST /auth/logout ─────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Se déconnecter',
    description:
      'Révoque tous les refresh tokens actifs de l\'utilisateur et efface les cookies httpOnly.',
  })
  @ApiResponse({ status: 200, description: 'Déconnecté avec succès.' })
  async logout(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.revokeAllRefreshTokens(user.id);
    clearAccessCookie(res, this.isProd);
    clearRefreshCookie(res, this.isProd);
    return { message: 'Déconnexion réussie.' };
  }

  // ── POST /auth/forgot-password ────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Étape 1 — Demander un code OTP',
    description:
      "Envoie un code OTP à 6 chiffres par email (valable 10 min). " +
      "La réponse est identique qu'un compte existe ou non (anti-énumération). " +
      'Limité à 3 demandes par fenêtre de 15 minutes.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Réponse générique (sécurité anti-énumération).' })
  @ApiResponse({ status: 429, description: 'Trop de tentatives.' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Ip()   clientIp: string,
    @Req()  req: Request,
  ): Promise<{ message: string }> {
    const userAgent = req.headers['user-agent'] ?? null;
    return this.authService.forgotPassword(dto, clientIp, userAgent);
  }

  // ── POST /auth/verify-otp ─────────────────────────────────────────────────

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
  @ApiResponse({ status: 429, description: 'Trop de tentatives.' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
  ): Promise<OtpVerifyResponse | AccountChoiceResult> {
    return this.authService.verifyOtp(dto.identifier, dto.code, dto.accountUserId);
  }

  // ── POST /auth/reset-password ─────────────────────────────────────────────

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Étape 3 — Définir le nouveau mot de passe',
    description:
      "Réinitialise le mot de passe en utilisant le resetToken obtenu à l'étape 2. " +
      'Le resetToken expire après 15 minutes. ' +
      "Le nouveau mot de passe doit être différent de l'ancien. " +
      'Tous les refresh tokens actifs sont révoqués après le reset.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Mot de passe réinitialisé avec succès.' })
  @ApiResponse({ status: 400, description: 'Token expiré, MDP trop faible ou identique.' })
  @ApiResponse({ status: 403, description: 'Token invalide.' })
  @ApiResponse({ status: 404, description: 'Compte introuvable.' })
  @ApiResponse({ status: 429, description: 'Trop de tentatives.' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Ip()   clientIp: string,
    @Req()  req: Request,
  ): Promise<{ message: string }> {
    const userAgent = req.headers['user-agent'] ?? null;
    return this.authService.resetPassword(dto.resetToken, dto.newPassword, clientIp, userAgent);
  }

  // ── GET /auth/google ──────────────────────────────────────────────────────

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleRedirect() {
    // Passport redirige automatiquement vers la page de consentement Google.
  }

  // ── GET /auth/google/callback ─────────────────────────────────────────────

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
    @Ip()   clientIp: string,
    @Req()  req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const userAgent = req.headers['user-agent'] ?? null;
    const result = await this.authService.exchangeGoogleOAuthCode(dto.code, clientIp, userAgent);
    setAuthCookies(
      res, this.isProd,
      result.accessToken, 7 * 24 * 60 * 60 * 1000,
      result.refreshToken, result.refreshTtlMs,
    );
    const { refreshToken: _rt, refreshTtlMs: _ms, ...publicResult } = result;
    return publicResult;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // "MON ESPACE" — compte client lié au compte pro (même email/téléphone)
  // ═══════════════════════════════════════════════════════════════════════

  // ── GET /auth/client-account/status ───────────────────────────────────────

  @Get('client-account/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'État du compte client lié ("Mon espace")',
    description:
      "Indique si le compte connecté a déjà un compte client lié, ou si un " +
      "compte client existant (même email/téléphone) pourrait être lié.",
  })
  async getClientAccountStatus(@CurrentUser() user: User): Promise<ClientAccountStatus> {
    return this.accountLinkService.getStatus(user.id);
  }

  // ── POST /auth/create-linked-client ───────────────────────────────────────

  @Post('create-linked-client')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Créer le compte client lié ("Mon espace" — création rapide)',
    description:
      'Crée un nouveau compte CLIENT (même email/téléphone/nom que le compte ' +
      'pro connecté), le lie durablement, puis connecte immédiatement dessus.',
  })
  @ApiResponse({ status: 429, description: 'Trop de tentatives.' })
  @ApiBody({ type: CreateLinkedClientDto })
  async createLinkedClient(
    @Body() dto: CreateLinkedClientDto,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.accountLinkService.createLinkedClient(user.id, dto.password);
    setAuthCookies(res, this.isProd, result.accessToken, 60 * 60 * 1000, result.refreshToken, result.refreshTtlMs);
    const { refreshToken: _rt, refreshTtlMs: _ms, ...publicResult } = result;
    return publicResult;
  }

  // ── POST /auth/link-existing-client ───────────────────────────────────────

  @Post('link-existing-client')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lier un compte client déjà existant ("Mon espace")',
    description:
      "Lie le compte pro connecté à un compte CLIENT préexistant partageant " +
      "le même email/téléphone. Nécessite une preuve de possession (mot de " +
      "passe du compte client, ou resetToken OTP) — jamais automatique. " +
      "Un mot de passe incorrect compte comme un échec de connexion sur le " +
      "compte CIBLE (même verrouillage à 5 tentatives que /auth/login).",
  })
  @ApiResponse({ status: 429, description: 'Trop de tentatives.' })
  @ApiBody({ type: LinkExistingClientDto })
  async linkExistingClient(
    @Body() dto: LinkExistingClientDto,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.accountLinkService.linkExistingClient(user.id, dto);
    setAuthCookies(res, this.isProd, result.accessToken, 60 * 60 * 1000, result.refreshToken, result.refreshTtlMs);
    const { refreshToken: _rt, refreshTtlMs: _ms, ...publicResult } = result;
    return publicResult;
  }

  // ── POST /auth/switch-account ─────────────────────────────────────────────

  @Post('switch-account')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Basculer entre compte pro et compte client lié',
    description:
      'Émet de nouveaux tokens pour le compte lié au compte connecté (pro→client ' +
      "ou client→pro) — aucune ré-authentification, le lien fait déjà foi. " +
      'Si le compte cible a la 2FA active (et pas de grâce récente), renvoie ' +
      'requiresTwoFa — le frontend complète via POST /auth/2fa/verify-login.',
  })
  @ApiResponse({ status: 429, description: 'Trop de tentatives.' })
  async switchAccount(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse | { requiresTwoFa: true; challengeToken: string }> {
    const result = await this.accountLinkService.switchAccount(user.id);

    if ('requiresTwoFa' in result) {
      return result;
    }

    setAuthCookies(res, this.isProd, result.accessToken, 60 * 60 * 1000, result.refreshToken, result.refreshTtlMs);
    const { refreshToken: _rt, refreshTtlMs: _ms, ...publicResult } = result;
    return publicResult;
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
