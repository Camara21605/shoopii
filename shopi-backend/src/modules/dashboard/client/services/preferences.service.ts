/* ============================================================
 * src/modules/dashboard/client/services/preferences.service.ts
 * FIX : helper getOrCreate avec early return
 * ============================================================ */

import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository }                      from '@nestjs/typeorm';
import { DeepPartial, Repository }               from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User }   from '../../../../database/entities/user.entity';
import { Client } from '../../../../database/entities/profiles/client-profile.entity';
import { AuditLog } from '../../../../database/entities/audit-log.entity';
import { NotificationPreferenceService } from '../../../notifications/services/notification-preference.service';
import { NotificationActorType, NotificationType } from '../../../../database/entities/notification/notification.entitiy';
import type { UpdatePreferencesDto } from '../../../notifications/dto/update-preferences.dto';
import {
  UpdateNotifsDto, UpdatePrivacyDto,
  UpdateApparenceDto, UpdateLangueDto,
} from '../dto/client-parametres.dto';

/* ✅ FIX — helper partagé avec early return → jamais null */
async function getOrCreate(
  clientRepo: Repository<Client>,
  userId: string,
): Promise<Client> {
  const found = await clientRepo.findOne({ where: { userId } });
  if (found) return found;                                                // ← early return
  const created = clientRepo.create({ userId } as DeepPartial<Client>);
  return clientRepo.save(created);
}

/* ════════════════════════════════════════════════════════════
 * 9. NOTIFICATIONS
 *
 * BUG CORRIGÉ — ce panneau enregistrait ses interrupteurs dans une colonne
 * JSON (client.notifSettings) que le système de notifications ne lisait
 * JAMAIS : décocher « E-mail » n'arrêtait aucun e-mail. Il pilote désormais
 * les VRAIES préférences (NotificationPreferenceService) : interrupteurs
 * globaux push / e-mail, catégories (commandes & livraisons, promotions,
 * messages, activité sociale) par canal, et mode « Ne pas déranger ».
 * Le SMS n'est pas proposé : le canal SMS n'est pas encore branché sur un
 * fournisseur (voir SmsChannelStrategy).
 * ════════════════════════════════════════════════════════════ */
type Ch = 'push' | 'email';

