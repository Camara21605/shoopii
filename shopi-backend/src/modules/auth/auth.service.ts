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

/* ── Constantes ── */
const BCRYPT_ROUNDS         = 12;
const JWT_TTL_SHORT         = '24h';
const JWT_TTL_LONG          = '7d';   // 30d → 7d : access token long
const JWT_TTL_SUPER         = '4h';   // 365d → 4h : super admin = TTL le plus court
const JWT_TTL_RESET         = '15m';
const OAUTH_CODE_TTL_SEC    = 60;     // code OAuth à usage unique, expire en 60s
const MAX_FAILED_LOGINS     = 5;
const LOCKOUT_MINUTES       = 30;
const OTP_EXPIRY_MINUTES    = 10;
const OTP_MAX_ATTEMPTS      = 3;
const OTP_RATE_LIMIT_WINDOW = 15;
const OTP_RATE_LIMIT_MAX    = 3;

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

export interface OtpVerifyResponse {
  resetToken: string;
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

    private readonly jwtService:          JwtService,
    private readonly config:              ConfigService,
    private readonly dataSource:          DataSource,
    private readonly codeCreationService: CodeCreationService,
    private readonly mailService:         MailService,

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
      const password  = this.config.get<string>('SUPER_ADMIN_PASSWORD') ?? 'Shopi@SuperAdmin2025!';
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

  async register(dto: RegisterDto, clientIp: string): Promise<AuthResponse> {

    // Sécurité : empêcher la création d'un compte SUPER_ADMIN (ou de tout
    // futur rôle privilégié non listé) via l'inscription publique.
    if (!SELF_REGISTRABLE_ROLES.includes(dto.role as UserRole)) {
      this.logger.warn(`[REGISTER ❌ RÔLE INTERDIT] ${dto.email} a tenté de s'inscrire avec le rôle "${dto.role}".`);
      throw new ForbiddenException(`Le rôle "${dto.role}" ne peut pas être créé via l'inscription.`);
    }

    // Vérifier unicité email
    /* withDeleted: true → inclut les comptes soft-deleted.
       Sans ça, TypeORM ignore les lignes avec deletedAt IS NOT NULL,
       mais la contrainte UNIQUE en base s'applique à TOUTES les lignes
       → INSERT échoue avec QueryFailedError au lieu de ConflictException. */
    const emailExists = await this.userRepo.findOne({
      where: { email: dto.email },
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

    const actorId = await this.findProfileId(newUser.id, newUser.role as UserRole);
    return { accessToken: this.signJwt(newUser, false, actorId), user: this.toPublicUser(newUser) };
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

  async login(dto: LoginDto, clientIp: string): Promise<AuthResponse> {
    const INVALID_MSG = 'Identifiants incorrects. Vérifiez votre email et mot de passe.';
    const user = await this.findByIdentifier(dto.identifier);
    if (!user) throw new UnauthorizedException(INVALID_MSG);

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const min = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(`Compte verrouillé. Réessayez dans ${min} minute(s).`);
    }
    if (user.status === UserStatus.BANNED)
      throw new UnauthorizedException('Votre compte a été banni. Contactez le support Shopi.');
    if (user.status === UserStatus.SUSPENDED)
      throw new UnauthorizedException("Votre compte est suspendu. Contactez l'administrateur.");

    // Récupérer le mot de passe (select: false sur le champ)
    const userWithPwd = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.password', 'u.failedLoginAttempts'])
      .where('u.id = :id', { id: user.id })
      .getOne();

    const passwordValid = await bcrypt.compare(dto.password, userWithPwd!.password);
    if (!passwordValid) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException(INVALID_MSG);
    }

    await this.userRepo.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil:         null,
      lastLoginAt:         new Date(),
      lastLoginIp:         clientIp,
    });

    this.logger.log(`[LOGIN ✅] ${user.email} | ${user.role} | IP=${clientIp}`);
    const actorId = await this.findProfileId(user.id, user.role as UserRole);
    return { accessToken: this.signJwt(user, dto.rememberMe ?? false, actorId), user: this.toPublicUser(user) };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. MOT DE PASSE OUBLIÉ — Génération OTP
  // ══════════════════════════════════════════════════════════════════════════

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const GENERIC_MSG =
      'Si un compte actif correspond à cet identifiant, ' +
      'vous recevrez un code de vérification dans quelques minutes.';

    const user = await this.findByIdentifier(dto.identifier);

    if (user && user.status === UserStatus.ACTIVE) {

      // Rate limiting : max OTP_RATE_LIMIT_MAX demandes par OTP_RATE_LIMIT_WINDOW min
      const windowStart = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW * 60_000);
      if (
        user.resetOtpRequestedAt &&
        user.resetOtpRequestedAt > windowStart &&
        (user.resetOtpRequestCount ?? 0) >= OTP_RATE_LIMIT_MAX
      ) {
        this.logger.warn(`[OTP RATE LIMIT 🚨] ${user.email}`);
        return { message: GENERIC_MSG };
      }

      // Générer un OTP à 6 chiffres cryptographiquement sûr
      const otpCode   = crypto.randomInt(100_000, 999_999).toString();
      const otpHash   = await bcrypt.hash(otpCode, BCRYPT_ROUNDS);
      const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

