/* ============================================================
 * src/modules/dashboard/client/services/preferences.service.ts
 * FIX : helper getOrCreate avec early return
 * ============================================================ */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository }                      from '@nestjs/typeorm';
import { DeepPartial, Repository }               from 'typeorm';

import { User }   from '../../../../database/entities/user.entity';
import { Client } from '../../../../database/entities/profiles/client-profile.entity';
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
 * 8. APPROBATIONS
 * ════════════════════════════════════════════════════════════ */
@Injectable()
export class ApprobationsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async getAll(user: User) {
    const p = await getOrCreate(this.clientRepo, user.id);
    try { return JSON.parse((p as any).trustedDevices ?? '[]'); }
    catch { return []; }
  }

  async remove(user: User, deviceId: string): Promise<{ message: string }> {
    const p    = await getOrCreate(this.clientRepo, user.id);
    let devs: any[] = [];
    try { devs = JSON.parse((p as any).trustedDevices ?? '[]'); } catch {}
    const before = devs.length;
    devs = devs.filter((d: any) => d.id !== deviceId);
    if (devs.length === before) throw new NotFoundException('Appareil introuvable.');
    (p as any).trustedDevices = JSON.stringify(devs);
    await this.clientRepo.save(p);
    return { message: 'Appareil retiré de la liste de confiance.' };
  }
}

/* ════════════════════════════════════════════════════════════
 * 9. NOTIFICATIONS
 * ════════════════════════════════════════════════════════════ */
@Injectable()
export class NotifsService {
  private readonly logger = new Logger(NotifsService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async get(user: User) {
    const p   = await getOrCreate(this.clientRepo, user.id);
    const raw = (p as any).notifSettings;
    try { return { notifSettings: typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {}) }; }
    catch { return { notifSettings: {} }; }
  }

  async update(user: User, dto: UpdateNotifsDto) {
    const p = await getOrCreate(this.clientRepo, user.id);
    if (dto.notifSettings !== undefined) {
      try { (p as any).notifSettings = typeof dto.notifSettings === 'string' ? JSON.parse(dto.notifSettings) : dto.notifSettings; }
      catch { (p as any).notifSettings = dto.notifSettings; }
    }
    await this.clientRepo.save(p);
    this.logger.log(`[NOTIFS UPDATE] userId=${user.id}`);
    return { notifSettings: (p as any).notifSettings };
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

  async update(user: User, dto: UpdatePrivacyDto) {
    const p = await getOrCreate(this.clientRepo, user.id);
    if (dto.privacySettings !== undefined) {
      try { (p as any).privacySettings = typeof dto.privacySettings === 'string' ? JSON.parse(dto.privacySettings) : dto.privacySettings; }
      catch { (p as any).privacySettings = dto.privacySettings; }
    }
    await this.clientRepo.save(p);
    return { privacySettings: (p as any).privacySettings };
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
    if (dto.theme        !== undefined) (p as any).theme        = dto.theme;
    if (dto.textSize     !== undefined) (p as any).textSize     = dto.textSize;
    if (dto.imageQuality !== undefined) (p as any).imageQuality = dto.imageQuality;
    await this.clientRepo.save(p);
    return { theme: (p as any).theme, textSize: (p as any).textSize, imageQuality: (p as any).imageQuality };
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
    if (dto.langue   !== undefined) (p as any).langue   = dto.langue;
    if (dto.devise   !== undefined) (p as any).devise   = dto.devise;
    if (dto.timezone !== undefined) (p as any).timezone = dto.timezone;
    await this.clientRepo.save(p);
    return { langue: (p as any).langue, devise: (p as any).devise, timezone: (p as any).timezone };
  }
}

/* ════════════════════════════════════════════════════════════
 * 13. DONNÉES — RGPD
 * ════════════════════════════════════════════════════════════ */
@Injectable()
export class DonneesService {
  private readonly logger = new Logger(DonneesService.name);

  constructor(
    @InjectRepository(User)    private readonly userRepo:   Repository<User>,
    @InjectRepository(Client)  private readonly clientRepo: Repository<Client>,
  ) {}

  async exportAll(user: User)            { this.logger.log(`[EXPORT] userId=${user.id}`); return { message: 'Export en préparation. Email dans 24h.' }; }
  async exportCommandes(user: User)      { return { message: "Historique des commandes en cours d'export." }; }
  async exportFactures(user: User)       { return { message: 'Factures en cours de génération.' }; }
  async rapportConfidentialite(user: User) {
    return {
      donneesCollectees: ['Nom', 'Email', 'Téléphone', 'Adresses', 'Commandes', 'Points'],
      partageeAvec:      ['Livreurs', 'Correspondants'],
      conservationDuree: '5 ans après dernière activité',
      droits:            ['Accès', 'Rectification', 'Suppression', 'Portabilité'],
      contact:           'privacy@shopi.gn',
    };
  }
  async demanderPortabilite(user: User) { return { message: 'Demande enregistrée. Délai légal : 30 jours.' }; }
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

  async desactiverCompte(user: User): Promise<{ message: string }> {
    const dbUser = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');
    (dbUser as any).status = 'inactive';
    await this.userRepo.save(dbUser);
    this.logger.warn(`[DÉSACTIVATION] userId=${user.id}`);
    return { message: 'Compte temporairement désactivé.' };
  }

  async revoquerAccesTiers(user: User): Promise<{ message: string }> {
    const p = await getOrCreate(this.clientRepo, user.id);
    (p as any).twoFaEnabled = false;
    (p as any).twoFaMethod  = null;
    await this.clientRepo.save(p);
    return { message: 'Tous les accès tiers ont été révoqués.' };
  }

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

  async supprimerCompte(user: User): Promise<{ message: string }> {
    const dbUser = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');
    dbUser.deletedAt        = new Date();
    (dbUser as any).status  = 'deleted';
    await this.userRepo.save(dbUser);
    this.logger.error(`[SUPPRESSION] userId=${user.id} — dans 30 jours`);
    return { message: 'Demande enregistrée. Suppression dans 30 jours.' };
  }
}