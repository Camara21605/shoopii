// src/modules/codes/code-creation.service.ts

import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { CreationCode, CodeStatus } from '../../../database/entities/code-creation.entity';
import { User, UserStatus }         from '../../../database/entities/user.entity';
import { UserRole }                 from '../../../common/enums/user-role.enum';
import { MailService }              from '../../email/email.service';
import { GenerateAndSendCodeDto, GenerateBulkCodesDto } from './dto/generate-and-send.dto';
import { FilterCodesDto }           from './dto/filter-codes.dto';

const MAX_VERIFICATION_ATTEMPTS = 10;
const DEFAULT_VALIDITY_DAYS     = 7;
const DEFAULT_MAX_USES          = 1;
const CODE_ALPHABET             = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const SUPER_ADMIN_INVITABLE_ROLES: UserRole[] = [
  UserRole.ADMIN, UserRole.PARTNER, UserRole.COMPANY, UserRole.DELIVERY,
];

export interface CodeResponse {
  id: string; code: string; role: string; roleLabel: string;
  status: 'valid' | 'used' | 'expired' | 'revoked';
  targetEmail: string | null; createdAt: string;
  expiresAt: string; expiresAtRaw: Date;
  uses: number; maxUses: number; note: string | null;
  emailSent: boolean; usedBy?: string; usedAt?: string;
}

export interface ValidateCodeResult {
  valid: true; targetRole: UserRole; codeId: string;
}

export interface CodeStatsPerRole {
  role: UserRole; roleLabel: string; total: number;
  valid: number; used: number; expired: number; revoked: number;
  totalUses: number; totalMaxUses: number; available: number;
  recentUsers: { name: string; date: string }[];
}

export interface CodeInfoResponse {
  senderType:  'company' | 'delivery' | null;
  senderName:  string | null;
  targetEmail: string | null;
  targetRole:  string;
  valid:       boolean;
  expired:     boolean;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur', company: 'Entreprise',
  delivery: 'Livreur', partner: 'Partenaire', correspondent: 'Correspondant',
};

@Injectable()
export class CodeCreationService {

  private readonly logger = new Logger(CodeCreationService.name);

