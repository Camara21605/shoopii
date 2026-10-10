/* ============================================================
 * FICHIER : services/notifications.service.ts
 * SECTION : §9 — Notifications
 *
 * Responsabilités :
 *   updateNotifications() → notifSettings (JSON structuré)
 *
 * Structure JSON attendue :
 * {
 *   colis:    { nouveauColis, colisEnAttente48h, transfertLivreur, colisRecupere, saturation80 },
 *   finances: { commissionEncaissee, virementEffectue, bilanHebdo, seuilWallet },
 *   canaux:   { push, sms, whatsapp, email }
 * }
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { User }          from '../../../../database/entities/user.entity';
import { UpdateNotificationsDto } from '../dto/correspondant-parametres.dto';
import { CorrespondantBaseService } from './base.service';
import { NotificationActorType, NotificationType as T } from '../../../../database/entities/notification/notification.entity';
import { NotificationPreferenceService } from '../../../notifications/services/notification-preference.service';
import type { UpdatePreferencesDto } from '../../../notifications/dto/update-preferences.dto';

/*
 * BUG CORRIGÉ — les interrupteurs « Notifications » étaient enregistrés dans un JSON
 * (correspondants.notifSettings) que PERSONNE ne lisait : couper « Nouveau colis déposé » ou
 * « Push » n'avait aucun effet. Ils pilotent désormais les préférences RÉELLES du moteur de
 * notifications (acteur CORRESPONDENT), comme pour les livreurs. Le JSON reste enregistré pour
 * réafficher l'écran tel quel.
 *
 * Correspondance avec les notifications réellement envoyées aux correspondants :
 *  - « Nouveau colis déposé »                          → ORDER_PLACED (commande qui passe par le relais)
 *  - « Transfert livreur », « Colis récupéré »,
 *    « Commission encaissée »                          → ORDER_STATUS_CHANGED (même type côté moteur :
 *                                                         actif si l'un d'eux est actif)
 *  - Canaux « Push » / « Email »                       → activation globale de chaque canal
 * Les autres interrupteurs (attente > 48 h, saturation, virement, bilan, seuil, SMS, WhatsApp)
 * n'ont pas de notification correspondante : l'écran les signale « bientôt disponible ».
 */
export const NOTIF_TYPES_CORRESPONDANT: Record<string, { groupe: string; cles: string[] }> = {
  [T.ORDER_PLACED]:         { groupe: 'colis', cles: ['nouveauColis'] },
  [T.ORDER_STATUS_CHANGED]: { groupe: '*',     cles: ['colis.transfertLivreur', 'colis.colisRecupere', 'finances.commissionEncaissee'] },
};

@Injectable()
export class NotificationsService extends CorrespondantBaseService {

  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Correspondent) corRepo:  Repository<Correspondent>,
    @InjectRepository(User)          userRepo: Repository<User>,
    private readonly prefs: NotificationPreferenceService,
  ) {
    super(corRepo, userRepo);
  }

  /** Préférences réelles à écrire d'après l'écran (absent = inchangé). */
  static versPreferences(ns: Record<string, Record<string, boolean>> | null | undefined): UpdatePreferencesDto {
    const patch: UpdatePreferencesDto = {};
    if (!ns) return patch;
    const lire = (chemin: string): boolean | undefined => {
      const [g, k] = chemin.split('.');
      const v = ns[g]?.[k];
      return typeof v === 'boolean' ? v : undefined;
    };
    if (lire('canaux.push')  !== undefined) patch.globalPushEnabled  = lire('canaux.push');
    if (lire('canaux.email') !== undefined) patch.globalEmailEnabled = lire('canaux.email');

    const perType: Record<string, { push: boolean; email?: boolean }> = {};
    for (const [type, { groupe, cles }] of Object.entries(NOTIF_TYPES_CORRESPONDANT)) {
      const valeurs = cles.map(c => lire(groupe === '*' ? c : `${groupe}.${c}`)).filter((v): v is boolean => v !== undefined);
      if (!valeurs.length) continue;
      const actif = valeurs.some(Boolean);
      /* Actif = push (l'e-mail garde le réglage par défaut de la plateforme) ; coupé = ni push ni e-mail */
      perType[type] = actif ? { push: true } : { push: false, email: false };
    }
    if (Object.keys(perType).length) patch.preferences = perType;
    return patch;
  }

  /**
   * Met à jour toutes les préférences de notifications.
   * Le JSON complet est remplacé à chaque appel.
   */
  async updateNotifications(userId: string, dto: UpdateNotificationsDto): Promise<Correspondent> {
    const cor = await this.findCorOrFail(userId);

    if (dto.notifSettings !== undefined) cor.notifSettings = dto.notifSettings ?? null;

    const updated = await this.enregistrer(cor, ['notifSettings']);
    const patch = NotificationsService.versPreferences(dto.notifSettings);
    if (Object.keys(patch).length) await this.prefs.update(NotificationActorType.CORRESPONDENT, cor.id, patch);
    this.logger.log(`[NOTIFS] Préférences mises à jour — userId=${userId}`);
    return updated;
  }
}