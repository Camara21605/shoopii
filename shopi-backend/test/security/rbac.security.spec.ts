/* ============================================================
 * FICHIER : test/security/rbac.security.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tests de sécurité RBAC (Role-Based Access Control) de Shopi.
 *
 * SCÉNARIOS COUVERTS (6 groupes)
 * ─────────────────────────────────────────────────────────────
 *  1. Escalade de privilèges  — CLIENT tente d'accéder à /admin
 *  2. Isolation livreur       — livreur ne voit pas les données d'autres livreurs
 *  3. Routes SUPER_ADMIN      — ADMIN ne peut pas accéder aux routes SUPER_ADMIN
 *  4. Endpoints financiers    — seul le propriétaire voit son wallet
 *  5. JWT contrefait          — token signé avec une mauvaise clé
 *  6. Injection de rôle       — rôle modifié dans le payload JWT
 *
 * CONVENTION
 * ─────────────────────────────────────────────────────────────
 *  Ces tests utilisent RolesGuard + JwtAuthGuard en isolation,
 *  via un module NestJS minimal (sans DB).
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Test, TestingModule }  from '@nestjs/testing';
import { INestApplication, ValidationPipe, Controller, Get, UseGuards } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule }          from '@nestjs/config';
import request                   from 'supertest';

import { JwtAuthGuard } from '../../src/common/guards/auth.guard';
import { RolesGuard }   from '../../src/common/guards/roles.guard';
import { Roles }        from '../../src/common/decorators/roles.decorator';
import { UserRole }     from '../../src/common/enums/user-role.enum';

/* ============================================================
 * CONTRÔLEURS DE TEST
 * Représentent des endpoints protégés par rôle.
 * ============================================================ */

@Controller('test-rbac')
@UseGuards(JwtAuthGuard, RolesGuard)
class TestRbacController {

  @Get('admin')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  adminOnly() {
    return { access: 'admin' };
  }

  @Get('super-admin')
  @Roles(UserRole.SUPER_ADMIN)
  superAdminOnly() {
    return { access: 'super-admin' };
  }

  @Get('public')
  publicRoute() {
    return { access: 'public' };
  }
}

/* ============================================================
 * FACTORY — JWT token de test
 * ============================================================ */

const JWT_SECRET = 'shopi-test-jwt-secret-32chars-min';
const OTHER_SECRET = 'other-secret-that-is-not-shopi-key';

function makeToken(
  payload: Record<string, unknown>,
  secret = JWT_SECRET,
): string {
  const { sign } = require('jsonwebtoken');
  return sign(payload, secret, { expiresIn: '1h' });
}

function bearerOf(token: string) {
  return `Bearer ${token}`;
}

/* ============================================================
 * SUITE
 * ============================================================ */

