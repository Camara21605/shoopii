import { GeoService } from './geo.service';
import { ZoneDistanceService } from './zone-distance.service';
import { GeoService as GeoMath } from '../location/services/geo.service';

function repo(rows: any[] = []) {
  return {
    rows,
    find: jest.fn(async (opts?: any) => (opts?.where?.parentId ? rows.filter(r => r.parentId === opts.where.parentId) : rows)),
    findOne: jest.fn(async (opts: any) => rows.find(r => (opts.where.id ? r.id === opts.where.id : r.code === opts.where.code)) ?? null),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => { const r = { id: x.id ?? `id-${rows.length + 1}`, ...x }; if (!rows.includes(x)) rows.push(r); return r; }),
  };
}

/* Mini référentiel : Guinée › Conakry (région) › Conakry (ville) › Ratoma, Kaloum › quartiers ; Kindia (ville, avec coordonnées). */
function referentiel() {
  return {
    pays: repo([{ id: 'gn', nom: 'GUINÉE', parentId: null, latitude: null, longitude: null }]),
    reg: repo([
      { id: 'rc', nom: 'CONAKRY', parentId: 'gn', latitude: 9.6, longitude: -13.6 },
      { id: 'rk', nom: 'KINDIA', parentId: 'gn', latitude: 10.0, longitude: -12.8 },
    ]),
    pref: repo([
      { id: 'pc', nom: 'CONAKRY', parentId: 'rc', latitude: 9.5, longitude: -13.7 },
      { id: 'pk', nom: 'KINDIA', parentId: 'rk', latitude: 10.0544, longitude: -12.8559 },
    ]),
    comm: repo([
      { id: 'cr', nom: 'RATOMA', parentId: 'pc', latitude: 9.589, longitude: -13.656 },
      { id: 'ck', nom: 'KALOUM', parentId: 'pc', latitude: null, longitude: null },
    ]),
    quart: repo([
      { id: 'q1', nom: 'KIPÉ', parentId: 'cr', latitude: null, longitude: null },
      { id: 'q2', nom: 'BOULBINET', parentId: 'ck', latitude: null, longitude: null },
    ]),
  };
}

function build(opts: { route?: 'ok' | 'down'; geocode?: Record<string, { lat: number; lng: number; precision: 'quartier' | 'commune' | 'ville' } | null> } = {}) {
  const r = referentiel();
  const route = {
    getRoute: jest.fn(async () => (opts.route === 'down'
      ? { provider: 'straight-line-fallback', totalDistanceM: 1, totalDurationS: 1 }
      : { provider: 'osrm', totalDistanceM: 152_340, totalDurationS: 3 * 3600 + 25 * 60 })),
  };
  const geocoding = { resolveAwait: jest.fn(async (p: any) => opts.geocode?.[p.quartier ?? p.commune] ?? null) };
  const svc = new ZoneDistanceService(r.pays as any, r.reg as any, r.pref as any, r.comm as any, r.quart as any, route as any, geocoding as any, new GeoMath());
  return { svc, route, geocoding, r };
}

