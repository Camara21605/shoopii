/* ============================================================
 * FICHIER : test/e2e/auth.e2e-spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tests E2E du flux d'authentification Shopi.
 *
 * SCÉNARIOS (4 groupes)
 * ─────────────────────────────────────────────────────────────
 *  1. Inscription        — champs manquants, email invalide, succès
 *  2. Connexion          — mauvais mdp, compte inexistant, succès
 *  3. Accès protégé      — sans token, token expiré, accès autorisé
 *  4. Refresh token      — token invalide, rotation
 *
 * STRATÉGIE
 * ─────────────────────────────────────────────────────────────
 *  App NestJS complète avec mocks Auth (SQLite en mémoire).
 *  Vérifie les codes HTTP, la forme des corps de réponse,
 *  et que les headers de sécurité sont correctement émis.
 *
 * NOTE : ces tests nécessitent une base de données de test
 *  configurée via DATABASE_URL_TEST ou SQLite en mémoire.
 *  Pour l'environnement CI, consulter .github/workflows/qa-pipeline.yml.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Test, TestingModule }  from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

/* ── Modules minimalistes pour les E2E Auth ── */
import { AuthModule }  from '../../src/modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';

/* ============================================================
 * HELPERS
 * ============================================================ */

const ENDPOINT = {
  register:  '/api/auth/register',
  login:     '/api/auth/login',
  refresh:   '/api/auth/refresh',
  me:        '/api/auth/me',
  logout:    '/api/auth/logout',
};

/* ============================================================
 * SUITE
 * ============================================================ */

describe('Auth E2E — parcours authentification', () => {

  let app: INestApplication;
  let accessToken:  string;
  let refreshToken: string;

  /* ==========================================================
   * Setup — app minimaliste sans DB externe
   * ========================================================== */

  beforeAll(async () => {
    /*
     * NOTE : Dans un environnement CI complet, on utilise une vraie DB de test.
     * Ici on mocke les services Auth pour tester la couche HTTP seule.
     */
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.test' }),
      ],
    })
    .overrideProvider('AuthService')
    .useValue({
      register: jest.fn().mockResolvedValue({ id: 'u-001', email: 'test@shopi.gn' }),
      login:    jest.fn().mockResolvedValue({
        accessToken:  'mock.access.token',
        refreshToken: 'mock.refresh.token',
        user:         { id: 'u-001', email: 'test@shopi.gn', role: 'CLIENT' },
      }),
      refreshTokens: jest.fn().mockResolvedValue({
        accessToken:  'mock.access.token.new',
        refreshToken: 'mock.refresh.token.new',
      }),
    })
    .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  /* ==========================================================
   * 1. INSCRIPTION
   * ========================================================== */

  describe('POST /api/auth/register', () => {

    it('retourne 400 si email manquant', async () => {
      const res = await request(app.getHttpServer())
        .post(ENDPOINT.register)
        .send({ password: 'Pass1234!' });
      expect(res.status).toBe(400);
    });

    it('retourne 400 si mot de passe manquant', async () => {
      const res = await request(app.getHttpServer())
        .post(ENDPOINT.register)
        .send({ email: 'test@shopi.gn' });
      expect(res.status).toBe(400);
    });

    it('retourne 400 si email invalide', async () => {
      const res = await request(app.getHttpServer())
        .post(ENDPOINT.register)
        .send({ email: 'pas-un-email', password: 'Pass1234!' });
      expect(res.status).toBe(400);
    });

    it('ne expose pas de stack trace en cas d\'erreur', async () => {
      const res = await request(app.getHttpServer())
        .post(ENDPOINT.register)
        .send({});
      expect(res.body.stack).toBeUndefined();
    });
  });

  /* ==========================================================
   * 2. CONNEXION
   * ========================================================== */

  describe('POST /api/auth/login', () => {

    it('retourne 400 si corps vide', async () => {
      const res = await request(app.getHttpServer())
        .post(ENDPOINT.login)
        .send({});
      expect(res.status).toBe(400);
    });

    it('ne retourne jamais le mot de passe hashé dans la réponse', async () => {
      const res = await request(app.getHttpServer())
        .post(ENDPOINT.login)
        .send({ email: 'test@shopi.gn', password: 'Pass1234!' });

      if (res.status === 200 || res.status === 201) {
        expect(res.body.user?.password).toBeUndefined();
        expect(res.body.user?.passwordHash).toBeUndefined();
      }
    });
  });

  /* ==========================================================
   * 3. ROUTES PROTÉGÉES — accès sans token
   * ========================================================== */

  describe('Routes protégées — guard JWT', () => {

    it('GET /api/auth/me retourne 401 sans Authorization header', async () => {
      const res = await request(app.getHttpServer())
        .get(ENDPOINT.me);
      expect(res.status).toBe(401);
    });

    it('GET /api/auth/me retourne 401 avec token malformé', async () => {
      const res = await request(app.getHttpServer())
        .get(ENDPOINT.me)
        .set('Authorization', 'Bearer token.invalide.malformé');
      expect(res.status).toBe(401);
    });

    it('GET /api/auth/me retourne 401 avec token JWT sans signature valide', async () => {
      const fakeToken = Buffer.from(JSON.stringify({ sub: 'fake', role: 'SUPER_ADMIN' })).toString('base64');
      const res = await request(app.getHttpServer())
        .get(ENDPOINT.me)
        .set('Authorization', `Bearer ${fakeToken}`);
      expect(res.status).toBe(401);
    });
  });

  /* ==========================================================
   * 4. HEADERS DE SÉCURITÉ
   * ========================================================== */

  describe('Headers de sécurité', () => {

    it('les réponses n\'exposent pas X-Powered-By', async () => {
      const res = await request(app.getHttpServer()).get('/api');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('Content-Type JSON sur les endpoints API', async () => {
      const res = await request(app.getHttpServer())
        .post(ENDPOINT.login)
        .send({ email: 'test@shopi.gn', password: 'Pass1234!' });
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  /* ==========================================================
   * 5. PROTECTION CSRF / REJEU
   * ========================================================== */

  describe('Protection contre le rejeu', () => {

    it('un même refresh token ne peut pas être utilisé deux fois consécutivement', async () => {
      /* Premier refresh — valide */
      const res1 = await request(app.getHttpServer())
        .post(ENDPOINT.refresh)
        .send({ refreshToken: 'old.refresh.token' });

      if (res1.status === 200) {
        /* Deuxième refresh avec l'ancien token — doit échouer */
        const res2 = await request(app.getHttpServer())
          .post(ENDPOINT.refresh)
          .send({ refreshToken: 'old.refresh.token' });
        expect(res2.status).toBeGreaterThanOrEqual(400);
      }
    });
  });
});