      const newRequestCount =
        user.resetOtpRequestedAt && user.resetOtpRequestedAt > windowStart
          ? (user.resetOtpRequestCount ?? 0) + 1
          : 1;

      await this.userRepo.update(user.id, {
        resetOtpHash:         otpHash,
        resetOtpExpiry:       otpExpiry,
        resetOtpAttempts:     0,
        resetOtpRequestedAt:  new Date(),
        resetOtpRequestCount: newRequestCount,
      });

      this.mailService
        .sendPasswordResetOtpEmail({
          toEmail:   user.email,
          firstName: user.firstName,
          otpCode,
          expiresAt: otpExpiry,
        })
        .catch(err =>
          this.logger.error(`[OTP EMAIL ❌] ${user.email} | ${(err as Error).message}`),
        );

      this.logger.log(
        `[OTP ENVOYÉ] ${user.email} | Expiration=${otpExpiry.toISOString()} | Demandes=${newRequestCount}`,
      );
    }

    return { message: GENERIC_MSG };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. VÉRIFICATION OTP
  // ══════════════════════════════════════════════════════════════════════════

  async verifyOtp(identifier: string, code: string): Promise<OtpVerifyResponse> {
    const INVALID_OTP = 'Code incorrect ou expiré. Vérifiez et réessayez.';

    // On doit récupérer resetOtpHash (select: false → query builder explicite)
    const user = await this.userRepo
      .createQueryBuilder('u')
      .select([
        'u.id', 'u.email', 'u.firstName', 'u.status',
        'u.resetOtpHash', 'u.resetOtpExpiry', 'u.resetOtpAttempts',
      ])
      .where('u.email = :email', { email: identifier.toLowerCase().trim() })
      .orWhere('u.phone = :phone', { phone: identifier.replace(/\s/g, '') })
      .getOne();

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException(INVALID_OTP);
    }

    if (!user.resetOtpHash || !user.resetOtpExpiry || user.resetOtpExpiry < new Date()) {
      throw new BadRequestException(
        'Ce code a expiré. Demandez un nouveau code depuis la page de connexion.',
      );
    }

    const attempts = user.resetOtpAttempts ?? 0;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await this.userRepo.update(user.id, {
        resetOtpHash: null, resetOtpExpiry: null, resetOtpAttempts: 0,
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
        throw new BadRequestException(
          'Code incorrect. Votre code a été invalidé. Demandez-en un nouveau.',
        );
      }
      await this.userRepo.update(user.id, { resetOtpAttempts: attempts + 1 });
      throw new BadRequestException(
        `Code incorrect. Il vous reste ${remaining} tentative(s).`,
      );
    }

    // OTP valide → effacer
    await this.userRepo.update(user.id, {
      resetOtpHash: null, resetOtpExpiry: null, resetOtpAttempts: 0,
    });

    // Générer resetToken JWT 15 min
    const resetToken = this.jwtService.sign(
      { sub: user.id, purpose: 'password-reset', email: user.email },
      {
        expiresIn: JWT_TTL_RESET,
        secret:    this.jwtResetSecret,
      },
    );

    this.logger.log(`[OTP ✅] ${user.email}`);
    return { resetToken };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. RÉINITIALISATION DU MOT DE PASSE
  // ══════════════════════════════════════════════════════════════════════════

  async resetPassword(resetToken: string, newPassword: string): Promise<{ message: string }> {
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

  private async findByIdentifier(identifier: string): Promise<User | null> {
    const normalized = identifier.trim().toLowerCase();
    if (normalized.includes('@')) {
      return this.userRepo.findOne({ where: { email: normalized } });
    }
    return this.userRepo.findOne({ where: { phone: normalized.replace(/\s/g, '') } });
  }

  private async handleFailedLogin(user: User): Promise<void> {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const updates: Partial<User> = { failedLoginAttempts: attempts };
    if (attempts >= MAX_FAILED_LOGINS) {
      updates.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
      this.logger.warn(`[BRUTE-FORCE 🚨] ${user.email} → verrouillé`);
    }
    await this.userRepo.update(user.id, updates as any);
  }

  private signJwt(user: User, rememberMe: boolean, actorId?: string): string {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    if (actorId) payload.actorId = actorId;

    // Le super admin a systématiquement le TTL le plus court (4h),
    // quel que soit le flag rememberMe — c'est le compte le plus privilégié.
    const expiresIn =
      user.role === UserRole.SUPER_ADMIN
        ? JWT_TTL_SUPER
        : rememberMe ? JWT_TTL_LONG : JWT_TTL_SHORT;

    return this.jwtService.sign(payload, { expiresIn });
  }

  /** Retourne le UUID du profil associé à un utilisateur selon son rôle */
  private async findProfileId(userId: string, role: UserRole): Promise<string | undefined> {
    try {
      switch (role) {
        case UserRole.CLIENT:        return (await this.clientRepo.findOne({ where: { userId } }))?.id;
        case UserRole.COMPANY:       return (await this.companyRepo.findOne({ where: { userId } }))?.id;
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

    let user = await this.userRepo.findOne({ where: { email } });

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
  async exchangeGoogleOAuthCode(code: string): Promise<AuthResponse> {
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

    return { accessToken: jwt, user: this.toPublicUser(user) };
  }

  private async generateUniqueUsername(firstName: string, lastName: string): Promise<string> {
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