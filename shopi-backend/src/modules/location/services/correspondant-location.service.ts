/* ============================================================
 * FICHIER : src/modules/location/services/correspondant-location.service.ts
 * RÔLE    : Gestion de la localisation du correspondant
 *           (dépôt + zones d'intervention).
 * ============================================================ */

import {
  Injectable, Logger, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { Correspondent }    from '../../../database/entities/profiles/correspondant-profile.entity';
import { UpdateCorrespondantLocationDto } from '../dto/correspondant-location.dto';
import { GeoService }       from './geo.service';
import { ProximityQueryDto } from '../dto/proximity.dto';
import type { IProximityResult } from '../interfaces/location.interfaces';

@Injectable()
export class CorrespondantLocationService {

  private readonly logger = new Logger(CorrespondantLocationService.name);

  constructor(
    @InjectRepository(Correspondent)
    private readonly corrRepo: Repository<Correspondent>,

    private readonly geoService: GeoService,
  ) {}

  /* ── Localisation du dépôt ───────────────────────────────── */

  async getLocation(corrId: string): Promise<Partial<Correspondent>> {
    const corr = await this.corrRepo.findOne({
      where:  { id: corrId },
      select: [
        'id', 'fullName', 'depotNom', 'depotAdresse', 'depotCommune',
        'depotVille', 'depotRegion', 'depotCodePostal', 'depotRepere',
        'depotLatitude', 'depotLongitude', 'depotPhone',
        'zonesActives',
      ] as any,
    });
    if (!corr) throw new NotFoundException('Correspondant introuvable.');
    return corr;
  }

  async updateLocation(
    corrId: string,
    userId: string,
    dto:    UpdateCorrespondantLocationDto,
  ): Promise<Partial<Correspondent>> {
    const corr = await this.corrRepo.findOne({ where: { id: corrId } });
    if (!corr)              throw new NotFoundException('Correspondant introuvable.');
    if (corr.userId !== userId) throw new ForbiddenException('Accès refusé.');

    Object.assign(corr, {
      depotNom:       dto.depotNom       ?? corr.depotNom,
      depotAdresse:   dto.depotAdresse   ?? corr.depotAdresse,
      depotCommune:   dto.depotCommune   ?? corr.depotCommune,
      depotVille:     dto.depotVille     ?? corr.depotVille,
      depotRegion:    dto.depotRegion    !== undefined ? dto.depotRegion    : (corr as any).depotRegion,
      depotCodePostal: dto.depotCodePostal !== undefined ? dto.depotCodePostal : (corr as any).depotCodePostal,
      depotRepere:    dto.depotRepere    ?? corr.depotRepere,
      depotLatitude:  dto.depotLatitude  !== undefined ? dto.depotLatitude  : (corr as any).depotLatitude,
      depotLongitude: dto.depotLongitude !== undefined ? dto.depotLongitude : (corr as any).depotLongitude,
      depotPhone:     dto.depotPhone     ?? (corr as any).depotPhone,
      zonesActives:   dto.zonesActives   != null
                        ? JSON.stringify(dto.zonesActives)
                        : (corr as any).zonesActives,
    });

    const saved = await this.corrRepo.save(corr);
    this.logger.log(`[CORR LOC ✅] Mise à jour corrId=${corrId}`);
    return saved;
  }

  /* ── Correspondants proches ──────────────────────────────── */

  async findNearby(query: ProximityQueryDto): Promise<IProximityResult[]> {
    const bbox = this.geoService.boundingBox(
      { latitude: query.latitude, longitude: query.longitude },
      query.rayonKm ?? 10,
    );

    const corrs = await this.corrRepo
      .createQueryBuilder('c')
      .select([
        'c.id', 'c.fullName', 'c.depotLatitude', 'c.depotLongitude',
        'c.depotVille', 'c.depotAdresse', 'c.depotPhone',
      ])
      .where('c.depotLatitude  BETWEEN :latMin AND :latMax', { latMin: bbox.latMin, latMax: bbox.latMax })
      .andWhere('c.depotLongitude BETWEEN :lngMin AND :lngMax', { lngMin: bbox.lngMin, lngMax: bbox.lngMax })
      .andWhere('c.status = :status', { status: 'active' })
      .take(query.limit ?? 20)
      .getMany();

    return this.geoService
      .sortByProximity(
        corrs.map(c => ({
          ...c,
          latitude:  Number((c as any).depotLatitude),
          longitude: Number((c as any).depotLongitude),
        })),
        { latitude: query.latitude, longitude: query.longitude },
        query.rayonKm ?? 10,
      )
      .map(c => ({
        id:         c.id,
        nom:        c.fullName,
        type:       'correspondant' as const,
        latitude:   c.latitude,
        longitude:  c.longitude,
        distanceKm: c.distanceKm,
        adresse:    (c as any).depotAdresse ?? undefined,
        ville:      (c as any).depotVille   ?? undefined,
        telephone:  (c as any).depotPhone   ?? undefined,
        disponible: true,
      }));
  }
}
