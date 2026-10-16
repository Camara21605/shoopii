import { DEVICE_TOKEN_TTL_MS, PROBE_TOKEN_TTL_MS, signPresence, verifyPresence } from './presence-token.util';

describe('Jeton de présence du téléphone', () => {
  const S = 'secret-de-test';

  it('authentique et non expiré : accepté', () => {
    const t = signPresence({ u: 'user-1' }, S, DEVICE_TOKEN_TTL_MS, 1_000);
    expect(verifyPresence(t, S, 2_000)).toEqual({ u: 'user-1' });
  });

  it('jeton de vérification : garde son identifiant, expire vite', () => {
    const t = signPresence({ u: 'user-1', p: 'probe-9' }, S, PROBE_TOKEN_TTL_MS, 0);
    expect(verifyPresence(t, S, 60_000)).toEqual({ u: 'user-1', p: 'probe-9' });
    expect(verifyPresence(t, S, PROBE_TOKEN_TTL_MS + 1)).toBeNull();
  });

  it('modifié, autre secret ou n’importe quoi : refusé', () => {
    const t = signPresence({ u: 'user-1' }, S, DEVICE_TOKEN_TTL_MS);
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ u: 'user-2', e: Date.now() + 1e9 })).toString('base64url');
    expect(verifyPresence(`${forged}.${sig}`, S)).toBeNull();
    expect(verifyPresence(`${body}.${sig}x`, S)).toBeNull();
    expect(verifyPresence(t, 'autre')).toBeNull();
    expect(verifyPresence(42, S)).toBeNull();
    expect(verifyPresence('a'.repeat(700), S)).toBeNull();
  });
});
