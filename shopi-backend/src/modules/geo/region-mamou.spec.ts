import { CONAKRY_COMMUNES, foldGeo } from './conakry-communes';
import { GeoService } from './geo.service';
import { REGION_BEYLA } from './region-beyla';
import { REGION_BOKE } from './region-boke';
import { REGION_FARANAH } from './region-faranah';
import { REGION_KANKAN } from './region-kankan';
import { REGION_KINDIA } from './region-kindia';
import { REGION_LABE } from './region-labe';
import { REGION_MAMOU } from './region-mamou';
import { REGION_NZEREKORE } from './region-nzerekore';

function repo(rows: any[] = []) {
  return {
    rows,
    find: jest.fn(async (opts?: any) => {
      const w = opts?.where;
      return w?.parentId ? rows.filter(r => r.parentId === w.parentId && (!w.statut || r.statut === w.statut)) : rows;
    }),
    findOne: jest.fn(async (opts: any) => rows.find(r => r.code === opts.where.code) ?? null),
    create: jest.fn((x: any) => x),
    update: jest.fn(async (id: string, patch: any) => { Object.assign(rows.find(r => r.id === id) ?? {}, patch); }),
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

  it('données : 4 préfectures (avec Timbo), 3 communes urbaines + 33 sous-préfectures, 28 quartiers à Mamou-Centre, codes uniques', () => {
    expect(REGION_MAMOU.prefectures.map(p => p.nom)).toEqual(['Mamou', 'Timbo', 'Dalaba', 'Pita']);
    expect(nbCommunes).toBe(36);
    const all = REGION_MAMOU.prefectures.flatMap(p => p.communes);
    expect(all.filter(c => c.type === 'urbaine')).toHaveLength(3);
    expect(new Set(all.map(c => c.code)).size).toBe(36);
    expect(all.find(c => c.nom === 'Mamou-Centre')?.quartiers).toHaveLength(28);
  });

  it('Pita et Dalaba : quartiers des 2 communes urbaines + districts de leurs 20 communes rurales, sans doublon', () => {
    const pd = REGION_MAMOU.prefectures.filter(p => p.nom === 'Pita' || p.nom === 'Dalaba').flatMap(p => p.communes);
    expect(pd).toHaveLength(22);
    expect(pd.every(c => (c.quartiers?.length ?? 0) >= 4)).toBe(true);
    for (const c of pd) expect(new Set(c.quartiers!.map(foldGeo)).size).toBe(c.quartiers!.length);
    expect(pd.find(c => c.nom === 'Pita-Centre')!.quartiers).toHaveLength(13);
    expect(pd.find(c => c.nom === 'Dalaba-Centre')!.quartiers).toHaveLength(7);
    expect(pd.reduce((n, c) => n + c.quartiers!.length, 0)).toBe(199);
  });

  it('crée tout ce qui manque sous la Guinée, une seule fois', async () => {
    const { svc, reg, pref, comm, quart } = service([{ id: 'gn', nom: 'GUINÉE', indicatif: '+224', statut: 'actif' }]);
    const first = await svc.ensureRegion(REGION_MAMOU);
    expect(first).toEqual({ region: true, prefectures: 4, communes: 36, quartiers: 326 });
    expect(reg.rows).toHaveLength(1);
    expect(pref.rows.every(p => p.parentId === reg.rows[0].id)).toBe(true);
    expect(comm.rows).toHaveLength(36);
    expect(quart.rows).toHaveLength(326);
    expect(new Set(quart.rows.map(q => q.code)).size).toBe(326);
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
    expect(res.prefectures).toBe(3);
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
    expect(quart.rows).toHaveLength(326 + 31);
    expect(new Set(quart.rows.map(q => q.code)).size).toBe(quart.rows.length);
  });
});

