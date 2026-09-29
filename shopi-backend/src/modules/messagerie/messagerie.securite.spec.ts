/* ============================================================
 * FICHIER : src/modules/messagerie/messagerie.securite.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tests de non-régression des failles corrigées lors de l'audit
 * sécurité de la messagerie (2026-09) :
 *
 *  1. Socket : un jeton émis AVANT la dernière déconnexion est refusé
 *  2. Réponse à un message : le message cité doit appartenir à la
 *     même conversation (envoi) et n'est jamais affiché sinon (lecture)
 *  3. Lien média : uniquement hébergé sur notre compte Cloudinary
 *  4. Anti-flood : join_conv / mark_read limités par connexion
 * ============================================================ */

import { BadRequestException } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

import { MessagerieService } from './messagerie.service';
import { MessagerieGateway } from './gateways/messagerie.gateway';
import { UserStatus } from '../../database/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';

/* ============================================================
 * MONTAGE — MessagerieService
 * ============================================================ */

function monterService(cloudName: string | null = 'shoneya') {
  const msgRepo = {
    findOne:            jest.fn().mockResolvedValue(null),
    findByIds:          jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(),
  };
  const config = { get: jest.fn((k: string) => (k === 'CLOUDINARY_CLOUD_NAME' ? cloudName ?? undefined : undefined)) };
  const vide = {} as any;

  const svc = new MessagerieService(
    vide, msgRepo as any, vide, vide, vide, vide, vide, vide, vide, vide, vide, vide, vide, vide,
    vide, config as any,
  );

  /* Le participant et l'accès à la conversation sont déjà couverts ailleurs :
   * on les simule pour isoler les contrôles testés ici. */
  jest.spyOn(svc as any, 'resolveProfileId').mockResolvedValue('profil-moi');
  jest.spyOn(svc as any, 'assertConvAccess').mockResolvedValue({
    id: 'conv-A', initiatorType: 'client', initiatorId: 'profil-moi', recipientType: 'company', recipientId: 'profil-autre',
  });

  return { svc, msgRepo };
}

/* ============================================================
 * 2 & 3. ENVOI — message cité et lien média
 * ============================================================ */

