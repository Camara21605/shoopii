/* ============================================================
 * FICHIER : src/modules/security-alerts/security-alerts.service.ts
 *
 * RÔLE : Stockage des préférences d'alertes de sécurité (section
 *        "Alertes de sécurité" des paramètres du compte client) et
 *        point d'entrée unique pour les envoyer réellement par email.
 *
 * DESIGN :
 *   - Réservé aux comptes CLIENT (le stockage vit sur Client, et c'est
 *     la seule page qui expose ce réglage) — isEnabled()/notifyIfEnabled()
 *     retournent false/no-op silencieusement pour tout autre rôle plutôt
 *     que de planter, pour rester sûrs à appeler depuis n'importe quel
 *     flux (login, paiement…) sans connaître le rôle de l'appelant.
 *   - SMS et push ne sont pas dans le format stocké : aucune passerelle
 *     SMS ni provider push n'existe encore côté backend (voir
 *     SecuriteSection.tsx côté frontend). Uniquement "email" par type.
 *   - Défaut = tout activé (opt-out) : ce sont des alertes de sécurité
 *     protectrices, pas du marketing — le standard du secteur est de les
 *     envoyer par défaut sauf désactivation explicite par l'utilisateur.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import { User }     from '../../database/entities/user.entity';
import { Client }   from '../../database/entities/profiles/client-profile.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { MailService } from '../email/email.service';
import type { AlertType } from '../dashboard/client/dto/client-parametres.dto';

export type AlertSettings = Record<AlertType, { email: boolean }>;

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  connex:      { email: true },
  mdp:         { email: true },
  tentatives:  { email: true },
  transaction: { email: true },
  pays:        { email: true },
};

@Injectable()
export class SecurityAlertsService {
  private readonly logger = new Logger(SecurityAlertsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    private readonly mailService: MailService,
  ) {}

  /* ── Lecture des préférences (fusionnées avec les défauts) ── */
  async getSettings(userId: string): Promise<AlertSettings> {
    const profile = await this.clientRepo.findOne({ where: { userId } });
    const stored  = this.parseStored(profile?.securityAlertSettings);
    return { ...DEFAULT_ALERT_SETTINGS, ...stored };
  }

  /* ── Mise à jour d'un seul type (case à cocher → sauvegarde immédiate,
   * même pattern que les autres panneaux de préférences de l'app) ── */
  async updateSetting(userId: string, type: AlertType, email: boolean): Promise<AlertSettings> {
    let profile = await this.clientRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.clientRepo.create({ userId } as DeepPartial<Client>);
    }
    const current = { ...DEFAULT_ALERT_SETTINGS, ...this.parseStored(profile.securityAlertSettings) };
    current[type] = { email };
    profile.securityAlertSettings = JSON.stringify(current);
    await this.clientRepo.save(profile);
    return current;
  }

  /* ── L'alerte `type` est-elle activée pour ce user ? (false pour tout
   * rôle non-CLIENT, ou si le user n'existe pas — jamais d'exception,
   * pour rester appelable sans risque depuis login/paiement/etc.) ── */
  async isEnabled(userId: string, type: AlertType): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'role'] });
    if (!user || user.role !== UserRole.CLIENT) return false;
    const settings = await this.getSettings(userId);
    return settings[type]?.email ?? true;
  }

  /* ── Vérifie + envoie (fire-and-forget, jamais throw) — point d'entrée
   * unique pour les 4 alertes à template générique (connex, tentatives,
   * transaction, pays). "mdp" a son propre email dédié plus riche
   * (sendPasswordChangedEmail, déjà existant) — voir SecuriteService,
   * qui appelle isEnabled() directement pour ce cas-là. ── */
  async notifyIfEnabled(userId: string, type: Exclude<AlertType, 'mdp'>, title: string, message: string): Promise<void> {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'role', 'email', 'firstName'] });
      if (!user || user.role !== UserRole.CLIENT) return;

      const settings = await this.getSettings(userId);
      if (!settings[type]?.email) return;

      await this.mailService.sendSecurityAlertEmail({
        toEmail:    user.email,
        firstName:  user.firstName,
        title,
        message,
        occurredAt: new Date(),
      });
    } catch (err) {
      this.logger.error(`[SECURITY ALERT ❌] type=${type} userId=${userId} | ${(err as Error).message}`);
    }
  }

  private parseStored(raw: string | null | undefined): Partial<AlertSettings> {
    if (!raw) return {};
    try { return JSON.parse(raw) as Partial<AlertSettings>; }
    catch { return {}; }
  }
}