describe('Région de Kankan', () => {
  const pref = (nom: string) => REGION_KANKAN.prefectures.find(p => p.nom === nom)!;

  it('données : 5 préfectures, 5 communes urbaines + 68 sous-préfectures, codes et noms uniques', () => {
    expect(REGION_KANKAN.prefectures.map(p => p.nom)).toEqual(['Kankan', 'Kérouané', 'Kouroussa', 'Mandiana', 'Siguiri']);
    expect(REGION_KANKAN.prefectures.map(p => p.communes.length - 1)).toEqual([15, 7, 14, 12, 20]);
    const all = REGION_KANKAN.prefectures.flatMap(p => p.communes);
    expect(all).toHaveLength(73);
    expect(all.filter(c => c.type === 'urbaine').map(c => c.nom))
      .toEqual(['Kankan-Centre', 'Kérouané-Centre', 'Kouroussa-Centre', 'Mandiana-Centre', 'Siguiri-Centre']);
    expect(new Set(all.map(c => c.code)).size).toBe(73);
    for (const p of REGION_KANKAN.prefectures) expect(new Set(p.communes.map(c => foldGeo(c.nom))).size).toBe(p.communes.length);
  });

  it('quartiers : Kankan 27, Kérouané 13, Kouroussa 10, Mandiana 7, Siguiri 39', () => {
    expect(new Set(pref('Kankan').communes[0].quartiers!.map(foldGeo)).size).toBe(27);
    expect(new Set(pref('Siguiri').communes[0].quartiers!.map(foldGeo)).size).toBe(39);
    expect(new Set(pref('Kérouané').communes[0].quartiers!.map(foldGeo)).size).toBe(13);
    expect(new Set(pref('Kouroussa').communes[0].quartiers!.map(foldGeo)).size).toBe(10);
    expect(new Set(pref('Mandiana').communes[0].quartiers!.map(foldGeo)).size).toBe(7);
  });

  it('s\'ajoute après Mamou et Labé, puis ne refait rien', async () => {
    const { svc, reg, comm, quart } = service([{ id: 'gn', nom: 'GUINÉE', indicatif: '+224', statut: 'actif' }]);
    await svc.ensureRegion(REGION_MAMOU);
    await svc.ensureRegion(REGION_LABE);
    expect(await svc.ensureRegion(REGION_KANKAN)).toEqual({ region: true, prefectures: 5, communes: 73, quartiers: 96 });
    expect(reg.rows).toHaveLength(3);
    expect(comm.rows).toHaveLength(36 + 54 + 73);
    expect(quart.rows).toHaveLength(326 + 31 + 96);
    expect(new Set(quart.rows.map(q => q.code)).size).toBe(quart.rows.length);
    expect(await svc.ensureRegion(REGION_KANKAN)).toEqual({ region: false, prefectures: 0, communes: 0, quartiers: 0 });
  });

  it('communes déjà créées sans quartiers (version précédente) : seuls les quartiers s\'ajoutent', async () => {
    const { svc } = service([{ id: 'gn', nom: 'GUINÉE', indicatif: '+224', statut: 'actif' }]);
    const sansQuartiers = { ...REGION_KANKAN, prefectures: REGION_KANKAN.prefectures.map(p => ({
      ...p, communes: p.communes.map(c => (['Kérouané-Centre', 'Kouroussa-Centre', 'Mandiana-Centre'].includes(c.nom) ? { ...c, quartiers: undefined } : c)),
    })) };
    await svc.ensureRegion(sansQuartiers);
    expect(await svc.ensureRegion(REGION_KANKAN)).toEqual({ region: false, prefectures: 0, communes: 0, quartiers: 30 });
  });

  it('Siguiri déjà en base (version précédente) : seules les 4 autres préfectures s\'ajoutent', async () => {
    const { svc } = service([{ id: 'gn', nom: 'GUINÉE', indicatif: '+224', statut: 'actif' }]);
    await svc.ensureRegion({ ...REGION_KANKAN, prefectures: [pref('Siguiri')] });
    expect(await svc.ensureRegion(REGION_KANKAN)).toEqual({ region: false, prefectures: 4, communes: 52, quartiers: 57 });
  });
});

