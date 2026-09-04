/* ============================================================
 * FICHIER : services/documents-partenaire.service.ts
 *
 * RÔLE : Documents & vérification KYC du partenaire (section 8).
 *   GET    /parametres/documents         → statut de chaque document
 *   POST   /parametres/documents/:type   → uploader un document
 *   DELETE /parametres/documents/:type   → supprimer un document
 *
 * Réplique exactement le pattern sécurisé de
 * documents-parametres.service.ts (module entreprise) :
 *   - Les documents sensibles (cni, domicile, activite) sont uploadés en
 *     PDF via UploadService.uploadDocument() → resource_type:'raw' +
 *     type:'authenticated' (Cloudinary refuse tout accès sans signature
 *     serveur) — seul le public_id est stocké, jamais une URL.
 *   - getDocuments() ne renvoie jamais le public_id au frontend, juste
 *     `{ present: boolean }`.
 * ============================================================ */

import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Partner,
  VerificationStatus,
} from 'src/database/entities/profiles/partenaire-profile.entity';
import { UploadService, UPLOAD_FOLDERS } from 'src/modules/upload/upload.service';

export type DocumentType = 'cni' | 'domicile' | 'activite';

const DOC_FIELD_MAP: Record<DocumentType, keyof Partner> = {
  cni:      'documentCni',
  domicile: 'documentDomicile',
  activite: 'documentActivite',
};

/** Documents obligatoires pour la vérification — voir aussi
 * WalletService.applyOperation() qui applique la même règle pour
 * bloquer le retrait de commission. */
const MANDATORY_DOC_TYPES: DocumentType[] = ['cni', 'domicile'];

@Injectable()
export class DocumentsPartenaireService {

  private readonly logger = new Logger(DocumentsPartenaireService.name);

  constructor(
    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,

    private readonly uploadService: UploadService,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Statut de chaque document
   * ────────────────────────────────────────────────────────── */

  async getDocuments(userId: string) {
    const partner = await this.findOrFail(userId);

    return {
      verificationStatus: partner.verificationStatus,
      documents: {
        cni:      { present: !!partner.documentCni },
        domicile: { present: !!partner.documentDomicile },
        activite: { present: !!partner.documentActivite },
      },
    };
  }

  /* ──────────────────────────────────────────────────────────
   * POST — Uploader un document
   * ────────────────────────────────────────────────────────── */

  async uploadDocument(
    userId: string,
    type: DocumentType,
    file: Express.Multer.File,
  ): Promise<{ present: true; type: DocumentType }> {
    if (!DOC_FIELD_MAP[type]) {
      throw new BadRequestException(`Type de document invalide : ${type}`);
    }
    if (!file) throw new BadRequestException('Aucun fichier reçu.');

    const partner = await this.findOrFail(userId);

    const ancienneValeur = partner[DOC_FIELD_MAP[type]] as string | null;
    if (ancienneValeur) {
      await this.deleteStoredDocument(ancienneValeur);
    }

    const result = await this.uploadService.uploadDocument(file, UPLOAD_FOLDERS.DOCUMENT);
    (partner as any)[DOC_FIELD_MAP[type]] = result.publicId;

    if (this.allMandatoryDocumentsPresent(partner)) {
      partner.verificationStatus = VerificationStatus.REVIEWING;
    }

    await this.partnerRepo.save(partner);
    this.logger.log(`[DOCUMENT] ${type} uploadé — userId=${userId}`);

    return { present: true, type };
  }

  /* ──────────────────────────────────────────────────────────
   * DELETE — Supprimer un document
   * ────────────────────────────────────────────────────────── */

  async deleteDocument(userId: string, type: DocumentType): Promise<{ message: string }> {
    if (!DOC_FIELD_MAP[type]) {
      throw new BadRequestException(`Type de document invalide : ${type}`);
    }

    const partner = await this.findOrFail(userId);

    const valeur = partner[DOC_FIELD_MAP[type]] as string | null;
    if (valeur) {
      await this.deleteStoredDocument(valeur);
      (partner as any)[DOC_FIELD_MAP[type]] = null;
      if (!this.allMandatoryDocumentsPresent(partner) && partner.verificationStatus === VerificationStatus.REVIEWING) {
        partner.verificationStatus = VerificationStatus.PENDING;
      }
      await this.partnerRepo.save(partner);
    }

    return { message: `Document "${type}" supprimé.` };
  }

  /* ──────────────────────────────────────────────────────────
   * HELPERS PRIVÉS
   * ────────────────────────────────────────────────────────── */

  private allMandatoryDocumentsPresent(partner: Partner): boolean {
    return MANDATORY_DOC_TYPES.every(t => !!partner[DOC_FIELD_MAP[t]]);
  }

  private async findOrFail(userId: string): Promise<Partner> {
    const partner = await this.partnerRepo.findOne({ where: { userId } });
    if (!partner) throw new NotFoundException('Profil partenaire introuvable.');
    return partner;
  }

  private async deleteStoredDocument(publicId: string): Promise<void> {
    try {
      await this.uploadService.delete(publicId, 'raw', 'authenticated');
    } catch {
      this.logger.warn('Suppression Cloudinary échouée');
    }
  }
}
