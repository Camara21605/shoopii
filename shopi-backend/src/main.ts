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
import { IoAdapter }              from '@nestjs/platform-socket.io';
import cookieParser               from 'cookie-parser';
import { AppModule }              from './app.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {

  /* ── Application ───────────────────────────────────────────── */
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  /* ── Graceful shutdown (SIGTERM Render) ─────────────────────── */
  app.enableShutdownHooks();

  /* ── Cookie parser (lecture de req.cookies pour JwtStrategy) ── */
  app.use(cookieParser());

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

  /* ── CORS ──────────────────────────────────────────────────── */
  const rawFrontend = process.env.FRONTEND_URL ?? '';
  const prodOrigins = rawFrontend.split(',').map(s => s.trim()).filter(Boolean);
  const isProd      = process.env.NODE_ENV === 'production';

  const allowedOrigins: string[] = isProd
    ? (prodOrigins.length > 0 ? prodOrigins : ['*'])
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000',
       ...prodOrigins];

  app.enableCors({
    origin:         allowedOrigins,
    credentials:    true,
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

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
