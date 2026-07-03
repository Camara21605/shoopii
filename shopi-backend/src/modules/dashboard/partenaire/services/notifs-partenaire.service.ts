/* ============================================================
 * FICHIER : services/notifs-partenaire.service.ts
 *
 * RÔLE : Sections Notifications + Confidentialité + Préférences.
 *
 * Stockage : les préférences sont sérialisées en JSON dans 3 colonnes
 *   text de l'entité Partner (notifSettings, privacySettings, preferences).
 *   Ce choix évite des tables supplémentaires pour des données simples.
 *
 * Endpoints :
 *   GET    /parametres/notifications      → préférences actuelles
 *   PATCH  /parametres/notifications      → mise à jour
 *   GET    /parametres/confidentialite
 *   PATCH  /parametres/confidentialite
 *   GET    /parametres/preferences
 *   PATCH  /parametres/preferences
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { Partner } from 'src/database/entities/profiles/partenaire-profile.entity';
import {
  UpdatePartenaireNotifsDto,
  UpdatePartenairePrivacyDto,
  UpdatePartenairePreferencesDto,
} from '../dto/partenaire-parametres.dto';

/* ── Valeurs par défaut ─────────────────────────────────── */
const DEFAULT_NOTIFS = {
  notifActeurActive: true, notifCommission: true, notifSignalement: true,
  notifPalier: true, notifNews: false,
  canalEmail: true, canalSms: true, canalWhatsapp: true, canalPush: false,
};
const DEFAULT_PRIVACY = {
  profilPublic: true, afficherTelephone: true, apparaitreClassement: false,
};
const DEFAULT_PREFS = { langue: 'fr', apparence: 'light' };

/* ── Helpers parse/stringify ── */
function parseJson<T>(text: string | null | undefined, defaults: T): T {
  if (!text) return defaults;
  try { return { ...defaults, ...JSON.parse(text) } as T; }
  catch { return defaults; }
}

/* ═══════════════════════════════════════════════════════════ */

@Injectable()
export class NotifsPartenaireService {

  private readonly logger = new Logger(NotifsPartenaireService.name);

  constructor(
    @InjectRepository(Partner) private readonly partnerRepo: Repository<Partner>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * NOTIFICATIONS — GET
   * ────────────────────────────────────────────────────────── */
  async getNotifs(userId: string) {
    const partner = await this.findOrFail(userId);
    return parseJson(partner.notifSettings, DEFAULT_NOTIFS);
  }

  /* ──────────────────────────────────────────────────────────
   * NOTIFICATIONS — PATCH
   * Merge avec les valeurs existantes pour permettre des mises
   * à jour partielles (un seul toggle à la fois).
   * ────────────────────────────────────────────────────────── */
  async updateNotifs(userId: string, dto: UpdatePartenaireNotifsDto) {
    const partner  = await this.findOrFail(userId);
    const existing = parseJson(partner.notifSettings, DEFAULT_NOTIFS);
    const merged   = { ...existing, ...dto };

    partner.notifSettings = JSON.stringify(merged);
    await this.partnerRepo.save(partner);

    this.logger.log(`[NOTIFS] Mis à jour — userId=${userId}`);
    return merged;
  }

  /* ──────────────────────────────────────────────────────────
   * CONFIDENTIALITÉ — GET
   * ────────────────────────────────────────────────────────── */
  async getPrivacy(userId: string) {
    const partner = await this.findOrFail(userId);
    return parseJson(partner.privacySettings, DEFAULT_PRIVACY);
  }

  /* ──────────────────────────────────────────────────────────
   * CONFIDENTIALITÉ — PATCH
   * ────────────────────────────────────────────────────────── */
  async updatePrivacy(userId: string, dto: UpdatePartenairePrivacyDto) {
    const partner  = await this.findOrFail(userId);
    const existing = parseJson(partner.privacySettings, DEFAULT_PRIVACY);
    const merged   = { ...existing, ...dto };

    partner.privacySettings = JSON.stringify(merged);
    await this.partnerRepo.save(partner);

    this.logger.log(`[CONFIDENTIALITÉ] Mis à jour — userId=${userId}`);
    return merged;
  }

  /* ──────────────────────────────────────────────────────────
   * PRÉFÉRENCES — GET
   * ────────────────────────────────────────────────────────── */
  async getPreferences(userId: string) {
    const partner = await this.findOrFail(userId);
    return parseJson(partner.preferences, DEFAULT_PREFS);
  }

  /* ──────────────────────────────────────────────────────────
   * PRÉFÉRENCES — PATCH
   * ────────────────────────────────────────────────────────── */
  async updatePreferences(userId: string, dto: UpdatePartenairePreferencesDto) {
    const partner  = await this.findOrFail(userId);
    const existing = parseJson(partner.preferences, DEFAULT_PREFS);
    const merged   = { ...existing, ...dto };

    partner.preferences = JSON.stringify(merged);
    await this.partnerRepo.save(partner);

    this.logger.log(`[PRÉFÉRENCES] Mis à jour — userId=${userId} | langue=${merged.langue}`);
    return merged;
  }

  /* ── Helper ── */
  async findOrFail(userId: string): Promise<Partner> {
    const p = await this.partnerRepo.findOne({ where: { userId } });
    if (!p) throw new NotFoundException('Profil partenaire introuvable.');
    return p;
  }
}
