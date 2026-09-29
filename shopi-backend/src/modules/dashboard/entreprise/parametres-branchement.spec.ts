/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/parametres-branchement.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Non-régression de l'audit « les paramètres de l'entreprise sont-ils
 * bien branchés ? » (2026-09) — un réglage enregistré doit être APPLIQUÉ
 * là où il a un effet, pas seulement stocké :
 *
 *  1. Confidentialité « Apparaître dans la recherche » → recherche par nom
 *  2. Catalogue « produits en rupture » → « Produits similaires »
 *  3. Contact « Repère pour les livreurs » (+ adresse, téléphone) → missions
 *  4. Contact « WhatsApp » → page boutique publique
 *  5. Facturation (raison sociale, NIF, RCCM) → écran Validations de l'admin
 *  A. « Livraison express » retirée (aucun mode express à la commande)
 * ============================================================ */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { PublicService } from '../../public/public.service';
import { CommandeQueryService } from '../../commande/services/commande-query.service';
import { AdminActeursService } from '../administrateur/services/admin-acteurs.service';
import { UpdateLivraisonDto } from './dto/update-livraison.dto';
import { LivreurAssignmentStatus } from '../../../database/entities/commande/commande.entity';

/** Construit un service sans passer par son (long) constructeur : seules les dépendances utiles au test. */
function monter<T>(Classe: abstract new (...args: any[]) => T, deps: Record<string, unknown>): T {
  return Object.assign(Object.create(Classe.prototype), deps) as T;
}

