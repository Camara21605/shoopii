/* ============================================================
 * FICHIER : src/modules/livreurs/services/invitation-livreur.service.ts
 *
 * RÔLE    : Gestion des invitations et du contact livreur.
 *
 * ─── MÉTHODES ────────────────────────────────────────────────
 *
 *  inviter(dto, user)       → POST /livreurs/inviter
 *  contacter(id, dto, user) → POST /livreurs/:id/contacter
 *
 * ─── FLUX D'INVITATION ───────────────────────────────────────
 *
 *  1. ModalInviter (étape 1) : l'entreprise saisit nom, email,
 *     zone, vehicleType, message
 *
 *  2. ModalInviter (étape 2) : aperçu de l'email
 *
 *  3. ModalInviter (étape 3) → POST /livreurs/inviter :
 *     → generateForCompany() dans CodeCreationService
 *       génère un code XXXX-XXXX-XX (même format que les autres)
 *     → créé dans creation_codes avec targetRole = DELIVERY
 *     → email envoyé via MailService
 *     → réponse : { code, email, fullName, expiresAt, codeId }
 *     → code affiché dans l'étape 3 de ModalInviter
 *
 *  Le destinataire s'inscrit sur shopi.gn/inscription avec ce code.
 *  auth.service.ts crée le profil Delivery avec companyId du code.
 *
 * ============================================================ */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { ConfigService }    from '@nestjs/config';

import {
  Delivery,
} from 'src/database/entities/profiles/livreur-profile.entity';
import {
  Company,
} from 'src/database/entities/profiles/entreprise-profile.entity';
import { User }       from 'src/database/entities/user.entity';
import { UserRole }   from 'src/common/enums/user-role.enum';
import { MailService } from 'src/modules/email/email.service';
import { CodeCreationService }
  from 'src/modules/auth/code-creation/code-creation.service';

import {
  InviterLivreurDto,
  ContacterLivreurDto,
} from '../dto/livreur.dto';

// ─────────────────────────────────────────────────────────────
// INTERFACE DE RÉPONSE
// ─────────────────────────────────────────────────────────────

export interface InvitationLivreurResponse {
  code:      string;    // XXXX-XXXX-XX — affiché dans ModalInviter étape 3
  email:     string;
  fullName:  string;
  expiresAt: string;
  codeId:    string;
}

@Injectable()
export class InvitationLivreurService {

  private readonly logger = new Logger(InvitationLivreurService.name);

  constructor(
    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    private readonly codeCreationService: CodeCreationService,
    private readonly mailService:         MailService,
    private readonly config:              ConfigService,
  ) {}

  // ══════════════════════════════════════════════════════════
  // PRIVÉ — Résoudre le profil Company depuis userId JWT
  // ══════════════════════════════════════════════════════════

  private async resolveCompany(user: User): Promise<Company> {
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
      return { id: 'admin', companyName: 'Shopi Admin' } as Company;
    }
    const company = await this.companyRepo.findOne({ where: { userId: user.id } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }

  // ══════════════════════════════════════════════════════════
  // 1. INVITER — POST /livreurs/inviter
  //
  // Génère un code d'invitation via CodeCreationService
  // (même format XXXX-XXXX-XX que les autres rôles)
  // et envoie l'email au futur livreur.
  //
  // Correspond au bouton "Envoyer l'invitation" de ModalInviter étape 2.
  // ══════════════════════════════════════════════════════════

  async inviter(dto: InviterLivreurDto, user: User): Promise<InvitationLivreurResponse> {
    const company = await this.resolveCompany(user);

    // Génère le code via CodeCreationService.generateForCompany()
    // → garantit le bon format + insertion correcte en BDD
    // → compatible avec validateCode() dans auth.service.ts
    const result = await this.codeCreationService.generateForCompany({
      targetRole:    UserRole.DELIVERY,
      targetEmail:   dto.email.toLowerCase().trim(),
      companyId:     company.id === 'admin' ? null : company.id,
      generatedById: user.id,
      note: JSON.stringify({
        fullName:    dto.fullName,
        zone:        dto.zone,
        vehicleType: dto.vehicleType,
      }),
    });

    const companyName = company.id === 'admin'
      ? 'Équipe Shopi'
      : (company as Company).companyName;

    try {
      await this.mailService.sendInvitationEmail({
        toEmail:       dto.email,
        toName:        dto.fullName,
        code:          result.code,
        targetRole:    UserRole.DELIVERY,
        expiresAt:     new Date(result.expiresAt),
        senderName:    companyName,
        customMessage: dto.message,
        ville:         dto.zone,
      });
    } catch (mailErr) {
      // Email échoué — le code existe déjà en BDD, pas bloquant
      this.logger.warn(
        `[INVITER LIVREUR ⚠️] Email non envoyé à ${dto.email} : ` +
        `${(mailErr as Error).message} | Code : ${result.code}`,
      );
    }

    this.logger.log(
      `[INVITER LIVREUR ✅] Code=${result.code} | Dest=${dto.email} | ` +
      `Company=${company.id} | Par=${user.id}`,
    );

    return {
      code:      result.code,
      email:     dto.email,
      fullName:  dto.fullName,
      expiresAt: new Date(result.expiresAt).toISOString(),
      codeId:    result.codeId,
    };
  }

  // ══════════════════════════════════════════════════════════
  // 2. CONTACTER — POST /livreurs/:id/contacter
  //
  // Envoie un email au livreur depuis l'entreprise.
  // Correspond au bouton "Envoyer" de ModalContacter.
  // ══════════════════════════════════════════════════════════

  async contacter(
    id:   string,
    dto:  ContacterLivreurDto,
    user: User,
  ): Promise<{ message: string }> {

    const d = await this.deliveryRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException(`Livreur introuvable (ID: ${id}).`);

    // Charger l'email depuis la table users
    const userRow = await this.deliveryRepo.manager
      .createQueryBuilder()
      .select(['u.email', 'u.firstName'])
      .from('users', 'u')
      .where('u.id = :id', { id: d.userId })
      .getRawOne() as { u_email: string; u_firstName: string } | undefined;

    if (!userRow?.u_email) {
      throw new NotFoundException('Email du livreur introuvable.');
    }

    const company = user.role === UserRole.COMPANY
      ? await this.companyRepo.findOne({ where: { userId: user.id } })
      : null;

    try {
      await this.mailService.sendContactEmail({
        toEmail:   userRow.u_email,
        toName:    d.fullName,
        fromName:  company?.companyName ?? 'Shopi',
        sujet:     dto.sujet,
        message:   dto.message,
      });
    } catch (mailErr) {
      this.logger.error(
        `[CONTACTER LIVREUR ❌] ${userRow.u_email} : ${(mailErr as Error).message}`,
      );
      throw new BadRequestException('Impossible d\'envoyer l\'email. Réessayez plus tard.');
    }

    this.logger.log(
      `[CONTACTER LIVREUR ✅] Dest=${userRow.u_email} | Sujet="${dto.sujet}"`,
    );

    return { message: `Email envoyé à ${d.fullName} (${userRow.u_email}).` };
  }
}