describe('ZoneDistanceService — distance d\'une zone entre deux lieux', () => {
  it('deux villes avec coordonnées : distance par la route + durée, positions exactes', async () => {
    const { svc, route } = build();
    const d = await svc.between('prefecture', 'pc', 'pk');
    expect(d).toMatchObject({ distanceKm: 152.34, dureeMin: 205, source: 'route', approx: false });
    expect(d!.depart.nom).toBe('CONAKRY');
    expect(route.getRoute).toHaveBeenCalledWith([{ latitude: 9.5, longitude: -13.7 }, { latitude: 10.0544, longitude: -12.8559 }], 'car');
  });

  it('routeur indisponible : distance à vol d\'oiseau, sans durée', async () => {
    const { svc } = build({ route: 'down' });
    const d = await svc.between('prefecture', 'pc', 'pk');
    expect(d!.source).toBe('vol_oiseau');
    expect(d!.dureeMin).toBeNull();
    expect(d!.distanceKm).toBeGreaterThan(100);
    expect(d!.distanceKm).toBeLessThan(130);
  });

  it('deux quartiers sans coordonnées : géocodés (position approximative)', async () => {
    const { svc, geocoding } = build({ geocode: { 'KIPÉ': { lat: 9.62, lng: -13.63, precision: 'quartier' }, BOULBINET: { lat: 9.51, lng: -13.71, precision: 'quartier' } } });
    const d = await svc.between('quartier', 'q1', 'q2');
    expect(d).toMatchObject({ source: 'route', approx: true });
    expect(d!.depart).toMatchObject({ nom: 'KIPÉ', precision: 'quartier', lat: 9.62 });
    expect(geocoding.resolveAwait).toHaveBeenCalledWith({ ville: 'CONAKRY', commune: 'RATOMA', quartier: 'KIPÉ' });
  });

  it('géocodage sans résultat : repli sur la commune, puis la ville', async () => {
    const { svc } = build();
    expect(await svc.locate('quartier', 'q1')).toMatchObject({ precision: 'commune', lat: 9.589 });
    expect(await svc.locate('quartier', 'q2')).toMatchObject({ precision: 'ville', lat: 9.5 });
  });

  it('pays sans coordonnées : centre de ses régions', async () => {
    const { svc } = build();
    expect(await svc.locate('pays', 'gn')).toMatchObject({ precision: 'pays', lat: 9.8, lng: -13.2 });
  });

  it('même point : distance nulle sans appeler le routeur ; lieu inconnu : null', async () => {
    const { svc, route } = build();
    expect(await svc.between('commune', 'cr', 'cr')).toMatchObject({ distanceKm: 0, source: 'vol_oiseau' });
    expect(route.getRoute).not.toHaveBeenCalled();
    expect(await svc.between('commune', 'cr', 'inconnu')).toBeNull();
  });
});

describe('GeoService — zone créée entre deux lieux : distance calculée automatiquement', () => {
  const trajet = { distanceKm: 152.34, dureeMin: 205, source: 'route' as const, approx: false, depart: {} as any, arrivee: {} as any };
  const make = () => {
    const zones = repo();
    const zoneDistance = { between: jest.fn(async () => trajet) };
    const svc = new GeoService(repo() as any, repo() as any, repo() as any, repo() as any, repo() as any, zones as any, repo() as any, repo() as any, zoneDistance as any);
    return { svc, zones, zoneDistance };
  };

  it('création avec deux villes : distance + source enregistrées, durée reprise du trajet', async () => {
    const { svc, zones, zoneDistance } = make();
    const z = await svc.createZone({ nom: 'Conakry - Kindia', code: 'CKY-KIN', couvertureType: 'prefecture', couvertureIds: ['pc', 'pk'] } as any);
    expect(zoneDistance.between).toHaveBeenCalledWith('prefecture', 'pc', 'pk');
    expect(z).toMatchObject({ distanceKm: 152.34, distanceSource: 'route', tempsEstime: 205 });
    expect(zones.rows[0]).toMatchObject({ distanceKm: 152.34 });
  });

  it('durée saisie par l\'admin : gardée ; une seule entité : pas de distance', async () => {
    const { svc, zoneDistance } = make();
    expect(await svc.createZone({ nom: 'A', code: 'A', couvertureType: 'prefecture', couvertureIds: ['pc', 'pk'], tempsEstime: 240 } as any)).toMatchObject({ tempsEstime: 240, distanceKm: 152.34 });
    zoneDistance.between.mockClear();
    expect(await svc.createZone({ nom: 'B', code: 'B', couvertureType: 'commune', couvertureIds: ['cr'] } as any)).toMatchObject({ distanceKm: null });
    expect(zoneDistance.between).not.toHaveBeenCalled();
  });

  it('aperçu du formulaire : deux lieux différents seulement', async () => {
    const { svc } = make();
    expect(await svc.zoneDistancePreview('prefecture', 'pc', 'pk')).toEqual(trajet);
    expect(await svc.zoneDistancePreview('prefecture', 'pc', 'pc')).toBeNull();
  });
});