describe('Région de Faranah', () => {
  const pref = (nom: string) => REGION_FARANAH.prefectures.find(p => p.nom === nom)!;

  it('données : 4 préfectures, 4 communes urbaines + 42 sous-préfectures, codes et noms uniques', () => {
    expect(REGION_FARANAH.prefectures.map(p => p.nom)).toEqual(['Faranah', 'Dabola', 'Dinguiraye', 'Kissidougou']);
    expect(REGION_FARANAH.prefectures.map(p => p.communes.length - 1)).toEqual([15, 8, 7, 12]);
    const all = REGION_FARANAH.prefectures.flatMap(p => p.communes);
    expect(all).toHaveLength(46);
    expect(all.filter(c => c.type === 'urbaine').map(c => c.nom))
      .toEqual(['Faranah-Centre', 'Dabola-Centre', 'Dinguiraye-Centre', 'Kissidougou-Centre']);
    expect(new Set(all.map(c => c.code)).size).toBe(46);
    for (const p of REGION_FARANAH.prefectures) expect(new Set(p.communes.map(c => foldGeo(c.nom))).size).toBe(p.communes.length);
  });

  it('quartiers et districts : 512, sans doublon dans une même commune ; Ballaya seule sans liste', () => {
    const all = REGION_FARANAH.prefectures.flatMap(p => p.communes);
    for (const c of all) expect(new Set((c.quartiers ?? []).map(foldGeo)).size).toBe(c.quartiers?.length ?? 0);
    expect(all.filter(c => !c.quartiers?.length).map(c => c.nom)).toEqual(['Ballaya']);
    expect(all.reduce((n, c) => n + (c.quartiers?.length ?? 0), 0)).toBe(512);
    expect(pref('Faranah').communes[0].quartiers).toHaveLength(25);
    expect(pref('Kissidougou').communes[0].quartiers).toHaveLength(24);
    expect(pref('Faranah').communes.find(c => c.nom === 'Banian')!.quartiers!.map(foldGeo)).not.toContain('ballaya');
  });

  it('s\'ajoute après les autres régions, puis ne refait rien', async () => {
    const { svc, reg, comm, quart } = service([{ id: 'gn', nom: 'GUINÉE', indicatif: '+224', statut: 'actif' }]);
    for (const r of [REGION_MAMOU, REGION_LABE, REGION_KANKAN]) await svc.ensureRegion(r);
    const before = { comm: comm.rows.length, quart: quart.rows.length };
    expect(await svc.ensureRegion(REGION_FARANAH)).toEqual({ region: true, prefectures: 4, communes: 46, quartiers: 512 });
    expect(reg.rows).toHaveLength(4);
    expect(comm.rows).toHaveLength(before.comm + 46);
    expect(quart.rows).toHaveLength(before.quart + 512);
    expect(new Set(quart.rows.map(q => q.code)).size).toBe(quart.rows.length);
    expect(quart.rows.every(q => q.code.length <= 50)).toBe(true);
    expect(await svc.ensureRegion(REGION_FARANAH)).toEqual({ region: false, prefectures: 0, communes: 0, quartiers: 0 });
  });
});

describe('Région de Kindia', () => {
  const pref = (nom: string) => REGION_KINDIA.prefectures.find(p => p.nom === nom)!;

  it('données : 5 préfectures, 5 communes urbaines + 42 communes rurales, codes et noms uniques', () => {
    expect(REGION_KINDIA.prefectures.map(p => p.nom)).toEqual(['Kindia', 'Coyah', 'Dubréka', 'Forécariah', 'Télimélé']);
    expect(REGION_KINDIA.prefectures.map(p => p.communes.length - 1)).toEqual([10, 2, 6, 10, 14]);
    const all = REGION_KINDIA.prefectures.flatMap(p => p.communes);
    expect(all).toHaveLength(47);
    expect(all.filter(c => c.type === 'urbaine').map(c => c.nom))
      .toEqual(['Kindia-Centre', 'Coyah-Centre', 'Dubréka-Centre', 'Forécariah-Centre', 'Télimélé-Centre']);
    expect(new Set(all.map(c => c.code)).size).toBe(47);
    for (const p of REGION_KINDIA.prefectures) expect(new Set(p.communes.map(c => foldGeo(c.nom))).size).toBe(p.communes.length);
  });

  it('chaque commune a ses quartiers/districts, sans doublon ; 576 au total', () => {
    const all = REGION_KINDIA.prefectures.flatMap(p => p.communes);
    for (const c of all) {
      expect(c.quartiers!.length).toBeGreaterThanOrEqual(2);
      expect(new Set(c.quartiers!.map(foldGeo)).size).toBe(c.quartiers!.length);
    }
    expect(all.reduce((n, c) => n + c.quartiers!.length, 0)).toBe(576);
    expect(pref('Kindia').communes[0].quartiers).toHaveLength(47);
    expect(pref('Dubréka').communes[0].quartiers).toHaveLength(15);
  });

  it('pas de doublon avec le Grand Conakry : Manéah, Sanoyah et Kagbélen n\'y sont pas', () => {
    const noms = REGION_KINDIA.prefectures.flatMap(p => p.communes.map(c => foldGeo(c.nom)));
    for (const n of CONAKRY_COMMUNES.map(c => foldGeo(c.nom))) expect(noms).not.toContain(n);
  });

  it('préfecture « Kindia » déjà saisie sans région : réutilisée, le reste ajouté, puis plus rien', async () => {
    const { svc, pref: prefs, comm, quart } = service(
      [{ id: 'gn', nom: 'GUINÉE', indicatif: '+224', statut: 'actif' }], [],
      [{ id: 'k', nom: 'KINDIA', parentId: null }],
      [{ id: 'kc', nom: 'KINDIA CENTRE', parentId: 'k' }],
    );
    expect(await svc.ensureRegion(REGION_KINDIA)).toEqual({ region: true, prefectures: 4, communes: 46, quartiers: 576 });
    expect(prefs.rows).toHaveLength(5);
    expect(comm.rows.filter(c => c.parentId === 'k')).toHaveLength(11);
    expect(quart.rows.filter(q => q.parentId === 'kc')).toHaveLength(47);
    expect(new Set(quart.rows.map(q => q.code)).size).toBe(quart.rows.length);
    expect(quart.rows.every(q => q.code.length <= 50)).toBe(true);
    expect(await svc.ensureRegion(REGION_KINDIA)).toEqual({ region: false, prefectures: 0, communes: 0, quartiers: 0 });
  });
});

