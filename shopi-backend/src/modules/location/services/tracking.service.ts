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

import { Commande, LivreurAssignmentStatus } from '../../../database/entities/commande/commande.entity';
import { CommandeCode, CodeActeurType, CodeCommandeStatus } from '../../../database/entities/commande/commande-code.entity';
import { Client }        from '../../../database/entities/profiles/client-profile.entity';
import { Company }       from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../database/entities/profiles/correspondant-profile.entity';
import { Localisation }  from '../../../database/entities/localisation.entity';

import { RouteService }  from './route.service';
import type { RouteResult } from './route.service';
import type { ICoordinates } from '../interfaces/location.interfaces';

/* ── Types de réponse ───────────────────────────────────────── */

export interface ActorPosition {
  id:       string;
  name:     string;
  /* 'correspondent' = position FIXE du dépôt/point relais (jamais "live"
   * comme le livreur — un correspondant ne bouge pas, seul son dépôt a
   * des coordonnées GPS enregistrées, voir CorrespondantLocationService). */
  role:     'vendor' | 'delivery' | 'client' | 'correspondent';
  lat:      number;
  lng:      number;
  address?: string;
  isLive:   boolean;   // true = mis à jour en temps réel (livreur)
}

/**
 * Trois tronçons distincts, colorés selon l'étape de la livraison :
 *   - livreurToShop   (rouge) — le livreur doit encore récupérer le colis
 *   - shopToClient    (vert)  — trajet de référence boutique → client, toujours affiché
 *   - livreurToClient (bleu)  — le livreur a récupéré le colis, en route vers le client
 */
export interface OrderTrackingRoutes {
  livreurToShop:   RouteResult | null;
  shopToClient:    RouteResult | null;
  livreurToClient: RouteResult | null;
}

export interface OrderTrackingResult {
  orderId:  string;
  numero:   string;
  status:   string;
  actors:   ActorPosition[];
  /** true = le livreur a déjà validé son code (colis récupéré en boutique) */
  livreurPickedUp: boolean;
  routes:   OrderTrackingRoutes;
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

    @InjectRepository(Correspondent)
    private readonly correspondantRepo: Repository<Correspondent>,

    @InjectRepository(Localisation)
    private readonly locRepo: Repository<Localisation>,

