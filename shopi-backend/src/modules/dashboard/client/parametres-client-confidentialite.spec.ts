/* ============================================================
 * FICHIER : src/modules/dashboard/client/parametres-client-confidentialite.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Non-régression de l'audit des paramètres client (2026-09) :
 *
 *  1. Le profil public d'un compte supprimé, désactivé, suspendu ou banni
 *     n'est plus visible (nom, bio, liste de souhaits) — seul un compte
 *     actif a un profil public ; le propriétaire voit toujours le sien.
 *  2. « Visibilité du profil : Personne » exclut le client de la recherche
 *     de la messagerie (par nom ou numéro).
 * ============================================================ */

import { NotFoundException } from '@nestjs/common';

import { ClientPublicProfilService } from './client-public-profil.service';
import { MessagerieService } from '../../messagerie/messagerie.service';
import { UserStatus } from '../../../database/entities/user.entity';
import { ConversationActorType } from '../../../database/entities/messaging/conversation.entity';

/** Construit un service sans passer par son (long) constructeur. */
function monter<T>(Classe: abstract new (...args: any[]) => T, deps: Record<string, unknown>): T {
  return Object.assign(Object.create(Classe.prototype), deps) as T;
}

/* ============================================================
 * 1 — Profil public
 * ============================================================ */

describe('Profil public client', () => {

  const client = (user: Record<string, unknown> | undefined, privacySettings: object | null = null) => ({
    id: 'cl-1', userId: 'user-cible', fullName: 'Aïssata Bah', bio: 'Bonjour', createdAt: new Date('2026-01-01'),
    privacySettings, user,
  });
  const actif = { id: 'user-cible', status: UserStatus.ACTIVE, createdAt: new Date('2026-01-01') };

  function monterProfil(target: unknown) {
    return monter(ClientPublicProfilService, {
      clientRepo:      { findOne: jest.fn().mockResolvedValue(target) },
      commandeRepo:    { count: jest.fn().mockResolvedValue(3) },
      wishlistService: { getAllForClient: jest.fn().mockResolvedValue([]) },
    });
  }

  it('compte actif : profil visible par un autre membre', async () => {
    const svc = monterProfil(client(actif));
    await expect(svc.getProfil('cl-1', 'user-visiteur')).resolves.toEqual(expect.objectContaining({ nom: 'Aïssata Bah' }));
  });

  it.each([
    ['supprimé (compte soft-deleted : relation user absente)', undefined],
    ['désactivé par le client',                              { ...actif, status: UserStatus.INACTIVE }],
    ['suspendu',                                             { ...actif, status: UserStatus.SUSPENDED }],
    ['banni',                                                { ...actif, status: UserStatus.BANNED }],
  ])('compte %s : profil introuvable pour les autres', async (_cas, user) => {
    const svc = monterProfil(client(user));
    await expect(svc.getProfil('cl-1', 'user-visiteur')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.getProfil('cl-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('le propriétaire voit toujours son propre profil', async () => {
    const svc = monterProfil(client({ ...actif, status: UserStatus.INACTIVE }));
    await expect(svc.getProfil('cl-1', 'user-cible')).resolves.toEqual(expect.objectContaining({ id: 'cl-1' }));
  });

  it('« Visibilité : Personne » reste respectée', async () => {
    const svc = monterProfil(client(actif, { visibilite: 'nobody' }));
    await expect(svc.getProfil('cl-1', 'user-visiteur')).rejects.toBeInstanceOf(NotFoundException);
  });
});

/* ============================================================
 * 2 — Recherche de la messagerie
 * ============================================================ */

describe('Recherche de la messagerie', () => {

  it('exclut les clients dont la visibilité est « Personne »', async () => {
    const conditions: string[] = [];
    const qb: any = { getMany: jest.fn().mockResolvedValue([]) };
    for (const m of ['leftJoinAndSelect', 'take']) qb[m] = jest.fn(() => qb);
    for (const m of ['where', 'andWhere']) qb[m] = jest.fn((sql: string) => { conditions.push(sql); return qb; });

    const svc = monter(MessagerieService, {
      blockedRepo: { find: jest.fn().mockResolvedValue([]) },
      clientRepo:  { createQueryBuilder: jest.fn(() => qb) },
      presence:    { getBulkPresence: jest.fn().mockResolvedValue(new Map()) },
    });

    await (svc as any).searchDirectory('user-moi', ConversationActorType.CLIENT, 'cl-moi', 'Aïssata', ConversationActorType.CLIENT);

    expect(conditions).toContain(`(cl."privacySettings"->>'visibilite') IS DISTINCT FROM 'nobody'`);
  });
});