/** Types de notification regroupés par catégorie affichée au client. */
const NOTIF_GROUPS: Record<string, NotificationType[]> = {
  commandes: [
    NotificationType.ORDER_PLACED, NotificationType.ORDER_CONFIRMED, NotificationType.ORDER_CANCELLED,
    NotificationType.ORDER_REFUNDED, NotificationType.ORDER_STATUS_CHANGED,
    NotificationType.DELIVERY_ASSIGNED, NotificationType.DELIVERY_PICKED_UP, NotificationType.DELIVERY_EN_ROUTE,
    NotificationType.DELIVERY_ARRIVED, NotificationType.DELIVERY_COMPLETED, NotificationType.DELIVERY_FAILED,
    NotificationType.DELIVERY_RETURNED, NotificationType.RETURN_REQUESTED, NotificationType.RETURN_STATUS_CHANGED,
    NotificationType.PAYMENT_RECEIVED, NotificationType.PAYMENT_SENT, NotificationType.PAYMENT_FAILED,
    NotificationType.PAYMENT_REFUND_DONE,
  ],
  promos: [
    NotificationType.PROMO_ACTIVE, NotificationType.PROMO_ENDING_SOON, NotificationType.PROMO_ENDED,
    NotificationType.PROMO_USED, NotificationType.PROMO_LIMIT_REACHED,
    NotificationType.PRODUCT_PRICE_DROP, NotificationType.PRODUCT_BACK_IN_STOCK, NotificationType.CRM_MESSAGE,
  ],
  messages: [
    NotificationType.MESSAGE_RECEIVED, NotificationType.MESSAGE_UNREAD, NotificationType.CONVERSATION_OPENED,
    NotificationType.CALL_MISSED, NotificationType.GROUP_CALL_MISSED,
  ],
  social: [
    NotificationType.FOLLOW_NEW, NotificationType.FOLLOW_ACCEPTED, NotificationType.FOLLOW_MUTUAL,
    NotificationType.REVIEW_REPLIED, NotificationType.STORY_PUBLISHED, NotificationType.STORY_EXPIRING_SOON,
  ],
};
const CHANNELS: Ch[] = ['push', 'email'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface NotifsView {
  global: { push: boolean; email: boolean };
  dnd:    { enabled: boolean; start: string; end: string; timezone: string };
  groups: Record<string, { push: boolean; email: boolean }>;
}

@Injectable()
export class NotifsService {
  private readonly logger = new Logger(NotifsService.name);

  constructor(private readonly prefs: NotificationPreferenceService) {}

  private actor(user: User) {
    return { type: NotificationActorType.CLIENT, id: ((user as any).actorId ?? user.id) as string };
  }

  async get(user: User): Promise<NotifsView> {
    const a    = this.actor(user);
    const pref = await this.prefs.getOrCreate(a.type, a.id);

    const groups: NotifsView['groups'] = {};
    for (const [key, types] of Object.entries(NOTIF_GROUPS)) {
      groups[key] = { push: false, email: false };
      for (const t of types) {
        const eff = this.prefs.getEffectiveChannelPref(pref, t);
        for (const ch of CHANNELS) if (eff[ch]) groups[key][ch] = true;   // « actif » dès qu'un type de la catégorie l'est
      }
    }
    return {
      global: { push: pref.globalPushEnabled, email: pref.globalEmailEnabled },
      dnd:    { enabled: pref.dndEnabled, start: pref.dndStartTime ?? '22:00', end: pref.dndEndTime ?? '07:00', timezone: pref.timezone || 'Africa/Conakry' },
      groups,
    };
  }

  async update(user: User, dto: UpdateNotifsDto): Promise<NotifsView> {
    const a = this.actor(user);
    const patch: UpdatePreferencesDto = {};

    if (dto.global) {
      if (typeof dto.global.push  === 'boolean') patch.globalPushEnabled  = dto.global.push;
      if (typeof dto.global.email === 'boolean') patch.globalEmailEnabled = dto.global.email;
    }

    if (dto.dnd) {
      if (typeof dto.dnd.enabled === 'boolean') patch.dndEnabled = dto.dnd.enabled;
      if (dto.dnd.start !== undefined) {
        if (!HHMM.test(dto.dnd.start)) throw new BadRequestException('Heure de début invalide (format HH:MM).');
        patch.dndStartTime = dto.dnd.start;
      }
      if (dto.dnd.end !== undefined) {
        if (!HHMM.test(dto.dnd.end)) throw new BadRequestException('Heure de fin invalide (format HH:MM).');
        patch.dndEndTime = dto.dnd.end;
      }
      if (dto.dnd.timezone !== undefined) {
        try { new Intl.DateTimeFormat('fr', { timeZone: dto.dnd.timezone }); }
        catch { throw new BadRequestException('Fuseau horaire invalide.'); }
        patch.timezone = dto.dnd.timezone;
      }
    }

    if (dto.groups) {
      const perType: Record<string, Partial<Record<Ch, boolean>>> = {};
      for (const [key, chans] of Object.entries(dto.groups)) {
        const types = NOTIF_GROUPS[key];
        if (!types) throw new BadRequestException(`Catégorie inconnue : ${key}.`);
        for (const ch of CHANNELS) {
          const want = (chans as any)?.[ch];
          if (typeof want !== 'boolean') continue;
          /* ON = retour aux réglages par défaut de la plateforme pour ce canal (les événements
           * importants), sauf si aucun n'est actif par défaut : alors tous. OFF = tous coupés. */
          const defaults = types.map(t => this.prefs.getEffectiveChannelPref({ preferences: null } as any, t)[ch]);
          const anyDefaultOn = defaults.some(Boolean);
          types.forEach((t, i) => {
            (perType[t] ??= {})[ch] = want ? (anyDefaultOn ? defaults[i] : true) : false;
          });
        }
      }
      if (Object.keys(perType).length) patch.preferences = perType;
    }

    if (Object.keys(patch).length) await this.prefs.update(a.type, a.id, patch);
    this.logger.log(`[NOTIFS UPDATE] userId=${user.id}`);
    return this.get(user);
  }
}

/* ════════════════════════════════════════════════════════════
 * 10. CONFIDENTIALITÉ
 * ════════════════════════════════════════════════════════════ */
@Injectable()
export class PrivacyService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async get(user: User) {
    const p   = await getOrCreate(this.clientRepo, user.id);
    const raw = (p as any).privacySettings;
    try { return { privacySettings: typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {}) }; }
    catch { return { privacySettings: {} }; }
  }

  /** Réglages connus et leur type — toute autre clé est ignorée (avant : JSON arbitraire enregistré tel quel). */
  private static readonly VISIBILITES = ['public', 'members', 'nobody'];
  private static readonly BOOLEANS    = ['historique', 'wishlist', 'perso', 'localisation'];

  async update(user: User, dto: UpdatePrivacyDto) {
    const p = await getOrCreate(this.clientRepo, user.id);
    if (dto.privacySettings !== undefined) {
      let incoming: Record<string, unknown>;
      try { incoming = typeof dto.privacySettings === 'string' ? JSON.parse(dto.privacySettings) : (dto.privacySettings as any); }
      catch { throw new BadRequestException('Réglages de confidentialité invalides.'); }
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new BadRequestException('Réglages de confidentialité invalides.');

      const current = ((await this.get(user)).privacySettings ?? {}) as Record<string, unknown>;
      const next: Record<string, unknown> = { ...current };
      if ('visibilite' in incoming) {
        if (!PrivacyService.VISIBILITES.includes(incoming.visibilite as string)) throw new BadRequestException('Visibilité du profil invalide.');
        next.visibilite = incoming.visibilite;
      }
      for (const k of PrivacyService.BOOLEANS) {
        if (!(k in incoming)) continue;
        if (typeof incoming[k] !== 'boolean') throw new BadRequestException(`Réglage « ${k} » invalide.`);
        next[k] = incoming[k];
      }
      (p as any).privacySettings = next;
    }
    await this.clientRepo.save(p);
    return { privacySettings: (p as any).privacySettings ?? {} };
  }
}

