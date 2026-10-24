import { foldGeo } from './conakry-communes';
import { GeoService } from './geo.service';
import { REGION_LABE } from './region-labe';
import { REGION_MAMOU } from './region-mamou';

function repo(rows: any[] = []) {
  return {
    rows,
    find: jest.fn(async (opts?: any) => {
      const w = opts?.where;
      return w?.parentId ? rows.filter(r => r.parentId === w.parentId && (!w.statut || r.statut === w.statut)) : rows;
    }),
    findOne: jest.fn(async (opts: any) => rows.find(r => r.code === opts.where.code) ?? null),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => { const r = { id: `id-${Math.random().toString(36).slice(2)}`, ...x }; rows.push(r); return r; }),
  };
}

function service(pays: any[], regions: any[] = [], prefs: any[] = [], communes: any[] = []) {
  const r = { pays: repo(pays), reg: repo(regions), pref: repo(prefs), comm: repo(communes), quart: repo() };
  const svc = new GeoService(r.pays as any, r.reg as any, r.pref as any, r.comm as any, r.quart as any, repo() as any, repo() as any, repo() as any);
  return { svc, ...r };
}

describe('Région de Mamou', () => {
  const nbCommunes = REGION_MAMOU.prefectures.reduce((n, p) => n + p.communes.length, 0);

  it('données : 3 préfectures, 3 communes urbaines + 33 sous-préfectures, 28 quartiers à Mamou-Centre, codes uniques', () => {
    expect(REGION_MAMOU.prefectures.map(p => p.nom)).toEqual(['Mamou', 'Dalaba', 'Pita']);
    expect(nbCommunes).toBe(36);
    const all = REGION_MAMOU.prefectures.flatMap(p => p.communes);
    expect(all.filter(c => c.type === 'urbaine')).toHaveLength(3);
    expect(new Set(all.map(c => c.code)).size).toBe(36);
    expect(all.find(c => c.nom === 'Mamou-Centre')?.quartiers).toHaveLength(28);
  });

  it('crée tout ce qui manque sous la Guinée, une seule fois', async () => {
    const { svc, reg, pref, comm, quart } = service([{ id: 'gn', nom: 'GUINÉE', indicatif: '+224', statut: 'actif' }]);
    const first = await svc.ensureRegion(REGION_MAMOU);
    expect(first).toEqual({ region: true, prefectures: 3, communes: 36, quartiers: 28 });
    expect(reg.rows).toHaveLength(1);
    expect(pref.rows.every(p => p.parentId === reg.rows[0].id)).toBe(true);
    expect(comm.rows).toHaveLength(36);
    expect(quart.rows).toHaveLength(28);
    expect([...reg.rows, ...pref.rows, ...comm.rows, ...quart.rows].every(x => x.code.length <= 50)).toBe(true);
    expect(await svc.ensureRegion(REGION_MAMOU)).toEqual({ region: false, prefectures: 0, communes: 0, quartiers: 0 });
  });

  it('réutilise ce qui existe déjà (région, préfecture, commune écrite autrement)', async () => {
    const { svc, comm } = service(
      [{ id: 'gn', nom: 'Guinée', indicatif: '', statut: 'actif' }],
      [{ id: 'r', nom: 'MAMOU', parentId: 'gn' }],
      [{ id: 'p', nom: 'PITA', parentId: 'r' }],
      [{ id: 'c', nom: 'TIMBI MADINA', parentId: 'p' }],
    );
    const res = await svc.ensureRegion(REGION_MAMOU);
    expect(res.region).toBe(false);
    expect(res.prefectures).toBe(2);
    expect(res.communes).toBe(35);
    expect(comm.rows.filter(c => foldGeo(c.nom) === 'timbi madina')).toHaveLength(1);
  });

  it('sans Guinée dans le référentiel : rien', async () => {
    const { svc } = service([]);
    expect((await svc.ensureRegion(REGION_MAMOU)).communes).toBe(0);
  });
});

describe('Région de Labé', () => {
  it('données : 5 préfectures, 5 communes urbaines + 49 sous-préfectures, 31 quartiers à Labé-Centre, codes uniques', () => {
    expect(REGION_LABE.prefectures.map(p => p.nom)).toEqual(['Labé', 'Koubia', 'Lélouma', 'Mali', 'Tougué']);
    const all = REGION_LABE.prefectures.flatMap(p => p.communes);
    expect(all).toHaveLength(54);
    expect(all.filter(c => c.type === 'urbaine')).toHaveLength(5);
    expect(new Set(all.map(c => c.code)).size).toBe(54);
    expect(new Set(all.find(c => c.nom === 'Labé-Centre')!.quartiers!.map(foldGeo)).size).toBe(31);
  });

  it('s\'ajoute à côté de Mamou sans rien toucher', async () => {
    const { svc, reg, comm, quart } = service([{ id: 'gn', nom: 'GUINÉE', indicatif: '+224', statut: 'actif' }]);
    await svc.ensureRegion(REGION_MAMOU);
    expect(await svc.ensureRegion(REGION_LABE)).toEqual({ region: true, prefectures: 5, communes: 54, quartiers: 31 });
    expect(reg.rows).toHaveLength(2);
    expect(comm.rows).toHaveLength(36 + 54);
    expect(quart.rows).toHaveLength(28 + 31);
    expect(new Set(quart.rows.map(q => q.code)).size).toBe(quart.rows.length);
  });
});
