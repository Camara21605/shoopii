/* ============================================================
 * FICHIER : src/modules/location/services/delivery-location.service.ts
 * RÔLE    : Gestion de la position GPS du livreur.
 *           Met à jour Delivery.lastLatitude/lastLongitude
 *           et enregistre l'historique dans LocationHistory.
 * ============================================================ */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository }                       from '@nestjs/typeorm';
import { Repository }                             from 'typeorm';

import { Delivery }         from '../../../database/entities/profiles/livreur-profile.entity';
import { LocationHistory }  from '../../../database/entities/location/location-history.entity';
import { UpdateDeliveryPositionDto, UpdateDeliveryZoneDto } from '../dto/delivery-position.dto';
import { GeoService }       from './geo.service';
import { ProximityQueryDto } from '../dto/proximity.dto';
import type { IProximityResult } from '../interfaces/location.interfaces';

@Injectable()
export class DeliveryLocationService {

  private readonly logger = new Logger(DeliveryLocationService.name);

  constructor(
    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    @InjectRepository(LocationHistory)
    private readonly historyRepo: Repository<LocationHistory>,

    private readonly geoService: GeoService,
  ) {}

  /* ── Position actuelle ───────────────────────────────────── */

  async getPosition(deliveryId: string): Promise<{ latitude: number; longitude: number } | null> {
    const d = await this.deliveryRepo.findOne({
      where:  { id: deliveryId },
      select: ['id', 'lastLatitude', 'lastLongitude'],
    });
    if (!d || d.lastLatitude == null || d.lastLongitude == null) return null;
    return { latitude: Number(d.lastLatitude), longitude: Number(d.lastLongitude) };
  }

  /* ── Mettre à jour la position ───────────────────────────── */

  async updatePosition(
    deliveryId: string,
    dto:        UpdateDeliveryPositionDto,
    saveHistory = true,
  ): Promise<void> {
    const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException(`Livreur introuvable (id: ${deliveryId}).`);

    // Vérifier si le mouvement est significatif (> 10m) avant de sauvegarder
    const prevLat = Number(delivery.lastLatitude);
    const prevLng = Number(delivery.lastLongitude);
    if (
      delivery.lastLatitude != null &&
      delivery.lastLongitude != null &&
      !this.geoService.isSignificantMove(
        { latitude: prevLat, longitude: prevLng },
        { latitude: dto.latitude, longitude: dto.longitude },
        10,
      )
    ) {
      return; // Pas de changement significatif
    }

    // Met à jour la position courante
    await this.deliveryRepo.update(deliveryId, {
      lastLatitude:  dto.latitude,
      lastLongitude: dto.longitude,
    } as any);

    // Enregistre l'historique
    if (saveHistory) {
      const entry = this.historyRepo.create({
        deliveryId,
        latitude:   dto.latitude,
        longitude:  dto.longitude,
        precisionM: dto.precisionM  ?? null,
        cap:        dto.cap         ?? null,
        vitesseKmh: dto.vitesseKmh  ?? null,
        sessionId:  dto.sessionId   ?? null,
        horodatage: dto.sessionId   ? new Date() : new Date(),
      });
      await this.historyRepo.save(entry);
    }
  }

  /* ── Mettre à jour la zone ───────────────────────────────── */

  async updateZone(deliveryId: string, dto: UpdateDeliveryZoneDto): Promise<Delivery> {
    const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException(`Livreur introuvable (id: ${deliveryId}).`);

    Object.assign(delivery, {
      ville:            dto.ville            ?? delivery.ville,
      zone:             dto.zone             ?? (delivery as any).zone,
      communesActives:  dto.communesActives  != null
                          ? JSON.stringify(dto.communesActives)
                          : (delivery as any).communesActives,
      radiusKm:         dto.radiusKm         ?? (delivery as any).radiusKm,
      distanceMax:      dto.distanceMax      ?? (delivery as any).distanceMax,
    });

    return this.deliveryRepo.save(delivery);
  }

  /* ── Livreurs proches ────────────────────────────────────── */

  async findNearby(query: ProximityQueryDto): Promise<IProximityResult[]> {
    const bbox = this.geoService.boundingBox(
      { latitude: query.latitude, longitude: query.longitude },
      query.rayonKm ?? 10,
    );

    const deliveries = await this.deliveryRepo
      .createQueryBuilder('d')
      .leftJoin('d.user', 'u')
      .select([
        'd.id', 'd.fullName', 'd.lastLatitude', 'd.lastLongitude',
        'd.ville', 'd.zone', 'u.profilePicture', 'u.phone',
      ])
      .where('d.lastLatitude  BETWEEN :latMin AND :latMax', {
        latMin: bbox.latMin, latMax: bbox.latMax,
      })
      .andWhere('d.lastLongitude BETWEEN :lngMin AND :lngMax', {
        lngMin: bbox.lngMin, lngMax: bbox.lngMax,
      })
      .andWhere('d.status = :status', { status: 'active' })
      .take(query.limit ?? 20)
      .getMany();

    return this.geoService
      .sortByProximity(
        deliveries.map(d => ({
          ...d,
          latitude:  Number(d.lastLatitude),
          longitude: Number(d.lastLongitude),
        })),
        { latitude: query.latitude, longitude: query.longitude },
        query.rayonKm ?? 10,
      )
      .map(d => ({
        id:         d.id,
        nom:        (d as any).fullName ?? 'Livreur',
        type:       'livreur' as const,
        latitude:   d.latitude,
        longitude:  d.longitude,
        distanceKm: d.distanceKm,
        ville:      (d as any).ville ?? undefined,
        telephone:  (d as any).user?.phone ?? undefined,
        logo:       (d as any).user?.profilePicture ?? undefined,
        disponible: true,
      }));
  }

  /* ── Historique de position ──────────────────────────────── */

  async getHistory(
    deliveryId: string,
    sessionId?: string,
    limit = 100,
  ): Promise<LocationHistory[]> {
    const qb = this.historyRepo
      .createQueryBuilder('h')
      .where('h.deliveryId = :deliveryId', { deliveryId })
      .orderBy('h.horodatage', 'DESC')
      .take(limit);

    if (sessionId) {
      qb.andWhere('h.sessionId = :sessionId', { sessionId });
    }

    return qb.getMany();
  }
}
