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

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { AdminZoneService }  from './admin-zone.service';
import { CreationCode, CodeStatus } from '../../../../database/entities/code-creation.entity';
import { GenerateCodeDto }   from '../dto/generate-code.dto';
import { ROLE_PREFIX, ROLE_TO_SHORT } from '../helpers/admin.constants';
import { randCode, fmtDate } from '../helpers/admin.helpers';
import { MailService }       from '../../../email/email.service';

@Injectable()
export class AdminCodesService {
  private readonly logger = new Logger(AdminCodesService.name);

  constructor(
    private readonly zoneService: AdminZoneService,
    private readonly mailService: MailService,

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
   * Retourne les codes générés par cet admin, paginés et triés par
   * date de création décroissante, avec statistiques agrégées sur
   * TOUTE la zone (pas seulement la page courante — sinon les stats
   * varieraient selon la page affichée, comme c'était le cas avant
   * quand elles étaient calculées sur les 200 derniers codes captés).
   */
  async getCodes(userId: string, page = 1, limit = 20) {
    const admin = await this.zoneService.adminOf(userId);
    const safeLimit = Math.min(limit, 100);

    const [codes, total, used, pending] = await Promise.all([
      this.codeRepo.find({
        where: { adminId: admin.id },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * safeLimit,
        take: safeLimit,
      }),
      this.codeRepo.count({ where: { adminId: admin.id } }),
      this.codeRepo.count({ where: { adminId: admin.id, status: CodeStatus.USED } }),
      this.codeRepo.count({ where: { adminId: admin.id, status: CodeStatus.PENDING } }),
    ]);

    return {
      stats: {
        generated: total,
        used,
        pending,
        // EXPIRED + REVOKED = tout le reste (4 statuts possibles au total)
        expired: total - used - pending,
      },
      page, limit: safeLimit, total,
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
        note:          dto.targetName ? JSON.stringify({ fullName: dto.targetName }) : null,
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
   * Envoie (ou renvoie) un code de création par email au destinataire
   * enregistré sur le code. Seul le canal Email est opérationnel pour
   * l'instant — SMS et WhatsApp sont désactivés côté frontend.
   */
  async sendCodeByEmail(userId: string, codeId: string) {
    const admin = await this.zoneService.adminOf(userId);
    const code  = await this.codeRepo.findOne({ where: { id: codeId, adminId: admin.id } });

    if (!code) throw new NotFoundException('Code introuvable.');
    if (!code.targetEmail) {
      throw new BadRequestException('Aucun email associé à ce code.');
    }
    if (code.status !== CodeStatus.PENDING) {
      throw new BadRequestException('Ce code n\'est plus en attente d\'utilisation.');
    }

    let toName: string | undefined;
    if (code.note) {
      try { toName = JSON.parse(code.note).fullName; } catch { /* note non-JSON, ignoré */ }
    }

    try {
      await this.mailService.sendInvitationEmail({
        toEmail:    code.targetEmail,
        toName,
        code:       code.code,
        targetRole: code.targetRole,
        expiresAt:  code.expiresAt,
        senderName: admin.fullName,
      });
    } catch (err) {
      this.logger.warn(`[CODE EMAIL ⚠️] Échec d'envoi à ${code.targetEmail} : ${(err as Error).message}`);
      throw new BadRequestException('Échec de l\'envoi de l\'email. Réessayez plus tard.');
    }

    return { message: `Email envoyé à ${code.targetEmail}.` };
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
