/* ============================================================
 * FICHIER : src/modules/dashboard/changement-mot-de-passe.sockets.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Changer son mot de passe (depuis n'importe quel tableau de bord) doit
 * couper les sockets temps réel déjà ouverts : les jetons sont invalidés,
 * mais un socket ne revérifie son jeton qu'à la reconnexion — une
 * session volée continuait donc à recevoir messages et notifications.
 * ============================================================ */

import * as bcrypt from 'bcryptjs';

import { SecuriteService as SecuriteClientService } from './client/services/securite.service';
import { SecuriteParametresService } from './entreprise/services/securite-parametres.service';
import { SecuriteLivreurService } from './livreur/services/securite-livreur.service';
import { SecuriteAdminService } from './super-admin/services/securite-admin.service';
import { SecuritePartenaireService } from './partenaire/services/securite-partenaire.service';
import { SecuriteService as SecuriteCorrespondantService } from './correspondant/services/securite.service';

const ANCIEN  = 'Ancien-mdp-123';
const NOUVEAU = 'Nouveau-mdp-456';

describe('Changement de mot de passe — coupe les sockets déjà ouverts', () => {

  let hash: string;
  beforeAll(async () => { hash = await bcrypt.hash(ANCIEN, 4); });

  /** Dépôt factice : la même ligne sert d'utilisateur et de profil. */
  function repo() {
    const ligne = () => ({ id: 'user-1', userId: 'user-1', email: 'moi@shopi.test', firstName: 'Moi', password: hash });
    const qb: any = {
      where: () => qb, andWhere: () => qb, select: () => qb, addSelect: () => qb,
      getOne: async () => ligne(),
    };
    return {
      findOne: jest.fn(async () => ligne()),
      save:    jest.fn(async (x: unknown) => x),
      update:  jest.fn(async () => undefined),
      create:  jest.fn((x: unknown) => x),
      createQueryBuilder: jest.fn(() => qb),
    };
  }

  const notif  = () => ({ fermerSessionsTempsReel: jest.fn().mockResolvedValue(0) });
  const config = { get: jest.fn((_k: string, d?: string) => d ?? 'https://shopi.test') };
  const mail   = { sendPasswordChangedEmail: jest.fn().mockResolvedValue(undefined) };
  const dto    = { currentPassword: ANCIEN, newPassword: NOUVEAU, confirmPassword: NOUVEAU };

  const cas: Array<[string, (n: ReturnType<typeof notif>) => Promise<unknown>]> = [
    ['client', (n) => new SecuriteClientService(
      repo() as any, repo() as any, repo() as any, mail as any,
      { isEnabled: jest.fn().mockResolvedValue(false) } as any, config as any, {} as any,
      { record: jest.fn() } as any, n as any,
    ).changePassword({ id: 'user-1' } as any, dto as any)],
    ['entreprise', (n) => new SecuriteParametresService(repo() as any, repo() as any, repo() as any, n as any)
      .updatePassword('user-1', dto as any)],
    ['livreur', (n) => new SecuriteLivreurService(repo() as any, repo() as any, repo() as any, {} as any, n as any)
      .updatePassword('user-1', dto as any)],
    ['super-admin', (n) => new SecuriteAdminService(
      repo() as any, repo() as any, repo() as any, {} as any, {} as any, mail as any, config as any, n as any,
    ).changePassword('user-1', dto as any)],
    ['partenaire', (n) => new SecuritePartenaireService(repo() as any, repo() as any, repo() as any, {} as any, {} as any, n as any)
      .updatePassword('user-1', dto as any)],
    ['correspondant', (n) => new SecuriteCorrespondantService(repo() as any, repo() as any, repo() as any, {} as any, n as any)
      .changePassword('user-1', dto as any)],
  ];

  it.each(cas)('%s', async (_nom, changer) => {
    const n = notif();
    await changer(n);
    expect(n.fermerSessionsTempsReel).toHaveBeenCalledWith('user-1', 'PASSWORD_CHANGED');
  });

  it("mauvais mot de passe actuel : rien n'est coupé", async () => {
    const n = notif();
    await expect(new SecuriteParametresService(repo() as any, repo() as any, repo() as any, n as any)
      .updatePassword('user-1', { ...dto, currentPassword: 'faux' } as any)).rejects.toThrow();
    expect(n.fermerSessionsTempsReel).not.toHaveBeenCalled();
  });
});
