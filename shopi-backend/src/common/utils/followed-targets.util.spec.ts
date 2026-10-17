import { followedTargetsSql, parseMasquerSuivis } from './followed-targets.util';

describe('Comptes suivis retirés de l’accueil', () => {
  it('ne compte que les abonnements actifs, quel que soit le rôle du suiveur', () => {
    const sql = followedTargetsSql('company');
    expect(sql).toContain(`f."targetType" = 'company'`);
    expect(sql).toContain('f."isSubscribed" = true');
    expect(sql).toContain(`f.status = 'active'`);
    for (const t of ['clients', 'entreprises', 'livreurs', 'correspondants']) expect(sql).toContain(`FROM ${t} WHERE "userId" = :viewerUserId`);
  });

  it('paramètre ?masquerSuivis= : seulement true / 1', () => {
    expect(parseMasquerSuivis('true')).toBe(true);
    expect(parseMasquerSuivis('1')).toBe(true);
    expect(parseMasquerSuivis(undefined)).toBe(false);
    expect(parseMasquerSuivis('false')).toBe(false);
  });
});
