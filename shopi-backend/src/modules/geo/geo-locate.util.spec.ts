import { locateInReferential, normalizeName, type GeoNode } from './geo-locate.util';

const n = (level: GeoNode['level'], id: string, nom: string, parentId: string | null, lat?: number, lng?: number): GeoNode =>
  ({ level, id, nom, code: id.toUpperCase(), parentId, latitude: lat ?? null, longitude: lng ?? null });

const REF: GeoNode[] = [
  n('pays', 'gn', 'Guinée', null),
  n('region', 'rcky', 'Conakry', 'gn'),
  n('prefecture', 'cky', 'Conakry', 'rcky', 9.6412, -13.5784),
  n('commune', 'kal', 'Kaloum', 'cky', 9.5092, -13.7122),
  n('commune', 'rat', 'Ratoma', 'cky', 9.6550, -13.6300),
  n('quartier', 'boul', 'Boulbinet', 'kal', 9.5160, -13.7110),
  n('quartier', 'kip', 'Kipé', 'rat', 9.6230, -13.6460),
  n('quartier', 'nongo', 'Nongo', 'rat'),               // pas encore de coordonnées
  n('prefecture', 'kin', 'Kindia', 'rcky', 10.0569, -12.8658),
];

describe('Localiser une position dans le référentiel', () => {
  it('quartier le plus proche, puis commune, ville et pays par les liens parent', () => {
    const r = locateInReferential(REF, 9.5165, -13.7105);
    expect(r).toMatchObject({ precision: 'quartier', source: 'coords', quartier: { nom: 'Boulbinet' }, commune: { nom: 'Kaloum' }, ville: { nom: 'Conakry' }, pays: { nom: 'Guinée' } });
    expect(r.distanceM).toBeLessThan(200);
  });

  it('quartier sans coordonnées retrouvé par son nom, mais seulement dans la bonne commune', () => {
    const r = locateInReferential(REF, 9.6560, -13.6310, ['Nongo', 'Ratoma']);
    // Kipé est à ~4 km : trop loin pour un quartier → commune Ratoma, puis Nongo par le nom.
    expect(r).toMatchObject({ precision: 'quartier', commune: { nom: 'Ratoma' }, quartier: { nom: 'Nongo' } });
  });

  it('sans coordonnées proches : par les noms lus par le téléphone (accents/majuscules ignorés)', () => {
    const r = locateInReferential(REF, 0, 0, ['KIPE', 'Conakry']);
    expect(r).toMatchObject({ source: 'nom', quartier: { nom: 'Kipé' }, commune: { nom: 'Ratoma' }, ville: { nom: 'Conakry' } });
  });

  it('rien de reconnaissable → tout à null (jamais d’invention)', () => {
    expect(locateInReferential(REF, 48.85, 2.35, ['Paris'])).toMatchObject({ precision: null, pays: null, ville: null, source: null });
  });

  it('normalisation des noms', () => {
    expect(normalizeName('Commune de Kâloum')).toBe('kaloum');
    expect(normalizeName("Tombo-Gbessia")).toBe('tombo gbessia');
  });
});