describe('Région de Beyla (décret du 20 août 2026)', () => {
  const pref = (nom: string) => REGION_BEYLA.prefectures.find(p => p.nom === nom)!;

  it('données : Beyla + Sinko, Karala, Kouankan ; Beyla-Centre + 13 communes rurales dans Beyla', () => {
    expect(REGION_BEYLA.prefectures.map(p => p.nom)).toEqual(['Beyla', 'Sinko', 'Karala', 'Kouankan']);
    expect(pref('Beyla').communes).toHaveLength(14);
    expect(pref('Beyla').communes.filter(c => c.type === 'urbaine').map(c => c.nom)).toEqual(['Beyla-Centre']);
    for (const n of ['Sinko', 'Karala', 'Kouankan']) {
      expect(pref(n).communes.map(c => c.nom)).toEqual([n]);
      expect(pref('Beyla').communes.map(c => foldGeo(c.nom))).not.toContain(foldGeo(n));
    }
    const all = REGION_BEYLA.prefectures.flatMap(p => p.communes);
    expect(new Set(all.map(c => c.code)).size).toBe(17);
  });

  it('quartiers et districts : 238, sans doublon ; seule Fonodou sans liste', () => {
    const all = REGION_BEYLA.prefectures.flatMap(p => p.communes);
    for (const c of all) expect(new Set((c.quartiers ?? []).map(foldGeo)).size).toBe(c.quartiers?.length ?? 0);
    expect(all.filter(c => !c.quartiers?.length).map(c => c.nom)).toEqual(['Fonodou']);
    expect(all.reduce((n, c) => n + (c.quartiers?.length ?? 0), 0)).toBe(238);
    expect(pref('Beyla').communes.find(c => c.nom === 'Samana')!.quartiers!.map(foldGeo)).not.toContain('sokourala');
  });

  it('s\'ajoute après les autres régions, puis ne refait rien', async () => {
    const { svc, reg, quart } = service([{ id: 'gn', nom: 'GUINÉE', indicatif: '+224', statut: 'actif' }]);
    for (const r of [REGION_MAMOU, REGION_LABE, REGION_KANKAN, REGION_FARANAH, REGION_KINDIA]) await svc.ensureRegion(r);
    expect(await svc.ensureRegion(REGION_BEYLA)).toEqual({ region: true, prefectures: 4, communes: 17, quartiers: 238 });
    expect(reg.rows).toHaveLength(6);
    expect(new Set(quart.rows.map(q => q.code)).size).toBe(quart.rows.length);
    expect(quart.rows.every(q => q.code.length <= 50)).toBe(true);
    expect(await svc.ensureRegion(REGION_BEYLA)).toEqual({ region: false, prefectures: 0, communes: 0, quartiers: 0 });
  });
});

