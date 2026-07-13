/**
 * ============================================================
 * FICHIER : src/modules/messagerie/services/presence.service.ts
 *
 * RÔLE : Gestion de la présence en ligne des utilisateurs
 *        via Redis (O(1), TTL natif, compatible multi-instances).
 *
 * POURQUOI REDIS PLUTÔT QUE MySQL :
 *   • MySQL n'a pas de TTL natif → cron job nécessaire
 *   • Redis SET/GET = O(1) contre SELECT = O(log n)
 *   • Redis survit aux crashs serveur (RDB/AOF)
 *   • Redis pub/sub permet la sync multi-serveurs
 *
 * STRUCTURE DES CLÉS :
 *   presence:{userId}         → UserPresence JSON (TTL 45s)
 *   presence:sockets:{userId} → SSET des socketIds actifs
 *
 * STRATÉGIE :
 *   - Connexion socket  → SETEX presence:* TTL 45s + SADD sockets
 *   - Heartbeat 30s     → SETEX rafraîchit le TTL
 *   - Déconnexion       → SREM sockets ; si SCARD=0 → DEL presence
 *   - TTL 45s > 30s     → garde en ligne même si heartbeat manque 1 fois
 * ============================================================
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRedis }  from '@nestjs-modules/ioredis';
import type { Redis }   from 'ioredis';
import type { UserPresence } from '../interfaces/messaging.interfaces';

/** Durée (secondes) avant qu'un utilisateur soit considéré hors-ligne */
const PRESENCE_TTL_S = 45;

/** Préfixe Redis pour les clés de présence */
const KEY_PRESENCE = (userId: string) => `presence:${userId}`;
const KEY_SOCKETS  = (userId: string) => `presence:sockets:${userId}`;

@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  // ─────────────────────────────────────────────────────────
  // CONNEXION
  // ─────────────────────────────────────────────────────────

  /**
   * Enregistre un socket actif pour userId.
   * Définit la présence comme "en ligne" avec TTL.
   */
  async onConnect(userId: string, socketId: string): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();

      // Ajoute le socketId dans un Set pour tracking multi-appareils
      pipeline.sadd(KEY_SOCKETS(userId), socketId);

      // Définit la présence avec TTL auto-expirante
      const presence: UserPresence = {
        online:   true,
        lastSeen: new Date().toISOString(),
        sockets:  0,  // mis à jour en dessous
      };

      pipeline.setex(
        KEY_PRESENCE(userId),
        PRESENCE_TTL_S,
        JSON.stringify(presence),
      );

      await pipeline.exec();

      // Met à jour le compteur sockets dans la clé présence
      await this.refreshPresence(userId);

      this.logger.debug(`[Presence] ONLINE userId=${userId} socket=${socketId}`);
    } catch (err) {
      // Redis indisponible : la connexion socket reste valide, on dégrade
      // simplement le tracking de présence sans faire planter le gateway.
      this.logger.warn(`[Presence] Redis indisponible (onConnect userId=${userId}) : ${(err as Error).message}`);
    }
  }

  // ─────────────────────────────────────────────────────────
  // DÉCONNEXION
  // ─────────────────────────────────────────────────────────

  /**
   * Retire un socket du Set actif.
   * Si le Set est vide → utilisateur hors ligne (lastSeen mis à jour).
   *
   * Retourne true si l'utilisateur est maintenant hors ligne
   * (utile pour broadcaster l'événement offline).
   */
  async onDisconnect(userId: string, socketId: string): Promise<boolean> {
    try {
      // Retire le socket du Set
      await this.redis.srem(KEY_SOCKETS(userId), socketId);

      // Compte les sockets restants
      const remaining = await this.redis.scard(KEY_SOCKETS(userId));

      if (remaining === 0) {
        // Plus aucun socket → passe hors ligne
        const presence: UserPresence = {
          online:   false,
          lastSeen: new Date().toISOString(),
          sockets:  0,
        };

        // Garde la clé 24h pour afficher "vu il y a Xh" côté client
        await this.redis.setex(
          KEY_PRESENCE(userId),
          60 * 60 * 24,
          JSON.stringify(presence),
        );

        this.logger.debug(`[Presence] OFFLINE userId=${userId}`);
        return true;
      }

      // Encore des sockets actifs — rafraîchit le TTL
      await this.refreshPresence(userId);
      return false;
    } catch (err) {
      // Redis indisponible : on n'empêche jamais la déconnexion du socket.
      this.logger.warn(`[Presence] Redis indisponible (onDisconnect userId=${userId}) : ${(err as Error).message}`);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // HEARTBEAT
  // ─────────────────────────────────────────────────────────

  /**
   * Appelé depuis le gateway toutes les 30s pour maintenir
   * la présence en vie (rafraîchit le TTL Redis).
   */
  async heartbeat(userId: string): Promise<void> {
    try {
      await this.refreshPresence(userId);
    } catch (err) {
      this.logger.warn(`[Presence] Redis indisponible (heartbeat userId=${userId}) : ${(err as Error).message}`);
    }
  }

  // ─────────────────────────────────────────────────────────
  // LECTURE
  // ─────────────────────────────────────────────────────────

  /**
   * Retourne la présence d'un utilisateur.
   * Null si jamais connecté (aucune clé Redis).
   */
  async getPresence(userId: string): Promise<UserPresence | null> {
    try {
      const raw = await this.redis.get(KEY_PRESENCE(userId));
      if (!raw) return null;
      return JSON.parse(raw) as UserPresence;
    } catch {
      return null;
    }
  }

  /**
   * Vérifie si un utilisateur est en ligne (helper rapide).
   * Retourne false si Redis est indisponible.
   */
  async isOnline(userId: string): Promise<boolean> {
    try {
      const presence = await this.getPresence(userId);
      return presence?.online === true;
    } catch {
      return false;
    }
  }

  /**
   * Retourne la présence de plusieurs utilisateurs en un seul
   * appel Redis pipeline (batch) — optimisation N+1.
   * Retourne tous null si Redis est indisponible.
   */
  async getBulkPresence(
    userIds: string[],
  ): Promise<Map<string, UserPresence | null>> {
    if (userIds.length === 0) return new Map();

    try {
      const pipeline = this.redis.pipeline();
      userIds.forEach(id => pipeline.get(KEY_PRESENCE(id)));

      const results = await pipeline.exec();
      const map     = new Map<string, UserPresence | null>();

      userIds.forEach((id, i) => {
        const raw = results?.[i]?.[1] as string | null;
        try {
          map.set(id, raw ? (JSON.parse(raw) as UserPresence) : null);
        } catch {
          map.set(id, null);
        }
      });

      return map;
    } catch {
      /* Redis indisponible → tous hors-ligne par défaut */
      const map = new Map<string, UserPresence | null>();
      userIds.forEach(id => map.set(id, null));
      return map;
    }
  }

  // ─────────────────────────────────────────────────────────
  // INTERNAL
  // ─────────────────────────────────────────────────────────

  private async refreshPresence(userId: string): Promise<void> {
    const socketCount = await this.redis.scard(KEY_SOCKETS(userId));

    const presence: UserPresence = {
      online:   socketCount > 0,
      lastSeen: new Date().toISOString(),
      sockets:  socketCount,
    };

    await this.redis.setex(
      KEY_PRESENCE(userId),
      PRESENCE_TTL_S,
      JSON.stringify(presence),
    );
  }

  // ─────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────

  async onModuleDestroy(): Promise<void> {
    // Nettoyage propre si le module est détruit (redémarrage Kubernetes)
    this.logger.log('[Presence] Module détruit — nettoyage Redis ignoré (TTL auto)');
  }
}
