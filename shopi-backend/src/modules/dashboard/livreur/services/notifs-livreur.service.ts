/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/services/notifs-livreur.service.ts
 * RÔLE : Section 8 — Notifications + Section 9 — Confidentialité
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';
import { UpdateLivreurNotifsDto, UpdateLivreurPrivacyDto } from '../dto/livreur-parametres.dto';

const DEFAULT_NOTIFS: Record<string, boolean> = {
  nouvelleMission: true, missionAnnulee: true, missionLivree: true,
  rappelMission: true, messageClient: true,
  gainRecu: true, virementEffectue: true, rapportHebdo: false,
  pushNotif: true, smsNotif: true, emailNotif: false,
};

const DEFAULT_PRIVACY: Record<string, boolean> = {
  showInSearch: true, showRating: true, showDeliveryCount: true,
  shareLocation: true, improveAlgo: true, anonymizedStats: true,
};

@Injectable()
export class NotifsLivreurService {

  private readonly logger = new Logger(NotifsLivreurService.name);

  constructor(
    @InjectRepository(Delivery)
    private readonly livreurRepo: Repository<Delivery>,
  ) {}

  /* ── Notifications ── */
  async getNotifs(userId: string) {
    const l = await this.findOrFail(userId);
    return l.notifSettings ?? DEFAULT_NOTIFS;
  }

  async updateNotifs(userId: string, dto: UpdateLivreurNotifsDto) {
    const l = await this.findOrFail(userId);
    const current = l.notifSettings ?? DEFAULT_NOTIFS;
    const incoming = Object.fromEntries(Object.entries(dto).filter(([,v]) => v !== undefined)) as Record<string, boolean>;
    l.notifSettings = { ...current, ...incoming };
    await this.livreurRepo.save(l);
    this.logger.log(`[NOTIFS] Mis à jour — userId=${userId}`);
    return l.notifSettings;
  }

  /* ── Confidentialité ── */
  async getPrivacy(userId: string) {
    const l = await this.findOrFail(userId);
    return l.privacySettings ?? DEFAULT_PRIVACY;
  }

  async updatePrivacy(userId: string, dto: UpdateLivreurPrivacyDto) {
    const l = await this.findOrFail(userId);
    const current = l.privacySettings ?? DEFAULT_PRIVACY;
    const incoming = Object.fromEntries(Object.entries(dto).filter(([,v]) => v !== undefined)) as Record<string, boolean>;
    l.privacySettings = { ...current, ...incoming };
    await this.livreurRepo.save(l);
    this.logger.log(`[PRIVACY] Mis à jour — userId=${userId}`);
    return l.privacySettings;
  }

  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }
}