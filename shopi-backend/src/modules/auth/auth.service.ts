/* ============================================================
 * FICHIER : src/modules/auth/auth.service.ts
 *
 * ADAPTÉ à la vraie structure des entités :
 *   - user.entity.ts     → champs existants + 6 champs OTP ajoutés
 *   - code-creation.entity.ts → companyId est sur Company (ManyToOne)
 *     PAS un champ direct sur CreationCode → getCodeCompanyId()
 *     lit la relation company { companyId }
 *   - Profils : Admin, Partner, Company, Delivery, Correspondent, Client
 *     → userId sans insert:false (déjà corrigé dans les entités fournies)
 *   - partnerName → name (partenaire-profile.entity.ts utilise `name`)
 * ============================================================ */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService }       from '@nestjs/jwt';
import { ConfigService }    from '@nestjs/config';
import { InjectRedis }      from '@nestjs-modules/ioredis';
import Redis                from 'ioredis';
import * as bcrypt          from 'bcryptjs';
import * as crypto          from 'crypto';

import { UserRole }             from 'src/common/enums/user-role.enum';
import { User, UserStatus }     from '../../database/entities/user.entity';
import { AuthLog }              from '../../database/entities/auth-log.entity';
import { RefreshToken }         from '../../database/entities/refresh-token.entity';
import { CompanyTeamMember, TeamMemberStatus } from '../../database/entities/company-team/company-team-member.entity';
import { Admin }                from '../../database/entities/profiles/admin-profile.entity';
import { Partner }              from '../../database/entities/profiles/partenaire-profile.entity';
import { Company }              from '../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }             from '../../database/entities/profiles/livreur-profile.entity';
import { Correspondent }        from '../../database/entities/profiles/correspondant-profile.entity';
import { Client }               from '../../database/entities/profiles/client-profile.entity';
import { Wallet }               from '../../database/entities/wallet.entity';
import { CreationCode }         from '../../database/entities/code-creation.entity';
import { CodeCreationService }  from './code-creation/code-creation.service';
import { MailService }          from '../email/email.service';
import { RegisterDto }          from './dto/register.dto';
import { LoginDto }             from './dto/login.dto';
import { ForgotPasswordDto }    from './dto/password.dto';
import type { JwtPayload }      from './strategies/jwt.strategy';
import { TwoFaService }         from './twofa/twofa.service';

/* ── Constantes ── */
const BCRYPT_ROUNDS         = 12;
const JWT_TTL_ACCESS        = '1h';   // Access token court — refresh tokens prennent le relais
const JWT_TTL_SUPER         = '4h';   // Super admin : TTL max 4h, pas de refresh token
const JWT_TTL_RESET         = '15m';
const JWT_TTL_TWOFA         = '5m';   // défi 2FA — court, une seule tentative de connexion
const OAUTH_CODE_TTL_SEC    = 60;     // Code OAuth à usage unique, expire en 60s
const MAX_FAILED_LOGINS     = 5;
const LOCKOUT_MINUTES       = 30;
const OTP_EXPIRY_MINUTES    = 10;
const OTP_MAX_ATTEMPTS      = 3;
const OTP_RATE_LIMIT_WINDOW = 15;
const OTP_RATE_LIMIT_MAX    = 3;
const REFRESH_TTL_NORMAL_MS = 24 * 60 * 60 * 1000;       // 24h
const REFRESH_TTL_LONG_MS   = 7  * 24 * 60 * 60 * 1000;  // 7j (rememberMe)
/** Durée de grâce après un step-up 2FA réussi lors d'un switch "Mon espace" —
 *  ne pas redemander le code à CHAQUE bascule pendant la même session. */
const SWITCH_2FA_GRACE_S    = 15 * 60; // 15 min
const MAX_REFRESH_TOKENS    = 5;  // Révoque les plus anciens au-delà de ce seuil

/* Hash factice pour neutraliser les timing attacks sur login (user introuvable).
 * Bcrypt.compare() prend ~300ms quel que soit le résultat.
 * Ce hash pré-calculé évite de générer un hash aléatoire à chaque requête. */
const DUMMY_HASH = '$2b$12$X9ZTfV6vO2UXXY8O1rZ.0OUSQ1wAaJaVvqrBp5DUk8GHe4l6xXGq';

const ROLES_REQUIRING_CODE: UserRole[] = [
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.DELIVERY,
  UserRole.PARTNER,
  UserRole.CORRESPONDENT,
];

/**
 * Rôles pouvant être créés via /auth/register.
 * Liste blanche volontaire : UserRole.SUPER_ADMIN est exclu et ne peut
 * jamais être obtenu par inscription publique (le seul super-admin
 * est créé par seedSuperAdmin()). Tout nouveau rôle privilégié ajouté
 * à UserRole devra être explicitement ajouté ici pour devenir éligible.
 */
const SELF_REGISTRABLE_ROLES: UserRole[] = [
  UserRole.CLIENT,
  ...ROLES_REQUIRING_CODE,
];

export interface AuthResponse {
  accessToken: string;
  user: {
    id:        string;
    email:     string;
    firstName: string;
    lastName:  string;
    username:  string;
    role:      UserRole;
    status:    UserStatus;
  };
}

/** Type interne : refreshToken n'est PAS retourné dans le corps de la réponse HTTP.
 *  Le contrôleur l'extrait et le pose en cookie httpOnly. */
export interface AuthServiceResult extends AuthResponse {
  refreshToken: string | null;  // null pour SUPER_ADMIN
  refreshTtlMs: number;
}

export interface OtpVerifyResponse {
  resetToken: string;
}

/** Retourné par login() à la place d'AuthServiceResult quand le compte a la 2FA active. */
export interface TwoFaChallengeResult {
  requiresTwoFa:  true;
  challengeToken: string;
}

/**
 * Retourné par login() quand l'identifiant + mot de passe saisis correspondent
 * à PLUSIEURS comptes à la fois (cas rare : un pro et son compte client lié
 * qui partagent, par coïncidence, le même mot de passe). Le frontend doit
 * représenter à l'utilisateur pour choisir, puis rappeler
 * POST /auth/login/choose-account avec le userId choisi.
 */
export interface AccountChoiceResult {
  requiresAccountChoice: true;
  accounts: { userId: string; role: UserRole }[];
}

@Injectable()
export class AuthService implements OnModuleInit {

  private readonly logger = new Logger(AuthService.name);
  private readonly jwtResetSecret: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,

    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    @InjectRepository(Correspondent)
    private readonly correspondentRepo: Repository<Correspondent>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    @InjectRepository(CompanyTeamMember)
    private readonly teamMemberRepo: Repository<CompanyTeamMember>,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,

    @InjectRepository(AuthLog)
    private readonly authLogRepo: Repository<AuthLog>,

    private readonly jwtService:          JwtService,
    private readonly config:              ConfigService,
    private readonly dataSource:          DataSource,
    private readonly codeCreationService: CodeCreationService,
    private readonly mailService:         MailService,
    private readonly twoFaService:        TwoFaService,

