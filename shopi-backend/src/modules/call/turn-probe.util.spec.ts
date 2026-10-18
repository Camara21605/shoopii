import { createHash, createHmac } from 'crypto';
import { buildMessage, errorCodeOf, explainProbe, parseMessage, resolveTurnCredentials } from './turn-probe.util';

describe('turn-probe.util', () => {
  it('message STUN : en-tête, attributs et MESSAGE-INTEGRITY corrects', () => {
    const key = createHash('md5').update('u:realm:p').digest();
    const user = Buffer.from('u');
    const head = Buffer.alloc(4); head.writeUInt16BE(0x0006, 0); head.writeUInt16BE(1, 2);
    const msg = buildMessage(0x0003, [Buffer.concat([head, user, Buffer.alloc(3)])], key);
    expect(msg.readUInt16BE(0)).toBe(0x0003);
    expect(msg.readUInt32BE(4)).toBe(0x2112a442);
    expect(msg.readUInt16BE(2)).toBe(msg.length - 20);
    const { attrs } = parseMessage(msg);
    expect(attrs.map(a => a.type)).toEqual([0x0006, 0x0008]);
    expect(attrs[0].value.toString()).toBe('u');
    const mac = createHmac('sha1', key).update(msg.subarray(0, msg.length - 24)).digest();
    expect(attrs[1].value.equals(mac)).toBe(true);
  });

  it('code d’erreur lu depuis ERROR-CODE', () => {
    const v = Buffer.concat([Buffer.from([0, 0, 4, 1]), Buffer.from('Unauthorized')]);
    expect(errorCodeOf([{ type: 0x0009, value: v }])).toEqual({ code: 401, reason: 'Unauthorized' });
  });

  it('identifiants : statiques, éphémères, absents', () => {
    const env = (o: Record<string, string>) => (k: string) => o[k];
    expect(resolveTurnCredentials(env({}))).toBeNull();
    expect(resolveTurnCredentials(env({ METERED_TURN_HOST: 'h', METERED_TURN_USERNAME: 'u', METERED_TURN_CREDENTIAL: 'c' })))
      .toEqual({ host: 'h', username: 'u', credential: 'c', mode: 'static' });
    expect(resolveTurnCredentials(env({ METERED_TURN_HOST: 'h', METERED_TURN_SECRET: 's' }))?.mode).toBe('ephemeral');
  });

  it('explications', () => {
    expect(explainProbe({ ok: false, ms: 1, stage: 'auth', error: '401', code: 401 })).toMatch(/refusés/);
    expect(explainProbe({ ok: false, ms: 1, stage: 'connect', error: 'ENOTFOUND' })).toMatch(/injoignable/);
  });
});