    @InjectRepository(CommandeCode)
    private readonly codeRepo: Repository<CommandeCode>,

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
      select: ['id', 'numero', 'status', 'clientId', 'companyId', 'livreurId', 'livreurAssignmentStatus', 'correspondantId'],
    });

    if (!commande) {
      throw new NotFoundException(`Commande introuvable (${orderId}).`);
    }

    /* ── 2. Vérifier l'accès (client, livreur, entreprise ou correspondant) ─── */
    await this.assertAccess(commande, userId);

    /* ── 3. Collecter les positions ───────────────────────────
     * Le livreur n'est inclus que s'il a réellement accepté la
     * mission — sinon sa dernière position connue (mission
     * précédente) resterait affichée à tort. */
    const actors: ActorPosition[] = [];

    const vendorPos = await this.getCompanyPosition(commande.companyId);
    if (vendorPos) actors.push(vendorPos);

    let deliveryPos: ActorPosition | null = null;
    let livreurPickedUp = false;
    if (commande.livreurId && commande.livreurAssignmentStatus === LivreurAssignmentStatus.ACCEPTED) {
      deliveryPos = await this.getDeliveryPosition(commande.livreurId);
      if (deliveryPos) actors.push(deliveryPos);

      const livreurCode = await this.codeRepo.findOne({
        where: { commandeId: commande.id, acteurType: CodeActeurType.LIVREUR },
      });
      livreurPickedUp = livreurCode?.status === CodeCommandeStatus.VALIDATED;
    }

    const clientPos = await this.getClientPosition(commande.clientId);
    if (clientPos) actors.push(clientPos);

    /* Correspondant (point relais) — position FIXE de son dépôt, affichée
     * dès qu'un correspondant est réellement impliqué dans la commande
     * (mode CORRESPONDANT ou MIXTE). Contrairement au livreur, il n'y a
     * pas de notion d'acceptation à vérifier ici : le correspondant a
     * déjà été choisi/impliqué en amont (voir commande.correspondantId). */
    if (commande.correspondantId) {
      const correspondantPos = await this.getCorrespondantPosition(commande.correspondantId);
      if (correspondantPos) actors.push(correspondantPos);
    }

    /* ── 4. Calculer les 3 tronçons colorés ───────────────────
     *   rouge : livreur → boutique  (avant récupération du colis)
     *   vert  : boutique → client   (trajet de référence, toujours)
     *   bleu  : livreur → client    (après récupération du colis)     */
    const routes: OrderTrackingRoutes = {
      livreurToShop:   null,
      shopToClient:    null,
      livreurToClient: null,
    };

    if (vendorPos && clientPos) {
      routes.shopToClient = await this.safeRoute(commande.numero, 'boutique→client', [
        { latitude: vendorPos.lat, longitude: vendorPos.lng },
        { latitude: clientPos.lat, longitude: clientPos.lng },
      ]);
    }

    if (deliveryPos && vendorPos && !livreurPickedUp) {
      routes.livreurToShop = await this.safeRoute(commande.numero, 'livreur→boutique', [
        { latitude: deliveryPos.lat, longitude: deliveryPos.lng },
        { latitude: vendorPos.lat,   longitude: vendorPos.lng },
      ]);
    }

    if (deliveryPos && clientPos && livreurPickedUp) {
      routes.livreurToClient = await this.safeRoute(commande.numero, 'livreur→client', [
        { latitude: deliveryPos.lat, longitude: deliveryPos.lng },
        { latitude: clientPos.lat,   longitude: clientPos.lng },
      ]);
    }

    return {
      orderId: commande.id,
      numero:  commande.numero,
      status:  commande.status,
      actors,
      livreurPickedUp,
      routes,
    };
  }

  /** Calcule un itinéraire entre 2 points sans jamais faire échouer le tracking global. */
  private async safeRoute(numero: string, label: string, waypoints: ICoordinates[]): Promise<RouteResult | null> {
    try {
      const route = await this.routeService.getRoute(waypoints);
      this.logger.debug(`[Tracking] ${numero} — ${label} via ${route.provider} (${route.totalDistanceTxt})`);
      return route;
    } catch (err: any) {
      this.logger.warn(`[Tracking] ${numero} — ${label} échoué: ${err.message}`);
      return null;
    }
  }

  /* ── Helpers privés ─────────────────────────────────────────── */

  private async assertAccess(commande: Commande, userId: string): Promise<void> {
    /*
     * Autorise l'accès si l'utilisateur est :
     * - Le client de la commande
     * - Le livreur assigné
     * - L'entreprise vendeuse
     * - Le correspondant impliqué (point relais) — ajouté pour que la
     *   carte de suivi soit visible par CHAQUE acteur réellement
     *   concerné par la commande, pas seulement client/entreprise/livreur.
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

    if (commande.correspondantId) {
      const correspondant = await this.correspondantRepo.findOne({
        where: { userId },
        select: ['id'],
      });
      if (correspondant && correspondant.id === commande.correspondantId) return;
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

  /** Position FIXE du dépôt/point relais du correspondant — jamais "live",
   *  contrairement au livreur qui envoie sa position en continu via socket. */
  private async getCorrespondantPosition(correspondantId: string): Promise<ActorPosition | null> {
    const c = await this.correspondantRepo.findOne({
      where:  { id: correspondantId },
      select: ['id', 'fullName', 'depotLatitude', 'depotLongitude', 'depotAdresse', 'depotVille'] as any,
    });

    if (!c || (c as any).depotLatitude == null || (c as any).depotLongitude == null) return null;

    return {
      id:      c.id,
      name:    (c as any).fullName ?? 'Correspondant',
      role:    'correspondent',
      lat:     Number((c as any).depotLatitude),
      lng:     Number((c as any).depotLongitude),
      address: [(c as any).depotAdresse, (c as any).depotVille].filter(Boolean).join(', '),
      isLive:  false,
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
