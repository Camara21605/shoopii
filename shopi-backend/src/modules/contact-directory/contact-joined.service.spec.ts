/* ============================================================
 * FICHIER : src/modules/contact-directory/contact-joined.service.spec.ts
 * MODULE : ContactDirectoryModule
 * ROLE : tests unitaires de « X a rejoint Shoneya » (dépôts simulés,
 *        aucune base ni notification réelle).
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-10-18
 * ============================================================ */
import { NotificationType } from 'src/database/entities/notification/notification.entity';
import { ContactJoinedService } from './contact-joined.service';
import type { DirectoryCard } from './contact-directory.service';

const card = (userId: string, name: string): DirectoryCard =>
  ({ userId, type: 'client', id: `p-${userId}`, name, logo: null });

function setup(opts: { phoneHash?: string | null; rows?: Array<{ id: string; ownerUserId: string; displayName: string | null }> }) {
  const contactRepo = {
    find:   jest.fn().mockResolvedValue(opts.rows ?? []),
    update: jest.fn().mockResolvedValue({ affected: (opts.rows ?? []).length }),
  };
  const userRepo = { findOne: jest.fn().mockResolvedValue({ id: 'new', phoneHash: opts.phoneHash ?? null }) };
  const directory = {
    cardsFor: jest.fn(async (ids: string[]) => new Map(ids.map(id => [id, card(id, id === 'new' ? 'Awa Diallo' : `Owner ${id}`)]))),
  };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  const svc = new ContactJoinedService(contactRepo as any, userRepo as any, directory as any, notifications as any);
  return { svc, contactRepo, notifications };
}

describe('ContactJoinedService', () => {
  it('ne fait rien sans numéro', async () => {
    const { svc, contactRepo, notifications } = setup({ phoneHash: null });
    expect(await svc.onAccountWithPhone('new')).toBe(0);
    expect(contactRepo.find).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('relie les répertoires et notifie chaque propriétaire avec son nom local', async () => {
    const { svc, contactRepo, notifications } = setup({
      phoneHash: 'h'.repeat(64),
      rows: [
        { id: 'r1', ownerUserId: 'o1', displayName: 'Tata Awa' },
        { id: 'r2', ownerUserId: 'o2', displayName: null },
      ],
    });
    expect(await svc.onAccountWithPhone('new')).toBe(2);
    expect(contactRepo.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ matchedUserId: 'new' }));
    const first = notifications.create.mock.calls[0][0];
    expect(first).toMatchObject({
      type: NotificationType.CONTACT_JOINED, recipientId: 'p-o1', actorId: 'p-new',
      title: 'Awa Diallo est sur Shoneya',
    });
    expect(first.body).toContain('« Tata Awa »');
    expect(notifications.create.mock.calls[1][0].body).toContain('Un de vos contacts');
  });

  it("une notification en échec n'empêche pas les suivantes", async () => {
    const { svc, notifications } = setup({
      phoneHash: 'h'.repeat(64),
      rows: [{ id: 'r1', ownerUserId: 'o1', displayName: null }, { id: 'r2', ownerUserId: 'o2', displayName: null }],
    });
    notifications.create.mockRejectedValueOnce(new Error('boom'));
    expect(await svc.onAccountWithPhone('new')).toBe(1);
  });
});
