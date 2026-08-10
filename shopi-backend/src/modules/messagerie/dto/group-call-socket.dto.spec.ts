/* ============================================================
 * FICHIER      : src/modules/messagerie/dto/group-call-socket.dto.spec.ts
 * RÔLE         : Preuve que la validation runtime des payloads
 *                Socket.IO d'appel de groupe fonctionne réellement.
 *
 * Voir call-socket.dto.spec.ts (module call) pour le raisonnement complet
 * — même méthode (plainToInstance + validate() directement, ce que fait
 * ValidationPipe en coulisses).
 * ============================================================ */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  GroupCallInitiateDto, GroupCallOfferDto, GroupCallIceCandidateDto, GroupCallToggleMediaDto,
} from './group-call-socket.dto';
import { CallType } from 'src/database/entities/call/call.entity';

const VALIDATOR_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';

describe('group-call-socket.dto', () => {
  describe('GroupCallInitiateDto', () => {
    it('payload valide (callType optionnel) → aucune erreur', async () => {
      const dto = plainToInstance(GroupCallInitiateDto, { groupId: UUID_A });
      expect(await validate(dto, VALIDATOR_OPTIONS)).toHaveLength(0);
    });

    it('groupId manquant → rejeté', async () => {
      const dto = plainToInstance(GroupCallInitiateDto, { callType: CallType.AUDIO });
      const errors = await validate(dto, VALIDATOR_OPTIONS);
      expect(errors.some(e => e.property === 'groupId')).toBe(true);
    });

    it('champ inconnu (ex. initiatorId falsifié) → rejeté', async () => {
      const dto = plainToInstance(GroupCallInitiateDto, { groupId: UUID_A, initiatorId: 'victime-uuid' });
      expect((await validate(dto, VALIDATOR_OPTIONS)).length).toBeGreaterThan(0);
    });
  });

  describe('GroupCallOfferDto — SDP', () => {
    it('sdp absent entièrement → rejeté', async () => {
      const dto = plainToInstance(GroupCallOfferDto, { groupId: UUID_A, callId: UUID_B, targetUserId: UUID_C });
      expect((await validate(dto, VALIDATOR_OPTIONS)).length).toBeGreaterThan(0);
    });

    it('SDP > 256 Ko → rejeté', async () => {
      const dto = plainToInstance(GroupCallOfferDto, {
        groupId: UUID_A, callId: UUID_B, targetUserId: UUID_C,
        sdp: { type: 'offer', sdp: 'a'.repeat(256_001) },
      });
      expect((await validate(dto, VALIDATOR_OPTIONS)).length).toBeGreaterThan(0);
    });

    it('SDP de taille normale → accepté', async () => {
      const dto = plainToInstance(GroupCallOfferDto, {
        groupId: UUID_A, callId: UUID_B, targetUserId: UUID_C,
        sdp: { type: 'offer', sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n' },
      });
      expect(await validate(dto, VALIDATOR_OPTIONS)).toHaveLength(0);
    });
  });

  describe('GroupCallIceCandidateDto', () => {
    it('candidate absent entièrement → rejeté', async () => {
      const dto = plainToInstance(GroupCallIceCandidateDto, { groupId: UUID_A, callId: UUID_B, targetUserId: UUID_C });
      expect((await validate(dto, VALIDATOR_OPTIONS)).length).toBeGreaterThan(0);
    });

    it('candidat > 8 Ko → rejeté', async () => {
      const dto = plainToInstance(GroupCallIceCandidateDto, {
        groupId: UUID_A, callId: UUID_B, targetUserId: UUID_C,
        candidate: { candidate: 'candidate:' + 'x'.repeat(8_200) },
      });
      expect((await validate(dto, VALIDATOR_OPTIONS)).length).toBeGreaterThan(0);
    });

    it('candidat de taille normale → accepté', async () => {
      const dto = plainToInstance(GroupCallIceCandidateDto, {
        groupId: UUID_A, callId: UUID_B, targetUserId: UUID_C,
        candidate: { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host' },
      });
      expect(await validate(dto, VALIDATOR_OPTIONS)).toHaveLength(0);
    });
  });

  describe('GroupCallToggleMediaDto', () => {
    it('les deux flags sont optionnels → payload minimal accepté', async () => {
      const dto = plainToInstance(GroupCallToggleMediaDto, { groupId: UUID_A, callId: UUID_B });
      expect(await validate(dto, VALIDATOR_OPTIONS)).toHaveLength(0);
    });

    it('audioEnabled non-booléen → rejeté', async () => {
      const dto = plainToInstance(GroupCallToggleMediaDto, { groupId: UUID_A, callId: UUID_B, audioEnabled: 'oui' });
      const errors = await validate(dto, VALIDATOR_OPTIONS);
      expect(errors.some(e => e.property === 'audioEnabled')).toBe(true);
    });
  });
});
