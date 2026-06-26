import { NestFactory }             from '@nestjs/core';
import { ValidationPipe, Logger }  from '@nestjs/common';
import { IoAdapter }               from '@nestjs/platform-socket.io';
import { AppModule }               from './app.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {

  /* ── Création de l'application ─────────────────────────────── */
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  /* ── Graceful shutdown (SIGTERM Render) ────────────────────── */
  app.enableShutdownHooks();

  /* ── Validation globale des DTO ────────────────────────────── */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      transform:            true,
      forbidNonWhitelisted: true,
      transformOptions:     { enableImplicitConversion: true },
    }),
  );

  /* ── WebSocket adapter ─────────────────────────────────────── */
  app.useWebSocketAdapter(new IoAdapter(app));

  /* ── CORS ─────────────────────────────────────────────────── */
  /*
   * FRONTEND_URL peut contenir plusieurs origines séparées par ","
   * Exemples :
   *   FRONTEND_URL=https://shopi.vercel.app
   *   FRONTEND_URL=https://shopi.vercel.app,https://shopi.gn
   *
   * En développement → localhost Vite autorisé en plus.
   * En production    → uniquement les origines déclarées dans FRONTEND_URL.
   */
  const rawFrontend  = process.env.FRONTEND_URL ?? '';
  const prodOrigins  = rawFrontend.split(',').map(s => s.trim()).filter(Boolean);
  const isProd       = process.env.NODE_ENV === 'production';

  const allowedOrigins: string[] = isProd
    ? (prodOrigins.length > 0 ? prodOrigins : ['*'])   // '*' si FRONTEND_URL oublié
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000',
       ...prodOrigins];

  app.enableCors({
    origin:         allowedOrigins,
    credentials:    true,
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  /* ── Préfixe global ────────────────────────────────────────── */
  app.setGlobalPrefix('api');

  /* ── Port & host ───────────────────────────────────────────── */
  /*
   * Render injecte automatiquement PORT.
   * Fallback 3000 en production, 3001 en dev.
   * On écoute sur 0.0.0.0 (obligatoire pour les conteneurs).
   */
  const port = parseInt(process.env.PORT ?? (isProd ? '3000' : '3001'), 10);
  const host = '0.0.0.0';

  await app.listen(port, host);

  logger.log(`🚀 Backend running on http://${host}:${port}/api`);
  logger.log(`   NODE_ENV  : ${process.env.NODE_ENV ?? 'development'}`);
  logger.log(`   CORS      : ${allowedOrigins.join(', ')}`);
}

bootstrap().catch(err => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
