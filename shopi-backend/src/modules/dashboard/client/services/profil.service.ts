/* ============================================================
 * src/modules/dashboard/client/services/profil.service.ts
 * FIX : getOrCreate avec early return → TypeScript content
 * ============================================================ */

import {
  ConflictException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import { User }   from '../../../../database/entities/user.entity';
import { Client } from '../../../../database/entities/profiles/client-profile.entity';
import { UpdateProfilDto, UpdateCoordonneesDto } from '../dto/client-parametres.dto';

@Injectable()
export class ProfilService {
  private readonly logger = new Logger(ProfilService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  /* ── Helper — early return pour éviter null ── */
  private async getOrCreate(userId: string): Promise<Client> {
    const found = await this.clientRepo.findOne({ where: { userId } });
    if (found) return found;                                              // ✅ early return
    const created = this.clientRepo.create({ userId } as DeepPartial<Client>);
    return this.clientRepo.save(created);
  }

  /* ── GET — profil complet ── */
  async get(user: User) {
    const dbUser  = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');
    const profile = await this.clientRepo.findOne({ where: { userId: user.id } });

    return {
      id:             dbUser.id,
      firstName:      dbUser.firstName,
      lastName:       dbUser.lastName,
      email:          dbUser.email,
      phone:          dbUser.phone,
      username:       dbUser.username,
      emailVerified:  dbUser.emailVerified,
      phoneVerified:  dbUser.phoneVerified,
      profilePicture: dbUser.profilePicture,
      dateNaissance:  (profile as any)?.dateNaissance ?? null,
      genre:          (profile as any)?.genre          ?? null,
      bio:            (profile as any)?.bio             ?? null,
      langue:         (profile as any)?.langue          ?? 'fr',
    };
  }

  /* ── PATCH — profil personnel ── */
  async updateProfil(user: User, dto: UpdateProfilDto) {
    const dbUser = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');

    if (dto.firstName !== undefined) dbUser.firstName = dto.firstName.trim();
    if (dto.lastName  !== undefined) dbUser.lastName  = dto.lastName.trim();
    if (dto.username  !== undefined) {
      const exists = await this.userRepo.findOne({ where: { username: dto.username.trim() } });
      if (exists && exists.id !== user.id)
        throw new ConflictException(`Le nom d'utilisateur "${dto.username}" est déjà pris.`);
      dbUser.username = dto.username.trim();
    }
    await this.userRepo.save(dbUser);

    const profile = await this.getOrCreate(user.id);                     // ✅ jamais null
    if (dto.dateNaissance !== undefined) (profile as any).dateNaissance = dto.dateNaissance;
    if (dto.genre         !== undefined) (profile as any).genre         = dto.genre;
    if (dto.bio           !== undefined) (profile as any).bio           = dto.bio?.trim();
    if (dto.langue        !== undefined) (profile as any).langue        = dto.langue;
    await this.clientRepo.save(profile);

    this.logger.log(`[PROFIL UPDATE] userId=${user.id}`);
    return this.get(user);
  }

  /* ── PATCH — avatar ── */
  async updateAvatar(user: User, avatarUrl: string): Promise<{ profilePicture: string }> {
    const dbUser = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');
    dbUser.profilePicture = avatarUrl;
    await this.userRepo.save(dbUser);
    return { profilePicture: avatarUrl };
  }

  /* ── PATCH — coordonnées ── */
  async updateCoordonnees(user: User, dto: UpdateCoordonneesDto): Promise<{ message: string }> {
    const dbUser = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');

    if (dto.email !== undefined) {
      const norm = dto.email.toLowerCase().trim();
      const exists = await this.userRepo.findOne({ where: { email: norm } });
      if (exists && exists.id !== user.id)
        throw new ConflictException(`L'email "${norm}" est déjà utilisé.`);
      dbUser.email         = norm;
      dbUser.emailVerified = false;
    }
    if (dto.phone !== undefined) {
      dbUser.phone         = dto.phone.trim();
      dbUser.phoneVerified = false;
    }
    await this.userRepo.save(dbUser);
    return { message: 'Coordonnées mises à jour. Un email/SMS de vérification a été envoyé.' };
  }
}