/* ════════════════════════════════════════════════════════════
 * 11. APPARENCE
 * ════════════════════════════════════════════════════════════ */
@Injectable()
export class ApparenceService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async get(user: User) {
    const p = await getOrCreate(this.clientRepo, user.id);
    return {
      theme:        (p as any).theme        ?? 'clair',
      textSize:     (p as any).textSize     ?? 'normal',
      imageQuality: (p as any).imageQuality ?? 'haute',
    };
  }

  async update(user: User, dto: UpdateApparenceDto) {
    const p = await getOrCreate(this.clientRepo, user.id);
    if (dto.textSize !== undefined) {
      if (!['normal', 'grand', 'tres_grand'].includes(dto.textSize)) throw new BadRequestException('Taille de texte invalide.');
      (p as any).textSize = dto.textSize;
    }
    await this.clientRepo.save(p);
    return { theme: (p as any).theme ?? 'sombre', textSize: (p as any).textSize ?? 'normal', imageQuality: (p as any).imageQuality ?? 'haute' };
  }
}

/* ════════════════════════════════════════════════════════════
 * 12. LANGUE & RÉGION
 * ════════════════════════════════════════════════════════════ */
@Injectable()
export class LangueService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async get(user: User) {
    const p = await getOrCreate(this.clientRepo, user.id);
    return {
      langue:   (p as any).langue   ?? 'fr',
      devise:   (p as any).devise   ?? 'GNF',
      timezone: (p as any).timezone ?? 'GMT+0',
    };
  }

  async update(user: User, dto: UpdateLangueDto) {
    const p = await getOrCreate(this.clientRepo, user.id);
    if (dto.langue !== undefined) {
      if (!['fr', 'en', 'ar', 'pt', 'zh'].includes(dto.langue)) throw new BadRequestException('Langue non prise en charge.');
      (p as any).langue = dto.langue;
    }
    await this.clientRepo.save(p);
    return { langue: (p as any).langue ?? 'fr', devise: (p as any).devise ?? 'GNF', timezone: (p as any).timezone ?? 'GMT+0' };
  }
}

/* ════════════════════════════════════════════════════════════
 * 13. DONNÉES — RGPD
 * ════════════════════════════════════════════════════════════ */
@Injectable()
export class DonneesService {
  private readonly logger = new Logger(DonneesService.name);

