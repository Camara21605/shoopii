/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/services/notifs-livreur.service.ts
 * RÔLE : Section 8 — Notifications + Section 9 — Confidentialité
 * ============================================================ */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';
import { UpdateLivreurNotifsDto, UpdateLivreurPrivacyDto } from '../dto/livreur-parametres.dto';
import { NotificationActorType, NotificationType as T } from 'src/database/entities/notification/notification.entity';
import { NotificationPreferenceService } from 'src/modules/notifications/services/notification-preference.service';
import type { NotificationPreference } from 'src/database/entities/notification/notification-preference.entity';
import type { UpdatePreferencesDto } from 'src/modules/notifications/dto/update-preferences.dto';

/*
 * BUG CORRIGÉ — les 11 interrupteurs « Notifications » étaient enregistrés dans
 * un JSON (livreurs.notifSettings) que PERSONNE ne lisait : couper « Nouvelle
 * mission » ou « SMS » n'avait aucun effet. Ils pilotent maintenant les
 * préférences RÉELLES du moteur de notifications (acteur DELIVERY), par familles
 * de notifications réellement envoyées aux livreurs. Coupé = ni push ni e-mail
 * (l'historique reste dans la cloche). SMS retiré : canal non branché.
 */
export const NOTIF_ITEMS: Record<string, T[]> = {
  missions:  [T.ORDER_STATUS_CHANGED, T.ORDER_PLACED],
  paiements: [T.PAYMENT_RECEIVED, T.PAYMENT_SENT, T.PAYMENT_FAILED],
  messages:  [T.MESSAGE_RECEIVED, T.CALL_MISSED, T.GROUP_CALL_MISSED],
  avis:      [T.REVIEW_RECEIVED, T.REVIEW_REPLIED],
  abonnes:   [T.FOLLOW_NEW],
  annonces:  [T.SYSTEM_ANNOUNCEMENT],
};
type Ch = 'push' | 'email';
const CHANNELS: Ch[] = ['push', 'email'];
export interface LivreurNotifsView { global: { push: boolean; email: boolean }; items: Record<string, boolean> }

/* Valeurs par défaut historiques (conservées pour référence, non utilisées) */
const _DEFAULT_NOTIFS: Record<string, boolean> = {
  nouvelleMission: true, missionAnnulee: true, missionLivree: true,
  rappelMission: true, messageClient: true,
  gainRecu: true, virementEffectue: true, rapportHebdo: false,
  pushNotif: true, smsNotif: true, emailNotif: false,
};

/*
 * BUG CORRIGÉ — les 6 réglages de confidentialité étaient enregistrés sans
 * qu'AUCUN service ne les lise. Les 4 conservés sont appliqués partout où le
 * livreur est visible publiquement (liste « Livreurs », profil, carte,
 * recherche — voir LivreursClientService, ActorMapService, ActorSearchService).
 * « Améliorer l'algorithme » et « Statistiques anonymisées » retirés : aucun
 * traitement ne pouvait en tenir compte.
 */
export const LIVREUR_PRIVACY_KEYS = ['showInSearch', 'showRating', 'showDeliveryCount', 'shareLocation'] as const;
export type LivreurPrivacy = Record<(typeof LIVREUR_PRIVACY_KEYS)[number], boolean>;
/** Réglages effectifs (absent = activé), anciennes clés ignorées. */
export function lirePrivacy(stored: Record<string, boolean> | null | undefined): LivreurPrivacy {
  const out = {} as LivreurPrivacy;
  for (const k of LIVREUR_PRIVACY_KEYS) out[k] = stored?.[k] !== false;
  return out;
}

@Injectable()
export class NotifsLivreurService {

  private readonly logger = new Logger(NotifsLivreurService.name);

  constructor(
    @InjectRepository(Delivery)
    private readonly livreurRepo: Repository<Delivery>,
    private readonly prefs: NotificationPreferenceService,
  ) {}

  /* ── Notifications ── */
  async getNotifs(userId: string): Promise<LivreurNotifsView> {
    const l = await this.findOrFail(userId);
    return this.toView(await this.prefs.getOrCreate(NotificationActorType.DELIVERY, l.id));
  }

  private toView(pref: NotificationPreference): LivreurNotifsView {
    const items: Record<string, boolean> = {};
    for (const [key, types] of Object.entries(NOTIF_ITEMS)) {
      /* « actif » dès qu'un type de la famille alerte par push ou e-mail */
      items[key] = types.some(t => { const e = this.prefs.getEffectiveChannelPref(pref, t); return e.push || e.email; });
    }
    return { global: { push: pref.globalPushEnabled, email: pref.globalEmailEnabled }, items };
  }

  async updateNotifs(userId: string, dto: UpdateLivreurNotifsDto): Promise<LivreurNotifsView> {
    const l = await this.findOrFail(userId);
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
          /* ON = canaux par défaut de la plateforme (push au minimum) ; OFF = ni push ni e-mail */
          const def = this.prefs.getEffectiveChannelPref({ preferences: null } as any, t);
          perType[t] = {};
          for (const ch of CHANNELS) perType[t][ch] = want ? (def[ch] || ch === 'push') : false;
        }
      }
      if (Object.keys(perType).length) patch.preferences = perType;
    }
    /* PERF — la réponse est construite à partir de la ligne qui vient d'être
     * enregistrée (avant : getNotifs() relisait le livreur puis les
     * préférences, soit ~4 allers-retours base de plus par clic). */
    const pref = Object.keys(patch).length
      ? await this.prefs.update(NotificationActorType.DELIVERY, l.id, patch)
      : await this.prefs.getOrCreate(NotificationActorType.DELIVERY, l.id);
    this.logger.log(`[NOTIFS] Mis à jour — userId=${userId}`);
    return this.toView(pref);
  }

  async getPrivacy(userId: string): Promise<LivreurPrivacy> {
    const l = await this.findOrFail(userId);
    return lirePrivacy(l.privacySettings);
  }

  async updatePrivacy(userId: string, dto: UpdateLivreurPrivacyDto): Promise<LivreurPrivacy> {
    const l = await this.findOrFail(userId);
    const next = lirePrivacy(l.privacySettings);
    for (const k of LIVREUR_PRIVACY_KEYS) if (typeof dto[k] === 'boolean') next[k] = dto[k];
    /* update() ciblé : save(l) réécrivait tout le profil (disponibilité,
     * compteurs…) avec les valeurs lues au début de la requête. */
    await this.livreurRepo.update(l.id, { privacySettings: next });
    this.logger.log(`[PRIVACY] Mis à jour — userId=${userId}`);
    return next;
  }

  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }
}