/* ============================================================
 * FICHIER : src/modules/location/services/tracking.service.ts
 *
 * RÔLE : Agrège toutes les positions nécessaires au suivi d'une
 *        commande en temps réel :
 *          - Position vendeur (Company.latitude/longitude)
 *          - Position livreur (Delivery.lastLatitude/lastLongitude)
 *          - Position client  (Localisation.estDefaut pour le userId)
 *
 *        Calcule l'itinéraire vendeur → livreur → client via ORS.
 * ============================================================ */

import {
  Injectable, Logger, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { Commande }      from '../../../database/entities/commande/commande.entity';
import { Client }        from '../../../database/entities/profiles/client-profile.entity';
import { Company }       from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from '../../../database/entities/profiles/livreur-profile.entity';
import { Localisation }  from '../../../database/entities/localisation.entity';

import { RouteService }  from './route.service';
import type { RouteResult } from './route.service';
import type { ICoordinates } from '../interfaces/location.interfaces';

/* ── Types de réponse ───────────────────────────────────────── */

export interface ActorPosition {
  id:       string;
  name:     string;
  role:     'vendor' | 'delivery' | 'client';
  lat:      number;
  lng:      number;
  address?: string;
  isLive:   boolean;   // true = mis à jour en temps réel (livreur)
}

export interface OrderTrackingResult {
  orderId:  string;
  numero:   string;
  status:   string;
  actors:   ActorPosition[];
  route:    RouteResult | null;
  /** Ordre de passage des waypoints (index dans actors[]) */
  waypointOrder: number[];
}

@Injectable()
export class TrackingService {

  private readonly logger = new Logger(TrackingService.name);

  constructor(
    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    @InjectRepository(Localisation)
    private readonly locRepo: Repository<Localisation>,

    private readonly routeService: RouteService,
  ) {}

  /* ── Tracking complet d'une commande ───────────────────────── */

  /**
   * Retourne les positions de tous les acteurs d'une commande
   * et calcule l'itinéraire optimal entre eux.
   *
   * @param orderId   UUID de la commande
   * @param userId    UUID de l'utilisateur qui consulte (sécurité)
   */
  async getOrderTracking(
    orderId: string,
    userId:  string,
  ): Promise<OrderTrackingResult> {

    /* ── 1. Charger la commande ──────────────────────────────── */
    const commande = await this.commandeRepo.findOne({
      where:  { id: orderId },
      select: ['id', 'numero', 'status', 'clientId', 'companyId', 'livreurId'],
    });

    if (!commande) {
      throw new NotFoundException(`Commande introuvable (${orderId}).`);
    }

    /* ── 2. Vérifier l'accès (client, livreur ou entreprise) ─── */
    await this.assertAccess(commande, userId);

    /* ── 3. Collecter les positions ─────────────────────────── */
    const actors: ActorPosition[]     = [];
    const waypoints: ICoordinates[]   = [];
    const waypointOrder: number[]     = [];

    /* --- Vendeur (Company) --- */
    const vendorPos = await this.getCompanyPosition(commande.companyId);
    if (vendorPos) {
      actors.push(vendorPos);
      waypoints.push({ latitude: vendorPos.lat, longitude: vendorPos.lng });
      waypointOrder.push(actors.length - 1);
    }

    /* --- Livreur (Delivery) — position temps réel --- */
    if (commande.livreurId) {
      const deliveryPos = await this.getDeliveryPosition(commande.livreurId);
      if (deliveryPos) {
        actors.push(deliveryPos);
        waypoints.push({ latitude: deliveryPos.lat, longitude: deliveryPos.lng });
        waypointOrder.push(actors.length - 1);
      }
    }

    /* --- Client (adresse de livraison) --- */
    const clientPos = await this.getClientPosition(commande.clientId);
    if (clientPos) {
      actors.push(clientPos);
      waypoints.push({ latitude: clientPos.lat, longitude: clientPos.lng });
      waypointOrder.push(actors.length - 1);
    }

    /* ── 4. Calculer l'itinéraire si assez de points ─────────── */
    let route: RouteResult | null = null;
    if (waypoints.length >= 2) {
      try {
        route = await this.routeService.getRoute(waypoints);
        this.logger.debug(
          `[Tracking] Itinéraire ${commande.numero} via ${route.provider} `
          + `— ${route.totalDistanceTxt} / ${route.totalDurationTxt}`,
        );
      } catch (err: any) {
        this.logger.warn(`[Tracking] Route échouée pour ${commande.numero}: ${err.message}`);
      }
    }

    return {
      orderId:       commande.id,
      numero:        commande.numero,
      status:        commande.status,
      actors,
      route,
      waypointOrder,
    };
  }

  /* ── Recalcul d'itinéraire (déclenché par le livreur) ────────── */

  /**
   * Recalcule l'itinéraire si la position du livreur a changé
   * significativement depuis le dernier calcul.
   */
  async recalculateRoute(
    orderId:         string,
    currentDelivery: ICoordinates,
  ): Promise<RouteResult | null> {
    const commande = await this.commandeRepo.findOne({
      where:  { id: orderId },
      select: ['id', 'companyId', 'clientId', 'livreurId'],
    });

    if (!commande) return null;

    const waypoints: ICoordinates[] = [];

    const vendor = await this.getCompanyPosition(commande.companyId);
    if (vendor) waypoints.push({ latitude: vendor.lat, longitude: vendor.lng });

    waypoints.push(currentDelivery);

    const client = await this.getClientPosition(commande.clientId);
    if (client) waypoints.push({ latitude: client.lat, longitude: client.lng });

    if (waypoints.length < 2) return null;

    return this.routeService.getRoute(waypoints);
  }

  /* ── Helpers privés ─────────────────────────────────────────── */

  private async assertAccess(commande: Commande, userId: string): Promise<void> {
    /*
     * Autorise l'accès si l'utilisateur est :
     * - Le client de la commande
     * - Le livreur assigné
     * - L'entreprise vendeuse
     */
    const client = await this.clientRepo.findOne({
      where: { userId },
      select: ['id'],
    });
    if (client && client.id === commande.clientId) return;

    const company = await this.companyRepo.findOne({
      where: { userId },
      select: ['id'],
    });
    if (company && company.id === commande.companyId) return;

    if (commande.livreurId) {
      const delivery = await this.deliveryRepo.findOne({
        where: { userId },
        select: ['id'],
      });
      if (delivery && delivery.id === commande.livreurId) return;
    }

    throw new ForbiddenException('Accès non autorisé à ce suivi de commande.');
  }

  private async getCompanyPosition(companyId: string): Promise<ActorPosition | null> {
    const c = await this.companyRepo.findOne({
      where:  { id: companyId },
      select: ['id', 'companyName', 'latitude', 'longitude', 'adresse', 'ville'] as any,
    });

    if (!c || (c as any).latitude == null || (c as any).longitude == null) return null;

    return {
      id:      c.id,
      name:    c.companyName,
      role:    'vendor',
      lat:     Number((c as any).latitude),
      lng:     Number((c as any).longitude),
      address: [(c as any).adresse, (c as any).ville].filter(Boolean).join(', '),
      isLive:  false,
    };
  }

  private async getDeliveryPosition(livreurId: string): Promise<ActorPosition | null> {
    const d = await this.deliveryRepo.findOne({
      where:  { id: livreurId },
      select: ['id', 'fullName', 'lastLatitude', 'lastLongitude'],
    });

    if (!d || d.lastLatitude == null || d.lastLongitude == null) return null;

    return {
      id:     d.id,
      name:   (d as any).fullName ?? 'Livreur',
      role:   'delivery',
      lat:    Number(d.lastLatitude),
      lng:    Number(d.lastLongitude),
      isLive: true,
    };
  }

  private async getClientPosition(clientId: string): Promise<ActorPosition | null> {
    /* Récupère l'adresse par défaut du client (via userId) */
    const client = await this.clientRepo.findOne({
      where:  { id: clientId },
      select: ['id', 'userId', 'fullName'],
    });

    if (!client) return null;

    const addr = await this.locRepo.findOne({
      where:  { userId: client.userId, estDefaut: true },
      select: ['latitude', 'longitude', 'quartier', 'commune', 'ville'],
    });

    if (!addr || addr.latitude == null || addr.longitude == null) return null;

    const addressStr = [addr.quartier, addr.commune, addr.ville]
      .filter(Boolean).join(', ');

    return {
      id:      client.id,
      name:    (client as any).fullName ?? 'Client',
      role:    'client',
      lat:     Number(addr.latitude),
      lng:     Number(addr.longitude),
      address: addressStr,
      isLive:  false,
    };
  }
}
