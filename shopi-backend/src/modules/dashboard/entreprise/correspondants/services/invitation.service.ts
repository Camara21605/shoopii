/* ============================================================
 * FICHIER : src/modules/correspondants/services/invitation.service.ts
 *
 * ─── CORRECTION DU BUG 400 "Code ne correspond pas" ──────────
 *
 *  CAUSE RACINE :
 *
 *  invitation.service.ts générait les codes LOCALEMENT avec :
 *    Array.from({ length: 10 }, () => Math.floor(Math.random() * 10))
 *    → Format XXXX-XXX-XXX (chiffres uniquement, ex: "4892-317-056")
 *
 *  Mais code-creation.service.ts génère les codes avec :
 *    CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
 *    → Format XXXX-XXXX-XX (lettres+chiffres, ex: "ABCD-EFGH-23")
 *
 *  Et validateCode() fait WHERE code = codeValue.toUpperCase()
 *  → Le code "4892-317-056" était bien en majuscules (que des chiffres)
 *    MAIS l'entité CreationCode a @Column({ length: 12 }) et le code
 *    fait 12 caractères (4+1+3+1+3 = 12) exactement — donc pas de troncature.
 *
 *  LE VRAI PROBLÈME :
 *  validateCode() dans code-creation.service.ts est appelé par auth.service.ts.
 *  Il cherche le code en base. Si le code "4892-317-056" existe → OK.
 *  Mais entry.targetRole = UserRole.CORRESPONDENT ("correspondent")
 *  et dto.role = "correspondent" → la comparaison devrait passer.
 *
 *  MAIS : invitation.service.ts ne passe PAS par CodeCreationService.
 *  Il crée directement dans codeRepo sans passer par la méthode generate.
 *  Le champ `code` dans CreationCode a length: 12 mais le format
 *  XXXX-XXX-XXX = 12 chars (4+3+3 + 2 tirets = 12) ✅ — OK.
 *
 *  VRAIE CAUSE FINALE trouvée :
 *  Dans validateCode() ligne :
 *    const normalized = codeValue.toUpperCase().trim();
 *    const entry = await this.codeRepo.findOne({ where: { code: normalized } });
 *
 *  Le code inséré par invitation.service est "4892-317-056" (minuscules ?)
 *  Non — que des chiffres et tirets. Pas de problème de casse.
 *
 *  VRAI PROBLÈME : le code est cherché UPPERCASE mais stocké en lowercase
 *  si le code a des lettres. Ici que des chiffres → pas de problème.
 *
 *  PROBLÈME RÉEL : validateCode() fait UN SEUL accès DB puis incrémente
 *  verificationAttempts ET re-save AVANT de vérifier si le code est valide.
 *  Si le code n'existe pas (entry = null) → BadRequestException mais
 *  APRÈS avoir tenté le save(entry) → erreur silencieuse possible.
 *
 *  SOLUTION RETENUE :
 *  Déléguer la génération à CodeCreationService.generateForCompany()
 *  (nouvelle méthode ajoutée ci-dessous) qui garantit :
 *  1. Le bon format de code (XXXX-XXXX-XX)
 *  2. La bonne insertion en BDD
 *  3. La compatibilité avec validateCode()
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
  Correspondent,
} from 'src/database/entities/profiles/correspondant-profile.entity';
import {
  Company,
} from 'src/database/entities/profiles/entreprise-profile.entity';
import {
  Delivery,
} from 'src/database/entities/profiles/livreur-profile.entity';
import { User }       from 'src/database/entities/user.entity';
import { UserRole }   from 'src/common/enums/user-role.enum';
import { MailService } from 'src/modules/email/email.service';

import { CodeCreationService } from 'src/modules/auth/code-creation/code-creation.service';

import {
  InviterCorrespondantDto,
  ContacterCorrespondantDto,
} from '../dto/correspondant.dto';

// ─────────────────────────────────────────────────────────────
// INTERFACE DE RÉPONSE
// ─────────────────────────────────────────────────────────────

export interface InvitationResponse {
  code:      string;
  email:     string;
  fullName:  string;
  expiresAt: string;
  codeId:    string;
}

@Injectable()
export class InvitationService {

  private readonly logger = new Logger(InvitationService.name);

  constructor(
    @InjectRepository(Correspondent)
    private readonly correspondantRepo: Repository<Correspondent>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    // ✅ Délègue la génération du code à CodeCreationService
    private readonly codeCreationService: CodeCreationService,

    private readonly mailService: MailService,
    private readonly config:      ConfigService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVÉ — Résoudre le profil Company
  // ══════════════════════════════════════════════════════════════════════════

  private async resolveCompany(user: User): Promise<Company> {
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
      return { id: 'admin', companyName: 'Shopi Admin' } as Company;
    }
    const company = await this.companyRepo.findOne({ where: { userId: user.id } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVÉ — Résoudre le profil Delivery (livreur)
  // ══════════════════════════════════════════════════════════════════════════

  private async resolveDelivery(user: User): Promise<Delivery> {
    const delivery = await this.deliveryRepo.findOne({ where: { userId: user.id } });
    if (!delivery) throw new NotFoundException('Profil livreur introuvable.');
    return delivery;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. INVITER — POST /correspondants/inviter
  //
  // ✅ Utilise CodeCreationService.generateForCompany() au lieu
  //    de générer le code localement.
  // ══════════════════════════════════════════════════════════════════════════

  async inviter(dto: InviterCorrespondantDto, user: User): Promise<InvitationResponse> {
    // ✅ Un livreur peut inviter un correspondant dans son propre réseau,
    // tout comme une entreprise — le rattachement se fait via deliveryId
    // au lieu de companyId.
    const isDelivery = user.role === UserRole.DELIVERY;

    const company  = isDelivery ? null : await this.resolveCompany(user);
    const delivery = isDelivery ? await this.resolveDelivery(user) : null;

    // ✅ FIX : génération déléguée à CodeCreationService
    // → bon format XXXX-XXXX-XX compatible avec validateCode()
    const result = await this.codeCreationService.generateForCompany({
      targetRole:    UserRole.CORRESPONDENT,
      targetEmail:   dto.email.toLowerCase().trim(),
      companyId:     company && company.id !== 'admin' ? company.id : null,
      deliveryId:    delivery ? delivery.id : null,
      generatedById: user.id,
      note: JSON.stringify({
        fullName: dto.fullName,
        ville:    dto.ville,
        quartier: dto.quartier,
        type:     dto.type,
      }),
    });

    const senderName = delivery
      ? delivery.fullName
      : company && company.id === 'admin'
        ? 'Équipe Shopi'
        : (company as Company).companyName;

    try {
      await this.mailService.sendInvitationEmail({
        toEmail:       dto.email,
        toName:        dto.fullName,
        code:          result.code,
        targetRole:    UserRole.CORRESPONDENT,
        expiresAt:     new Date(result.expiresAt),
        senderName,
        customMessage: dto.message,
        ville:         dto.ville,
        quartier:      dto.quartier,
        type:          dto.type,
      });
    } catch (mailErr) {
      this.logger.warn(
        `[INVITER ⚠️] Email non envoyé à ${dto.email} : ` +
        `${(mailErr as Error).message} | Code créé : ${result.code}`,
      );
    }

    this.logger.log(
      `[INVITER ✅] Code=${result.code} | Dest=${dto.email} | ` +
      (delivery ? `Delivery=${delivery.id}` : `Company=${company?.id}`),
    );

    return {
      code:      result.code,
      email:     dto.email,
      fullName:  dto.fullName,
      expiresAt: new Date(result.expiresAt).toISOString(),
      codeId:    result.codeId,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. CONTACTER — POST /correspondants/:id/contacter
  // ══════════════════════════════════════════════════════════════════════════

  async contacter(id: string, dto: ContacterCorrespondantDto, user: User): Promise<{ message: string }> {
    const c = await this.correspondantRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`Correspondant introuvable (ID: ${id}).`);

    const userRow = await this.correspondantRepo.manager
      .createQueryBuilder()
      .select(['u.email', 'u.firstName'])
      .from('users', 'u')
      .where('u.id = :id', { id: c.userId })
      .getRawOne() as { u_email: string; u_firstName: string } | undefined;

    if (!userRow?.u_email) throw new NotFoundException('Email du correspondant introuvable.');

    const company = user.role === UserRole.COMPANY
      ? await this.companyRepo.findOne({ where: { userId: user.id } })
      : null;

    try {
      await this.mailService.sendContactEmail({
        toEmail:   userRow.u_email,
        toName:    c.fullName,
        fromName:  company?.companyName ?? 'Shopi',
        sujet:     dto.sujet,
        message:   dto.message,
      });
    } catch (mailErr) {
      this.logger.error(`[CONTACTER ❌] ${userRow.u_email} : ${(mailErr as Error).message}`);
      throw new BadRequestException('Impossible d\'envoyer l\'email. Réessayez plus tard.');
    }

    return { message: `Email envoyé à ${c.fullName} (${userRow.u_email}).` };
  }
}