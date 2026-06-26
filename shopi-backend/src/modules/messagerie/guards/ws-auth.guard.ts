/**
 * ============================================================
 * FICHIER : src/modules/messagerie/guards/ws-auth.guard.ts
 *
 * RÔLE : Guard WebSocket qui vérifie le token JWT à la
 *        connexion Socket.IO. Injecte userId, actorType et
 *        actorId dans socket.data pour usage downstream.
 *
 * POURQUOI UN GUARD SÉPARÉ :
 *   • Séparer l'authentification de la logique métier (SRP)
 *   • Réutilisable par tout gateway NestJS
 *   • Déconnexion propre si token invalide
 *
 * FONCTIONNEMENT :
 *   1. Extrait le token depuis auth.token, query.token ou
 *      headers.authorization
 *   2. Vérifie signature JWT avec JwtService
 *   3. Injecte les données dans socket.data
 *   4. Retourne false → NestJS refuse la connexion
 * ============================================================
 */

import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService }  from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException }  from '@nestjs/websockets';
import type { Socket }  from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(
    private readonly jwt:    JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const socket: Socket = context.switchToWs().getClient<Socket>();

    const token = this.extractToken(socket);

    if (!token) {
      this.logger.warn(`[WsAuth] Connexion refusée — token absent (socket=${socket.id})`);
      throw new WsException('Authentification requise.');
    }

    try {
      const secret  = this.config.get<string>('JWT_SECRET');
      const payload = this.jwt.verify<{
        sub:    string;
        role:   string;
        userId: string;
      }>(token, { secret });

      /*
       * Injecte dans socket.data pour être accessible partout
       * dans le gateway sans repasser par l'injection.
       * userId = sub du JWT (UUID utilisateur).
       */
      socket.data.userId    = payload.sub ?? payload.userId;
      socket.data.userRole  = payload.role;

      return true;
    } catch {
      this.logger.warn(`[WsAuth] Token invalide socket=${socket.id}`);
      throw new WsException('Token invalide ou expiré.');
    }
  }

  // ── Extraction token depuis différentes sources ────────────

  private extractToken(socket: Socket): string | null {
    // 1. handshake.auth.token (recommandé — côté client socket.io)
    const authToken = socket.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;

    // 2. query string (compatibilité navigateurs anciens)
    const queryToken = socket.handshake.query?.token;
    if (queryToken) return Array.isArray(queryToken) ? queryToken[0] : queryToken;

    // 3. Header Authorization: Bearer <token>
    const headerAuth = socket.handshake.headers?.authorization;
    if (headerAuth?.startsWith('Bearer ')) return headerAuth.slice(7);

    return null;
  }
}
