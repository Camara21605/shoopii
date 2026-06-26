/* ============================================================
 * FICHIER : src/modules/location/gateways/location.gateway.ts
 *
 * RÔLE : Gateway Socket.IO temps réel pour le suivi de position.
 *
 * NAMESPACE : /location  (isolé de /suivis et /messaging)
 *
 * ROOMS :
 *   delivery:{deliveryId}  → position d'un livreur spécifique
 *   order:{orderId}        → suivi commande en cours
 *
 * EVENTS CLIENT → SERVEUR :
 *   location:update        → livreur envoie sa position GPS
 *   location:start-sharing → livreur démarre le partage
 *   location:stop-sharing  → livreur arrête le partage
 *   location:subscribe     → client/entreprise s'abonne à un livreur
 *   location:unsubscribe   → client/entreprise se désabonne
 *
 * EVENTS SERVEUR → CLIENT :
 *   location:position      → nouvelle position du livreur
 *   location:sharing-on    → le livreur a démarré le partage
 *   location:sharing-off   → le livreur a arrêté le partage
 *   location:connected     → handshake confirmé
 *
 * OPTIMISATION :
 *   - Seules les positions significativement différentes sont émises
 *   - Throttle configurable par socket
 *   - Reconnexion automatique côté client
 * ============================================================ */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger }                 from '@nestjs/common';
import { Server, Socket }         from 'socket.io';
import { JwtService }             from '@nestjs/jwt';
import { ConfigService }          from '@nestjs/config';
import { InjectRepository }       from '@nestjs/typeorm';
import { Repository }             from 'typeorm';
import { v4 as uuid }             from 'uuid';

import { Delivery }               from '../../../database/entities/profiles/livreur-profile.entity';
import { LocationHistory }        from '../../../database/entities/location/location-history.entity';
import { GeoService }             from '../services/geo.service';
import type { ILocationUpdatePayload } from '../interfaces/location.interfaces';

/** Intervalle minimum entre deux émissions par livreur (ms) */
const THROTTLE_MS = 1_000;

/** Seuil de déplacement minimal avant émission (mètres) */
const MIN_MOVE_M  = 5;

interface SocketData {
  userId:     string;
  deliveryId: string | null;
  sessionId:  string | null;
}

interface SharingSession {
  sessionId:  string;
  deliveryId: string;
  startedAt:  Date;
  lastLat:    number;
  lastLng:    number;
  lastEmit:   number;       // timestamp ms
}

