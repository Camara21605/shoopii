/* ============================================================
 * FICHIER      : src/modules/delivery-group/delivery-group.service.spec.ts
 * MODULE       : Groupes de messagerie (commande + groupes libres)
 * RÔLE         : Tests unitaires — gestion d'un groupe libre par son administrateur.
 *
 * COUVERTURE :
 *   ✅ effectivePermissions — groupe de commande / administrateur : tout permis ;
 *      groupe libre : droits choisis par l'administrateur
 *   ✅ envoi — texte refusé sans canSendMessages, vocal refusé sans canSendVoice,
 *      vocal accepté quand seul le texte est retiré
 *   ✅ setMemberPermissions — réservé à l'administrateur, jamais sur un
 *      administrateur, message système + diffusion temps réel
 *   ✅ addMembers — réservé à l'administrateur d'un groupe libre, ignore les
 *      membres déjà présents, réactive un ancien membre
 *
 * Tous les dépôts TypeORM sont simulés (aucune base réelle).
 * ============================================================ */

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DeliveryGroupService } from './delivery-group.service';
import { DeliveryGroupKind, DeliveryGroupStatus } from '../../database/entities/delivery-group/delivery-group.entity';
import { GroupMessageContentType } from '../../database/entities/delivery-group/group-message.entity';
import { ConversationActorType } from '../../database/entities/messaging/conversation.entity';

const customGroup = (over: Record<string, unknown> = {}) => ({
  id: 'g1', kind: DeliveryGroupKind.CUSTOM, status: DeliveryGroupStatus.ACTIVE,
  createdByUserId: 'creator', commandeNumero: null, ...over,
});

const member = (userId: string, over: Record<string, unknown> = {}) => ({
  id: `m-${userId}`, groupId: 'g1', userId, actorType: 'client', actorId: `a-${userId}`,
  displayName: userId, isActive: true, isAdmin: false,
  canSendMessages: true, canSendVoice: true, canCall: true, ...over,
});

