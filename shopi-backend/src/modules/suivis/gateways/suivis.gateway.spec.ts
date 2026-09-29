/* ============================================================
 * FICHIER : src/modules/suivis/gateways/suivis.gateway.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Sécurité du namespace /suivis :
 *  - la connexion est authentifiée dans le gateway (un Guard NestJS ne
 *    s'exécute pas sur handleConnection — avant, TOUTES les connexions
 *    étaient refusées faute de userId)
 *  - compte banni/suspendu, jeton antérieur à une déconnexion ou à un
 *    changement de mot de passe, session révoquée → refusé
 *  - le namespace est enregistré pour être coupé au bannissement
 *  - join-room n'accepte que les rooms publiques de profil
 * ============================================================ */

import { SuivisGateway } from './suivis.gateway';
import { UserStatus } from '../../../database/entities/user.entity';

const IAT = Math.floor(new Date('2026-09-29T08:00:00Z').getTime() / 1000);
const UUID = '3f2b8c1a-9d4e-4b7a-8c6f-1e2d3c4b5a69';

function monter(user: Record<string, unknown> | null, opts: { jetonValide?: boolean; sessionValide?: boolean } = {}) {
  const jwt = {
    verify: jest.fn(() => {
      if (opts.jetonValide === false) throw new Error('invalid signature');
      return { sub: 'user-1', sid: 'sid-1', iat: IAT };
    }),
  };
  const userRepo = { findOne: jest.fn().mockResolvedValue(user) };
  const session  = { validateSession: jest.fn().mockResolvedValue(opts.sessionValide ?? true) };
  const notifBroadcast = { registerSessionServer: jest.fn() };

  const gateway = new SuivisGateway(jwt as any, userRepo as any, session as any, notifBroadcast as any);
  return { gateway, notifBroadcast };
}

const socket = (token: string | null = 'jwt') => ({
  id: 'sock-1', data: {} as any,
  handshake: { auth: { token }, query: {}, headers: {} },
  emit: jest.fn(), disconnect: jest.fn(), join: jest.fn(),
}) as any;

const actif = (extra: object = {}) => ({ id: 'user-1', status: UserStatus.ACTIVE, lastLogoutAt: null, lastPasswordChangedAt: null, ...extra });

describe('SuivisGateway — sécurité', () => {

  it("s'enregistre pour être coupé à la révocation de session et au bannissement", () => {
    const { gateway, notifBroadcast } = monter(actif());
    const server = {} as any;
    gateway.afterInit(server);
    expect(notifBroadcast.registerSessionServer).toHaveBeenCalledWith(server);
  });

  it('accepte un compte actif avec un jeton valide et identifie le socket', async () => {
    const { gateway } = monter(actif());
    const s = socket();

    await gateway.handleConnection(s);

    expect(s.disconnect).not.toHaveBeenCalled();
    expect(s.data.userId).toBe('user-1');
    expect(s.join).toHaveBeenCalledWith('user-user-1');
    expect(s.join).toHaveBeenCalledWith('session:sid-1');
    expect(gateway.isUserOnline('user-1')).toBe(true);
  });

  it.each([
    ['sans jeton',                    actif(), {}, null],
    ['jeton invalide',                actif(), { jetonValide: false }, 'jwt'],
    ['compte introuvable',            null,    {}, 'jwt'],
    ['compte banni',                  actif({ status: UserStatus.BANNED }), {}, 'jwt'],
    ['compte suspendu',               actif({ status: UserStatus.SUSPENDED }), {}, 'jwt'],
    ['jeton antérieur au logout',     actif({ lastLogoutAt: new Date('2026-09-29T09:00:00Z') }), {}, 'jwt'],
    ['jeton antérieur au nouveau mdp', actif({ lastPasswordChangedAt: new Date('2026-09-29T09:00:00Z') }), {}, 'jwt'],
    ['session révoquée',              actif(), { sessionValide: false }, 'jwt'],
  ])('refuse : %s', async (_cas, user, opts, token) => {
    const { gateway } = monter(user, opts);
    const s = socket(token);

    await gateway.handleConnection(s);

    expect(s.disconnect).toHaveBeenCalled();
    expect(s.join).not.toHaveBeenCalled();
    expect(s.data.userId).toBeUndefined();
  });

  describe('join-room', () => {
    const connecte = () => { const s = socket(); s.data.userId = 'user-1'; return s; };

    it.each([`company-${UUID}`, `delivery-${UUID}`, `correspondent-${UUID}`])('accepte la room publique %s', async (room) => {
      const { gateway } = monter(actif());
      const s = connecte();
      await gateway.handleJoinRoom(s, room);
      expect(s.join).toHaveBeenCalledWith(room);
    });

    it.each([
      `user-${UUID}`,            // notifications privées d'un autre
      'session:sid-autre',
      `company-${UUID}-x`,
      'company-pas-un-uuid',
      '',
    ])('refuse la room %j', async (room) => {
      const { gateway } = monter(actif());
      const s = connecte();
      await gateway.handleJoinRoom(s, room);
      expect(s.join).not.toHaveBeenCalled();
    });

    it('refuse un socket non authentifié', async () => {
      const { gateway } = monter(actif());
      const s = socket();
      await gateway.handleJoinRoom(s, `company-${UUID}`);
      expect(s.join).not.toHaveBeenCalled();
    });
  });
});