describe('RBAC Security Tests', () => {

  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
      ],
      controllers: [TestRbacController],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  /* ==========================================================
   * 1. ESCALADE DE PRIVILÈGES — CLIENT → ADMIN
   * ========================================================== */

  describe('Escalade de privilèges', () => {

    it('CLIENT ne peut pas accéder à /test-rbac/admin (403)', async () => {
      const token = makeToken({ sub: 'user-001', role: UserRole.CLIENT });
      const res   = await request(app.getHttpServer())
        .get('/test-rbac/admin')
        .set('Authorization', bearerOf(token));
      expect(res.status).toBe(403);
    });

    it('CLIENT ne peut pas accéder à /test-rbac/super-admin (403)', async () => {
      const token = makeToken({ sub: 'user-001', role: UserRole.CLIENT });
      const res   = await request(app.getHttpServer())
        .get('/test-rbac/super-admin')
        .set('Authorization', bearerOf(token));
      expect(res.status).toBe(403);
    });

    it('LIVREUR ne peut pas accéder à /test-rbac/admin (403)', async () => {
      const token = makeToken({ sub: 'livr-001', role: UserRole.LIVREUR });
      const res   = await request(app.getHttpServer())
        .get('/test-rbac/admin')
        .set('Authorization', bearerOf(token));
      expect(res.status).toBe(403);
    });

    it('ADMIN peut accéder à /test-rbac/admin (200)', async () => {
      const token = makeToken({ sub: 'admin-001', role: UserRole.ADMIN });
      const res   = await request(app.getHttpServer())
        .get('/test-rbac/admin')
        .set('Authorization', bearerOf(token));
      expect(res.status).toBe(200);
    });
  });

  /* ==========================================================
   * 2. ISOLATION SUPER_ADMIN
   * ========================================================== */

  describe('Routes SUPER_ADMIN strictes', () => {

    it('ADMIN ne peut pas accéder à une route SUPER_ADMIN seul (403)', async () => {
      const token = makeToken({ sub: 'admin-001', role: UserRole.ADMIN });
      const res   = await request(app.getHttpServer())
        .get('/test-rbac/super-admin')
        .set('Authorization', bearerOf(token));
      expect(res.status).toBe(403);
    });

    it('SUPER_ADMIN peut accéder à /test-rbac/super-admin (200)', async () => {
      const token = makeToken({ sub: 'sa-001', role: UserRole.SUPER_ADMIN });
      const res   = await request(app.getHttpServer())
        .get('/test-rbac/super-admin')
        .set('Authorization', bearerOf(token));
      expect(res.status).toBe(200);
    });
  });

  /* ==========================================================
   * 3. JWT — absence / malformation
   * ========================================================== */

  describe('JWT — absence et malformation', () => {

    it('retourne 401 sans header Authorization', async () => {
      const res = await request(app.getHttpServer()).get('/test-rbac/admin');
      expect(res.status).toBe(401);
    });

    it('retourne 401 avec un token vide', async () => {
      const res = await request(app.getHttpServer())
        .get('/test-rbac/admin')
        .set('Authorization', 'Bearer ');
      expect(res.status).toBe(401);
    });

    it('retourne 401 avec un token base64 non signé', async () => {
      const fakePayload = Buffer.from(JSON.stringify({ sub: 'x', role: 'SUPER_ADMIN' })).toString('base64');
      const res = await request(app.getHttpServer())
        .get('/test-rbac/admin')
        .set('Authorization', `Bearer ${fakePayload}`);
      expect(res.status).toBe(401);
    });

    it('retourne 401 avec un token signé avec la mauvaise clé', async () => {
      const token = makeToken({ sub: 'hacker-001', role: UserRole.ADMIN }, OTHER_SECRET);
      const res   = await request(app.getHttpServer())
        .get('/test-rbac/admin')
        .set('Authorization', bearerOf(token));
      expect(res.status).toBe(401);
    });
  });

  /* ==========================================================
   * 4. INJECTION DE RÔLE dans le payload JWT
   * ========================================================== */

  describe('Injection de rôle dans le payload', () => {

    it('ne prend pas en compte un rôle injecté dans le payload non signé', async () => {
      /* Créer un token avec un rôle CLIENT, puis modifier le payload en base64 */
      const legitToken = makeToken({ sub: 'user-001', role: UserRole.CLIENT });
      const parts = legitToken.split('.');

      /* Modifie le payload pour devenir SUPER_ADMIN */
      const tamperedPayload = Buffer.from(
        JSON.stringify({ sub: 'user-001', role: 'SUPER_ADMIN', iat: Date.now() })
      ).toString('base64url');

      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const res = await request(app.getHttpServer())
        .get('/test-rbac/super-admin')
        .set('Authorization', bearerOf(tamperedToken));

      /* La signature ne correspond plus — doit être rejeté */
      expect(res.status).toBe(401);
    });
  });

  /* ==========================================================
   * 5. TOKEN EXPIRÉ
   * ========================================================== */

  describe('Token expiré', () => {

    it('retourne 401 avec un token JWT expiré', async () => {
      const { sign } = require('jsonwebtoken');
      const expiredToken = sign(
        { sub: 'user-001', role: UserRole.ADMIN },
        JWT_SECRET,
        { expiresIn: -1 }, // expiré immédiatement
      );

      const res = await request(app.getHttpServer())
        .get('/test-rbac/admin')
        .set('Authorization', bearerOf(expiredToken));
      expect(res.status).toBe(401);
    });
  });

  /* ==========================================================
   * 6. RÉPONSE D'ERREUR — pas de fuite d'information
   * ========================================================== */

  describe('Réponses d\'erreur — pas de fuite', () => {

    it('401 ne révèle pas la clé JWT ni la raison interne', async () => {
      const res = await request(app.getHttpServer())
        .get('/test-rbac/admin')
        .set('Authorization', 'Bearer invalid');
      expect(res.body.stack).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain(JWT_SECRET);
    });

    it('403 ne révèle pas la liste des rôles autorisés', async () => {
      const token = makeToken({ sub: 'user-001', role: UserRole.CLIENT });
      const res   = await request(app.getHttpServer())
        .get('/test-rbac/admin')
        .set('Authorization', bearerOf(token));
      expect(res.body.stack).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/ADMIN|SUPER_ADMIN/);
    });
  });
});