/** QueryBuilder factice qui enregistre toutes les conditions WHERE. */
function fauxQb(resultat: { many?: unknown[]; count?: number } = {}) {
  const conditions: string[] = [];
  const qb: any = {
    conditions,
    getManyAndCount: jest.fn(async () => [resultat.many ?? [], resultat.count ?? 0]),
    getMany:         jest.fn(async () => resultat.many ?? []),
  };
  for (const m of ['leftJoinAndSelect', 'orderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
  for (const m of ['where', 'andWhere']) qb[m] = jest.fn((sql: string) => { conditions.push(sql); return qb; });
  return qb;
}

const boutique = (extra: Record<string, unknown> = {}) => ({
  id: 'co-1', companyName: 'Boutique Test', createdAt: new Date('2026-01-01'),
  livraisonStandard: true, livraisonShopi: true, livraisonCorresp: false, clickCollect: true,
  livraisonExpress: true, zonesLivraison: ['Kaloum'], whatsapp: '620000000', ...extra,
});

/* ============================================================
 * 1 & 4 & A — Page / recherche publique des boutiques
 * ============================================================ */

describe('Recherche publique des boutiques', () => {

  function monterPublic(rows: unknown[] = []) {
    const qb = fauxQb({ many: rows, count: rows.length });
    const svc = monter(PublicService, { companyRepo: { createQueryBuilder: jest.fn(() => qb) } });
    return { svc, qb };
  }

  it('1. une recherche par nom exclut les boutiques qui ont masqué « Apparaître dans la recherche »', async () => {
    const { svc, qb } = monterPublic();
    await svc.listBoutiques({ page: 1, limit: 10, search: 'test' });
    expect(qb.conditions.some((c: string) => c.includes(`'showInSearch'`) && c.includes(`'false'`))).toBe(true);
  });

  it('1. sans recherche (simple liste), le réglage ne masque pas la boutique', async () => {
    const { svc, qb } = monterPublic();
    await svc.listBoutiques({ page: 1, limit: 10 });
    expect(qb.conditions.some((c: string) => c.includes('showInSearch'))).toBe(false);
  });

  it('4. le numéro WhatsApp de la boutique est renvoyé', async () => {
    const { svc } = monterPublic([boutique()]);
    const res = await svc.listBoutiques({ page: 1, limit: 10 });
    expect(res.data[0].whatsapp).toBe('620000000');
  });

  it('A. « Livraison express » n’est plus annoncée aux clients, même si elle était cochée', async () => {
    const { svc } = monterPublic([boutique({ livraisonExpress: true })]);
    const res = await svc.listBoutiques({ page: 1, limit: 10 });
    expect(res.data[0].livraison).not.toHaveProperty('express');
    expect(res.data[0].livraison).toEqual(expect.objectContaining({ standard: true, zones: ['Kaloum'] }));
  });
});

/* ============================================================
 * 2 — Produits similaires
 * ============================================================ */

describe('Produits similaires', () => {

  it('2. respecte « masquer les produits en rupture » de la boutique', async () => {
    const qb = fauxQb({ many: [] });
    const svc = monter(PublicService, {
      productRepo: {
        findOne: jest.fn().mockResolvedValue({ id: 'p-1', categoryId: 'cat-1', nom: 'Chaussure' }),
        createQueryBuilder: jest.fn(() => qb),
      },
    });

    await svc.getSimilaires('p-1');

    expect(qb.conditions).toContain('(company."showOutOfStock" = true OR p.stock > 0)');
  });
});

/* ============================================================
 * 3 — Missions du livreur
 * ============================================================ */

describe('Missions du livreur', () => {

  it('3. le livreur reçoit l’adresse, le repère et le téléphone de la boutique où récupérer le colis', async () => {
    const svc = monter(CommandeQueryService, {
      deliveryRepo: { findOne: jest.fn().mockResolvedValue({ id: 'dl-1' }) },
      commandeRepo: {
        find: jest.fn().mockResolvedValue([{
          id: 'cmd-1', numero: 'CMD-1', companyId: 'co-1', clientId: 'cl-1',
          items: [{ nomProduit: 'Sac' }], codes: [], fraisLivraison: 15000,
          livreurAssignmentStatus: LivreurAssignmentStatus.ACCEPTED, createdAt: new Date(),
        }]),
      },
      clientRepo:  { find: jest.fn().mockResolvedValue([{ id: 'cl-1', fullName: 'Aïssata', userId: null }]) },
      companyRepo: { find: jest.fn().mockResolvedValue([boutique({
        adresse: 'Avenue de la République', repere: 'Bâtiment rouge à côté de la pharmacie', businessPhone: '622 11 22 33',
      })]) },
      locRepo: { find: jest.fn().mockResolvedValue([]) },
    });

    const [mission] = await svc.listLivreur({ id: 'user-livreur' } as any);

    expect(mission).toEqual(expect.objectContaining({
      companyAdresse:   'Avenue de la République',
      companyRepere:    'Bâtiment rouge à côté de la pharmacie',
      companyTelephone: '622 11 22 33',
    }));
  });
});

/* ============================================================
 * 5 — Écran Validations de l'administrateur
 * ============================================================ */

describe('Validations administrateur', () => {

  it('5. montre raison sociale, NIF, RCCM et les pièces envoyées — jamais l’URL des fichiers', async () => {
    const entreprise = boutique({
      raisonSociale: 'BOUTIQUE TEST SARL', nif: '123456789', rccm: 'GN-CNK-2026-B-00001',
      ownerIdDocument: 'https://res.cloudinary.com/x/cni-secret.jpg', documentRccm: 'https://res.cloudinary.com/x/rccm.pdf',
      documentNif: null, documentBancaire: null, documentPhoto: null,
      user: { id: 'user-co', firstName: 'Mamadou', lastName: 'Diallo', createdAt: new Date() },
    });
    const svc = monter(AdminActeursService, {
      zoneService:  { adminOf: jest.fn().mockResolvedValue({ id: 'adm-1', fullName: 'Admin Zone', zone: 'Conakry' }) },
      partnerRepo:  { find: jest.fn().mockResolvedValue([]) },
      companyRepo:  { find: jest.fn().mockResolvedValue([entreprise]) },
      deliveryRepo: { find: jest.fn().mockResolvedValue([]) },
    });

    const { list } = await svc.getValidations('user-admin');

    expect(list[0].legal).toEqual({
      companyName: 'Boutique Test', raisonSociale: 'BOUTIQUE TEST SARL', nif: '123456789', rccm: 'GN-CNK-2026-B-00001',
      documents: { cni: true, rccm: true, nif: false, bancaire: false, photo: false },
    });
    expect(JSON.stringify(list)).not.toContain('cloudinary');
  });
});

/* ============================================================
 * A — Paramètres > Livraison
 * ============================================================ */

describe('Paramètres > Livraison', () => {

  it('A. « livraisonExpress » n’est plus un champ modifiable (refusé par la validation)', async () => {
    const dto = plainToInstance(UpdateLivraisonDto, { livraisonStandard: true, livraisonExpress: true });
    const erreurs = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(erreurs.map(e => e.property)).toContain('livraisonExpress');
  });
});
