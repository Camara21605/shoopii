/* ============================================================
 * src/modules/dashboard/client/services/paiement.service.ts
 * FIX : early return dans getOrCreate
 * ============================================================ */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository }                      from '@nestjs/typeorm';
import { DeepPartial, Repository }               from 'typeorm';
import { v4 as uuid }                            from 'uuid';

import { Client } from '../../../../database/entities/profiles/client-profile.entity';
import { User }   from '../../../../database/entities/user.entity';
import { AddPaiementDto } from '../dto/client-parametres.dto';

export interface PaymentItem {
  id: string; type: string;
  numero: string; isDefault: boolean; addedAt: string;
}

@Injectable()
export class PaiementService {
  private readonly logger = new Logger(PaiementService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  /* ✅ FIX — early return, jamais null */
  private async getOrCreate(userId: string): Promise<Client> {
    const found = await this.clientRepo.findOne({ where: { userId } });
    if (found) return found;
    const created = this.clientRepo.create({ userId, paymentMethods: '[]' } as DeepPartial<Client>);
    return this.clientRepo.save(created);
  }

  private parse(p: Client): PaymentItem[] {
    try { return JSON.parse((p as any).paymentMethods ?? '[]'); }
    catch { return []; }
  }

  private masquer(n: string): string {
    return n.length <= 6 ? n : n.slice(0, 8) + '** ** **';
  }

  async getAll(user: User): Promise<PaymentItem[]> {
    return this.parse(await this.getOrCreate(user.id));
  }

  async add(user: User, dto: AddPaiementDto): Promise<PaymentItem[]> {
    const profile = await this.getOrCreate(user.id);
    let methods   = this.parse(profile);
    const item: PaymentItem = {
      id:        uuid(),
      type:      dto.type,
      numero:    this.masquer(dto.numero),
      isDefault: dto.isDefault ?? methods.length === 0,
      addedAt:   new Date().toISOString().slice(0, 10),
    };
    if (item.isDefault) methods = methods.map(m => ({ ...m, isDefault: false }));
    methods.push(item);
    (profile as any).paymentMethods = JSON.stringify(methods);
    await this.clientRepo.save(profile);
    return methods;
  }

  async remove(user: User, id: string): Promise<PaymentItem[]> {
    const profile = await this.getOrCreate(user.id);
    let methods   = this.parse(profile);
    const before  = methods.length;
    methods = methods.filter(m => m.id !== id);
    if (methods.length === before) throw new NotFoundException(`Moyen de paiement introuvable (id: ${id}).`);
    (profile as any).paymentMethods = JSON.stringify(methods);
    await this.clientRepo.save(profile);
    return methods;
  }

  async setDefault(user: User, id: string): Promise<PaymentItem[]> {
    const profile = await this.getOrCreate(user.id);
    let methods   = this.parse(profile);
    const idx     = methods.findIndex(m => m.id === id);
    if (idx === -1) throw new NotFoundException(`Moyen de paiement introuvable (id: ${id}).`);
    methods = methods.map((m, i) => ({ ...m, isDefault: i === idx }));
    (profile as any).paymentMethods = JSON.stringify(methods);
    await this.clientRepo.save(profile);
    return methods;
  }
}