  constructor(
    @InjectRepository(User)     private readonly userRepo:     Repository<User>,
    @InjectRepository(Client)   private readonly clientRepo:   Repository<Client>,
    @InjectRepository(AuditLog) private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  /* Génération réelle du fichier (ZIP/CSV/PDF) et envoi email : pas encore
   * automatisés — en attendant, chaque demande est consignée dans
   * audit_logs (déjà lu par le dashboard admin, AuditPage) pour que le
   * DPO puisse la traiter manuellement dans le délai annoncé à
   * l'utilisateur. Avant ce correctif, ces actions ne faisaient QUE
   * logger côté serveur (console) puis répondre un message de succès —
   * la demande de l'utilisateur n'était donc jamais réellement enregistrée
   * nulle part, ce qui viole la promesse RGPD affichée dans l'UI. */
  private async logDemande(user: User, action: string): Promise<void> {
    await this.auditLogRepo.save(this.auditLogRepo.create({
      actorId:    user.id,
      actorName:  `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
      actorEmail: user.email,
      icon:       '📄',
      action,
      targetType: 'rgpd_request',
      targetId:   user.id,
    }));
  }

  async exportAll(user: User) {
    await this.logDemande(user, 'RGPD — demande d\'export complet des données (profil, commandes, messages, points)');
    return { message: 'Demande enregistrée. Export envoyé par email sous 24h.' };
  }

  async exportCommandes(user: User) {
    await this.logDemande(user, 'RGPD — demande d\'export de l\'historique des commandes');
    return { message: 'Demande enregistrée. Export envoyé par email sous 24h.' };
  }

  async exportFactures(user: User) {
    await this.logDemande(user, 'RGPD — demande d\'export des factures et reçus');
    return { message: 'Demande enregistrée. Export envoyé par email sous 24h.' };
  }

  async rapportConfidentialite(user: User) {
    return {
      donneesCollectees: ['Nom', 'Email', 'Téléphone', 'Adresses', 'Commandes', 'Points'],
      partageeAvec:      ['Livreurs', 'Correspondants'],
      conservationDuree: '5 ans après dernière activité',
      droits:            ['Accès', 'Rectification', 'Suppression', 'Portabilité'],
      contact:           'privacy@shopi.gn',
    };
  }

  async demanderPortabilite(user: User) {
    await this.logDemande(user, 'RGPD — demande de portabilité des données');
    return { message: 'Demande enregistrée. Délai légal : 30 jours.' };
  }
}

/* ════════════════════════════════════════════════════════════
 * 14. DANGER
 * ════════════════════════════════════════════════════════════ */
@Injectable()
export class DangerService {
  private readonly logger = new Logger(DangerService.name);

  constructor(
    @InjectRepository(User)   private readonly userRepo:   Repository<User>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
  ) {}

  /* Vérifie le mot de passe actuel avant toute action irréversible ou à
   * fort impact — sans ça, un JWT volé/laissé ouvert (poste partagé, XSS)
   * suffisait à désactiver ou supprimer le compte en 2 clics, sans aucune
   * seconde preuve d'identité (même faille que celle corrigée côté
   * entreprise, voir danger-parametres.service.ts). */
  private async verifyPassword(userId: string, password: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'password'] });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new UnauthorizedException('Mot de passe incorrect. Action refusée.');
  }

  async desactiverCompte(user: User, password: string): Promise<{ message: string }> {
    await this.verifyPassword(user.id, password);
    const dbUser = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');
    (dbUser as any).status = 'inactive';
    await this.userRepo.save(dbUser);
    this.logger.warn(`[DÉSACTIVATION] userId=${user.id}`);
    return { message: 'Compte temporairement désactivé.' };
  }

  /* "Révoquer les accès tiers" a été retiré : le site ne propose aucune
   * intégration OAuth/application tierce (vérifié — aucune entité ni route
   * de ce type dans tout le backend). L'implémentation précédente
   * désactivait silencieusement le 2FA de l'utilisateur sous cet intitulé
   * trompeur — une régression de sécurité déguisée en action anodine.
   * Le bouton correspondant est désormais désactivé côté frontend
   * ("Bientôt disponible") plutôt que de faire semblant. */

  async reinitialiserPreferences(user: User): Promise<{ message: string }> {
    const p = await getOrCreate(this.clientRepo, user.id);
    (p as any).notifSettings   = null;
    (p as any).privacySettings = null;
    (p as any).theme           = 'clair';
    (p as any).textSize        = 'normal';
    (p as any).imageQuality    = 'haute';
    (p as any).langue          = 'fr';
    (p as any).devise          = 'GNF';
    (p as any).timezone        = 'GMT+0';
    await this.clientRepo.save(p);
    return { message: 'Préférences réinitialisées.' };
  }

  async supprimerCompte(user: User, password: string): Promise<{ message: string }> {
    await this.verifyPassword(user.id, password);
    const dbUser = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');
    dbUser.deletedAt        = new Date();
    (dbUser as any).status  = 'deleted';
    await this.userRepo.save(dbUser);
    this.logger.error(`[SUPPRESSION] userId=${user.id} — dans 30 jours`);
    return { message: 'Demande enregistrée. Suppression dans 30 jours.' };
  }
}