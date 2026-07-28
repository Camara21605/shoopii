/* ============================================================
 * SERVICE : admin-codes.service.ts
 *
 * Gestion des codes de création d'acteurs.
 * Format : SHOPI-{PAR|ENT|LVR|COR}-{5 alphanum}
 *
 * Opérations disponibles :
 *   • getCodes       — liste + stats (générés/utilisés/en attente/expirés)
 *   • generateCode   — génération avec retry d'unicité (5 tentatives max)
 *   • revokeCode     — révocation d'un code PENDING uniquement
 * ============================================================ */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { AdminZoneService }  from './admin-zone.service';
import { CreationCode, CodeStatus } from '../../../../database/entities/code-creation.entity';
import { GenerateCodeDto }   from '../dto/generate-code.dto';
import { ROLE_PREFIX, ROLE_TO_SHORT } from '../helpers/admin.constants';
import { randCode, fmtDate } from '../helpers/admin.helpers';

@Injectable()
export class AdminCodesService {

  constructor(
    private readonly zoneService: AdminZoneService,

    @InjectRepository(CreationCode)
    private readonly codeRepo: Repository<CreationCode>,
  ) {}

  /**
   * Traduit le statut interne CodeStatus en libellé court frontend.
   *   USED    → 'used'
   *   PENDING → 'sent'
   *   Autre   → 'expired' (inclut EXPIRED et REVOKED)
   */
  private toStatut(s: CodeStatus): string {
    if (s === CodeStatus.USED)    return 'used';
    if (s === CodeStatus.PENDING) return 'sent';
    return 'expired';
  }

  /**
   * Retourne les 200 derniers codes générés par cet admin,
   * triés par date de création décroissante, avec statistiques agrégées.
   */
  async getCodes(userId: string) {
    const admin = await this.zoneService.adminOf(userId);
    const codes = await this.codeRepo.find({
      where: { adminId: admin.id },
      order: { createdAt: 'DESC' },
      take: 200,
    });

    return {
      stats: {
        generated: codes.length,
        used:      codes.filter(c => c.status === CodeStatus.USED).length,
        pending:   codes.filter(c => c.status === CodeStatus.PENDING).length,
        expired:   codes.filter(c =>
          c.status === CodeStatus.EXPIRED || c.status === CodeStatus.REVOKED
        ).length,
      },
      list: codes.map(c => ({
        id:           c.id,
        code:         c.code,
        type:         ROLE_TO_SHORT[c.targetRole] ?? c.targetRole,
        destinataire: c.targetEmail ?? null,
        statut:       this.toStatut(c.status),
        creeLe:       fmtDate(c.createdAt),
      })),
    };
  }

  /**
   * Génère un nouveau code unique pour le rôle cible.
   *
   * Stratégie d'unicité : jusqu'à 5 candidats aléatoires sont
   * testés en base avant de lever une erreur.  La probabilité
   * de collision sur 36^5 ≈ 60M combinaisons est très faible,
   * mais le retry garantit la robustesse en production.
   */
  async generateCode(userId: string, dto: GenerateCodeDto) {
    const admin     = await this.zoneService.adminOf(userId);
    const prefix    = ROLE_PREFIX[dto.targetRole] ?? 'ACT';
    const validDays = dto.validityDays ?? 30;
    const expiresAt = new Date(Date.now() + validDays * 86_400_000);

    let code = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = randCode(prefix);
      const exists    = await this.codeRepo.findOne({ where: { code: candidate } });
      if (!exists) { code = candidate; break; }
    }

    if (!code) {
      throw new BadRequestException('Impossible de générer un code unique. Réessayez.');
    }

    const saved = await this.codeRepo.save(
      this.codeRepo.create({
        code,
        targetRole:    dto.targetRole,
        targetEmail:   dto.targetEmail ?? null,
        validityDays:  validDays,
        expiresAt,
        maxUses:       1,
        status:        CodeStatus.PENDING,
        adminId:       admin.id,
        generatedById: userId,
      }),
    );

    return {
      id:           saved.id,
      code:         saved.code,
      type:         ROLE_TO_SHORT[saved.targetRole] ?? saved.targetRole,
      destinataire: saved.targetEmail ?? null,
      statut:       'sent',
      creeLe:       fmtDate(saved.createdAt),
    };
  }

  /**
   * Révoque un code en attente (PENDING → REVOKED).
   *
   * Seuls les codes PENDING peuvent être révoqués :
   * un code déjà utilisé ou expiré ne peut pas être annulé.
   */
  async revokeCode(userId: string, codeId: string) {
    const admin = await this.zoneService.adminOf(userId);
    const code  = await this.codeRepo.findOne({ where: { id: codeId, adminId: admin.id } });

    if (!code) throw new NotFoundException('Code introuvable.');
    if (code.status !== CodeStatus.PENDING) {
      throw new BadRequestException('Seuls les codes en attente peuvent être révoqués.');
    }

    code.status    = CodeStatus.REVOKED;
    code.revokedAt = new Date();
    await this.codeRepo.save(code);

    return { message: 'Code révoqué.' };
  }
}