@WebSocketGateway({
  namespace: '/location',
  cors: {
    origin:      true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class LocationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LocationGateway.name);

  /** Sessions actives : Map<socketId, SharingSession> */
  private readonly sessions = new Map<string, SharingSession>();

  constructor(
    private readonly jwt:       JwtService,
    private readonly config:    ConfigService,
    private readonly geo:       GeoService,

    @InjectRepository(Delivery)
    private readonly delivRepo: Repository<Delivery>,

    @InjectRepository(LocationHistory)
    private readonly histRepo:  Repository<LocationHistory>,
  ) {}

  /* ── Init ─────────────────────────────────────────────────── */

  afterInit(): void {
    this.logger.log('📍 Gateway /location initialisée');
  }

  /* ── Connexion ───────────────────────────────────────────── */

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token =
        socket.handshake.auth?.token as string ||
        (socket.handshake.query?.token as string) ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) return void socket.disconnect();

      let payload: { sub: string; role: string };
      try {
        payload = this.jwt.verify(token, {
          secret: this.config.get<string>('JWT_SECRET'),
        });
      } catch {
        return void socket.disconnect();
      }

      socket.data.userId = payload.sub;
      socket.data.deliveryId = null;
      socket.data.sessionId  = null;

      // Si livreur → retrouver son profil
      if (payload.role === 'delivery') {
        const delivery = await this.delivRepo.findOne({
          where:  { userId: payload.sub },
          select: ['id'],
        });
        if (delivery) {
          socket.data.deliveryId = delivery.id;
          await socket.join(`delivery:${delivery.id}`);
        }
      }

      await socket.join(`user:${payload.sub}`);

      socket.emit('location:connected', {
        userId:   payload.sub,
        socketId: socket.id,
        ts:       new Date().toISOString(),
      });

      this.logger.log(`📍 Connecté user=${payload.sub} socket=${socket.id}`);
    } catch {
      socket.disconnect();
    }
  }

  /* ── Déconnexion ─────────────────────────────────────────── */

  async handleDisconnect(socket: Socket): Promise<void> {
    const deliveryId = socket.data?.deliveryId;
    if (deliveryId && this.sessions.has(socket.id)) {
      const session = this.sessions.get(socket.id)!;
      this.sessions.delete(socket.id);
      this.server.to(`delivery:${deliveryId}`).emit('location:sharing-off', {
        deliveryId,
        sessionId: session.sessionId,
        ts: new Date().toISOString(),
      });
    }
    this.logger.log(`📍 Déconnecté socket=${socket.id}`);
  }

  /* ── EVENTS CLIENT → SERVEUR ─────────────────────────────── */

  /**
   * Le livreur démarre le partage de sa position.
   * Crée une session et rejoint la room dédiée.
   */
  @SubscribeMessage('location:start-sharing')
  async handleStartSharing(
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const deliveryId = socket.data?.deliveryId;
    if (!deliveryId) return;

    const sessionId = uuid();
    socket.data.sessionId = sessionId;

    this.sessions.set(socket.id, {
      sessionId,
      deliveryId,
      startedAt: new Date(),
      lastLat:   0,
      lastLng:   0,
      lastEmit:  0,
    });

    this.server.to(`delivery:${deliveryId}`).emit('location:sharing-on', {
      deliveryId,
      sessionId,
      ts: new Date().toISOString(),
    });

    this.logger.log(`📍 START SHARING deliveryId=${deliveryId} session=${sessionId}`);
  }

  /**
   * Le livreur arrête le partage.
   */
  @SubscribeMessage('location:stop-sharing')
  async handleStopSharing(
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const deliveryId = socket.data?.deliveryId;
    const session    = this.sessions.get(socket.id);
    if (!deliveryId || !session) return;

    this.sessions.delete(socket.id);
    socket.data.sessionId = null;

    this.server.to(`delivery:${deliveryId}`).emit('location:sharing-off', {
      deliveryId,
      sessionId: session.sessionId,
      ts: new Date().toISOString(),
    });

    this.logger.log(`📍 STOP SHARING deliveryId=${deliveryId}`);
  }

  /**
   * Le livreur envoie sa position GPS.
   * Throttling + filtre de mouvement significatif.
   */
  @SubscribeMessage('location:update')
  async handleLocationUpdate(
    @ConnectedSocket() socket: Socket,
    @MessageBody()    payload: ILocationUpdatePayload,
  ): Promise<void> {
    const deliveryId = socket.data?.deliveryId;
    const session    = this.sessions.get(socket.id);
    if (!deliveryId || !session) return;

    const now = Date.now();

    // Throttle : pas plus d'une mise à jour par seconde
    if (now - session.lastEmit < THROTTLE_MS) return;

    // Mouvement significatif : > 5 mètres
    if (
      session.lastLat !== 0 &&
      !this.geo.isSignificantMove(
        { latitude: session.lastLat, longitude: session.lastLng },
        { latitude: payload.latitude, longitude: payload.longitude },
        MIN_MOVE_M,
      )
    ) return;

    // Mise à jour de la session
    session.lastLat  = payload.latitude;
    session.lastLng  = payload.longitude;
    session.lastEmit = now;

    // Met à jour la position en base
    await this.delivRepo.update(deliveryId, {
      lastLatitude:  payload.latitude,
      lastLongitude: payload.longitude,
    } as any);

    // Enregistre l'historique
    await this.histRepo.save(
      this.histRepo.create({
        deliveryId,
        latitude:   payload.latitude,
        longitude:  payload.longitude,
        precisionM: payload.precisionM ?? null,
        cap:        payload.cap        ?? null,
        vitesseKmh: payload.vitesseKmh ?? null,
        sessionId:  session.sessionId,
        horodatage: payload.horodatage ? new Date(payload.horodatage) : new Date(),
      }),
    );

    // Broadcast aux abonnés de la room delivery:{deliveryId}
    this.server.to(`delivery:${deliveryId}`).emit('location:position', {
      deliveryId,
      latitude:   payload.latitude,
      longitude:  payload.longitude,
      precisionM: payload.precisionM,
      cap:        payload.cap,
      vitesseKmh: payload.vitesseKmh,
      sessionId:  session.sessionId,
      ts:         payload.horodatage ?? new Date().toISOString(),
    });
  }

  /**
   * Un client ou une entreprise s'abonne aux mises à jour d'un livreur.
   */
  @SubscribeMessage('location:subscribe')
  async handleSubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody()    body: { deliveryId: string },
  ): Promise<void> {
    if (!body?.deliveryId) return;
    const room = `delivery:${body.deliveryId}`;
    await socket.join(room);
    this.logger.debug(`📍 Subscribe socket=${socket.id} → room=${room}`);
  }

  /**
   * Se désabonner d'un livreur.
   */
  @SubscribeMessage('location:unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody()    body: { deliveryId: string },
  ): Promise<void> {
    if (!body?.deliveryId) return;
    await socket.leave(`delivery:${body.deliveryId}`);
  }

  /* ── API interne (appelée depuis autres services) ───────── */

  /** Diffuse une position depuis l'extérieur du gateway (ex: REST fallback) */
  broadcastPosition(
    deliveryId: string,
    lat:        number,
    lng:        number,
    extra?:     Record<string, unknown>,
  ): void {
    this.server.to(`delivery:${deliveryId}`).emit('location:position', {
      deliveryId,
      latitude:  lat,
      longitude: lng,
      ts:        new Date().toISOString(),
      ...extra,
    });
  }

  isSharing(deliveryId: string): boolean {
    for (const s of this.sessions.values()) {
      if (s.deliveryId === deliveryId) return true;
    }
    return false;
  }
}
