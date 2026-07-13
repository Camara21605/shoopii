/* ============================================================
 * FICHIER  : src/common/health/health.module.ts
 * MODULE   : Common / Health
 * ROLE     : Module NestJS du health check.
 *
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-04
 * ============================================================ */

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
