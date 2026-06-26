/* ============================================================
 * src/modules/dashboard/client/services/securite.service.ts
 * FIX : early return dans chaque getOrCreate
 * ============================================================ */

import {
  BadRequestException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectRepository }        from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User }   from '../../../../database/entities/user.entity';
import { Client } from '../../../../database/entities/profiles/client-profile.entity';
import {
  ChangePasswordDto, UpdateSecuriteDto, UpdateQuestionsDto,
} from '../dto/client-parametres.dto';

@Injectable()
export class SecuriteService {
  private readonly logger = new Logger(SecuriteService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  /* ✅ FIX — early return, jamais null */
  private async getOrCreate(userId: string): Promise<Client> {
    const found = await this.clientRepo.findOne({ where: { userId } });
    if (found) return found;
    const created = this.clientRepo.create({ userId } as DeepPartial<Client>);
    return this.clientRepo.save(created);
  }

  /* ── GET — statut sécurité ── */
  async getStatut(user: User) {
    const dbUser  = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');
    const profile = await this.clientRepo.findOne({ where: { userId: user.id } });

    const questions = (() => {
      try { return JSON.parse((profile as any)?.questionsSecurite ?? '[]'); }
      catch { return []; }
    })();

    return {
      emailVerified:        dbUser.emailVerified,
      phoneVerified:        dbUser.phoneVerified,
      twoFaEnabled:         (profile as any)?.twoFaEnabled   ?? false,
      twoFaMethod:          (profile as any)?.twoFaMethod    ?? null,
      questionsConfigurees: questions.filter((q: any) => q.reponse).length,
      codesSecours:         (profile as any)?.codesSecours   ?? 0,
      dernierChangementMdp: dbUser.lastPasswordChangedAt,
    };
  }

  /* ── PATCH — mot de passe ── */
  async changePassword(user: User, dto: ChangePasswordDto): Promise<{ message: string }> {
    const dbUser = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');

    const valid = await bcrypt.compare(dto.currentPassword, dbUser.password);
    if (!valid) throw new BadRequestException('Mot de passe actuel incorrect.');
    if (dto.newPassword.length < 8)
      throw new BadRequestException('Minimum 8 caractères requis.');
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(dto.newPassword))
      throw new BadRequestException('Doit contenir une majuscule, une minuscule et un chiffre.');

    dbUser.password              = await bcrypt.hash(dto.newPassword, 12);
    dbUser.lastPasswordChangedAt = new Date();
    await this.userRepo.save(dbUser);
    this.logger.log(`[PASSWORD CHANGE] userId=${user.id}`);
    return { message: 'Mot de passe modifié avec succès.' };
  }

  /* ── PATCH — 2FA ── */
  async update2fa(user: User, dto: UpdateSecuriteDto): Promise<{ twoFaEnabled: boolean }> {
    const profile = await this.getOrCreate(user.id);                     // ✅ jamais null
    if (dto.twoFaEnabled !== undefined) (profile as any).twoFaEnabled = dto.twoFaEnabled;
    if (dto.twoFaMethod  !== undefined) (profile as any).twoFaMethod  = dto.twoFaMethod;
    await this.clientRepo.save(profile);
    return { twoFaEnabled: (profile as any).twoFaEnabled ?? false };
  }

  /* ── PATCH — questions de sécurité ── */
  async updateQuestions(user: User, dto: UpdateQuestionsDto): Promise<{ message: string }> {
    const profile = await this.getOrCreate(user.id);                     // ✅ jamais null
    (profile as any).questionsSecurite = JSON.stringify(dto.questions);
    await this.clientRepo.save(profile);
    return { message: 'Questions de sécurité enregistrées.' };
  }

  /* ── POST — codes de secours ── */
  async genererCodesSecours(user: User): Promise<{ codes: string[] }> {
    const profile = await this.getOrCreate(user.id);                     // ✅ jamais null
    const codes   = Array.from({ length: 8 }, () =>
      Math.random().toString(36).substring(2, 8).toUpperCase(),
    );
    const hashed  = await Promise.all(codes.map(c => bcrypt.hash(c, 10)));
    (profile as any).codesSecoursHashed = JSON.stringify(hashed);
    (profile as any).codesSecours       = codes.length;
    await this.clientRepo.save(profile);
    this.logger.log(`[CODES SECOURS] userId=${user.id}`);
    return { codes };
  }
}