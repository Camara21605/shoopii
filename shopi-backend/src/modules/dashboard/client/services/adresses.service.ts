/* ============================================================
 * src/modules/dashboard/client/services/adresses.service.ts
 * FIX : early return dans getOrCreate
 * ============================================================ */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository }                      from '@nestjs/typeorm';
import { DeepPartial, Repository }               from 'typeorm';
import { v4 as uuid }                            from 'uuid';

import { Client } from '../../../../database/entities/profiles/client-profile.entity';
import { User }   from '../../../../database/entities/user.entity';
import { CreateAdresseDto, UpdateAdresseDto } from '../dto/client-parametres.dto';

export interface AdresseItem {
  id: string; nom: string; fullName: string;
  adresse: string; commune?: string; ville: string;
  phone?: string; isDefault: boolean;
}

@Injectable()
export class AdressesService {
  private readonly logger = new Logger(AdressesService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  /* ✅ FIX — early return, jamais null */
  private async getOrCreate(userId: string): Promise<Client> {
    const found = await this.clientRepo.findOne({ where: { userId } });
    if (found) return found;
    const created = this.clientRepo.create({ userId, adresses: '[]' } as DeepPartial<Client>);
    return this.clientRepo.save(created);
  }

  private parse(profile: Client): AdresseItem[] {
    try { return JSON.parse((profile as any).adresses ?? '[]'); }
    catch { return []; }
  }

  async getAll(user: User): Promise<AdresseItem[]> {
    return this.parse(await this.getOrCreate(user.id));
  }

  async create(user: User, dto: CreateAdresseDto): Promise<AdresseItem[]> {
    const profile = await this.getOrCreate(user.id);
    let adresses  = this.parse(profile);
    if (dto.isDefault) adresses = adresses.map(a => ({ ...a, isDefault: false }));
    adresses.push({ id: uuid(), ...dto });
    (profile as any).adresses = JSON.stringify(adresses);
    await this.clientRepo.save(profile);
    return adresses;
  }

  async update(user: User, id: string, dto: UpdateAdresseDto): Promise<AdresseItem[]> {
    const profile = await this.getOrCreate(user.id);
    let adresses  = this.parse(profile);
    const idx     = adresses.findIndex(a => a.id === id);
    if (idx === -1) throw new NotFoundException(`Adresse introuvable (id: ${id}).`);
    if (dto.isDefault) adresses = adresses.map(a => ({ ...a, isDefault: false }));
    adresses[idx] = { ...adresses[idx], ...dto };
    (profile as any).adresses = JSON.stringify(adresses);
    await this.clientRepo.save(profile);
    return adresses;
  }

  async remove(user: User, id: string): Promise<AdresseItem[]> {
    const profile = await this.getOrCreate(user.id);
    let adresses  = this.parse(profile);
    const before  = adresses.length;
    adresses = adresses.filter(a => a.id !== id);
    if (adresses.length === before) throw new NotFoundException(`Adresse introuvable (id: ${id}).`);
    (profile as any).adresses = JSON.stringify(adresses);
    await this.clientRepo.save(profile);
    return adresses;
  }

  async setDefault(user: User, id: string): Promise<AdresseItem[]> {
    const profile = await this.getOrCreate(user.id);
    let adresses  = this.parse(profile);
    const idx     = adresses.findIndex(a => a.id === id);
    if (idx === -1) throw new NotFoundException(`Adresse introuvable (id: ${id}).`);
    adresses = adresses.map((a, i) => ({ ...a, isDefault: i === idx }));
    (profile as any).adresses = JSON.stringify(adresses);
    await this.clientRepo.save(profile);
    return adresses;
  }
}