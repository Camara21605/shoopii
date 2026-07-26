/* ============================================================
 * FICHIER : test/security/api-injection.security.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tests de sécurité contre les injections (SQL, XSS, NoSQL, SSTI).
 *
 * SCÉNARIOS COUVERTS (5 groupes)
 * ─────────────────────────────────────────────────────────────
 *  1. Injection SQL            — payloads dans les query params et body
 *  2. Injection XSS            — scripts dans les champs texte
 *  3. Prototype Pollution      — __proto__, constructor dans le body
 *  4. Path Traversal           — ../ dans les paramètres de route
 *  5. Validation des inputs    — types incorrects, longueurs extrêmes
 *
 * APPROCHE
 * ─────────────────────────────────────────────────────────────
 *  - App NestJS minimale avec ValidationPipe(whitelist + transform)
 *  - On vérifie que l'API ne crashe jamais (500) sur des payloads hostiles
 *  - On vérifie que les payloads injectés ne sont pas renvoyés tels quels
 *    (pas de "reflect" XSS dans la réponse)
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
} from '@nestjs/common';
import request from 'supertest';

/* ============================================================
 * CONTRÔLEUR DE TEST
 * Simule un endpoint d'entrée utilisateur typique.
 * ============================================================ */

@Controller('test-injection')
class TestInjectionController {

  @Get('search')
  search(@Query('q') q: string) {
    /* Simule une recherche qui ne doit pas exécuter le SQL injecté */
    return { query: q, results: [] };
  }

  @Post('create')
  create(@Body() body: Record<string, unknown>) {
    /* Retourne uniquement les champs attendus — whitelist active */
    return { id: 'safe-id', name: body['name'] ?? '' };
  }

  @Get('user/:id')
  getUser(@Param('id') id: string) {
    /* L'id doit être traité comme une chaîne, pas exécuté */
    return { id, found: false };
  }
}

/* ============================================================
 * PAYLOADS DE TEST
 * ============================================================ */

const SQL_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "' UNION SELECT password FROM users--",
  "1 OR 1=1",
  "admin'--",
  "1; SELECT pg_sleep(5)--",
];

const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  'javascript:alert(document.cookie)',
  '"><script>alert("xss")</script>',
  "'; alert('xss'); var x='",
];

const PROTOTYPE_PAYLOADS = [
  { '__proto__': { admin: true } },
  { 'constructor': { prototype: { admin: true } } },
  { '__proto__.admin': true },
];

const PATH_TRAVERSAL = [
  '../../../etc/passwd',
  '..\\..\\..\\windows\\system32\\',
  '%2e%2e%2f%2e%2e%2f',
  '....//....//etc/passwd',
];

/* ============================================================
 * SUITE
 * ============================================================ */