describe('Région de N\'Zérékoré', () => {
  const pref = (nom: string) => REGION_NZEREKORE.prefectures.find(p => p.nom === nom)!;

  it('données : 5 préfectures (sans Beyla), 5 communes urbaines + 48 communes rurales, sans Kouankan', () => {
    expect(REGION_NZEREKORE.prefectures.map(p => p.nom)).toEqual(['N\'Zérékoré', 'Guéckédou', 'Lola', 'Macenta', 'Yomou']);
    expect(REGION_NZEREKORE.prefectures.map(p => p.communes.length - 1)).toEqual([10, 11, 8, 13, 6]);
    const all = REGION_NZEREKORE.prefectures.flatMap(p => p.communes);
    expect(all).toHaveLength(53);
    expect(all.filter(c => c.type === 'urbaine')).toHaveLength(5);
    expect(new Set(all.map(c => c.code)).size).toBe(53);
    expect(all.map(c => foldGeo(c.nom))).not.toContain('kouankan');
    for (const p of REGION_NZEREKORE.prefectures) expect(new Set(p.communes.map(c => foldGeo(c.nom))).size).toBe(p.communes.length);
  });

  it('chaque commune a ses quartiers/districts, sans doublon ; 620 au total', () => {
    const all = REGION_NZEREKORE.prefectures.flatMap(p => p.communes);
    for (const c of all) {
      expect(c.quartiers!.length).toBeGreaterThanOrEqual(3);
      expect(new Set(c.quartiers!.map(foldGeo)).size).toBe(c.quartiers!.length);
    }
    expect(all.reduce((n, c) => n + c.quartiers!.length, 0)).toBe(620);
    expect(pref('N\'Zérékoré').communes[0].quartiers).toHaveLength(22);
    expect(pref('Macenta').communes[0].quartiers!.map(foldGeo)).not.toContain(foldGeo('Districts-Urbains'));
  });

  it('s\'ajoute à côté de Beyla, puis ne refait rien', async () => {
    const { svc, reg, quart } = service([{ id: 'gn', nom: 'GUINÉE', indicatif: '+224', statut: 'actif' }]);
    await svc.ensureRegion(REGION_BEYLA);
    expect(await svc.ensureRegion(REGION_NZEREKORE)).toEqual({ region: true, prefectures: 5, communes: 53, quartiers: 620 });
    expect(reg.rows).toHaveLength(2);
    expect(new Set(quart.rows.map(q => q.code)).size).toBe(quart.rows.length);
    expect(quart.rows.every(q => q.code.length <= 50)).toBe(true);
    expect(await svc.ensureRegion(REGION_NZEREKORE)).toEqual({ region: false, prefectures: 0, communes: 0, quartiers: 0 });
  });
});

describe('Région de Boké', () => {
  const pref = (nom: string) => REGION_BOKE.prefectures.find(p => p.nom === nom)!;

  it('données : 6 préfectures (avec Kamsar), 5 communes urbaines + 32 communes rurales', () => {
    expect(REGION_BOKE.prefectures.map(p => p.nom)).toEqual(['Boké', 'Kamsar', 'Boffa', 'Fria', 'Gaoual', 'Koundara']);
    expect(pref('Kamsar').communes.map(c => c.nom)).toEqual(['Kamsar']);
    expect(pref('Boké').communes.map(c => foldGeo(c.nom))).not.toContain('kamsar');
    const all = REGION_BOKE.prefectures.flatMap(p => p.communes);
    expect(all).toHaveLength(37);
    expect(all.filter(c => c.type === 'urbaine')).toHaveLength(5);
    expect(new Set(all.map(c => c.code)).size).toBe(37);
    for (const p of REGION_BOKE.prefectures) expect(new Set(p.communes.map(c => foldGeo(c.nom))).size).toBe(p.communes.length);
  });

  it('chaque commune a ses quartiers/districts, sans doublon', () => {
    const all = REGION_BOKE.prefectures.flatMap(p => p.communes);
    for (const c of all) {
      expect(c.quartiers!.length).toBeGreaterThanOrEqual(4);
      expect(new Set(c.quartiers!.map(foldGeo)).size).toBe(c.quartiers!.length);
    }
    expect(all.reduce((n, c) => n + c.quartiers!.length, 0)).toBe(398);
  });

  it('s\'ajoute, puis ne refait rien', async () => {
    const { svc, quart } = service([{ id: 'gn', nom: 'GUINÉE', indicatif: '+224', statut: 'actif' }]);
    expect(await svc.ensureRegion(REGION_BOKE)).toEqual({ region: true, prefectures: 6, communes: 37, quartiers: 398 });
    expect(new Set(quart.rows.map(q => q.code)).size).toBe(quart.rows.length);
    expect(quart.rows.every(q => q.code.length <= 50)).toBe(true);
    expect(await svc.ensureRegion(REGION_BOKE)).toEqual({ region: false, prefectures: 0, communes: 0, quartiers: 0 });
  });
});

