import { ConfigService } from '@nestjs/config';
import { frenchInstruction, RouteService } from './route.service';

const A = { latitude: 9.53, longitude: -13.68 };
const B = { latitude: 9.54, longitude: -13.67 };

function svc(env: Record<string, string> = {}) {
  return new RouteService({ get: (k: string) => env[k] } as unknown as ConfigService);
}

const osrmBody = {
  code: 'Ok',
  routes: [{
    distance: 2000, duration: 300,
    geometry: { coordinates: [[-13.68, 9.53], [-13.675, 9.535], [-13.67, 9.54]] },
    legs: [{ steps: [
      { distance: 1200, duration: 180, name: 'Route du Niger', maneuver: { type: 'depart', location: [-13.68, 9.53] } },
      { distance: 800, duration: 120, name: '', maneuver: { type: 'turn', modifier: 'right', location: [-13.675, 9.535] } },
      { distance: 0, duration: 0, name: '', maneuver: { type: 'arrive', location: [-13.67, 9.54] } },
    ] }],
  }],
};

describe('RouteService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sans clé ORS : itinéraire routier OSRM, consignes en français, polyline [lat, lng]', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => osrmBody } as Response);
    const r = await svc().getRoute([A, B]);
    expect(r.provider).toBe('osrm');
    expect(r.polyline[0]).toEqual([9.53, -13.68]);
    expect(r.steps.map(s => s.text)).toEqual(['Partez sur Route du Niger', 'Tournez à droite', 'Vous êtes arrivé à destination']);
    expect(r.steps[1]).toMatchObject({ maneuver: 'right', at: [9.535, -13.675] });
    expect(r.totalDistanceTxt).toBe('2.0 km');
  });

  it('moto plus rapide, marche à ~4,8 km/h', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => osrmBody } as Response);
    expect((await svc().getRoute([A, B], 'moto')).totalDurationS).toBe(240);
    expect(Math.round((await svc().getRoute([A, B], 'foot')).totalDurationS)).toBe(1500);
  });

  it('routeurs injoignables → ligne droite, sans guidage', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('réseau'));
    const r = await svc().getRoute([A, B]);
    expect(r.provider).toBe('straight-line-fallback');
    expect(r.steps).toEqual([]);
    expect(r.polyline).toHaveLength(2);
  });

  it('rond-point', () => {
    expect(frenchInstruction('roundabout', 'Avenue X', 2, 'car')).toBe('Au rond-point, prenez la 2e sortie sur Avenue X');
    expect(frenchInstruction('roundabout', null, 1, 'car')).toBe('Au rond-point, prenez la 1re sortie');
  });
});
