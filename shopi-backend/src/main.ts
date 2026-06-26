import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useWebSocketAdapter(new IoAdapter(app));

  const rawFrontendUrl = process.env.FRONTEND_URL ?? '';
  const prodOrigins = rawFrontendUrl
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const allowedOrigins =
    process.env.NODE_ENV === 'production'
      ? prodOrigins
      : ['http://localhost:5173', 'http://localhost:5174'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix('api');

  const port = parseInt(process.env.PORT!, 10);
  const host = '0.0.0.0';

  await app.listen(port, host);

  logger.log(`🚀 Backend running on http://${host}:${port}/api`);
  logger.log(`   Environment: ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap().catch(err => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});