describe('Messagerie — contrôles à l’envoi', () => {

  describe('lien média (Cloudinary uniquement)', () => {

    it.each([
      'https://res.cloudinary.com/shoneya/image/upload/v1/chat/photo.jpg',
      'https://res.cloudinary.com/shoneya/raw/upload/v1/docs/facture.pdf',
    ])('accepte un média de notre compte : %s', (url) => {
      const { svc } = monterService();
      expect(() => svc.assertMediaUrlAutorisee(url)).not.toThrow();
    });

    it.each([
      'https://piege.example/facture.pdf',
      'http://res.cloudinary.com/shoneya/image/upload/x.jpg',       // pas HTTPS
      'https://res.cloudinary.com/autre-compte/image/upload/x.jpg', // autre compte Cloudinary
      'https://res.cloudinary.com.piege.example/shoneya/x.jpg',     // faux domaine préfixé
      'javascript:alert(1)',
    ])('refuse : %s', (url) => {
      const { svc } = monterService();
      expect(() => svc.assertMediaUrlAutorisee(url)).toThrow(BadRequestException);
    });

    it('sans CLOUDINARY_CLOUD_NAME (dev) : exige au moins le domaine Cloudinary en HTTPS', () => {
      const { svc } = monterService(null);
      expect(() => svc.assertMediaUrlAutorisee('https://res.cloudinary.com/nimporte/x.jpg')).not.toThrow();
      expect(() => svc.assertMediaUrlAutorisee('https://piege.example/x.jpg')).toThrow(BadRequestException);
    });

    it("sendMessage refuse un lien externe avant toute écriture", async () => {
      const { svc, msgRepo } = monterService();
      await expect(svc.sendMessage('user-moi', UserRole.CLIENT, 'conv-A', {
        contentType: 'file', mediaUrl: 'https://piege.example/facture.pdf', mediaName: 'facture.pdf',
      } as any)).rejects.toBeInstanceOf(BadRequestException);
      expect(msgRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('message cité (replyToId)', () => {

    it("refuse de citer un message d'une autre conversation", async () => {
      const { svc, msgRepo } = monterService();
      msgRepo.findOne.mockResolvedValue(null);

      await expect(svc.sendMessage('user-moi', UserRole.CLIENT, 'conv-A', {
        contentType: 'text', content: 'regarde ça', replyToId: 'msg-de-conv-B',
      } as any)).rejects.toThrow("Le message cité n'appartient pas à cette conversation.");

      expect(msgRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'msg-de-conv-B', conversationId: 'conv-A' } }),
      );
    });
  });
});

/* ============================================================
 * 2. LECTURE — un message cité étranger n'est jamais affiché
 * ============================================================ */

describe('Messagerie — affichage des messages cités', () => {

  it("n'expose jamais le contenu d'un message cité d'une autre conversation", async () => {
    const { svc, msgRepo } = monterService();
    const now = new Date('2026-09-29T08:00:00Z');
    const msg = (id: string, conversationId: string, extra: object = {}) => ({
      id, conversationId, senderType: 'client', senderId: 'profil-moi', contentType: 'text',
      content: `contenu ${id}`, mediaUrl: null, createdAt: now, readAt: null, isEdited: false, deletedAt: null, ...extra,
    });

    const qb: any = {
      where: jest.fn(() => qb), orderBy: jest.fn(() => qb), addOrderBy: jest.fn(() => qb),
      take: jest.fn(() => qb), andWhere: jest.fn(() => qb),
      getMany: jest.fn().mockResolvedValue([
        msg('m-1', 'conv-A', { replyToId: 'secret-B' }),
        msg('m-2', 'conv-A', { replyToId: 'parent-A' }),
      ]),
    };
    msgRepo.createQueryBuilder.mockReturnValue(qb);
    msgRepo.findByIds.mockResolvedValue([
      msg('secret-B', 'conv-B', { content: 'code secret', latitude: 9.5, longitude: -13.7 }),
      msg('parent-A', 'conv-A'),
    ]);

    const page = await svc.getMessagesWithReplies('user-moi', UserRole.CLIENT, 'conv-A', undefined, 30);

    const m1 = page.data.find(m => m.id === 'm-1')!;
    const m2 = page.data.find(m => m.id === 'm-2')!;
    expect(m1.replyToMessage).toBeNull();
    expect(JSON.stringify(page)).not.toContain('code secret');
    expect(m2.replyToMessage?.id).toBe('parent-A');
  });
});

/* ============================================================
 * 1 & 4. PASSERELLE SOCKET
 * ============================================================ */

describe('MessagerieGateway — sécurité de connexion et anti-flood', () => {

  const IAT = Math.floor(new Date('2026-09-29T08:00:00Z').getTime() / 1000);

  function monterGateway(user: Record<string, unknown> | null) {
    const jwt      = { verify: jest.fn(() => ({ sub: 'user-1', role: 'client', iat: IAT })) };
    const config   = { get: jest.fn(() => 'secret') };
    const presence = { onConnect: jest.fn(), onDisconnect: jest.fn(), heartbeat: jest.fn() };
    const broadcast = { presenceChanged: jest.fn(), setServer: jest.fn(), typing: jest.fn(), messageRead: jest.fn() };
    const msgService = { markAsReadByUserId: jest.fn().mockResolvedValue({ otherParticipantUserId: null }) };
    const session  = { validateSession: jest.fn().mockResolvedValue(true) };
    const convRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'conv-A', initiatorUserId: 'user-1', recipientUserId: 'user-2' }),
      manager: { query: jest.fn().mockResolvedValue([]) },
    };
    const userRepo = { findOne: jest.fn().mockResolvedValue(user) };

    const gateway = new MessagerieGateway(
      jwt as any, config as any, presence as any, broadcast as any, msgService as any,
      session as any, {} as any, convRepo as any, userRepo as any,
    );
    return { gateway, presence, msgService };
  }

  const socket = () => ({
    id: 'sock-1', data: {} as any,
    handshake: { auth: { token: 'jwt' }, query: {}, headers: {} },
    emit: jest.fn(), disconnect: jest.fn(), join: jest.fn(),
  }) as any;

  it('refuse un jeton émis AVANT la dernière déconnexion', async () => {
    const { gateway, presence } = monterGateway({
      id: 'user-1', status: UserStatus.ACTIVE, lastLogoutAt: new Date('2026-09-29T09:00:00Z'),
    });
    const s = socket();

    await gateway.handleConnection(s);

    expect(s.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'TOKEN_INVALID' }));
    expect(s.disconnect).toHaveBeenCalled();
    expect(s.join).not.toHaveBeenCalled();
    expect(presence.onConnect).not.toHaveBeenCalled();
  });

  it('accepte un jeton émis APRÈS la dernière déconnexion (nouvelle connexion)', async () => {
    const { gateway } = monterGateway({
      id: 'user-1', status: UserStatus.ACTIVE, lastLogoutAt: new Date('2026-09-29T07:00:00Z'),
    });
    const s = socket();

    await gateway.handleConnection(s);

    expect(s.disconnect).not.toHaveBeenCalled();
    expect(s.join).toHaveBeenCalledWith('user:user-1');
  });

  it('join_conv : au-delà du seuil, les demandes sont refusées sans toucher la base', async () => {
    const { gateway } = monterGateway(null);
    const s = socket();
    s.data.userId = 'user-1';
    const convRepo = (gateway as any).convRepo;

    for (let i = 0; i < 30; i++) await gateway.handleJoinConv(s, { conversationId: 'conv-A' });
    const appelsAvant = convRepo.findOne.mock.calls.length;

    await expect(gateway.handleJoinConv(s, { conversationId: 'conv-A' })).rejects.toBeInstanceOf(WsException);
    expect(convRepo.findOne.mock.calls.length).toBe(appelsAvant);
  });

  it('mark_read : au-delà du seuil, ignoré sans requête', async () => {
    const { gateway, msgService } = monterGateway(null);
    const s = socket();
    s.data.userId = 'user-1';

    for (let i = 0; i < 35; i++) await gateway.handleMarkRead(s, { conversationId: 'conv-A' });

    expect(msgService.markAsReadByUserId).toHaveBeenCalledTimes(30);
  });
});
