/*
 * ⚠️ DOIT ÊTRE LA PREMIÈRE INSTRUCTION DU PROCESSUS.
 *
 * Force le résolveur DNS à retourner les adresses IPv4 en priorité.
 *
 * POURQUOI :
 *   Render (free tier) ne route pas le trafic IPv6 sortant.
 *   Le DNS de Supabase pooler (aws-0-eu-west-1.pooler.supabase.com)
 *   retourne une adresse IPv6 en premier → ENETUNREACH à la connexion.
 *
 *   Placer ceci AVANT tout import garantit qu'AUCUNE connexion réseau
 *   (pg, ioredis, nodemailer…) ne tentera d'abord une IPv6.
 *   L'option `family: 4` dans `extra` TypeORM est insuffisante car elle
 *   s'applique après la résolution DNS (trop tardif).
 *
 * IMPACT : null en production normale (IPv4 est toujours disponible).
 */
import { setDefaultResultOrder } from 'dns';
setDefaultResultOrder('ipv4first');

import { NestFactory }            from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter }              from '@nestjs/platform-socket.io';
import cookieParser               from 'cookie-parser';
import compression                from 'compression';
import { AppModule }              from './app.module';
import { csrfProtection }         from './common/middleware/csrf.middleware';

const logger = new Logger('Bootstrap');

async function bootstrap() {

  /* ── Application ───────────────────────────────────────────── */
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  /* ── Graceful shutdown (SIGTERM Render) ─────────────────────── */
  app.enableShutdownHooks();

  /* ── Faire confiance au premier proxy (Render) ───────────────
   * Sans ça, req.ip (utilisé par @Ip() pour le rate limiting et les
   * logs d'audit AuthLog) renvoie l'IP interne du load balancer Render
   * pour TOUTES les requêtes — le rate limiting par IP devient partagé
   * entre tous les utilisateurs et les IP loguées sont inexploitables.
   * `1` = ne fait confiance qu'au premier hop (le proxy Render), pas à
   * un en-tête X-Forwarded-For arbitraire plus loin dans la chaîne. */
  app.set('trust proxy', 1);

  /* ── CORS ──────────────────────────────────────────────────────
   * DOIT être enregistré AVANT tout middleware capable de court-
   * circuiter la requête (csrfProtection notamment). Un middleware
   * Express répond dans l'ordre d'enregistrement : si csrfProtection
   * rejette une requête (403) AVANT que le middleware CORS n'ait eu
   * la main, la réponse part sans en-tête Access-Control-Allow-Origin
   * — le navigateur masque alors le vrai 403 derrière une erreur CORS
   * généraliste, impossible à diagnostiquer côté frontend. */
  const rawFrontend = process.env.FRONTEND_URL ?? '';
  const prodOrigins = rawFrontend.split(',').map(s => s.trim()).filter(Boolean);
  const isProd      = process.env.NODE_ENV === 'production';

  /* FIX C4 — Interdire le wildcard CORS en production.
   * Avant : si FRONTEND_URL était vide, allowedOrigins = ['*'] ce qui
   * autorisait toutes les origines même avec credentials:true.
   * Après : crash immédiat si la variable est absente en production. */
  if (isProd && prodOrigins.length === 0) {
    logger.error('FRONTEND_URL non défini en production — démarrage annulé.');
    process.exit(1);
  }

  const allowedOrigins: string[] = isProd
    ? prodOrigins
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000',
       ...prodOrigins];

  app.enableCors({
    origin:         allowedOrigins,
    credentials:    true,
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
    /* Par défaut, fetch() cross-origin ne peut lire qu'une poignée d'en-
     * têtes de réponse "sûrs" (Content-Type, Cache-Control…) — un en-tête
     * personnalisé comme X-CSRF-Token doit être explicitement exposé ici,
     * sinon response.headers.get('X-CSRF-Token') renvoie toujours null
     * côté frontend, même si le serveur l'envoie bien (voir
     * csrf.middleware.ts pour pourquoi ce canal est nécessaire en prod). */
    exposedHeaders: ['X-CSRF-Token'],
  });

  /* ── Compression gzip/brotli des réponses ─────────────────────
   * Aucune compression n'était appliquée : chaque réponse JSON
   * (listes de produits, boutiques…) partait en clair sur le réseau.
   * `filter` exclut les réponses SSE/stream (Content-Type text/event-
   * stream) où la compression casserait le flux. */
  app.use(compression({
    filter: (req, res) => {
      if (res.getHeader('Content-Type')?.toString().includes('text/event-stream')) return false;
      return compression.filter(req, res);
    },
  }));

  /* ── Cookie parser (lecture de req.cookies pour JwtStrategy) ── */
  app.use(cookieParser());

  /* ── CSRF (double-submit cookie) — défense en profondeur ──────
   * Doit être APRÈS cookieParser (a besoin de req.cookies) et AVANT
   * les routes. Voir csrf.middleware.ts pour le détail du modèle
   * de risque et pourquoi c'est nécessaire malgré sameSite. */
  app.use(csrfProtection(isProd));

  /* ── Validation globale des DTO ─────────────────────────────── */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      transform:            true,
      forbidNonWhitelisted: true,
      transformOptions:     { enableImplicitConversion: true },
    }),
  );

  /* ── WebSocket ─────────────────────────────────────────────── */
  app.useWebSocketAdapter(new IoAdapter(app));

  /* ── Préfixe global ─────────────────────────────────────────── */
  app.setGlobalPrefix('api');

  /* ── Port & host ────────────────────────────────────────────── */
  const port = parseInt(process.env.PORT ?? (isProd ? '3000' : '3001'), 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Backend running on port ${port}`);
  logger.log(`   NODE_ENV : ${process.env.NODE_ENV ?? 'development'}`);
  logger.log(`   DNS      : IPv4 preferred (Render compatibility)`);
}

bootstrap().catch(err => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
