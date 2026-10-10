/* ============================================================
 * FICHIER : src/modules/location/services/actor-map.service.spec.ts
 *
 * Carte de recherche (bouton 📍 de l'accueil) — non-régression de l'audit
 * de la carte (2026-09) :
 *  1. « Voir le profil » d'un correspondant mène à sa vraie page
 *     (/correspondants/:id — /profil/correspondant/:id n'existe pas).
 *  2. Correspondant : « Apparaître dans la recherche » coupé → absent de la carte ;
 *     « Partager ma localisation » coupé → position approximative, sans adresse.
 *  3. « Autour de moi » : pré-filtre SQL sur la zone pour les trois types
 *     (avant : 400 acteurs quelconques par type, puis filtre par distance).
 * ============================================================ */

import { ActorMapService } from './actor-map.service';

/** QueryBuilder factice : enregistre les conditions et leurs paramètres, renvoie `rows`. */
function fauxQb(rows: unknown[]) {
  const conditions: { sql: string; params?: Record<string, unknown> }[] = [];
  const qb: any = { conditions, getMany: jest.fn().mockResolvedValue(rows) };
  for (const m of ['select', 'addSelect', 'innerJoin', 'take']) qb[m] = jest.fn(() => qb);
  for (const m of ['where', 'andWhere']) qb[m] = jest.fn((sql: string, params?: Record<string, unknown>) => { conditions.push({ sql, params }); return qb; });
  return qb;
}

const correspondant = (privacySettings: unknown) => ({
  id: 'cor-1', fullName: 'Fatou Camara', status: 'active', averageRating: 4.5,
  depotVille: 'Conakry', depotCommune: 'Kaloum', depotQuartier: 'Boulbinet', depotAdresse: 'Rue KA-020, porte bleue',
  depotLatitude: 9.5092, depotLongitude: -13.7122, privacySettings,
  user: { id: 'u-cor', profilePicture: null },
});

function monter(corrRows: unknown[]) {
  const qbs = { vendor: fauxQb([]), delivery: fauxQb([]), corr: fauxQb(corrRows) };
  const svc = Object.assign(Object.create(ActorMapService.prototype), {
    companyRepo:  { createQueryBuilder: jest.fn(() => qbs.vendor) },
    deliveryRepo: { createQueryBuilder: jest.fn(() => qbs.delivery) },
    corrRepo:     { createQueryBuilder: jest.fn(() => qbs.corr) },
    geo:          { distanceKm: jest.fn(() => 1.2) },
    /* Centre du quartier : point approximatif */
    geocoding:    { resolveNow: jest.fn(() => ({ lat: 9.51, lng: -13.71, precision: 'quartier' })) },
  }) as ActorMapService;
  return { svc, qbs };
}

describe('Carte de recherche — correspondants', () => {

  it('1. « Voir le profil » mène à /correspondants/:id', async () => {
    const { svc } = monter([correspondant(null)]);
    const { results } = await svc.search({ q: 'fatou' });
    expect(results[0].profilePath).toBe('/correspondants/cor-1');
  });

  it('2. position exacte du dépôt quand le partage de localisation est permis', async () => {
    const { svc } = monter([correspondant({ visibilite: { partagerLocalisation: true } })]);
    const [a] = (await svc.search({ q: 'fatou' })).results;
    expect(a).toEqual(expect.objectContaining({ lat: 9.5092, lng: -13.7122, approx: false, address: 'Rue KA-020, porte bleue' }));
  });

  it('2. « Partager ma localisation » coupé : position approximative, sans adresse', async () => {
    const { svc } = monter([correspondant({ visibilite: { partagerLocalisation: false } })]);
    const [a] = (await svc.search({ q: 'fatou' })).results;
    expect(a.approx).toBe(true);
    expect(a.precision).toBe('quartier');
    expect(a.lat).not.toBe(9.5092);
    expect(a.address).toBeNull();
  });

  it('2. « Apparaître dans la recherche » coupé : exclu en SQL, et jamais renvoyé', async () => {
    const { svc, qbs } = monter([correspondant({ visibilite: { apparaitreRecherche: false } })]);
    const { results } = await svc.search({ q: 'fatou' });
    expect(qbs.corr.conditions.map((c: { sql: string }) => c.sql))
      .toContain(`(c."privacySettings"->'visibilite'->>'apparaitreRecherche') IS DISTINCT FROM 'false'`);
    expect(results).toHaveLength(0);
  });
});

describe('Carte de recherche — « Autour de moi »', () => {

  const bbox = (qb: { conditions: { sql: string; params?: Record<string, number> }[] }) =>
    qb.conditions.find(c => c.sql.includes(':bbMinLat'));

  it('3. pré-filtre SQL sur la zone pour les trois types, à la taille du rayon', async () => {
    const { svc, qbs } = monter([]);
    await svc.search({ lat: 9.5, lng: -13.7, radiusKm: 10 });

    for (const qb of [qbs.vendor, qbs.delivery, qbs.corr]) {
      const c = bbox(qb);
      expect(c).toBeDefined();
      expect(c!.params!.bbMinLat).toBeCloseTo(9.5 - 10 / 111, 4);
      expect(c!.params!.bbMaxLat).toBeCloseTo(9.5 + 10 / 111, 4);
      expect(c!.params!.bbMaxLng).toBeGreaterThan(-13.7);
    }
    /* Sans GPS utilisable, l'acteur reste candidat (situé d'après son quartier) */
    expect(bbox(qbs.delivery)!.sql).toContain(`(d."privacySettings"->>'shareLocation') = 'false'`);
    expect(bbox(qbs.corr)!.sql).toContain(`'partagerLocalisation') = 'false'`);
  });

  it('3. recherche par nom : aucun filtre de zone', async () => {
    const { svc, qbs } = monter([]);
    await svc.search({ q: 'pharmacie', lat: 9.5, lng: -13.7 });
    expect(bbox(qbs.vendor)).toBeUndefined();
  });
});
