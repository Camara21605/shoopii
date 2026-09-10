/* ============================================================
 * SERVICE : admin-communication.service.ts
 *
 * Préférences de communication de l'admin : message + signature
 * insérés dans les emails d'invitation qu'il envoie (voir
 * AdminCodesService.sendCodeByEmail → MailService.sendInvitationEmail),
 * et modèles de notification personnalisés qui remplacent le texte
 * par défaut envoyé aux acteurs (voir NotificationEventService).
 *
 * Les clés de notifTemplates non reconnues sont ignorées et chaque
 * valeur est tronquée à 1000 caractères — ce champ arrive en JSON
 * libre (pas de DTO imbriqué), donc ce service est le seul gardien
 * contre un modèle disproportionné ou une clé invalide.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  AdminCommunicationSettings,
  AdminNotifTemplates,
} from '../../../../database/entities/admin-communication-settings.entity';
import { UpdateCommunicationDto } from '../dto/update-communication.dto';

const NOTIF_KEYS: (keyof AdminNotifTemplates)[] = ['approved', 'rejected', 'suspended', 'warned', 'reactivated'];
const MAX_TEMPLATE_LEN = 1000;

@Injectable()
export class AdminCommunicationService {

  constructor(
    @InjectRepository(AdminCommunicationSettings)
    private readonly repo: Repository<AdminCommunicationSettings>,
  ) {}

  private sanitizeTemplates(input?: AdminNotifTemplates | null): AdminNotifTemplates | null {
    if (!input) return null;
    const out: AdminNotifTemplates = {};
    for (const key of NOTIF_KEYS) {
      const val = input[key];
      if (typeof val === 'string' && val.trim()) {
        out[key] = val.trim().slice(0, MAX_TEMPLATE_LEN);
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  async getSettings(userId: string): Promise<AdminCommunicationSettings> {
    const existing = await this.repo.findOne({ where: { userId } });
    if (existing) return existing;
    return this.repo.create({ userId, invitationMessage: null, signature: null, notifTemplates: null });
  }

  async updateSettings(userId: string, dto: UpdateCommunicationDto): Promise<AdminCommunicationSettings> {
    let settings = await this.repo.findOne({ where: { userId } });
    if (!settings) settings = this.repo.create({ userId });

    if (dto.invitationMessage !== undefined) {
      settings.invitationMessage = dto.invitationMessage?.trim().slice(0, 2000) || null;
    }
    if (dto.signature !== undefined) {
      settings.signature = dto.signature?.trim().slice(0, 300) || null;
    }
    if (dto.notifTemplates !== undefined) {
      settings.notifTemplates = this.sanitizeTemplates(dto.notifTemplates);
    }

    return this.repo.save(settings);
  }

  /**
   * Retourne le modèle personnalisé de l'admin pour cet événement,
   * ou null si non défini (l'appelant doit alors garder son texte
   * par défaut). Utilisé par AdminActeursService / AdminSignalementsService
   * juste avant d'appeler NotificationEventService.
   */
  async getTemplate(userId: string, key: keyof AdminNotifTemplates): Promise<string | null> {
    const settings = await this.repo.findOne({ where: { userId } });
    return settings?.notifTemplates?.[key]?.trim() || null;
  }

  /** Idem pour le message d'invitation + la signature (un seul aller simple). */
  async getInvitationExtras(userId: string): Promise<{ message: string | null; signature: string | null }> {
    const settings = await this.repo.findOne({ where: { userId } });
    return {
      message:   settings?.invitationMessage?.trim() || null,
      signature: settings?.signature?.trim() || null,
    };
  }
}
