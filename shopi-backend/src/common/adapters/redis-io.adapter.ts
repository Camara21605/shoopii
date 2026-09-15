/* ============================================================
 * FICHIER : src/common/adapters/redis-io.adapter.ts
 *
 * RÔLE : Adaptateur Socket.IO branché sur Redis pub/sub.
 *
 * POURQUOI
 * ------------------------------------------------------------
 * Par défaut, Socket.IO gère les rooms et le broadcast EN MÉMOIRE,
 * local au process Node.js. Tant que le backend tourne sur une
 * seule instance Render, ça fonctionne parfaitement. Mais dès
 * qu'une 2e instance est lancée (montée en charge), un client
 * connecté à l'instance A et un client connecté à l'instance B
 * ne peuvent plus se voir : chaque instance ignore les sockets
 * de l'autre. Résultat, silencieux et intermittent selon sur
 * quelle instance chaque utilisateur atterrit : messages,
 * indicateurs "typing" et accusés de lecture qui n'arrivent
 * jamais à certains utilisateurs.
 *
 * Cet adaptateur fait transiter rooms + broadcasts par Redis
 * pub/sub : toutes les instances publient/écoutent sur les mêmes
 * canaux, donc un événement émis par l'instance A atteint bien
 * les sockets de l'instance B. S'applique automatiquement à TOUS
 * les namespaces (/messaging, /suivis, /support, /notifications,
 * /location, /calls) car il remplace l'adaptateur par défaut au
 * niveau du serveur Socket.IO global.
 *
 * On réutilise le client ioredis DÉJÀ configuré par RedisModule
 * (host/port/password/TLS/family:4 — voir app.module.ts) plutôt
 * que d'en recréer un, pour ne jamais désynchroniser cette config
 * réseau spécifique à Render. Un abonné Redis dédié est requis en
 * plus (`.duplicate()`) car une connexion en mode SUBSCRIBE ne
 * peut plus exécuter aucune autre commande.
 * ============================================================ */

import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { ServerOptions } from 'socket.io';

const logger = new Logger('RedisIoAdapter');

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(private readonly appContext: INestApplicationContext) {
    super(appContext);
  }

  async connectToRedis(): Promise<void> {
    const pubClient = this.appContext.get<Redis>(getRedisConnectionToken());
    const subClient = pubClient.duplicate();

    subClient.on('error', (err) =>
      logger.error(`Connexion Redis (subscriber Socket.IO) en erreur: ${err.message}`),
    );

    this.adapterConstructor = createAdapter(pubClient, subClient);
    logger.log('✅ Adaptateur Redis Socket.IO connecté — rooms/broadcasts partagés entre instances.');
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    } else {
      logger.warn('Adaptateur Redis non initialisé (connectToRedis() non appelé) — Socket.IO reste en mémoire locale, ne fonctionnera correctement que sur une seule instance.');
    }
    return server;
  }
}