describe('Mamou : districts des sous-préfectures et préfecture de Timbo (décret du 20 août 2026)', () => {
  const pref = (nom: string) => REGION_MAMOU.prefectures.find(p => p.nom === nom)!;

  it('les 12 communes rurales de Mamou et Timbo ont leurs districts, sans doublon', () => {
    const mamou = pref('Mamou').communes.filter(c => c.type === 'rurale');
    expect(mamou).toHaveLength(12);
    expect(mamou.map(c => foldGeo(c.nom))).not.toContain('timbo');
    for (const c of [...mamou, ...pref('Timbo').communes]) {
      expect(c.quartiers!.length).toBeGreaterThanOrEqual(4);
      expect(new Set(c.quartiers!.map(foldGeo)).size).toBe(c.quartiers!.length);
    }
    expect([...mamou, ...pref('Timbo').communes].reduce((n, c) => n + c.quartiers!.length, 0)).toBe(99);
    expect(pref('Timbo')).toMatchObject({ anciennement: 'Mamou', communes: [{ nom: 'Timbo' }] });
  });

  it('base existante : la commune Timbo enregistrée sous Mamou est rattachée à la préfecture de Timbo, sans doublon', async () => {
    const { svc, pref: prefs, comm, quart } = service(
      [{ id: 'gn', nom: 'GUINÉE', indicatif: '+224', statut: 'actif' }],
      [{ id: 'r', nom: 'MAMOU', parentId: 'gn' }],
      [{ id: 'pm', nom: 'MAMOU', parentId: 'r' }],
      [{ id: 'ct', nom: 'TIMBO', code: 'GN-MAM-MAM-TIM', parentId: 'pm' }],
    );
    const res = await svc.ensureRegion(REGION_MAMOU);
    expect(res.moved).toBe(1);
    const timbo = prefs.rows.find(p => p.nom === 'TIMBO')!;
    expect(comm.rows.filter(c => foldGeo(c.nom) === 'timbo')).toEqual([expect.objectContaining({ id: 'ct', parentId: timbo.id })]);
    expect(quart.rows.filter(q => q.parentId === 'ct')).toHaveLength(6);
    expect(await svc.ensureRegion(REGION_MAMOU)).toEqual({ region: false, prefectures: 0, communes: 0, quartiers: 0 });
  });

  it('même rattachement pour Kamsar (Boké), Sinko et Karala (Beyla), Kouankan (Macenta)', async () => {
    const { svc, pref: prefs, comm } = service(
      [{ id: 'gn', nom: 'GUINÉE', indicatif: '+224', statut: 'actif' }], [],
      [{ id: 'pb', nom: 'BOKÉ', parentId: null }, { id: 'pby', nom: 'BEYLA', parentId: null }, { id: 'pmc', nom: 'MACENTA', parentId: null }],
      [
        { id: 'k', nom: 'KAMSAR', code: 'X1', parentId: 'pb' }, { id: 's', nom: 'SINKO', code: 'X2', parentId: 'pby' },
        { id: 'ka', nom: 'KARALA', code: 'X3', parentId: 'pby' }, { id: 'ko', nom: 'KOUANKAN', code: 'X4', parentId: 'pmc' },
      ],
    );
    expect((await svc.ensureRegion(REGION_BOKE)).moved).toBe(1);
    expect((await svc.ensureRegion(REGION_BEYLA)).moved).toBe(3);
    for (const [id, nom] of [['k', 'KAMSAR'], ['s', 'SINKO'], ['ka', 'KARALA'], ['ko', 'KOUANKAN']]) {
      expect(comm.rows.find(c => c.id === id)!.parentId).toBe(prefs.rows.find(p => p.nom === nom)!.id);
      expect(comm.rows.filter(c => c.nom === nom)).toHaveLength(1);
    }
  });
});