describe('DeliveryGroupService — groupe libre', () => {
  let svc: DeliveryGroupService;
  let groupRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let msgRepo: Record<string, jest.Mock>;
  let broadcast: Record<string, jest.Mock>;
  let messagerie: Record<string, jest.Mock>;

  beforeEach(() => {
    groupRepo  = { findOneOrFail: jest.fn(), save: jest.fn(async x => x), findOne: jest.fn() };
    memberRepo = {
      findOne: jest.fn(), find: jest.fn().mockResolvedValue([]), save: jest.fn(async x => x),
      create: jest.fn(x => x), increment: jest.fn(), count: jest.fn(),
    };
    msgRepo    = { create: jest.fn(x => ({ ...x, id: 'msg', createdAt: new Date() })), save: jest.fn(async x => x) };
    broadcast  = { groupNewMessage: jest.fn(), groupStatusChanged: jest.fn() };
    messagerie = { getContactInfo: jest.fn() };
    svc = new DeliveryGroupService(
      groupRepo as any, memberRepo as any, msgRepo as any, broadcast as any, messagerie as any,
    );
  });

  describe('effectivePermissions', () => {
    it('groupe de commande : tout est permis, quels que soient les drapeaux', () => {
      const p = svc.effectivePermissions(customGroup({ kind: DeliveryGroupKind.ORDER }) as any, member('u', { canSendMessages: false, canCall: false }) as any);
      expect(p).toEqual({ canSendMessages: true, canSendVoice: true, canCall: true });
    });

    it('administrateur (ou créateur) : tout est permis', () => {
      expect(svc.effectivePermissions(customGroup() as any, member('u', { isAdmin: true, canCall: false }) as any).canCall).toBe(true);
      expect(svc.effectivePermissions(customGroup() as any, member('creator', { canSendVoice: false }) as any).canSendVoice).toBe(true);
    });

    it('membre d\'un groupe libre : droits choisis par l\'administrateur', () => {
      const p = svc.effectivePermissions(customGroup() as any, member('u', { canSendMessages: false, canSendVoice: true, canCall: false }) as any);
      expect(p).toEqual({ canSendMessages: false, canSendVoice: true, canCall: false });
    });
  });

  describe('sendGroupMessage', () => {
    beforeEach(() => { groupRepo.findOneOrFail.mockResolvedValue(customGroup()); });

    it('texte refusé en lecture seule', async () => {
      memberRepo.findOne.mockResolvedValue(member('u', { canSendMessages: false, canSendVoice: false, canCall: false }));
      await expect(svc.sendGroupMessage('g1', 'u', { contentType: GroupMessageContentType.TEXT, content: 'salut' } as any))
        .rejects.toBeInstanceOf(ForbiddenException);
      expect(msgRepo.save).not.toHaveBeenCalled();
    });

    it('vocal refusé sans canSendVoice', async () => {
      memberRepo.findOne.mockResolvedValue(member('u', { canSendVoice: false }));
      await expect(svc.sendGroupMessage('g1', 'u', { contentType: GroupMessageContentType.AUDIO, mediaUrl: 'https://x' } as any))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('vocal accepté quand seul le texte est retiré', async () => {
      memberRepo.findOne.mockResolvedValue(member('u', { canSendMessages: false, canSendVoice: true }));
      await svc.sendGroupMessage('g1', 'u', { contentType: GroupMessageContentType.AUDIO, mediaUrl: 'https://x' } as any);
      expect(msgRepo.save).toHaveBeenCalled();
    });
  });

  describe('setMemberPermissions', () => {
    beforeEach(() => { groupRepo.findOneOrFail.mockResolvedValue(customGroup()); });

    it('refusé pour un membre non administrateur', async () => {
      memberRepo.findOne.mockResolvedValueOnce(member('u'));                 // l'appelant
      await expect(svc.setMemberPermissions('g1', 'u', 'm-v', { canCall: false }))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('jamais sur un administrateur', async () => {
      memberRepo.findOne
        .mockResolvedValueOnce(member('creator'))                             // l'appelant (créateur)
        .mockResolvedValueOnce(member('v', { isAdmin: true }));               // la cible
      await expect(svc.setMemberPermissions('g1', 'creator', 'm-v', { canCall: false }))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('lecture seule : enregistre, écrit un message système et prévient les membres', async () => {
      const target = member('v');
      memberRepo.findOne.mockResolvedValueOnce(member('creator')).mockResolvedValueOnce(target);
      memberRepo.find.mockResolvedValue([member('creator'), target]);

      const res = await svc.setMemberPermissions('g1', 'creator', 'm-v', { canSendMessages: false, canSendVoice: false, canCall: false });

      expect(res).toEqual({ id: 'm-v', canSendMessages: false, canSendVoice: false, canCall: false });
      expect(memberRepo.save).toHaveBeenCalledWith(expect.objectContaining({ canSendMessages: false, canSendVoice: false, canCall: false }));
      expect(msgRepo.create).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('lecture seule') }));
      expect(broadcast.groupStatusChanged).toHaveBeenCalledWith(['creator', 'v'], expect.objectContaining({
        event: 'group_member_permissions_changed', memberUserId: 'v',
      }));
    });
  });

  describe('addMembers', () => {
    const ref = (id: string) => ({ type: ConversationActorType.CLIENT, id });

    it('refusé sur un groupe de commande', async () => {
      memberRepo.findOne.mockResolvedValue(member('creator', { isAdmin: true }));
      groupRepo.findOneOrFail.mockResolvedValue(customGroup({ kind: DeliveryGroupKind.ORDER }));
      await expect(svc.addMembers('g1', 'creator', [ref('x')])).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refusé pour un membre non administrateur', async () => {
      memberRepo.findOne.mockResolvedValue(member('u'));
      groupRepo.findOneOrFail.mockResolvedValue(customGroup());
      await expect(svc.addMembers('g1', 'u', [ref('x')])).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ajoute un nouveau, réactive un ancien membre, ignore un membre déjà présent', async () => {
      memberRepo.findOne.mockResolvedValue(member('creator'));
      groupRepo.findOneOrFail.mockResolvedValue(customGroup());
      const former = member('ancien', { isActive: false, canCall: false });
      memberRepo.find
        .mockResolvedValueOnce([member('creator'), member('deja'), former])   // état initial
        .mockResolvedValue([member('creator'), member('deja'), member('nouveau'), member('ancien')]);
      messagerie.getContactInfo.mockImplementation(async (_t: string, id: string) => ({ userId: id, name: id }));

      await svc.addMembers('g1', 'creator', [ref('nouveau'), ref('ancien'), ref('deja')]);

      const saved = memberRepo.save.mock.calls.map(c => c[0]);
      expect(saved).toEqual(expect.arrayContaining([
        expect.objectContaining({ userId: 'nouveau' }),
        expect.objectContaining({ userId: 'ancien', isActive: true, canCall: true }),
      ]));
      expect(saved.some(m => m.userId === 'deja')).toBe(false);
      expect(broadcast.groupStatusChanged).toHaveBeenCalledWith(
        expect.arrayContaining(['nouveau', 'ancien']), expect.objectContaining({ event: 'group_created' }),
      );
    });

    it('rien à ajouter → erreur claire', async () => {
      memberRepo.findOne.mockResolvedValue(member('creator'));
      groupRepo.findOneOrFail.mockResolvedValue(customGroup());
      memberRepo.find.mockResolvedValue([member('creator'), member('deja')]);
      messagerie.getContactInfo.mockResolvedValue({ userId: 'deja', name: 'deja' });
      await expect(svc.addMembers('g1', 'creator', [ref('deja')])).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