  constructor(
    @InjectRepository(CreationCode) private readonly codeRepo: Repository<CreationCode>,
    @InjectRepository(User)         private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  /* ── 1. INVITATION DIRECTE ── */
  async generateAndSendCode(dto: GenerateAndSendCodeDto, superAdmin: User): Promise<CodeResponse> {
    this.assertIsSuperAdmin(superAdmin);
    if (!SUPER_ADMIN_INVITABLE_ROLES.includes(dto.targetRole as UserRole)) {
      throw new ForbiddenException(`Le super-admin ne peut pas inviter un "${ROLE_LABELS[dto.targetRole] ?? dto.targetRole}".`);
    }
    const normalizedEmail = dto.targetEmail.toLowerCase().trim();
    const existingUser = await this.userRepo.findOne({ where: { email: normalizedEmail } });
    if (existingUser) throw new ConflictException(`Un compte Shopi existe déjà pour "${normalizedEmail}".`);
    const activePending = await this.codeRepo.findOne({ where: { targetEmail: normalizedEmail, status: CodeStatus.PENDING } });
    if (activePending) throw new ConflictException(`Un code valide existe déjà pour "${normalizedEmail}".`);
    const validityDays = dto.validityDays ?? DEFAULT_VALIDITY_DAYS;
    const entry = this.codeRepo.create({
      code: this.generateReadableCode(), targetRole: dto.targetRole as UserRole,
      targetEmail: normalizedEmail, validityDays, expiresAt: this.computeExpiry(validityDays),
      maxUses: dto.maxUses ?? DEFAULT_MAX_USES, usesCount: 0,
      note: dto.note?.trim() ?? null, generatedById: superAdmin.id, status: CodeStatus.PENDING,
    });
    const saved = await this.codeRepo.save(entry);

    /* Envoi synchrone : on attend la réponse SMTP avant de répondre au client.
     * Si l'email échoue, on retourne quand même le code (emailSent: false)
     * pour ne pas bloquer le super admin, mais l'erreur est loguée et visible. */
    let emailSent = false;
    try {
      await this.mailService.sendInvitationEmail({
        toEmail:    normalizedEmail,
        code:       saved.code,
        targetRole: saved.targetRole,
        expiresAt:  saved.expiresAt,
        senderName: `${superAdmin.firstName} ${superAdmin.lastName}`,
      });
      emailSent = true;
      this.logger.log(`[EMAIL ✅] Invitation envoyée à ${normalizedEmail} | Code: ${saved.code}`);
    } catch (err: any) {
      this.logger.error(`[EMAIL ❌] Échec d'envoi à ${normalizedEmail}`);
      this.logger.error(`[EMAIL ❌] Code erreur  : ${err.code  ?? 'UNKNOWN'}`);
      this.logger.error(`[EMAIL ❌] Message     : ${err.message}`);
      this.logger.error(`[EMAIL ❌] SMTP response: ${err.response ?? '–'}`);
      this.logger.error(`[EMAIL ❌] ResponseCode : ${err.responseCode ?? '–'}`);
      /* Ne pas bloquer le super admin — le code est créé et utilisable
         même si l'email a échoué. Il peut copier le code manuellement. */
    }

    return this.toCodeResponse(saved, emailSent);
  }

  /* ── 2. GÉNÉRATION EN LOT ── */
  async generateBulkCodes(dto: GenerateBulkCodesDto, superAdmin: User): Promise<CodeResponse[]> {
    this.assertIsSuperAdmin(superAdmin);
    if (!SUPER_ADMIN_INVITABLE_ROLES.includes(dto.targetRole as UserRole)) {
      throw new ForbiddenException(`Le super-admin ne peut pas générer des codes pour "${ROLE_LABELS[dto.targetRole] ?? dto.targetRole}".`);
    }
    const expiresAt = this.computeExpiry(dto.validityDays);
    const entries = Array.from({ length: dto.quantity }, () =>
      this.codeRepo.create({
        code: this.generateReadableCode(), targetRole: dto.targetRole as UserRole,
        targetEmail: null, validityDays: dto.validityDays, expiresAt,
        maxUses: dto.maxUses, usesCount: 0, note: dto.note?.trim() ?? null,
        generatedById: superAdmin.id, status: CodeStatus.PENDING,
      }),
    );
    const saved = await this.codeRepo.save(entries);
    return saved.map(c => this.toCodeResponse(c, false));
  }

  /* ── 2B. GÉNÉRATION PAR ENTREPRISE/LIVREUR ── */
  async generateForCompany(params: {
    targetRole: UserRole; targetEmail: string;
    companyId: string | null; deliveryId?: string | null; generatedById: string; note?: string;
  }): Promise<{ code: string; codeId: string; expiresAt: Date }> {
    const { targetRole, targetEmail, companyId, deliveryId, generatedById, note } = params;
    const existing = await this.codeRepo.findOne({ where: { targetEmail, status: CodeStatus.PENDING } });
    if (existing) return { code: existing.code, codeId: existing.id, expiresAt: existing.expiresAt };
    const entry = this.codeRepo.create({
      code: this.generateReadableCode(), targetRole, targetEmail,
      validityDays: DEFAULT_VALIDITY_DAYS, expiresAt: this.computeExpiry(DEFAULT_VALIDITY_DAYS),
      maxUses: 1, usesCount: 0, status: CodeStatus.PENDING,
      generatedById, companyId: companyId ?? null, deliveryId: deliveryId ?? null, note: note ?? null,
    });
    const saved = await this.codeRepo.save(entry);
    return { code: saved.code, codeId: saved.id, expiresAt: saved.expiresAt };
  }

  /* ── 3. VALIDATION ── */
  async validateCode(codeValue: string, targetRole: UserRole): Promise<ValidateCodeResult> {
    const normalized = codeValue.toUpperCase().trim();
    const entry      = await this.codeRepo.findOne({ where: { code: normalized } });
    if (entry) {
      entry.verificationAttempts = (entry.verificationAttempts ?? 0) + 1;
      await this.codeRepo.save(entry);
      if (entry.verificationAttempts > MAX_VERIFICATION_ATTEMPTS) {
        if (entry.status === CodeStatus.PENDING) { entry.status = CodeStatus.REVOKED; entry.revokedAt = new Date(); await this.codeRepo.save(entry); }
        throw new ForbiddenException(`Ce code a été révoqué après trop de tentatives.`);
      }
    }
    if (!entry) throw new BadRequestException(`Code d'invitation invalide.`);
    if (entry.status === CodeStatus.REVOKED) throw new BadRequestException(`Ce code a été révoqué.`);
    if (entry.status === CodeStatus.EXPIRED || entry.expiresAt < new Date()) {
      if (entry.status !== CodeStatus.EXPIRED) { entry.status = CodeStatus.EXPIRED; await this.codeRepo.save(entry); }
      throw new BadRequestException(`Ce code a expiré.`);
    }
    if (entry.usesCount >= entry.maxUses) { entry.status = CodeStatus.USED; await this.codeRepo.save(entry); throw new BadRequestException(`Ce code a déjà été utilisé.`); }
    if (entry.targetRole !== targetRole) throw new BadRequestException(`Ce code est pour le rôle "${ROLE_LABELS[entry.targetRole] ?? entry.targetRole}".`);
    return { valid: true, targetRole: entry.targetRole, codeId: entry.id };
  }

  /* ═══════════════════════════════════════════════════════════
   * GET /codes/info/:code — PUBLIC
   *
   * FIX DÉFINITIF :
   *
   *  Stratégie 1 — companyId sur le code (le plus fiable)
   *    Si entry.companyId est défini → senderType = 'company'
   *    Requête SQL directe sur la table entreprises
   *
   *  Stratégie 2 — generatedById → user.role (fallback)
   *    Si entry.generatedById pointe vers un COMPANY → 'company'
   *    Si entry.generatedById pointe vers un DELIVERY → 'delivery'
   *    Requête senderName en try/catch isolé pour ne pas bloquer
   *
   *  Chaque étape est isolée dans un try/catch → jamais de throw
   ═══════════════════════════════════════════════════════════ */
  async getCodeInfo(codeValue: string): Promise<CodeInfoResponse> {
    const normalized = codeValue.toUpperCase().trim();

    let entry: CreationCode | null = null;
    try {
      entry = await this.codeRepo.findOne({ where: { code: normalized } });
    } catch {
      return { senderType: null, senderName: null, targetEmail: null, targetRole: 'correspondent', valid: false, expired: false };
    }

    if (!entry) {
      return { senderType: null, senderName: null, targetEmail: null, targetRole: 'correspondent', valid: false, expired: false };
    }

    const expired = entry.status === CodeStatus.EXPIRED || entry.expiresAt < new Date();
    const valid   = entry.status === CodeStatus.PENDING && !expired;

    let senderType: 'company' | 'delivery' | null = null;
    let senderName: string | null = null;

    /* ── Stratégie 1 : companyId sur le code ── */
    if (entry.companyId) {
      senderType = 'company';
      try {
        /*
         * Requête SQL directe — pas de relation TypeORM
         * → aucun risque d'erreur de nom de relation
         */
        const rows = await this.codeRepo.manager.query(
          `SELECT companyName FROM entreprises WHERE id = ? LIMIT 1`,
          [entry.companyId],
        );
        senderName = rows?.[0]?.companyName ?? null;
      } catch (e) {
        this.logger.warn(`[getCodeInfo] companyName non trouvé: ${e}`);
      }

    /* ── Stratégie 2 : generatedById → user.role ── */
    } else if (entry.generatedById) {
      try {
        const sender = await this.userRepo.findOne({ where: { id: entry.generatedById } });

        if (sender?.role === UserRole.COMPANY) {
          senderType = 'company';
          try {
            const rows = await this.codeRepo.manager.query(
              `SELECT companyName FROM entreprises WHERE userId = ? LIMIT 1`,
              [sender.id],
            );
            senderName = rows?.[0]?.companyName ?? null;
          } catch { /* senderName reste null */ }

        } else if (sender?.role === UserRole.DELIVERY) {
          senderType = 'delivery';
          try {
            const rows = await this.codeRepo.manager.query(
              `SELECT fullName FROM livreurs WHERE userId = ? LIMIT 1`,
              [sender.id],
            );
            senderName = rows?.[0]?.fullName ?? null;
          } catch { /* senderName reste null */ }
        }
      } catch (e) {
        this.logger.warn(`[getCodeInfo] sender lookup échoué: ${e}`);
      }
    }

    this.logger.log(`[getCodeInfo] code=${normalized} | senderType=${senderType} | senderName=${senderName} | valid=${valid}`);

    return { senderType, senderName, targetEmail: entry.targetEmail, targetRole: entry.targetRole, valid, expired };
  }

  /* ── 4. CONSOMMATION ── */
  async consumeCode(codeId: string, newUser: User, ip?: string): Promise<void> {
    const entry = await this.codeRepo.findOne({ where: { id: codeId } });
    if (!entry) { this.logger.error(`[CONSUME ❌] Code ID="${codeId}" introuvable`); return; }
    entry.usesCount += 1; entry.usedById = newUser.id;
    entry.usedAt = new Date(); entry.usedFromIp = ip ?? null;
    if (entry.usesCount >= entry.maxUses) entry.status = CodeStatus.USED;
    await this.codeRepo.save(entry);
  }

  /* ── 5. RÉVOCATION ── */
  async revokeCode(codeId: string, superAdmin: User): Promise<CodeResponse> {
    this.assertIsSuperAdmin(superAdmin);
    const entry = await this.codeRepo.findOne({ where: { id: codeId } });
    if (!entry) throw new NotFoundException(`Code introuvable (ID: ${codeId}).`);
    if (entry.status !== CodeStatus.PENDING) throw new BadRequestException(`Impossible de révoquer un code avec le statut "${entry.status}".`);
    entry.status = CodeStatus.REVOKED; entry.revokedAt = new Date();
    const saved = await this.codeRepo.save(entry);
    return this.toCodeResponse(saved, false);
  }

  /* ── 6. EXPIRATION AUTO ── */
  async expireOutdatedCodes(): Promise<number> {
    const result = await this.codeRepo.createQueryBuilder()
      .update(CreationCode).set({ status: CodeStatus.EXPIRED })
      .where('status = :status', { status: CodeStatus.PENDING })
      .andWhere('expiresAt < :now', { now: new Date() }).execute();
    return result.affected ?? 0;
  }

  /* ── 7. LISTE ── */
  async listCodes(superAdmin: User, dto: FilterCodesDto) {
    this.assertIsSuperAdmin(superAdmin);
    const page = dto.page ?? 1; const limit = dto.limit ?? 20;
    const qb = this.codeRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.generatedBy', 'generatedBy')
      .leftJoinAndSelect('c.usedBy', 'usedBy')
      .orderBy('c.createdAt', 'DESC').skip((page - 1) * limit).take(limit);
    if (dto.targetRole) qb.andWhere('c.targetRole = :role', { role: dto.targetRole });
    if (dto.status)     qb.andWhere('c.status = :status',   { status: dto.status });
    if (dto.search?.trim()) {
      const term = `%${dto.search.trim().toLowerCase()}%`;
      qb.andWhere(`(LOWER(c.code) LIKE :term OR LOWER(c.note) LIKE :term OR LOWER(c.targetEmail) LIKE :term OR LOWER(CONCAT(usedBy.firstName, ' ', usedBy.lastName)) LIKE :term)`, { term });
    }
    const [codes, total] = await qb.getManyAndCount();
    await this.syncExpiredInList(codes);
    return { data: codes.map(c => this.toCodeResponse(c, false)), total, page, pages: Math.ceil(total / limit) };
  }

  /* ── 8. STATS ── */
  async getCodeStats(superAdmin: User): Promise<CodeStatsPerRole[]> {
    this.assertIsSuperAdmin(superAdmin);
    const aggregated = await this.codeRepo.createQueryBuilder('c')
      .select('c.targetRole', 'role').addSelect('COUNT(*)', 'total')
      .addSelect(`SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END)`, 'valid')
      .addSelect(`SUM(CASE WHEN c.status = 'used'    THEN 1 ELSE 0 END)`, 'used')
      .addSelect(`SUM(CASE WHEN c.status = 'expired' THEN 1 ELSE 0 END)`, 'expired')
      .addSelect(`SUM(CASE WHEN c.status = 'revoked' THEN 1 ELSE 0 END)`, 'revoked')
      .addSelect('SUM(c.usesCount)', 'totalUses').addSelect('SUM(c.maxUses)', 'totalMaxUses')
      .groupBy('c.targetRole').getRawMany();
    const recentUsages = await this.codeRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.usedBy', 'usedBy').where('c.usedAt IS NOT NULL')
      .orderBy('c.usedAt', 'DESC').take(50).getMany();
    const recentByRole: Record<string, { name: string; date: string }[]> = {};
    for (const code of recentUsages) {
      const user = code.usedBy as User | undefined;
      if (!user) continue;
      if (!recentByRole[code.targetRole]) recentByRole[code.targetRole] = [];
      if (recentByRole[code.targetRole].length < 5) {
        recentByRole[code.targetRole].push({ name: `${user.firstName} ${user.lastName?.charAt(0) ?? ''}.`, date: code.usedAt?.toISOString().slice(0, 10) ?? '' });
      }
    }
    return aggregated.map(row => {
      const role = row.role as UserRole;
      const totalUses = parseInt(row.totalUses, 10) || 0;
      const totalMaxUses = parseInt(row.totalMaxUses, 10) || 0;
      return { role, roleLabel: ROLE_LABELS[role] ?? role, total: parseInt(row.total, 10) || 0, valid: parseInt(row.valid, 10) || 0, used: parseInt(row.used, 10) || 0, expired: parseInt(row.expired, 10) || 0, revoked: parseInt(row.revoked, 10) || 0, totalUses, totalMaxUses, available: Math.max(0, totalMaxUses - totalUses), recentUsers: recentByRole[role] ?? [] };
    });
  }

  /* ── Privés ── */
  private generateReadableCode(): string {
    const rand = (n: number) => Array.from({ length: n }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
    return `${rand(4)}-${rand(4)}-${rand(2)}`;
  }
  private computeExpiry(days: number): Date {
    const d = new Date(); d.setDate(d.getDate() + days); d.setHours(23, 59, 59, 0); return d;
  }
  private assertIsSuperAdmin(user: User): void {
    if (user.role !== UserRole.SUPER_ADMIN) throw new ForbiddenException('Accès refusé.');
    if (user.status !== UserStatus.ACTIVE)  throw new ForbiddenException('Compte inactif.');
  }
  private async syncExpiredInList(codes: CreationCode[]): Promise<void> {
    const now = new Date();
    const toExpire = codes.filter(c => c.status === CodeStatus.PENDING && c.expiresAt < now);
    if (toExpire.length === 0) return;
    for (const c of toExpire) c.status = CodeStatus.EXPIRED;
    await this.codeRepo.save(toExpire);
  }
  private toCodeResponse(entry: CreationCode, emailSent: boolean): CodeResponse {
    const statusMap: Record<CodeStatus, CodeResponse['status']> = { [CodeStatus.PENDING]: 'valid', [CodeStatus.USED]: 'used', [CodeStatus.EXPIRED]: 'expired', [CodeStatus.REVOKED]: 'revoked' };
    const usedBy = entry.usedBy as User | undefined;
    return {
      id: entry.id, code: entry.code, role: entry.targetRole, roleLabel: ROLE_LABELS[entry.targetRole] ?? entry.targetRole,
      status: statusMap[entry.status], targetEmail: entry.targetEmail,
      createdAt: entry.createdAt?.toISOString().slice(0, 10) ?? '',
      expiresAt: entry.expiresAt.toISOString().slice(0, 10), expiresAtRaw: entry.expiresAt,
      uses: entry.usesCount, maxUses: entry.maxUses, note: entry.note, emailSent,
      ...(usedBy && { usedBy: `${usedBy.firstName} ${usedBy.lastName?.charAt(0) ?? ''}.`, usedAt: entry.usedAt?.toISOString().slice(0, 10) }),
    };
  }
}