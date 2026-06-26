/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/services/zone-livreur.service.ts
 * RÔLE : Section 3 — Zones, Horaires, Disponibilité automatique
 *   GET   /parametres/zone        → zones + distanceMax + autoDispoSettings
 *   PATCH /parametres/zone        → MAJ zones + distanceMax + autoDispoSettings
 *   GET   /parametres/horaires    → horaires 7 jours triés
 *   PATCH /parametres/horaires    → remplacer tous les horaires
 *   PATCH /parametres/horaires/:jour → modifier un seul jour
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Delivery } from 'src/database/entities/profiles/livreur-profile.entity';
import {
  LivreurHoraire, JourSemaine,
  JOURS_ORDER, DEFAULT_HORAIRES_LIVREUR,
} from 'src/database/entities/livreur.table/livreur-horaire.entity';
import { UpdateZonesDto, UpdateHorairesLivreurDto, HoraireJourDto } from '../dto/livreur-parametres.dto';

@Injectable()
export class ZoneLivreurService {

  private readonly logger = new Logger(ZoneLivreurService.name);

  constructor(
    @InjectRepository(Delivery)       private readonly livreurRepo:  Repository<Delivery>,
    @InjectRepository(LivreurHoraire) private readonly horaireRepo:  Repository<LivreurHoraire>,
  ) {}

  /* ── PATCH — Zones & disponibilité ── */
  async updateZones(userId: string, dto: UpdateZonesDto): Promise<Delivery> {
    const livreur = await this.findOrFail(userId);
    if (dto.communesActives  !== undefined) livreur.communesActives  = dto.communesActives;
    if (dto.distanceMax      !== undefined) livreur.distanceMax      = dto.distanceMax;
    if (dto.autoDispoSettings !== undefined) livreur.autoDispoSettings = dto.autoDispoSettings;
    const updated = await this.livreurRepo.save(livreur);
    this.logger.log(`[ZONE] Mis à jour — userId=${userId}`);
    return updated;
  }

  /* ── GET — Horaires triés lundi → dimanche ── */
  async getHoraires(userId: string): Promise<LivreurHoraire[]> {
    const livreur = await this.findOrFail(userId);
    let horaires = await this.horaireRepo.find({ where: { livreurId: livreur.id } });
    if (horaires.length === 0) horaires = await this.initHorairesDefaut(livreur.id);
    return this.sortByWeek(horaires);
  }

  /* ── PATCH — Remplacer tous les horaires ── */
  async updateHoraires(userId: string, dto: UpdateHorairesLivreurDto): Promise<LivreurHoraire[]> {
    const livreur = await this.findOrFail(userId);
    for (const h of dto.horaires) await this.upsertJour(livreur.id, h);
    this.logger.log(`[HORAIRES] ${dto.horaires.length} jours mis à jour — userId=${userId}`);
    return this.getHoraires(userId);
  }

  /* ── PATCH — Un seul jour ── */
  async updateJour(userId: string, jour: JourSemaine, dto: HoraireJourDto): Promise<LivreurHoraire> {
    const livreur = await this.findOrFail(userId);
    const h = await this.upsertJour(livreur.id, { ...dto, jour });
    this.logger.log(`[HORAIRE] ${jour} mis à jour — userId=${userId}`);
    return h;
  }

  /* ── Helpers ── */
  private async upsertJour(livreurId: string, dto: HoraireJourDto): Promise<LivreurHoraire> {
    let h = await this.horaireRepo.findOne({ where: { livreurId, jour: dto.jour } });
    if (!h) h = this.horaireRepo.create({ livreurId, jour: dto.jour });
    h.ouverture = dto.actif ? (dto.ouverture ?? null) : null;
    h.fermeture = dto.actif ? (dto.fermeture ?? null) : null;
    h.actif = dto.actif;
    return this.horaireRepo.save(h);
  }

  private async initHorairesDefaut(livreurId: string): Promise<LivreurHoraire[]> {
    const entities = JOURS_ORDER.map(jour => {
      const def = DEFAULT_HORAIRES_LIVREUR[jour];
      return this.horaireRepo.create({
        livreurId, jour,
        ouverture: def.actif ? def.ouverture : null,
        fermeture: def.actif ? def.fermeture : null,
        actif:     def.actif,
      });
    });
    return this.horaireRepo.save(entities);
  }

  private sortByWeek(horaires: LivreurHoraire[]): LivreurHoraire[] {
    return [...horaires].sort((a, b) => JOURS_ORDER.indexOf(a.jour) - JOURS_ORDER.indexOf(b.jour));
  }

  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }
}