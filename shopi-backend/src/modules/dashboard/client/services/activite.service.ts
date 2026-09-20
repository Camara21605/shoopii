/* ============================================================
 * src/modules/dashboard/client/services/activite.service.ts
 * Section 7 — Journal d'activité
 *
 * BUG CORRIGÉ — le journal lisait une colonne JSON `client.activityLog` que
 * rien ne remplissait : il était toujours vide. Il lit désormais le VRAI
 * journal d'authentification (table auth_logs : connexions réussies ou
 * échouées, déconnexions, réinitialisation de mot de passe, vérification
 * d'e-mail…) et les actions faites depuis les paramètres (changement de mot
 * de passe, d'e-mail, de téléphone) que ce service enregistre via record().
 *
 * Confidentialité : uniquement les lignes de CET utilisateur. Le pays est
 * résolu depuis l'IP (GeoIP local, sans appel externe).
 * L'export est fabriqué côté interface à partir de ces mêmes lignes (CSV) —
 * plus de faux « vous recevrez un e-mail ».
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { In, Repository }     from 'typeorm';

import { User }    from '../../../../database/entities/user.entity';
import { AuthLog } from '../../../../database/entities/auth-log.entity';
import { GeoIpService }   from '../../../security-alerts/geo-ip.service';
import { parseUserAgent } from '../../../../common/utils/user-agent.util';

/** Événements affichés dans le journal, avec leur rubrique. */
const EVENTS: Record<string, { type: 'login' | 'security' | 'alert' | 'profile'; title: string }> = {
  login_success:           { type: 'login',    title: 'Connexion réussie' },
  login_failed:            { type: 'alert',    title: 'Tentative de connexion échouée' },
  login_locked:            { type: 'alert',    title: 'Compte verrouillé après plusieurs échecs' },
  login_session_conflict:  { type: 'security', title: 'Connexion depuis un autre appareil — ancienne session fermée' },
  logout:                  { type: 'login',    title: 'Déconnexion' },
  register_success:        { type: 'profile',  title: 'Création du compte' },
  password_reset_success:  { type: 'security', title: 'Mot de passe réinitialisé' },
  password_changed:        { type: 'security', title: 'Mot de passe modifié' },
  email_verify_success:    { type: 'security', title: 'Adresse e-mail vérifiée' },
  email_changed:           { type: 'profile',  title: 'Adresse e-mail modifiée' },
  phone_changed:           { type: 'profile',  title: 'Numéro de téléphone modifié' },
  tokens_revoked:          { type: 'security', title: 'Sessions révoquées' },
  account_locked:          { type: 'alert',    title: 'Compte verrouillé' },
  account_deactivated:     { type: 'security', title: 'Compte désactivé' },
  account_reactivated:     { type: 'security', title: 'Compte réactivé à la connexion' },
};

export interface ActiviteItem {
  /** Code de l'événement (clé de traduction côté interface) */
  code:     string;
  type:     'login' | 'security' | 'alert' | 'profile';
  /** Libellé français de repli */
  title:    string;
  /** « Windows — Chrome » (vide si inconnu) */
  device:   string;
  /** Pays résolu depuis l'IP (vide si inconnu) */
  location: string;
  ip:       string;
  /** ISO 8601 */
  time:     string;
  success:  boolean;
}

@Injectable()
export class ActiviteService {
  private readonly logger = new Logger(ActiviteService.name);
  private readonly regionNames = new Intl.DisplayNames(['fr'], { type: 'region' });

  constructor(
    @InjectRepository(AuthLog) private readonly logRepo: Repository<AuthLog>,
    private readonly geoIp: GeoIpService,
  ) {}

  async get(user: User, limit = 50): Promise<ActiviteItem[]> {
    const rows = await this.logRepo.find({
      where: { userId: user.id, event: In(Object.keys(EVENTS)) },
      order: { createdAt: 'DESC' },
      take:  Math.min(Math.max(limit, 1), 200),
    });

    return rows.map(r => {
      const def = EVENTS[r.event];
      const ua  = r.userAgent ? parseUserAgent(r.userAgent) : null;
      const cc  = this.geoIp.lookupCountry(r.ipAddress);
      let location = '';
      if (cc) { try { location = this.regionNames.of(cc) ?? cc; } catch { location = cc; } }
      return {
        code:     r.event,
        type:     def.type,
        title:    def.title,
        device:   ua ? `${ua.device} — ${ua.browser}` : '',
        location,
        ip:       r.ipAddress ?? '',
        time:     r.createdAt.toISOString(),
        success:  r.success,
      };
    });
  }

  /**
   * Consigne une action faite depuis les paramètres (fire-and-forget : un échec
   * d'écriture du journal ne doit jamais faire échouer l'action elle-même).
   */
  record(userId: string, role: string | null, event: string, ip: string | null = null, userAgent: string | null = null): void {
    this.logRepo.save(this.logRepo.create({
      event, userId, role, ipAddress: ip, userAgent, success: true,
    })).catch(err => this.logger.warn(`[JOURNAL] écriture impossible (${event}) : ${(err as Error).message}`));
  }
}