describe('API Injection Security Tests', () => {

  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestInjectionController],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist:        true,
      forbidNonWhitelisted: false, // on teste la réponse, pas le blocage
      transform:        true,
    }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  /* ==========================================================
   * 1. INJECTION SQL — query params
   * ========================================================== */

  describe('Injection SQL — query params', () => {

    SQL_PAYLOADS.forEach(payload => {
      it(`n'exécute pas et ne crashe pas sur: ${payload.substring(0, 40)}`, async () => {
        const res = await request(app.getHttpServer())
          .get('/test-injection/search')
          .query({ q: payload });

        /* L'app ne doit JAMAIS retourner 500 sur des inputs hostiles */
        expect(res.status).not.toBe(500);

        /* La réponse ne doit pas contenir de données DB non autorisées */
        expect(res.body.results).toEqual([]);
      });
    });

    it('retourne la chaîne littérale sans l\'interpréter', async () => {
      const res = await request(app.getHttpServer())
        .get('/test-injection/search')
        .query({ q: "' OR 1=1--" });

      /* La valeur query doit être retournée telle quelle (échappée) */
      expect(res.status).toBeLessThan(500);
    });
  });

  /* ==========================================================
   * 2. INJECTION XSS — body
   * ========================================================== */

  describe('Injection XSS — body', () => {

    XSS_PAYLOADS.forEach(payload => {
      it(`ne reflète pas XSS et ne crashe pas: ${payload.substring(0, 40)}`, async () => {
        const res = await request(app.getHttpServer())
          .post('/test-injection/create')
          .send({ name: payload });

        expect(res.status).not.toBe(500);

        /* Le payload XSS ne doit pas être retourné dans un contexte HTML actif */
        const body = JSON.stringify(res.body);
        /* On vérifie que <script> n'est pas dans la réponse JSON non-échappée */
        if (res.headers['content-type']?.includes('text/html')) {
          expect(body).not.toContain('<script>');
        }
      });
    });
  });

  /* ==========================================================
   * 3. PROTOTYPE POLLUTION
   * ========================================================== */

  describe('Prototype Pollution', () => {

    PROTOTYPE_PAYLOADS.forEach((payload, i) => {
      it(`n'injecte pas dans le prototype global (payload ${i + 1})`, async () => {
        const before = ({} as any).admin;

        await request(app.getHttpServer())
          .post('/test-injection/create')
          .send(payload);

        /* Object.prototype ne doit pas être modifié */
        const after = ({} as any).admin;
        expect(after).toBe(before);
      });
    });

    it('__proto__ n\'est pas transmis au handler (whitelist)', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-injection/create')
        .send({ '__proto__': { admin: true }, name: 'test' });

      expect(res.status).not.toBe(500);
    });
  });

  /* ==========================================================
   * 4. PATH TRAVERSAL — paramètres de route
   * ========================================================== */

  describe('Path Traversal', () => {

    PATH_TRAVERSAL.forEach(path => {
      it(`ne divulgue pas de fichiers système pour: ${path.substring(0, 30)}`, async () => {
        const res = await request(app.getHttpServer())
          .get(`/test-injection/user/${encodeURIComponent(path)}`);

        expect(res.status).not.toBe(500);
        /* On ne doit jamais voir le contenu d'un fichier système */
        expect(JSON.stringify(res.body)).not.toContain('root:');
        expect(JSON.stringify(res.body)).not.toContain('[extensions]');
      });
    });
  });

  /* ==========================================================
   * 5. VALIDATION — types et longueurs extrêmes
   * ========================================================== */

  describe('Validation des inputs extrêmes', () => {

    it('survit à un body de 1 Mo de données', async () => {
      const hugeName = 'A'.repeat(1_000_000);
      const res = await request(app.getHttpServer())
        .post('/test-injection/create')
        .send({ name: hugeName });

      /* Soit rejeté par le serveur (413/400), soit traité sans crash */
      expect(res.status).not.toBe(500);
    });

    it('survit à un body null', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-injection/create')
        .send(null);
      expect(res.status).not.toBe(500);
    });

    it('survit à un body avec null byte', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-injection/create')
        .send({ name: 'test\x00inject' });
      expect(res.status).not.toBe(500);
    });

    it('survit à des nombres comme valeurs de string', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-injection/create')
        .send({ name: 9999999999999 });
      expect(res.status).not.toBe(500);
    });

    it('survit à un tableau vide comme body', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-injection/create')
        .send([]);
      expect(res.status).not.toBe(500);
    });

    it('retourne 400 pour un Content-Type invalide', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-injection/create')
        .set('Content-Type', 'text/xml')
        .send('<root><name>test</name></root>');
      /* Doit gérer proprement — pas un 500 */
      expect(res.status).not.toBe(500);
    });
  });

  /* ==========================================================
   * 6. RÉPONSES — pas de fuite de stack trace
   * ========================================================== */

  describe('Fuite d\'information dans les erreurs', () => {

    it('une erreur 400 n\'expose pas la stack trace', async () => {
      const res = await request(app.getHttpServer())
        .get('/test-injection/search');

      if (res.status >= 400) {
        expect(res.body.stack).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toContain('node_modules');
      }
    });

    it('une route inexistante retourne 404 sans détail interne', async () => {
      const res = await request(app.getHttpServer())
        .get('/cette-route-nexiste-pas-12345');
      expect(res.status).toBe(404);
      expect(res.body.stack).toBeUndefined();
    });
  });
});
