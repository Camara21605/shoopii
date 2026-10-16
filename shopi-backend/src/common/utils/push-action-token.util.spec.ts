import { PUSH_ACTION_TTL_MS, signPushAction, verifyPushAction } from './push-action-token.util';

const CLAIMS = { c: 'conv-1', u: 'user-1', t: 'client', i: 'actor-1' };

describe('Jeton des boutons de notification (Répondre / Marquer comme lu)', () => {
  it('un jeton authentique donne exactement ses droits', () => {
    expect(verifyPushAction(signPushAction(CLAIMS, 's3cret'), 's3cret')).toEqual(CLAIMS);
  });
  it('refuse un jeton modifié, signé ailleurs, expiré ou absurde', () => {
    const tok = signPushAction(CLAIMS, 's3cret', 0);
    const [body, sig] = tok.split('.');
    const forged = Buffer.from(JSON.stringify({ ...CLAIMS, c: 'autre-conv', e: Date.now() + 1e9 })).toString('base64url');
    expect(verifyPushAction(`${forged}.${sig}`, 's3cret')).toBeNull();
    expect(verifyPushAction(signPushAction(CLAIMS, 'autre-clé'), 's3cret')).toBeNull();
    expect(verifyPushAction(tok, 's3cret', PUSH_ACTION_TTL_MS + 1)).toBeNull();
    expect(verifyPushAction(`${body}`, 's3cret')).toBeNull();
    expect(verifyPushAction(42, 's3cret')).toBeNull();
  });
});