    @InjectRedis()
    private readonly redis: Redis,
  ) {
    const secret = config.get<string>('JWT_RESET_SECRET');
    if (!secret) {
      throw new Error(
        '[AuthService] JWT_RESET_SECRET est absent des variables d\'environnement. ' +
        'Définissez-le avec une valeur aléatoire de 64+ caractères dans votre .env.',
      );
    }
    this.jwtResetSecret = secret;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════════

  async onModuleInit(): Promise<void> {
    await this.seedSuperAdmin();
  }

  private async seedSuperAdmin(): Promise<void> {
    try {
      const existing = await this.userRepo.findOne({
        where: { role: UserRole.SUPER_ADMIN },
      });
      if (existing) {
        this.logger.log(`[SUPER ADMIN] Existant : ${existing.email}`);
        return;
      }

      const email     = this.config.get<string>('SUPER_ADMIN_EMAIL')    ?? 'superadmin@shopi.com';
      const rawPwd    = this.config.get<string>('SUPER_ADMIN_PASSWORD');
      const DEFAULT_PWD = 'Shopi@SuperAdmin2025!';

      /* FIX m2 — Interdire le démarrage en production avec le mot de passe par défaut.
       * Si SUPER_ADMIN_PASSWORD n'est pas défini en prod, les credentials publics
       * du code source seraient utilisés → compte super-admin immédiatement compromis. */
      if (process.env.NODE_ENV === 'production' && !rawPwd) {
        this.logger.error(
          'SUPER_ADMIN_PASSWORD non défini en production. Démarrage annulé pour sécurité.',
        );
        process.exit(1);
      }

      const password = rawPwd ?? DEFAULT_PWD;
      const firstName = this.config.get<string>('SUPER_ADMIN_FIRSTNAME')  ?? 'Super';
      const lastName  = this.config.get<string>('SUPER_ADMIN_LASTNAME')   ?? 'Admin';

      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const username       = await this.generateUniqueUsername(firstName, lastName);

      const superAdmin = this.userRepo.create({
        firstName, lastName, email, username,
        password: hashedPassword,
        role:     UserRole.SUPER_ADMIN,
        status:   UserStatus.ACTIVE,
      });
      const saved = await this.userRepo.save(superAdmin);
      await this.walletRepo.save(this.walletRepo.create({ userId: saved.id }));

      /* ⚠️  NE PAS logger le mot de passe ni le JWT — ils appartiennent aux secrets.
         Récupérez les credentials via votre gestionnaire de secrets (Vault, AWS SSM,
         Render Secret Files, etc.) en lisant les variables d'environnement définies
         dans SUPER_ADMIN_EMAIL et SUPER_ADMIN_PASSWORD. */
      this.logger.warn('╔════════════════════════════════════════════════╗');
      this.logger.warn('║  SUPER ADMIN CRÉÉ                              ║');
      this.logger.warn(`║  Email : ${email.padEnd(38)}║`);
      this.logger.warn('║  Credentials : voir variables d\'environnement  ║');
      this.logger.warn('║  Changez le MDP dès la première connexion !    ║');
      this.logger.warn('╚════════════════════════════════════════════════╝');
    } catch (err) {
      this.logger.error(`[SUPER ADMIN SEED ❌] ${(err as Error).message}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. INSCRIPTION
  // ══════════════════════════════════════════════════════════════════════════

  async register(dto: RegisterDto, clientIp: string, userAgent: string | null = null): Promise<AuthServiceResult> {

    // Sécurité : empêcher la création d'un compte SUPER_ADMIN (ou de tout
    // futur rôle privilégié non listé) via l'inscription publique.
    if (!SELF_REGISTRABLE_ROLES.includes(dto.role as UserRole)) {
      this.logger.warn(`[REGISTER ❌ RÔLE INTERDIT] ${dto.email} a tenté de s'inscrire avec le rôle "${dto.role}".`);
      throw new ForbiddenException(`Le rôle "${dto.role}" ne peut pas être créé via l'inscription.`);
    }

    // Vérifier unicité email — SCOPÉE PAR RÔLE (UNIQUE(email, role) en base).
    /* Un même email peut désormais correspondre à un compte pro ET un compte
     * client (comptes liés "Mon espace") : ne bloquer que si CE rôle précis
     * est déjà pris pour cet email, pas n'importe quel rôle.
     * withDeleted: true → inclut les comptes soft-deleted.
       Sans ça, TypeORM ignore les lignes avec deletedAt IS NOT NULL,
       mais la contrainte UNIQUE en base s'applique à TOUTES les lignes
       → INSERT échoue avec QueryFailedError au lieu de ConflictException. */
    const emailExists = await this.userRepo.findOne({
      where: { email: dto.email, role: dto.role as UserRole },
      withDeleted: true,
    });
    if (emailExists) {
      throw new ConflictException('Cette adresse email est déjà associée à un compte Shopi.');
    }

    let validatedCodeId: string | null = null;
    let codeCompanyId:   string | null = null;
    let codeDeliveryId:  string | null = null;

    if (ROLES_REQUIRING_CODE.includes(dto.role as UserRole)) {
      if (!dto.activationCode) {
        throw new BadRequestException(
          `Un code d'invitation est requis pour créer un compte ${dto.role}.`,
        );
      }
      const validated = await this.codeCreationService.validateCode(
        dto.activationCode,
        dto.role as UserRole,
      );
      validatedCodeId = validated.codeId;

      // ✅ Lire le companyId depuis la relation company sur CreationCode
      codeCompanyId = await this.getCodeCompanyId(validatedCodeId);

      // ✅ Lire le deliveryId depuis la relation delivery sur CreationCode
      codeDeliveryId = await this.getCodeDeliveryId(validatedCodeId);

      // ✅ Vérifier que l'email correspond à celui de l'invitation (si nominatif)
      const codeTargetEmail = await this.getCodeTargetEmail(validatedCodeId);
      if (codeTargetEmail && codeTargetEmail.toLowerCase() !== dto.email.toLowerCase().trim()) {
        throw new ForbiddenException(
          `Ce code d'invitation a été émis pour "${codeTargetEmail}". ` +
          `Utilisez l'adresse email indiquée dans votre email d'invitation.`,
        );
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const username       = await this.generateUniqueUsername(dto.firstName, dto.lastName);

    /* ── Construire les champs User enrichis ─────────────────── */
    const userExtras: Partial<User> = {};
    if (dto.countryCode) userExtras.countryCode = dto.countryCode;
    if (dto.countryName) userExtras.countryName = dto.countryName;
    if (dto.dialCode)    userExtras.dialCode    = dto.dialCode;
    if (dto.birthDate)   userExtras.birthDate   = new Date(dto.birthDate) as any;
    if (dto.gender)      userExtras.gender      = dto.gender as any;

    let newUser: User;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const userEntity = this.userRepo.create({
        firstName:  dto.firstName,
        lastName:   dto.lastName,
        email:      dto.email,
        phone:      dto.phone ?? null,
        username,
        password:   hashedPassword,
        role:       dto.role as UserRole,
        status:     UserStatus.ACTIVE,
        ...userExtras,
      });
      newUser = await queryRunner.manager.save(User, userEntity);

      await this.createProfile(queryRunner.manager, newUser, dto, codeCompanyId, codeDeliveryId);

      const wallet = this.walletRepo.create({ userId: newUser.id });
      await queryRunner.manager.save(Wallet, wallet);

      // Consommer le code d'activation
      if (validatedCodeId) {
        await queryRunner.manager
          .createQueryBuilder()
          .update('creation_codes')
          .set({
            usesCount:  () => 'usesCount + 1',
            usedById:   newUser.id,
            usedAt:     new Date(),
            usedFromIp: clientIp,
            status: () =>
              `CASE WHEN usesCount + 1 >= maxUses THEN 'used' ELSE status END`,
          })
          .where('id = :id', { id: validatedCodeId })
          .execute();
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[REGISTER ❌] ${dto.email} | ${(err as Error).message}`);
      if (
        err instanceof BadRequestException ||
        err instanceof ConflictException   ||
        err instanceof ForbiddenException
      ) throw err;
      throw new InternalServerErrorException(
        'Erreur lors de la création du compte. Veuillez réessayer.',
      );
    } finally {
      await queryRunner.release();
    }

    this.logger.log(`[REGISTER ✅] ${newUser.email} | ${newUser.role} | IP=${clientIp}`);

    this.mailService
      .sendWelcomeEmail({
        toEmail:   newUser.email,
        firstName: newUser.firstName,
        role:      newUser.role,
        loginUrl:  `${this.config.get('FRONTEND_URL')}/login`,
      })
      .catch(err =>
        this.logger.error(`[WELCOME EMAIL ❌] ${newUser.email} | ${(err as Error).message}`),
      );

    const actorId     = await this.findProfileId(newUser.id, newUser.role as UserRole);
    const accessToken  = this.signJwt(newUser, false, actorId);
    const ttlMs        = REFRESH_TTL_NORMAL_MS;
    const expiresAt    = new Date(Date.now() + ttlMs);
    const { rawToken: refreshToken } = await this.issueRefreshToken(
      newUser.id, clientIp, userAgent, expiresAt,
    );

    this.logEvent('register_success', {
      userId: newUser.id, email: newUser.email, role: newUser.role,
      ipAddress: clientIp, userAgent, success: true,
    });

    return { accessToken, refreshToken, refreshTtlMs: ttlMs, user: this.toPublicUser(newUser) };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CRÉATION DES PROFILS — adaptée aux vraies entités
  // ══════════════════════════════════════════════════════════════════════════

  private async createProfile(
    manager:       any,
    user:          User,
    dto:           RegisterDto,
    codeCompanyId?:  string | null,
    codeDeliveryId?: string | null,
  ): Promise<void> {
    const fullName = `${user.firstName} ${user.lastName}`;

    /* Données de localisation communes (optionnelles) */
    const loc = {
      ville:     dto.city          ?? null,
      commune:   dto.district      ?? null,
      region:    dto.region        ?? null,
      pays:      dto.countryCode   ?? dto.country ?? 'GN',
      adresse:   dto.address       ?? null,
      codePostal: dto.postalCode   ?? null,
      latitude:  dto.latitude      ?? null,
      longitude: dto.longitude     ?? null,
    };

    switch (user.role) {

      case UserRole.ADMIN: {
        const profile = manager.create(Admin, {
          userId:   user.id,
          fullName,
          phone:    dto.phone ?? null,
          zone:     loc.ville,
          status:   'pending' as any,
        });
        await manager.save(Admin, profile);
        break;
      }

      case UserRole.PARTNER: {
        const profile = manager.create(Partner, {
          userId:    user.id,
          name:      fullName,
          phone:     dto.phone ?? null,
          zone:      loc.ville,
          status:    'pending' as any,
          adresse:   loc.adresse,
          commune:   loc.commune,
          ville:     loc.ville,
          region:    loc.region,
          pays:      loc.pays,
          codePostal: loc.codePostal,
          latitude:  loc.latitude,
          longitude: loc.longitude,
        });
        await manager.save(Partner, profile);
        break;
      }

      case UserRole.COMPANY: {
        const profile = manager.create(Company, {
          userId:        user.id,
          companyName:   dto.companyName?.trim() || dto.shopName?.trim() || fullName,
          status:        'pending' as any,
          companyTypeId: (dto as any).companyTypeId ?? null,
          adresse:       loc.adresse,
          commune:       loc.commune,
          ville:         loc.ville,
          region:        loc.region,
          pays:          loc.pays,
          codePostal:    loc.codePostal,
          latitude:      loc.latitude,
          longitude:     loc.longitude,
        });
        await manager.save(Company, profile);
        break;
      }

      case UserRole.DELIVERY: {
        const profile = manager.create(Delivery, {
          userId:        user.id,
          fullName,
          phone:         dto.phone ?? null,
          status:        'pending' as any,
          availability:  'offline' as any,
          ville:         loc.ville,
          zone:          loc.commune ?? loc.ville,
          lastLatitude:  loc.latitude,
          lastLongitude: loc.longitude,
        });
        await manager.save(Delivery, profile);
        break;
      }

      case UserRole.CORRESPONDENT: {
        const profile = manager.create(Correspondent, {
          userId:         user.id,
          fullName,
          phone:          dto.phone ?? null,
          status:         'pending' as any,
          companyId:      codeCompanyId  ?? null,
          deliveryId:     codeDeliveryId ?? null,
          depotAdresse:   loc.adresse,
          depotCommune:   loc.commune,
          depotVille:     loc.ville,
          depotRegion:    loc.region,
          depotCodePostal: loc.codePostal,
          depotLatitude:  loc.latitude,
          depotLongitude: loc.longitude,
        });
        await manager.save(Correspondent, profile);
        break;
      }

      case UserRole.CLIENT: {
        const profile = manager.create(Client, {
          userId:   user.id,
          fullName,
          status:   'active' as any,
        });
        await manager.save(Client, profile);
        break;
      }

      default:
        break;
    }

    this.logger.log(`[PROFILE ✅] ${user.role} créé pour ${user.email}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. CONNEXION
  // ══════════════════════════════════════════════════════════════════════════

  async login(
    dto:       LoginDto,
    clientIp:  string,
    userAgent: string | null = null,
  ): Promise<AuthServiceResult | TwoFaChallengeResult | AccountChoiceResult> {
    const INVALID_MSG = 'Identifiants incorrects. Vérifiez votre email et mot de passe.';
    const candidates = await this.findAllByIdentifier(dto.identifier);

    const matched = await this.verifyPasswordAgainstCandidates(candidates, dto.password);

    if (matched.length === 0) {
      // Compteur d'échecs uniquement sur les comptes RÉELS (pas les slots factices).
      await Promise.all(candidates.map(c => this.handleFailedLogin(c)));
      this.logEvent('login_failed', {
        email: dto.identifier, ipAddress: clientIp, userAgent, success: false,
        failureReason: candidates.length === 0 ? 'Utilisateur introuvable' : 'Mot de passe incorrect',
      });
      throw new UnauthorizedException(INVALID_MSG);
    }

    if (matched.length === 1) {
      return this.finishLogin(matched[0], dto.rememberMe ?? false, clientIp, userAgent);
    }

    /* Les comptes liés (pro + client, même email/téléphone) partagent, par
     * coïncidence, le même mot de passe — impossible de savoir lequel est
     * visé, on demande explicitement. */
    this.logEvent('login_account_choice', {
      email: dto.identifier, ipAddress: clientIp, userAgent, success: true,
    });
    return {
      requiresAccountChoice: true,
      accounts: matched.map(u => ({ userId: u.id, role: u.role })),
    };
  }

  /**
   * Teste `password` contre chaque candidat et renvoie ceux qui correspondent.
   *
   * FIX timing attack (comptes liés) : le nombre de comparaisons bcrypt
   * exécutées ne doit JAMAIS dépendre du nombre de comptes réels trouvés —
   * sinon un attaquant mesure le temps de réponse (bcrypt ≈150-300ms/appel)
   * pour déduire si un email a 0, 1 ou 2 comptes liés, avant même de
   * connaître le bon mot de passe. On complète donc TOUJOURS à exactement 2
   * emplacements (2 = maximum réel possible : UNIQ_user_email_role limite à
   * un compte par rôle, et seul le couple pro+client partage un identifiant)
   * avec un hachage factice si besoin, et on exécute les comparaisons EN
   * PARALLÈLE (Promise.all) pour que le temps total reste borné par UNE
   * comparaison bcrypt, pas par leur somme.
   */
  private async verifyPasswordAgainstCandidates(candidates: User[], password: string): Promise<User[]> {
    const slots: (User | null)[] = [...candidates];
    while (slots.length < 2) slots.push(null);

    const results = await Promise.all(slots.map(async (candidate) => {
      if (!candidate) {
        await bcrypt.compare(password, DUMMY_HASH);
        return null;
      }
      const withPwd = await this.userRepo
        .createQueryBuilder('u')
        .select(['u.id', 'u.password'])
        .where('u.id = :id', { id: candidate.id })
        .getOne();
      const valid = await bcrypt.compare(password, withPwd!.password);
      return valid ? candidate : null;
    }));

    return results.filter((c): c is User => c !== null);
  }

  /** POST /auth/login/choose-account — termine la connexion quand plusieurs comptes liés matchaient. */
  async loginChooseAccount(
    identifier: string,
    password:   string,
    userId:     string,
    rememberMe: boolean,
    clientIp:   string,
    userAgent:  string | null,
  ): Promise<AuthServiceResult | TwoFaChallengeResult> {
    const INVALID_MSG = 'Identifiants incorrects. Vérifiez votre email et mot de passe.';
    /* On ne fait JAMAIS confiance au userId envoyé par le client seul — il doit
     * être l'un des candidats réels pour cet identifiant, mot de passe revérifié.
     * Pas de protection anti-timing nécessaire ici : les comptes candidats sont
     * déjà connus de l'appelant (révélés dans la réponse requiresAccountChoice
     * du 1er appel), un seul bcrypt.compare ne fuit donc rien de nouveau. */
    const candidates = await this.findAllByIdentifier(identifier);
    const chosen = candidates.find(c => c.id === userId);
    if (!chosen) throw new UnauthorizedException(INVALID_MSG);

    const withPwd = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.password'])
      .where('u.id = :id', { id: chosen.id })
      .getOne();
    const passwordValid = await bcrypt.compare(password, withPwd!.password);
    if (!passwordValid) {
      await this.handleFailedLogin(chosen);
      this.logEvent('login_failed', {
        userId: chosen.id, email: chosen.email, role: chosen.role,
        ipAddress: clientIp, userAgent, success: false, failureReason: 'Mot de passe incorrect (choix de compte)',
      });
      throw new UnauthorizedException(INVALID_MSG);
    }

    return this.finishLogin(chosen, rememberMe, clientIp, userAgent);
  }

  /**
   * Termine la connexion pour un compte dont le mot de passe est DÉJÀ
   * vérifié : statut/verrouillage, défi 2FA, puis émission des tokens.
   * Partagé entre login() (match unique) et loginChooseAccount().
   */
  private async finishLogin(
    user:       User,
    rememberMe: boolean,
    clientIp:   string,
    userAgent:  string | null,
  ): Promise<AuthServiceResult | TwoFaChallengeResult> {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const min = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      this.logEvent('login_locked', {
        userId: user.id, email: user.email, role: user.role,
        ipAddress: clientIp, userAgent, success: false,
        failureReason: `Verrouillé encore ${min} min`,
      });
      throw new UnauthorizedException(`Compte verrouillé. Réessayez dans ${min} minute(s).`);
    }
    if (user.status === UserStatus.BANNED) {
      this.logEvent('login_failed', {
        userId: user.id, email: user.email, role: user.role,
        ipAddress: clientIp, userAgent, success: false, failureReason: 'Compte banni',
      });
      throw new UnauthorizedException('Votre compte a été banni. Contactez le support Shopi.');
    }
    if (user.status === UserStatus.SUSPENDED) {
      this.logEvent('login_failed', {
        userId: user.id, email: user.email, role: user.role,
        ipAddress: clientIp, userAgent, success: false, failureReason: 'Compte suspendu',
      });
      throw new UnauthorizedException("Votre compte est suspendu. Contactez l'administrateur.");
    }

    await this.userRepo.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil:         null,
      lastLoginAt:         new Date(),
      lastLoginIp:         clientIp,
    });

    /* ── Défi 2FA ────────────────────────────────────────────
     * Le mot de passe est correct, mais le compte a la 2FA active :
     * on n'émet PAS encore les tokens d'accès. On renvoie un
     * challengeToken de courte durée (5 min) que le frontend doit
     * échanger via POST /auth/2fa/verify-login avec le code TOTP. */
    if (await this.twoFaService.isEnabled(user.role as UserRole, user.id)) {
      const challengeToken = this.jwtService.sign(
        { sub: user.id, purpose: '2fa-challenge' },
        { expiresIn: JWT_TTL_TWOFA, secret: this.jwtResetSecret },
      );
      this.logEvent('login_2fa_challenge', {
        userId: user.id, email: user.email, role: user.role,
        ipAddress: clientIp, userAgent, success: true,
      });
      return { requiresTwoFa: true, challengeToken };
    }

    this.logEvent('login_success', {
      userId: user.id, email: user.email, role: user.role,
      ipAddress: clientIp, userAgent, success: true,
    });
    this.logger.log(`[LOGIN ✅] ${user.email} | ${user.role} | IP=${clientIp}`);

    return this.issueTokensForUser(user, rememberMe, clientIp, userAgent);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2bis. VÉRIFICATION DU DÉFI 2FA — POST /auth/2fa/verify-login
  // ══════════════════════════════════════════════════════════════════════════

  async verifyTwoFaLogin(
    challengeToken: string,
    code:           string,
    clientIp:       string,
    userAgent:      string | null = null,
  ): Promise<AuthServiceResult> {
    let payload: { sub: string; purpose: string; switchFrom?: string };
    try {
      payload = this.jwtService.verify(challengeToken, { secret: this.jwtResetSecret });
    } catch {
      throw new UnauthorizedException('Session de connexion expirée. Reconnectez-vous.');
    }
    if (payload.purpose !== '2fa-challenge') {
      throw new ForbiddenException('Token invalide.');
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || user.status === UserStatus.BANNED || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Compte inactif. Reconnectez-vous.');
    }

    const valid = await this.twoFaService.verifyLoginCode(user.role as UserRole, user.id, code);
    if (!valid) {
      this.logEvent('login_2fa_failed', {
        userId: user.id, email: user.email, role: user.role,
        ipAddress: clientIp, userAgent, success: false, failureReason: 'Code 2FA incorrect',
      });
      throw new UnauthorizedException('Code de vérification incorrect.');
    }

    await this.userRepo.update(user.id, { lastLoginAt: new Date(), lastLoginIp: clientIp });

    /* Défi émis par AccountLinkService.switchAccount() (payload.switchFrom
     * présent) plutôt que par un login classique : pose la grâce pour ne
     * pas redemander le code à chaque bascule pendant SWITCH_2FA_GRACE_S. */
    if (payload.switchFrom) {
      await this.markSwitch2faVerified(payload.switchFrom, user.id);
      this.logEvent('account_switch_2fa_verified', {
        userId: user.id, email: user.email, role: user.role,
        ipAddress: clientIp, userAgent, success: true,
      });
    } else {
      this.logEvent('login_success', {
        userId: user.id, email: user.email, role: user.role,
        ipAddress: clientIp, userAgent, success: true,
      });
    }
    this.logger.log(`[LOGIN 2FA ✅] ${user.email} | ${user.role} | IP=${clientIp}`);

    /* rememberMe n'est pas connu à cette étape (pas transmis dans le défi) —
     * session normale (24h) par défaut ; l'utilisateur peut se reconnecter
     * avec "Se souvenir de moi" si besoin d'une session plus longue. */
    return this.issueTokensForUser(user, false, clientIp, userAgent);
  }

  /**
   * Émet un défi 2FA pour un switch "Mon espace" — même format et même
   * endpoint de vérification (POST /auth/2fa/verify-login) qu'un défi de
   * login classique, avec en plus `switchFrom` pour que verifyTwoFaLogin()
   * sache poser la grâce une fois validé. Utilisé par AccountLinkService.
   */
  signSwitchTwoFaChallenge(targetUserId: string, switchFromUserId: string): string {
    return this.jwtService.sign(
      { sub: targetUserId, purpose: '2fa-challenge', switchFrom: switchFromUserId },
      { expiresIn: JWT_TTL_TWOFA, secret: this.jwtResetSecret },
    );
  }

  /** true si un step-up 2FA a déjà été validé pour CE couple (source→cible)
   *  dans les SWITCH_2FA_GRACE_S dernières minutes — évite de redemander le
   *  code à chaque bascule pendant la même session. */
  async isSwitch2faGraced(sourceUserId: string, targetUserId: string): Promise<boolean> {
    return (await this.redis.get(`switch2fa:${sourceUserId}:${targetUserId}`)) === '1';
  }

  private async markSwitch2faVerified(sourceUserId: string, targetUserId: string): Promise<void> {
    await this.redis.set(`switch2fa:${sourceUserId}:${targetUserId}`, '1', 'EX', SWITCH_2FA_GRACE_S);
  }

  /**
   * Vérifie un resetToken émis par verifyOtp() (preuve qu'un OTP envoyé sur
   * l'email/téléphone d'un compte a été validé). Réutilisé par
   * AccountLinkService comme preuve de possession pour lier un compte
   * client PRÉEXISTANT — pas besoin de dupliquer l'infra OTP : "a prouvé
   * qu'il contrôle la boîte mail/le téléphone de ce compte" est exactement
   * la preuve recherchée, que ce soit pour réinitialiser un mot de passe
   * ou pour lier un compte.
   */
  verifyResetToken(token: string): { sub: string; purpose: string; email: string } {
    return this.jwtService.verify(token, { secret: this.jwtResetSecret });
  }

  /** Émet accessToken + (sauf SUPER_ADMIN) refreshToken pour un utilisateur déjà authentifié.
   *  Non-private : réutilisé par AccountLinkService pour le switch pro↔client
   *  (aucune réauthentification nécessaire, le lien fait déjà foi). */
  async issueTokensForUser(
    user:       User,
    rememberMe: boolean,
    clientIp:   string | null,
    userAgent:  string | null,
  ): Promise<AuthServiceResult> {
    const actorId    = await this.findProfileId(user.id, user.role as UserRole);
    const accessToken = this.signJwt(user, false, actorId);

    /* SUPER_ADMIN n'a pas de refresh token — il doit se reconnecter manuellement après 4h */
    let refreshToken: string | null = null;
    let refreshTtlMs = 0;
    if (user.role !== UserRole.SUPER_ADMIN) {
      const ttlMs = rememberMe ? REFRESH_TTL_LONG_MS : REFRESH_TTL_NORMAL_MS;
      const expiresAt = new Date(Date.now() + ttlMs);
      const { rawToken } = await this.issueRefreshToken(user.id, clientIp, userAgent, expiresAt);
      refreshToken = rawToken;
      refreshTtlMs = ttlMs;
    }

    return { accessToken, refreshToken, refreshTtlMs, user: this.toPublicUser(user) };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. MOT DE PASSE OUBLIÉ — Génération OTP
  // ══════════════════════════════════════════════════════════════════════════

  async forgotPassword(dto: ForgotPasswordDto, clientIp: string | null = null, userAgent: string | null = null): Promise<{ message: string }> {
    const GENERIC_MSG =
      'Si un compte actif correspond à cet identifiant, ' +
      'vous recevrez un code de vérification dans quelques minutes.';

    /* Peut désormais renvoyer 2 comptes (pro + client lié, même email).
     * Comme les deux partagent la même boîte mail, on génère UN SEUL code
     * OTP et on le stocke sur les DEUX lignes actives — un seul email est
     * envoyé, verifyOtp() décidera ensuite (via accountUserId) quel compte
     * précis réinitialiser si les deux acceptent encore ce code. */
    const candidates = (await this.findAllByIdentifier(dto.identifier))
      .filter(u => u.status === UserStatus.ACTIVE);

    if (candidates.length > 0) {
      const primary = candidates[0];

      // Rate limiting : max OTP_RATE_LIMIT_MAX demandes par OTP_RATE_LIMIT_WINDOW min
      // (basé sur le 1er compte trouvé — les deux comptes liés sont demandés ensemble).
      const windowStart = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW * 60_000);
      if (
        primary.resetOtpRequestedAt &&
        primary.resetOtpRequestedAt > windowStart &&
        (primary.resetOtpRequestCount ?? 0) >= OTP_RATE_LIMIT_MAX
      ) {
        this.logger.warn(`[OTP RATE LIMIT 🚨] ${primary.email}`);
        return { message: GENERIC_MSG };
      }

      // Générer un OTP à 6 chiffres cryptographiquement sûr
      const otpCode   = crypto.randomInt(100_000, 999_999).toString();
      const otpHash   = await bcrypt.hash(otpCode, BCRYPT_ROUNDS);
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

      const newRequestCount =
        primary.resetOtpRequestedAt && primary.resetOtpRequestedAt > windowStart
          ? (primary.resetOtpRequestCount ?? 0) + 1
          : 1;

      await Promise.all(candidates.map(u => this.userRepo.update(u.id, {
        resetOtpHash:         otpHash,
        resetOtpExpiry:       otpExpiry,
        resetOtpAttempts:     0,
        resetOtpRequestedAt:  new Date(),
        resetOtpRequestCount: newRequestCount,
      })));

      /* Fire-and-forget : la réponse HTTP (message générique anti-énumération)
       * ne doit pas attendre le round-trip SMTP. En cas d'échec, l'erreur est
       * logguée en détail ici — MailService.send() l'a déjà logguée une 1re
       * fois avec code/responseCode/response avant de la relancer ; ce
       * deuxième log confirme le contexte métier (quel OTP, pour qui). */
      this.mailService
        .sendPasswordResetOtpEmail({
          toEmail:   primary.email,
          firstName: primary.firstName,
          otpCode,
          expiresAt: otpExpiry,
        })
        .catch((err: any) =>
          this.logger.error(
            `[OTP EMAIL ❌] Échec d'envoi à ${primary.email} — `
            + `code=${err?.code ?? 'N/A'} responseCode=${err?.responseCode ?? 'N/A'} `
            + `message=${err?.message ?? err}`,
          ),
        );

      this.logEvent('otp_sent', {
        userId: primary.id, email: primary.email,
        ipAddress: clientIp, userAgent, success: true,
      });

      this.logger.log(
        `[OTP ENVOYÉ] ${primary.email} | Expiration=${otpExpiry.toISOString()} | Demandes=${newRequestCount} | Comptes=${candidates.length}`,
      );
    }

    return { message: GENERIC_MSG };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. VÉRIFICATION OTP
  // ══════════════════════════════════════════════════════════════════════════

  async verifyOtp(
    identifier:     string,
    code:           string,
    accountUserId?: string,
  ): Promise<OtpVerifyResponse | AccountChoiceResult> {
    const INVALID_OTP = 'Code incorrect ou expiré. Vérifiez et réessayez.';

    // On doit récupérer resetOtpHash (select: false → query builder explicite)
    // getMany() : identifier n'est plus unique tous rôles confondus — un compte
    // pro et son compte client lié peuvent tous deux matcher (forgotPassword()
    // leur a écrit le MÊME hash OTP, voir plus haut).
    const allMatches = await this.userRepo
      .createQueryBuilder('u')
      .select([
        'u.id', 'u.email', 'u.role', 'u.firstName', 'u.status',
        'u.resetOtpHash', 'u.resetOtpExpiry', 'u.resetOtpAttempts',
      ])
      .where('u.email = :email', { email: identifier.toLowerCase().trim() })
      .orWhere('u.phone = :phone', { phone: identifier.replace(/\s/g, '') })
      .getMany();

    /* Cible précise si l'appelant a déjà choisi (2e appel après un
     * requiresAccountChoice), sinon le seul candidat s'il n'y en a qu'un. */
    const user = accountUserId
      ? allMatches.find(u => u.id === accountUserId)
      : (allMatches.length === 1 ? allMatches[0] : undefined);

    if ((!user && allMatches.length <= 1) || (user && user.status !== UserStatus.ACTIVE)) {
      this.logEvent('otp_failed', {
        email: identifier, success: false, failureReason: 'Utilisateur introuvable ou inactif',
      });
      throw new BadRequestException(INVALID_OTP);
    }

    /* Ambigu (comptes liés, pas encore de choix) : on valide le code contre
     * le 1er candidat AVANT de révéler l'ambiguïté — les deux comptes liés
     * partagent le même hash OTP (écrit par forgotPassword()), donc ce test
     * est représentatif des deux ; on ne veut pas laisser deviner un code
     * sans connaître l'identifiant exact. */
    if (!user) {
      const representative = allMatches[0];
      const otpStillValid =
        representative.resetOtpHash && representative.resetOtpExpiry
        && representative.resetOtpExpiry > new Date()
        && await bcrypt.compare(code.trim(), representative.resetOtpHash);
      if (!otpStillValid) {
        this.logEvent('otp_failed', {
          email: identifier, success: false, failureReason: 'OTP invalide (comptes liés)',
        });
        throw new BadRequestException(INVALID_OTP);
      }
      return {
        requiresAccountChoice: true,
        accounts: allMatches.map(u => ({ userId: u.id, role: u.role })),
      };
    }

    if (!user.resetOtpHash || !user.resetOtpExpiry || user.resetOtpExpiry < new Date()) {
      this.logEvent('otp_failed', {
        userId: user.id, email: user.email, success: false, failureReason: 'OTP absent ou expiré',
      });
      throw new BadRequestException(
        'Ce code a expiré. Demandez un nouveau code depuis la page de connexion.',
      );
    }

    const attempts = user.resetOtpAttempts ?? 0;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await this.userRepo.update(user.id, {
        resetOtpHash: null, resetOtpExpiry: null, resetOtpAttempts: 0,
      });
      this.logEvent('otp_failed', {
        userId: user.id, email: user.email, success: false, failureReason: 'Trop de tentatives',
      });
      throw new BadRequestException(
        'Trop de tentatives incorrectes. Votre code a été invalidé. Demandez-en un nouveau.',
      );
    }

    const isValid = await bcrypt.compare(code.trim(), user.resetOtpHash);

    if (!isValid) {
      const remaining = OTP_MAX_ATTEMPTS - attempts - 1;
      if (remaining <= 0) {
        await this.userRepo.update(user.id, {
          resetOtpHash: null, resetOtpExpiry: null, resetOtpAttempts: 0,
        });
        this.logEvent('otp_failed', {
          userId: user.id, email: user.email, success: false,
          failureReason: 'Code invalide — limite de tentatives atteinte',
        });
        throw new BadRequestException(
          'Code incorrect. Votre code a été invalidé. Demandez-en un nouveau.',
        );
      }
      await this.userRepo.update(user.id, { resetOtpAttempts: attempts + 1 });
      this.logEvent('otp_failed', {
        userId: user.id, email: user.email, success: false,
        failureReason: `Code invalide — ${remaining} tentative(s) restante(s)`,
      });
      throw new BadRequestException(
        `Code incorrect. Il vous reste ${remaining} tentative(s).`,
      );
    }

    /* OTP valide → effacer sur TOUS les comptes liés à cet identifiant, pas
     * seulement celui choisi : forgotPassword() a écrit le même hash sur
     * chacun, un code déjà utilisé pour l'un ne doit plus être rejouable
     * pour l'autre. */
    await Promise.all(allMatches.map(u => this.userRepo.update(u.id, {
      resetOtpHash: null, resetOtpExpiry: null, resetOtpAttempts: 0,
    })));

    // Générer resetToken JWT 15 min
    const resetToken = this.jwtService.sign(
      { sub: user.id, purpose: 'password-reset', email: user.email },
      {
        expiresIn: JWT_TTL_RESET,
        secret:    this.jwtResetSecret,
      },
    );

    this.logEvent('otp_success', { userId: user.id, email: user.email, success: true });
    this.logger.log(`[OTP ✅] ${user.email}`);
    return { resetToken };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. RÉINITIALISATION DU MOT DE PASSE
  // ══════════════════════════════════════════════════════════════════════════

  async resetPassword(resetToken: string, newPassword: string, clientIp: string | null = null, userAgent: string | null = null): Promise<{ message: string }> {
    let payload: any;
    try {
      payload = this.jwtService.verify(resetToken, {
        secret: this.jwtResetSecret,
      });
    } catch {
      throw new BadRequestException(
        'Votre session de réinitialisation a expiré (15 min). Recommencez depuis le début.',
      );
    }

    if (payload.purpose !== 'password-reset') {
      throw new ForbiddenException('Token invalide.');
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('Compte introuvable ou inactif.');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Le mot de passe doit faire au moins 8 caractères.');
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.',
      );
    }

    // Vérifier que le nouveau MDP ≠ l'ancien
    const userWithPwd = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.password'])
      .where('u.id = :id', { id: user.id })
      .getOne();

    const sameAsOld = await bcrypt.compare(newPassword, userWithPwd!.password);
    if (sameAsOld) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent de l\'ancien.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userRepo.update(user.id, {
      password:              hashedPassword,
      lastPasswordChangedAt: new Date(),
      failedLoginAttempts:   0,
      lockedUntil:           null,
    });

    /* Révoquer tous les refresh tokens actifs — invalide toutes les sessions
     * existantes après un reset de mot de passe (bonne pratique OWASP). */
    await this.revokeAllRefreshTokens(user.id);

    this.logEvent('password_reset_success', {
      userId: user.id, email: user.email, role: user.role,
      ipAddress: clientIp, userAgent, success: true,
    });

    this.mailService
      .sendPasswordChangedEmail({
        toEmail:   user.email,
        firstName: user.firstName,
        changedAt: new Date(),
        loginUrl:  `${this.config.get('FRONTEND_URL')}/login`,
      })
      .catch(err =>
        this.logger.error(`[PWD CHANGED EMAIL ❌] ${user.email} | ${(err as Error).message}`),
      );

    this.logger.log(`[PASSWORD RESET ✅] ${user.email}`);
    return { message: 'Votre mot de passe a été réinitialisé avec succès.' };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 6. PROFIL CONNECTÉ
  // ══════════════════════════════════════════════════════════════════════════

  async getMe(userId: string): Promise<ReturnType<typeof this.toPublicUser>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    return this.toPublicUser(user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MÉTHODES PRIVÉES
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Lire le companyId depuis le code d'invitation.
   *
   * Dans code-creation.entity.ts, companyId est une FK vers
   * entreprise-profile.entity.ts (Company). On le lit directement
   * depuis la colonne `companyId` de creation_codes.
   */
  private async getCodeCompanyId(codeId: string | null): Promise<string | null> {
    if (!codeId) return null;
    const code = await this.dataSource
      .getRepository(CreationCode)
      .findOne({ where: { id: codeId }, select: ['id', 'companyId'] });
    return code?.companyId ?? null;
  }

  /**
   * Lire le deliveryId depuis le code d'invitation.
   *
   * Dans code-creation.entity.ts, deliveryId est une FK vers
   * livreur-profile.entity.ts (Delivery). On le lit directement
   * depuis la colonne `deliveryId` de creation_codes.
   */
  private async getCodeDeliveryId(codeId: string | null): Promise<string | null> {
    if (!codeId) return null;
    const code = await this.dataSource
      .getRepository(CreationCode)
      .findOne({ where: { id: codeId }, select: ['id', 'deliveryId'] });
    return code?.deliveryId ?? null;
  }

  /**
   * Lire l'email cible du code pour vérifier que l'email
   * du formulaire correspond à l'email de l'invitation.
   *
   * Dans code-creation.entity.ts : targetEmail (nullable varchar).
   */
  private async getCodeTargetEmail(codeId: string | null): Promise<string | null> {
    if (!codeId) return null;
    const code = await this.dataSource
      .getRepository(CreationCode)
      .findOne({ where: { id: codeId }, select: ['id', 'targetEmail'] });
    return code?.targetEmail ?? null;
  }

  /**
   * Renvoie TOUS les comptes correspondant à cet identifiant — email/téléphone
   * ne sont plus uniques globalement (UNIQUE(email, role)) depuis l'ajout des
   * comptes liés pro↔client : un même email peut désormais correspondre à
   * DEUX lignes `users` (le compte pro et son compte client lié). En pratique
   * jamais plus de 2 résultats (au plus un par rôle, et seul le couple
   * pro+client partage un identifiant).
   */
  private async findAllByIdentifier(identifier: string): Promise<User[]> {
    const normalized = identifier.trim().toLowerCase();
    if (normalized.includes('@')) {
      return this.userRepo.find({ where: { email: normalized } });
    }
    return this.userRepo.find({ where: { phone: normalized.replace(/\s/g, '') } });
  }

  /**
   * Non-private : réutilisé par AccountLinkService.linkExistingClient() pour
   * que le mot de passe testé contre un compte client CIBLE (preuve de
   * possession) bénéficie du même verrouillage à 5 tentatives que le login
   * normal — ce chemin ne passait auparavant par aucun compteur d'échec.
   */
  async handleFailedLogin(user: User): Promise<void> {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const updates: Partial<User> = { failedLoginAttempts: attempts };
    if (attempts >= MAX_FAILED_LOGINS) {
      updates.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
      this.logger.warn(`[BRUTE-FORCE 🚨] ${user.email} → verrouillé`);
    }
    await this.userRepo.update(user.id, updates as any);
  }

  private signJwt(user: User, _rememberMe: boolean, actorId?: string): string {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    if (actorId) payload.actorId = actorId;

    /* Access token court (1h) pour tous les rôles non-super-admin.
     * La persistance de session est assurée par le refresh token (24h ou 7j).
     * SUPER_ADMIN n'a pas de refresh token — il doit se reconnecter après 4h. */
    const expiresIn = user.role === UserRole.SUPER_ADMIN ? JWT_TTL_SUPER : JWT_TTL_ACCESS;

    return this.jwtService.sign(payload, { expiresIn });
  }

  /** Retourne le UUID du profil associé à un utilisateur selon son rôle */
  private async findProfileId(userId: string, role: UserRole): Promise<string | undefined> {
    try {
      switch (role) {
        case UserRole.CLIENT:        return (await this.clientRepo.findOne({ where: { userId } }))?.id;
        case UserRole.COMPANY: {
          /* Propriétaire : possède une entité Company propre */
          const ownCompany = await this.companyRepo.findOne({ where: { userId } });
          if (ownCompany) return ownCompany.id;
          /* Collaborateur : lié à une entreprise via CompanyTeamMember
           * → actorId = companyId de l'entreprise pour laquelle il travaille
           * → cela permet aux endpoints /dashboard/entreprise/* de fonctionner
           *   identiquement pour le propriétaire et ses collaborateurs */
          const membership = await this.teamMemberRepo.findOne({
            where: { userId, status: TeamMemberStatus.ACTIVE },
            select: ['companyId'],
          });
          return membership?.companyId;
        }
        case UserRole.DELIVERY:      return (await this.deliveryRepo.findOne({ where: { userId } }))?.id;
        case UserRole.CORRESPONDENT: return (await this.correspondentRepo.findOne({ where: { userId } }))?.id;
        case UserRole.PARTNER:       return (await this.partnerRepo.findOne({ where: { userId } }))?.id;
        case UserRole.ADMIN:         return (await this.adminRepo.findOne({ where: { userId } }))?.id;
        default:                     return undefined;
      }
    } catch {
      return undefined;
    }
  }

  private toPublicUser(user: User) {
    return {
      id:        user.id,
      email:     user.email,
      firstName: user.firstName,
      lastName:  user.lastName,
      username:  user.username,
      role:      user.role,
      status:    user.status,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 7. CONNEXION / INSCRIPTION VIA GOOGLE OAUTH
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Appelé après validation du token Google.
   * - Si l'email existe déjà → connexion directe (tout rôle accepté)
   * - Sinon → création d'un compte CLIENT automatiquement
   * Retourne un JWT signé.
   */
  async googleLogin(googleUser: {
    email: string; firstName: string; lastName: string; picture?: string | null;
  }): Promise<string> {
    const email = googleUser.email.toLowerCase().trim();

    /* email n'est plus unique tous rôles confondus (comptes liés pro↔client).
     * Google ne fournit qu'un email, pas de mot de passe pour désambiguïser
     * comme en login classique — on privilégie le compte CLIENT (c'est
     * l'identité par défaut pour l'OAuth grand public), sinon le premier
     * trouvé. Un utilisateur avec un compte pro + client liés voulant
     * spécifiquement se connecter en pro via Google devra utiliser le
     * login classique ou le switch depuis "Mon espace". */
    const matches = await this.userRepo.find({ where: { email } });
    let user = matches.find(u => u.role === UserRole.CLIENT) ?? matches[0] ?? null;

    if (user) {
      if (user.status === UserStatus.BANNED)
        throw new UnauthorizedException('Votre compte est banni. Contactez le support Shopi.');
      if (user.status === UserStatus.SUSPENDED)
        throw new UnauthorizedException('Votre compte est suspendu. Contactez l\'administrateur.');
      user.lastLoginAt = new Date();
      await this.userRepo.save(user);
      const actorId = await this.findProfileId(user.id, user.role as UserRole);
      return this.signJwt(user, true, actorId);
    }

    /* ── Nouveau compte CLIENT ── */
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const username  = await this.generateUniqueUsername(
        googleUser.firstName || 'User', googleUser.lastName || '',
      );
      const randomPwd = await bcrypt.hash(
        crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS,
      );

      const userEntity = this.userRepo.create({
        firstName:      googleUser.firstName || 'Utilisateur',
        lastName:       googleUser.lastName  || '',
        email,
        username,
        password:       randomPwd,
        role:           UserRole.CLIENT,
        status:         UserStatus.ACTIVE,
        emailVerified:  true,
        profilePicture: googleUser.picture ?? null,
        lastLoginAt:    new Date(),
      });
      user = await queryRunner.manager.save(User, userEntity);

      await queryRunner.manager.save(Client, this.clientRepo.create({
        userId:   user.id,
        fullName: `${user.firstName} ${user.lastName}`.trim(),
        status:   'active' as any,
      }));

      await queryRunner.manager.save(Wallet, this.walletRepo.create({ userId: user.id }));

      await queryRunner.commitTransaction();

      this.mailService.sendWelcomeEmail({
        toEmail:  user.email,
        firstName: user.firstName,
        role:      user.role,
        loginUrl:  `${this.config.get('FRONTEND_URL')}/login`,
      }).catch(err =>
        this.logger.error(`[WELCOME GOOGLE ❌] ${user!.email} | ${(err as Error).message}`),
      );

      this.logger.log(`[GOOGLE REGISTER ✅] ${user.email}`);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    const actorId = await this.findProfileId(user!.id, user!.role as UserRole);
    return this.signJwt(user!, true, actorId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 8. GOOGLE OAUTH — CODE À USAGE UNIQUE (anti-JWT-in-URL)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Génère un code aléatoire à usage unique (UUID) et stocke le JWT associé
   * dans Redis avec une expiration de 60 secondes.
   *
   * Pourquoi : éviter de mettre le JWT directement dans l'URL de redirection
   * (historique navigateur, logs serveur, header Referer).
   * Le code court est non-sensible (aléatoire, expire en 60s, usage unique).
   */
  async createGoogleOAuthCode(jwt: string): Promise<string> {
    const code = crypto.randomUUID();
    await this.redis.setex(`oauth_code:${code}`, OAUTH_CODE_TTL_SEC, jwt);
    return code;
  }

  /**
   * Échange le code OAuth contre le JWT, puis détruit le code (usage unique).
   * Lance UnauthorizedException si le code est expiré ou inexistant.
   */
  async exchangeGoogleOAuthCode(
    code:      string,
    ipAddress: string | null = null,
    userAgent: string | null = null,
  ): Promise<AuthServiceResult> {
    const key = `oauth_code:${code}`;
    const jwt = await this.redis.get(key);

    if (!jwt) {
      throw new UnauthorizedException(
        'Code OAuth invalide ou expiré (60 secondes). Reconnectez-vous via Google.',
      );
    }

    await this.redis.del(key);

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(jwt, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Token OAuth invalide. Reconnectez-vous.');
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) throw new NotFoundException('Compte introuvable.');

    const ttlMs    = REFRESH_TTL_NORMAL_MS;
    const expiresAt = new Date(Date.now() + ttlMs);
    const { rawToken: refreshToken } = await this.issueRefreshToken(
      user.id, ipAddress, userAgent, expiresAt,
    );

    this.logEvent('login_success', {
      userId: user.id, email: user.email, role: user.role,
      ipAddress, userAgent, success: true,
    });

    return { accessToken: jwt, refreshToken, refreshTtlMs: ttlMs, user: this.toPublicUser(user) };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUDIT LOG — journalisation des événements de sécurité (fire-and-forget)
  // ══════════════════════════════════════════════════════════════════════════

  /** Non-private : réutilisé par AccountLinkService pour journaliser les
   *  switches "Mon espace" dans le même journal d'audit que le reste de l'auth. */
  logEvent(
    event: string,
    data: {
      userId?:        string | null;
      email?:         string | null;
      role?:          string | null;
      ipAddress?:     string | null;
      userAgent?:     string | null;
      success?:       boolean;
      failureReason?: string | null;
    },
  ): void {
    this.authLogRepo.save(
      this.authLogRepo.create({
        event,
        userId:        data.userId        ?? null,
        email:         data.email         ?? null,
        role:          data.role          ?? null,
        ipAddress:     data.ipAddress     ?? null,
        userAgent:     data.userAgent     ?? null,
        success:       data.success       ?? true,
        failureReason: data.failureReason ?? null,
      }),
    ).catch(err =>
      this.logger.error(`[AUTH LOG ❌] ${event} | ${(err as Error).message}`),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REFRESH TOKENS — émission, rotation, révocation
  // ══════════════════════════════════════════════════════════════════════════

  private async issueRefreshToken(
    userId:     string,
    ipAddress:  string | null,
    userAgent:  string | null,
    expiresAt:  Date,
  ): Promise<{ rawToken: string; record: RefreshToken }> {
    /* Plafonner à MAX_REFRESH_TOKENS tokens actifs par utilisateur.
     * Révoque les plus anciens si le seuil est dépassé (ex : multi-appareils). */
    const active = await this.refreshTokenRepo.find({
      where: { userId, revoked: false },
      order: { createdAt: 'ASC' },
    });
    if (active.length >= MAX_REFRESH_TOKENS) {
      const toRevoke = active.slice(0, active.length - MAX_REFRESH_TOKENS + 1);
      for (const old of toRevoke) {
        await this.refreshTokenRepo.update(old.id, { revoked: true });
      }
    }

    /* Token brut = deux UUID v4 concaténés (288 bits d'entropie).
     * Seul le hash SHA-256 (64 hex) est stocké en base. */
    const rawToken  = crypto.randomUUID() + crypto.randomUUID();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const record = this.refreshTokenRepo.create({ tokenHash, userId, ipAddress, userAgent, expiresAt });
    await this.refreshTokenRepo.save(record);

    return { rawToken, record };
  }

  private async revokeRefreshToken(id: string): Promise<void> {
    await this.refreshTokenRepo.update(id, { revoked: true });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.refreshTokenRepo.update({ userId, revoked: false }, { revoked: true });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REFRESH — rotation du refresh token + nouvel access token
  // ══════════════════════════════════════════════════════════════════════════

  async refreshTokens(
    rawRefreshToken: string,
    ipAddress:       string | null,
    userAgent:       string | null,
  ): Promise<AuthServiceResult> {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    /* tokenHash a select:false → on doit l'expliciter dans le queryBuilder */
    const record = await this.refreshTokenRepo
      .createQueryBuilder('rt')
      .addSelect('rt.tokenHash')
      .where('rt.tokenHash = :hash',   { hash: tokenHash })
      .andWhere('rt.revoked = false')
      .andWhere('rt.expiresAt > :now', { now: new Date() })
      .getOne();

    if (!record) {
      this.logEvent('token_refresh_failed', {
        ipAddress, userAgent, success: false,
        failureReason: 'Token introuvable, révoqué ou expiré',
      });
      throw new UnauthorizedException('Session expirée. Veuillez vous reconnecter.');
    }

    const user = await this.userRepo.findOne({ where: { id: record.userId } });
    if (!user || user.status === UserStatus.BANNED || user.status === UserStatus.SUSPENDED) {
      await this.revokeAllRefreshTokens(record.userId);
      this.logEvent('token_refresh_failed', {
        userId: record.userId, ipAddress, userAgent, success: false,
        failureReason: 'Compte inactif ou banni',
      });
      throw new UnauthorizedException('Compte inactif. Reconnectez-vous.');
    }

    /* Rotation : révocation de l'ancien + émission d'un nouveau avec la même expiration.
     * Si le même token est utilisé deux fois → détection de vol → révocation totale. */
    const newExpiresAt = record.expiresAt;
    await this.revokeRefreshToken(record.id);
    const { rawToken: newRawToken, record: newRecord } = await this.issueRefreshToken(
      user.id, ipAddress, userAgent, newExpiresAt,
    );
    await this.refreshTokenRepo.update(record.id, { replacedByTokenId: newRecord.id });

    const actorId    = await this.findProfileId(user.id, user.role as UserRole);
    const accessToken = this.signJwt(user, false, actorId);
    const refreshTtlMs = newExpiresAt.getTime() - Date.now();

    this.logEvent('token_refreshed', {
      userId: user.id, email: user.email, role: user.role,
      ipAddress, userAgent, success: true,
    });

    this.logger.log(`[REFRESH ✅] ${user.email} | IP=${ipAddress}`);
    return { accessToken, refreshToken: newRawToken, refreshTtlMs, user: this.toPublicUser(user) };
  }

  /** Non-private : réutilisé par AccountLinkService pour générer le username
   *  du compte client créé depuis "Mon espace". */
  async generateUniqueUsername(firstName: string, lastName: string): Promise<string> {
    const normalize = (s: string) =>
      s.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
    const base = `${normalize(firstName)}.${normalize(lastName)}`;
    let username = base;
    let suffix   = 1;

    // ✅ withDeleted: true → inclut les users soft-deleted (deletedAt non NULL).
    //    La contrainte UNIQUE en base s'applique à TOUTES les lignes,
    //    donc on doit aussi compter les supprimés pour éviter le doublon.
    while (await this.userRepo.findOne({ where: { username }, withDeleted: true })) {
      username = `${base}${suffix++}`;
    }
    return username;
  }
}