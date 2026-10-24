import { CONAKRY_COMMUNES, foldGeo } from './conakry-communes';
import { GeoService } from './geo.service';

function repo(rows: any[] = []) {
  return {
    rows,
    find: jest.fn(async (opts?: any) => {
      const w = opts?.where;
      return w?.parentId ? rows.filter(r => r.parentId === w.parentId && (!w.statut || r.statut === w.statut)) : rows;
    }),
    findOne: jest.fn(async (opts: any) => rows.find(r => r.code === opts.where.code) ?? null),
    create: jest.fn((x: any) => x),
    save: jest.fn(async (x: any) => { const r = { id: `id-${rows.length}`, ...x }; rows.push(r); return r; }),
  };
}

function service(prefs: any[], communes: any[], quartiers: any[] = []) {
  const pref = repo(prefs), comm = repo(communes), quart = repo(quartiers), audit = repo();
  const svc = new GeoService(repo() as any, repo() as any, pref as any, comm as any, quart as any, repo() as any, audit as any, repo() as any);
  return { svc, comm, quart };
}

describe('Communes de Conakry', () => {
  it('liste de 13 communes, sans doublon', () => {
    expect(CONAKRY_COMMUNES).toHaveLength(13);
    expect(new Set(CONAKRY_COMMUNES.map(c => foldGeo(c.nom))).size).toBe(13);
    expect(foldGeo('MANÉAH')).toBe(foldGeo('Maneah'));
  });

  it('ajoute seulement celles qui manquent, une seule fois', async () => {
    const { svc, comm } = service(
      [{ id: 'cky', nom: 'CONAKRY', statut: 'actif' }],
      [{ id: 'k', nom: 'KALOUM', code: 'X1', parentId: 'cky', statut: 'actif' }, { id: 'r', nom: 'Ratoma', code: 'X2', parentId: 'cky', statut: 'actif' }],
    );
    const first = await svc.ensureConakryCommunes();
    expect(first.added).toHaveLength(11);
    expect(first.added).not.toContain('Kaloum');
    const again = await svc.ensureConakryCommunes();
    expect(again.added).toHaveLength(0);
    expect(comm.rows.filter(r => r.parentId === 'cky')).toHaveLength(13);
  });

  it('quartiers : ajoutés sous chaque commune, sans doublon (accents et tirets ignorés), une seule fois', async () => {
    const { svc, quart } = service(
      [{ id: 'cky', nom: 'Conakry', statut: 'actif' }],
      [{ id: 'dix', nom: 'DIXINN', code: 'D', parentId: 'cky', statut: 'actif' }],
      [{ id: 'q1', nom: 'BELLE VUE ECOLE', code: 'Q1', parentId: 'dix', statut: 'actif' }],
    );
    const total = CONAKRY_COMMUNES.reduce((n, c) => n + new Set(c.quartiers.map(foldGeo)).size, 0);
    const first = await svc.ensureConakryCommunes();
    expect(first.quartiers).toBe(total - 1);
    expect(quart.rows.filter(r => r.parentId === 'dix')).toHaveLength(17);
    expect(quart.rows.every(r => r.code.length <= 50)).toBe(true);
    expect(new Set(quart.rows.map(r => r.code)).size).toBe(quart.rows.length);
    expect((await svc.ensureConakryCommunes()).quartiers).toBe(0);
  });

  it('sans préfecture Conakry : rien ; le sélecteur propose quand même les 13 communes', async () => {
    const { svc } = service([], []);
    expect((await svc.ensureConakryCommunes()).added).toEqual([]);
    const list = await svc.communesOfVille('conakry');
    expect(list).toHaveLength(13);
    expect(list.every(c => c.id === null)).toBe(true);
  });
});
