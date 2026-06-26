/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/services/notifs-parametres.service.ts
 *
 * RÔLE : Gère les préférences de notifications (section 10)
 *   GET   /parametres/notifications → lire les 14 toggles
 *   PATCH /parametres/notifications → mettre à jour les toggles
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { UpdateNotifsDto } from '../dto/update-notifs.dto';

/* ── Valeurs par défaut (utilisées à la 1ère lecture si notifSettings est null) */
const DEFAULT_NOTIFS: Record<string, boolean> = {
  newOrder:          true,
  orderCancelled:    true,
  orderDelivered:    true,
  paymentReceived:   true,
  outOfStock:        true,
  nearThreshold:     true,
  productPublished:  false,
  catalogRequest:    true,
  newReview:         true,
  negativeReview:    true,
  weeklyReport:      false,
  promoInvitations:  true,
  monthlyReport:     true,
  shopNews:          false,
};

@Injectable()
export class NotifsParametresService {

  private readonly logger = new Logger(NotifsParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Lire les préférences de notifications
   * ────────────────────────────────────────────────────────── */

  async getNotifs(userId: string): Promise<Record<string, boolean>> {
    const company = await this.findCompanyOrFail(userId);

    // Si jamais configuré → retourner les valeurs par défaut
    return company.notifSettings ?? DEFAULT_NOTIFS;
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Mettre à jour les préférences (section 10)
   * Merge partiel : seuls les champs envoyés sont modifiés
   * ────────────────────────────────────────────────────────── */

  async updateNotifs(userId: string, dto: UpdateNotifsDto): Promise<Record<string, boolean>> {
    const company = await this.findCompanyOrFail(userId);

    // Merge : conserver les valeurs actuelles, écraser les nouvelles
    const current  = company.notifSettings ?? DEFAULT_NOTIFS;
    const dtoPlain = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    ) as Record<string, boolean>;

    company.notifSettings = { ...current, ...dtoPlain };

    await this.companyRepo.save(company);
    this.logger.log(`[NOTIFS] Mis à jour — userId=${userId}`);

    return company.notifSettings;
  }

  /* ── HELPER ── */
  private async findCompanyOrFail(userId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}
