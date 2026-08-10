/* ============================================================
 * FICHIER      : src/modules/call/dto/call-socket.dto.spec.ts
 * RÔLE         : Preuve que la validation runtime des payloads
 *                Socket.IO d'appel 1:1 fonctionne réellement.
 *
 * Utilise plainToInstance + validate() de class-validator/class-
 * transformer DIRECTEMENT — exactement ce que fait ValidationPipe en
 * coulisses (voir @UsePipes dans call.gateway.ts). C'est la preuve la
 * plus proche du comportement réel sans monter un vrai serveur Socket.IO
 * (fait séparément en vérification live, voir le rapport de la partie).
 *
 * COUVERTURE :
 *   ✅ payload valide → 0 erreur
 *   ✅ payload incomplet (champ requis manquant) → rejeté
 *   ✅ payload avec un champ inconnu → rejeté (whitelist/forbidNonWhitelisted)
 *   ✅ UUID invalide → rejeté
 *   ✅ SDP trop volumineux (> 256 Ko) → rejeté
 *   ✅ SDP de taille normale → accepté
 *   ✅ candidat ICE trop volumineux (> 8 Ko) → rejeté
 *   ✅ type de SDP invalide (ni offer/answer/pranswer/rollback) → rejeté
 * ============================================================ */

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CallInitiateDto, CallOfferDto, CallAnswerDto, CallIceCandidateDto, CallAcceptDto,
} from './call-socket.dto';
import { CallType } from 'src/database/entities/call/call.entity';

const VALIDATOR_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };
/* @IsUUID() vérifie version + variant RFC4122 — un UUID "factice" comme
 * 111...1 échoue (variant nibble invalide), il faut respecter le format
 * réel (version=4 en 3e groupe, variant∈{8,9,a,b} en 4e groupe). */
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

describe('call-socket.dto', () => {
  describe('CallInitiateDto', () => {
    it('payload valide → aucune erreur', async () => {
      const dto = plainToInstance(CallInitiateDto, {
        conversationId: UUID_A, calleeUserId: UUID_B, callerName: 'Jean', callType: CallType.AUDIO,
      });
      expect(await validate(dto, VALIDATOR_OPTIONS)).toHaveLength(0);
    });

    it('payload incomplet (callerName manquant) → rejeté', async () => {
      const dto = plainToInstance(CallInitiateDto, { conversationId: UUID_A, calleeUserId: UUID_B });
      const errors = await validate(dto, VALIDATOR_OPTIONS);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.property === 'callerName')).toBe(true);
    });

    it('champ inconnu injecté (ex. callerId falsifié) → rejeté (whitelist)', async () => {
      const dto = plainToInstance(CallInitiateDto, {
        conversationId: UUID_A, calleeUserId: UUID_B, callerName: 'Jean',
        callerId: 'victime-uuid', // champ non déclaré dans le DTO — tentative d'injection
      });
      const errors = await validate(dto, VALIDATOR_OPTIONS);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('calleeUserId non-UUID → rejeté', async () => {
      const dto = plainToInstance(CallInitiateDto, {
        conversationId: UUID_A, calleeUserId: 'pas-un-uuid', callerName: 'Jean',
      });
      const errors = await validate(dto, VALIDATOR_OPTIONS);
      expect(errors.some(e => e.property === 'calleeUserId')).toBe(true);
    });
  });

  describe('CallAcceptDto', () => {
    it('conversationId manquant → rejeté', async () => {
      const dto = plainToInstance(CallAcceptDto, { callerUserId: UUID_A });
      const errors = await validate(dto, VALIDATOR_OPTIONS);
      expect(errors.some(e => e.property === 'conversationId')).toBe(true);
    });
  });

  describe('CallOfferDto — SDP', () => {
    it('SDP de taille normale → accepté', async () => {
      const dto = plainToInstance(CallOfferDto, {
        conversationId: UUID_A, targetUserId: UUID_B,
        sdp: { type: 'offer', sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n...' },
      });
      expect(await validate(dto, VALIDATOR_OPTIONS)).toHaveLength(0);
    });

    it('SDP > 256 Ko → rejeté', async () => {
      const oversized = 'a'.repeat(256_001);
      const dto = plainToInstance(CallOfferDto, {
        conversationId: UUID_A, targetUserId: UUID_B,
        sdp: { type: 'offer', sdp: oversized },
      });
      const errors = await validate(dto, VALIDATOR_OPTIONS);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('sdp.type invalide (ni offer/answer/pranswer/rollback) → rejeté', async () => {
      const dto = plainToInstance(CallOfferDto, {
        conversationId: UUID_A, targetUserId: UUID_B,
        sdp: { type: 'malicious-type', sdp: 'v=0...' },
      });
      const errors = await validate(dto, VALIDATOR_OPTIONS);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('sdp manquant entièrement → rejeté', async () => {
      const dto = plainToInstance(CallOfferDto, { conversationId: UUID_A, targetUserId: UUID_B });
      const errors = await validate(dto, VALIDATOR_OPTIONS);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('CallAnswerDto — SDP', () => {
    it('SDP > 256 Ko → rejeté (même limite que offer)', async () => {
      const dto = plainToInstance(CallAnswerDto, {
        conversationId: UUID_A, targetUserId: UUID_B,
        sdp: { type: 'answer', sdp: 'a'.repeat(300_000) },
      });
      expect((await validate(dto, VALIDATOR_OPTIONS)).length).toBeGreaterThan(0);
    });
  });

  describe('CallIceCandidateDto', () => {
    it('candidat de taille normale → accepté', async () => {
      const dto = plainToInstance(CallIceCandidateDto, {
        conversationId: UUID_A, targetUserId: UUID_B,
        candidate: { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host', sdpMLineIndex: 0, sdpMid: '0' },
      });
      expect(await validate(dto, VALIDATOR_OPTIONS)).toHaveLength(0);
    });

    it('candidat > 8 Ko → rejeté', async () => {
      const dto = plainToInstance(CallIceCandidateDto, {
        conversationId: UUID_A, targetUserId: UUID_B,
        candidate: { candidate: 'candidate:' + 'x'.repeat(8_200) },
      });
      const errors = await validate(dto, VALIDATOR_OPTIONS);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('targetUserId manquant → rejeté', async () => {
      const dto = plainToInstance(CallIceCandidateDto, {
        conversationId: UUID_A, candidate: { candidate: 'candidate:1 1 UDP...' },
      });
      const errors = await validate(dto, VALIDATOR_OPTIONS);
      expect(errors.some(e => e.property === 'targetUserId')).toBe(true);
    });
  });
});
