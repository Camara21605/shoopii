/* ============================================================
 * FICHIER : src/modules/explore/search-text.util.spec.ts
 * RÔLE    : Tests unitaires de la normalisation de recherche.
 * ============================================================ */

import { likeEscape, normalizeText, searchPhrase, searchTokens } from './search-text.util';

describe('search-text.util', () => {
  it('retire accents et majuscules', () => {
    expect(normalizeText('TÉLÉPHONE Électroménager')).toBe('telephone electromenager');
  });

  it('découpe en mots, retire les mots vides et le pluriel simple', () => {
    expect(searchTokens('Chaussures de Sport')).toEqual(['chaussure', 'sport']);
    expect(searchTokens('  galaxy   samsung ')).toEqual(['galaxy', 'samsung']);
  });

  it("garde les mots vides s'il n'y a rien d'autre", () => {
    expect(searchTokens('de la')).toEqual(['de', 'la']);
  });

  it('ignore la ponctuation et les jokers SQL', () => {
    expect(searchTokens('%')).toEqual([]);
    expect(searchTokens("l'iPhone 15")).toEqual(['iphone', '15']);
  });

  it('dédoublonne et borne le nombre de mots', () => {
    expect(searchTokens('riz riz riz')).toEqual(['riz']);
    expect(searchTokens('a1 b2 c3 d4 e5 f6 g7')).toHaveLength(5);
  });

  it('phrase normalisée pour le classement', () => {
    expect(searchPhrase('  Téléphone   Samsung ')).toBe('telephone samsung');
  });

  it('échappe les jokers LIKE', () => {
    expect(likeEscape('100%_\\')).toBe('100\\%\\_\\\\');
  });
});
