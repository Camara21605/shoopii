/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/services/documents-parametres.service.ts
 *
 * RÔLE : Gère les documents et la vérification (section 8)
 *   GET  /parametres/documents            → statut de chaque document
 *   POST /parametres/documents/:type      → uploader un document
 *   DELETE /parametres/documents/:type    → supprimer un document
 *
 * Types de documents acceptés :
 *   "cni"       → ownerIdDocument (CNI / Passeport)
 *   "rccm"      → documentRccm
 *   "bancaire"  → documentBancaire
 *   "photo"     → documentPhoto (photo boutique physique)
 *   "nif"       → documentNif
 * ============================================================ */

import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Company,
  VerificationStatus,
} from 'src/database/entities/profiles/entreprise-profile.entity';
import { UploadService, UPLOAD_FOLDERS } from 'src/modules/upload/upload.service';

/* ── Types de documents gérés ── */
type DocumentType = 'cni' | 'rccm' | 'bancaire' | 'photo' | 'nif';

/* ── Mapping type → champ Company ── */
const DOC_FIELD_MAP: Record<DocumentType, keyof Company> = {
  cni:      'ownerIdDocument',
  rccm:     'documentRccm',
  bancaire: 'documentBancaire',
  photo:    'documentPhoto',
  nif:      'documentNif',
};

@Injectable()
export class DocumentsParametresService {

  private readonly logger = new Logger(DocumentsParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    private readonly uploadService: UploadService,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Statut de chaque document
   * ────────────────────────────────────────────────────────── */

  async getDocuments(userId: string) {
    const company = await this.findCompanyOrFail(userId);

    return {
      verificationStatus: company.verificationStatus,
      documents: {
        cni:      { url: company.ownerIdDocument, present: !!company.ownerIdDocument },
        rccm:     { url: company.documentRccm,    present: !!company.documentRccm    },
        bancaire: { url: company.documentBancaire,present: !!company.documentBancaire},
        photo:    { url: company.documentPhoto,   present: !!company.documentPhoto   },
        nif:      { url: company.documentNif,     present: !!company.documentNif     },
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
  ): Promise<{ url: string; type: DocumentType }> {
    if (!DOC_FIELD_MAP[type]) {
      throw new BadRequestException(`Type de document invalide : ${type}`);
    }

    const company = await this.findCompanyOrFail(userId);

    // Supprimer l'ancien document si déjà uploadé
    const ancienneUrl = company[DOC_FIELD_MAP[type]] as string | null;
    if (ancienneUrl) {
      await this.deleteCloudinaryFile(ancienneUrl);
    }

    // Upload selon le type : image pour photo boutique, document PDF pour les autres
    let url: string;
    if (type === 'photo') {
      const result = await this.uploadService.uploadImage(file, UPLOAD_FOLDERS.COMPANY);
      url = result.url;
    } else {
      const result = await this.uploadService.uploadDocument(file, UPLOAD_FOLDERS.DOCUMENT);
      url = result.url;
    }

    // Sauvegarder l'URL dans le bon champ
    (company as any)[DOC_FIELD_MAP[type]] = url;

    // Repasser en "reviewing" si tous les docs obligatoires sont présents
    if (this.allMandatoryDocumentsPresent(company)) {
      company.verificationStatus = VerificationStatus.REVIEWING;
    }

    await this.companyRepo.save(company);
    this.logger.log(`[DOCUMENT] ${type} uploadé — userId=${userId}`);

    return { url, type };
  }

  /* ──────────────────────────────────────────────────────────
   * DELETE — Supprimer un document
   * ────────────────────────────────────────────────────────── */

  async deleteDocument(
    userId: string,
    type: DocumentType,
  ): Promise<{ message: string }> {
    const company = await this.findCompanyOrFail(userId);

    const url = company[DOC_FIELD_MAP[type]] as string | null;
    if (url) {
      await this.deleteCloudinaryFile(url);
      (company as any)[DOC_FIELD_MAP[type]] = null;
      await this.companyRepo.save(company);
    }

    return { message: `Document "${type}" supprimé.` };
  }

  /* ──────────────────────────────────────────────────────────
   * HELPERS PRIVÉS
   * ────────────────────────────────────────────────────────── */

  /**
   * Vérifie si les 3 documents obligatoires sont présents :
   * CNI + RCCM + justificatif bancaire
   */
  private allMandatoryDocumentsPresent(company: Company): boolean {
    return !!(company.ownerIdDocument && company.documentRccm && company.documentBancaire);
  }

  private async findCompanyOrFail(userId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }

  private async deleteCloudinaryFile(url: string): Promise<void> {
    try {
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
      if (match) {
        // Détecter si c'est une image ou un document PDF
        const isImage = /\.(webp|jpg|jpeg|png|gif)$/i.test(url);
        await this.uploadService.delete(match[1], isImage ? 'image' : 'raw');
      }
    } catch {
      this.logger.warn(`Suppression Cloudinary échouée : ${url}`);
    }
  }
}
