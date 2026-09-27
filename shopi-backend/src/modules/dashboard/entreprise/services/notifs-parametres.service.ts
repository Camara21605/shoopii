/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/services/notifs-parametres.service.ts
 *
 * RÔLE : Notifications de l'entreprise (Paramètres, section 10)
 *   GET   /parametres/notifications → réglages réels
 *   PATCH /parametres/notifications → mise à jour
 *
 * BUG CORRIGÉ — les 14 interrupteurs étaient enregistrés dans une colonne
 * JSON (company.notifSettings) que le système de notifications ne lisait
 * JAMAIS : couper « Nouvelle commande » n'arrêtait aucune alerte. Et 5 d'entre
 * eux (demande de catalogue, avis négatif, rapports hebdo / mensuel,
 * invitations promo) ne correspondaient à AUCUNE notification existante.
 *
 * Ils pilotent désormais les VRAIES préférences (NotificationPreferenceService,
 * acteur COMPANY — celles que lit NotificationService avant chaque envoi) :
 *   - interrupteurs globaux push / e-mail ;
 *   - un interrupteur par famille de notifications RÉELLEMENT envoyées aux
 *     entreprises (voir NOTIF_ITEMS) — coupé = ni push ni e-mail ; l'historique
 *     reste dans la cloche du tableau de bord (in-app).
 * Même mécanisme que les paramètres client (dashboard/client/services/
 * preferences.service.ts).
 * ============================================================ */

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { NotificationActorType, NotificationType as T } from 'src/database/entities/notification/notification.entitiy';
import { NotificationPreferenceService } from 'src/modules/notifications/services/notification-preference.service';
import type { UpdatePreferencesDto } from 'src/modules/notifications/dto/update-preferences.dto';
import { UpdateNotifsDto } from '../dto/update-notifs.dto';

/** Chaque interrupteur ↔ les types de notification réellement envoyés à l'entreprise. */
export const NOTIF_ITEMS: Record<string, T[]> = {
  newOrder:         [T.ORDER_PLACED],
  orderCancelled:   [T.ORDER_CANCELLED, T.ORDER_REFUNDED],
  orderDelivered:   [T.DELIVERY_COMPLETED, T.DELIVERY_FAILED, T.DELIVERY_RETURNED],
  returns:          [T.RETURN_REQUESTED, T.RETURN_STATUS_CHANGED],
  paymentReceived:  [T.PAYMENT_RECEIVED],
  outOfStock:       [T.PRODUCT_OUT_OF_STOCK, T.STOCK_CRITICAL],
  nearThreshold:    [T.STOCK_LOW],
  productPublished: [T.PRODUCT_APPROVED],
  promos:           [T.PROMO_ENDING_SOON, T.PROMO_ENDED, T.PROMO_LIMIT_REACHED, T.PROMO_USED],
  newReview:        [T.REVIEW_RECEIVED],
  newFollower:      [T.FOLLOW_NEW],
  likes:            [T.PRODUCT_LIKED, T.PRODUCT_LIKED_AGG, T.SERVICE_LIKED],
  messages:         [T.MESSAGE_RECEIVED, T.CALL_MISSED, T.GROUP_CALL_MISSED],
  shopNews:         [T.SYSTEM_ANNOUNCEMENT],
};

type Ch = 'push' | 'email';
const CHANNELS: Ch[] = ['push', 'email'];

export interface CompanyNotifsView {
  global: { push: boolean; email: boolean };
  items:  Record<string, boolean>;
}

@Injectable()
export class NotifsParametresService {

  private readonly logger = new Logger(NotifsParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly prefs: NotificationPreferenceService,
  ) {}

  async getNotifs(userId: string): Promise<CompanyNotifsView> {
    const company = await this.findCompanyOrFail(userId);
    const pref = await this.prefs.getOrCreate(NotificationActorType.COMPANY, company.id);
    const items: Record<string, boolean> = {};
    for (const [key, types] of Object.entries(NOTIF_ITEMS)) {
      /* « actif » dès qu'un type de la famille alerte par push ou e-mail */
      items[key] = types.some(t => {
        const eff = this.prefs.getEffectiveChannelPref(pref, t);
        return eff.push || eff.email;
      });
    }
    return { global: { push: pref.globalPushEnabled, email: pref.globalEmailEnabled }, items };
  }

  async updateNotifs(userId: string, dto: UpdateNotifsDto): Promise<CompanyNotifsView> {
    const company = await this.findCompanyOrFail(userId);
    const patch: UpdatePreferencesDto = {};

    if (dto.global) {
      if (typeof dto.global.push  === 'boolean') patch.globalPushEnabled  = dto.global.push;
      if (typeof dto.global.email === 'boolean') patch.globalEmailEnabled = dto.global.email;
    }

    if (dto.items) {
      const perType: Record<string, Partial<Record<Ch, boolean>>> = {};
      for (const [key, want] of Object.entries(dto.items)) {
        const types = NOTIF_ITEMS[key];
        if (!types) throw new BadRequestException(`Notification inconnue : ${key}.`);
        if (typeof want !== 'boolean') throw new BadRequestException(`Valeur invalide pour ${key}.`);
        for (const t of types) {
          /* ON = retour aux canaux par défaut de la plateforme pour ce type (push
           * au minimum) ; OFF = ni push ni e-mail (la cloche garde l'historique). */
          const def = this.prefs.getEffectiveChannelPref({ preferences: null } as any, t);
          perType[t] = {};
          for (const ch of CHANNELS) perType[t][ch] = want ? (def[ch] || ch === 'push') : false;
        }
      }
      if (Object.keys(perType).length) patch.preferences = perType as any;
    }

    if (Object.keys(patch).length) {
      await this.prefs.update(NotificationActorType.COMPANY, company.id, patch);
    }
    this.logger.log(`[NOTIFS] Mis à jour — companyId=${company.id}`);
    return this.getNotifs(userId);
  }

  private async findCompanyOrFail(userId: string): Promise<Company> {
    let company = await this.companyRepo.findOne({ where: { id: userId } });
    if (!company) company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}
