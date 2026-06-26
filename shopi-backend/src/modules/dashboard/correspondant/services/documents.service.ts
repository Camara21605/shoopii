/* ============================================================
 * FICHIER : services/documents.service.ts
 * SECTION : §7 — Documents & Vérification
 *
 * Responsabilités :
 *   getDocuments()       → statut de chaque document + verificationStatus
 *   uploadDocument()     → upload CNI / bail / assurance / casier / registre
 *   uploadPhotosDepot()  → upload photos du point de dépôt (multiple)
 *   deleteDocument()     → suppression Cloudinary + nullification champ
 * ============================================================ */

import {
  Injectable, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import {
  Correspondent,
  VerificationStatus,
} from '../../../../database/entities/profiles/correspondant-profile.entity';
import { User }           from '../../../../database/entities/user.entity';
import { UploadService, UPLOAD_FOLDERS } from '../../../upload/upload.service';
import { CorrespondantBaseService }      from './base.service';

/** Types de documents officiels acceptés */
export type DocumentType = 'cni' | 'bail' | 'assurance' | 'casier' | 'registre';

/** Mapping type → champ entité Correspondent */
const DOC_FIELD: Record<DocumentType, keyof Correspondent> = {
  cni:       'documentCni',
  bail:      'documentBail',
  assurance: 'documentAssurance',
  casier:    'documentCasier',
  registre:  'documentRegistre',
};

@Injectable()
export class DocumentsService extends CorrespondantBaseService {

  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Correspondent) corRepo:  Repository<Correspondent>,
    @InjectRepository(User)          userRepo: Repository<User>,
    private readonly uploadService: UploadService,
  ) {
    super(corRepo, userRepo);
  }

  /**
   * Retourne le statut complet de chaque document.
   * Utilisé par SecDocuments au chargement de la section.
   */
  async getDocuments(userId: string) {
    const cor = await this.findCorOrFail(userId);
    return {
      verificationStatus: cor.verificationStatus,
      documents: {
        cni:       { url: cor.documentCni,       present: !!cor.documentCni       },
        bail:      { url: cor.documentBail,      present: !!cor.documentBail      },
        assurance: { url: cor.documentAssurance, present: !!cor.documentAssurance },
        casier:    { url: cor.documentCasier,    present: !!cor.documentCasier    },
        registre:  { url: cor.documentRegistre,  present: !!cor.documentRegistre  },
        photos:    {
          urls:  cor.documentPhotos,
          count: cor.documentPhotos?.length ?? 0,
        },
      },
    };
  }

  /**
   * Upload un document officiel sur Cloudinary.
   *
   * Comportement :
   *   1. Valide le type (cni | bail | assurance | casier | registre)
   *   2. Supprime l'ancienne version sur Cloudinary si elle existe
   *   3. Upload le nouveau fichier
   *   4. Si CNI + bail présents → passe verificationStatus en REVIEWING
   */
  async uploadDocument(
    userId: string,
    type: DocumentType,
    file: Express.Multer.File,
  ): Promise<{ url: string; type: DocumentType; verificationStatus: VerificationStatus }> {
    if (!DOC_FIELD[type]) {
      throw new BadRequestException(
        `Type invalide : "${type}". Valeurs acceptées : ${Object.keys(DOC_FIELD).join(', ')}`,
      );
    }

    const cor = await this.findCorOrFail(userId);

    /* Supprimer l'ancienne version */
    const ancienUrl = cor[DOC_FIELD[type]] as string | null;
    if (ancienUrl) await this.deleteCloudinaryFile(ancienUrl);

    /* Upload le nouveau */
    const result = await this.uploadService.uploadDocument(file, UPLOAD_FOLDERS.DOCUMENT);
    (cor as any)[DOC_FIELD[type]] = result.url;

    /* Passage en REVIEWING si les 2 docs principaux sont présents */
    if (cor.documentCni && cor.documentBail) {
      cor.verificationStatus = VerificationStatus.REVIEWING;
    }

    await this.corRepo.save(cor);
    this.logger.log(`[DOC] ${type} uploadé — userId=${userId}`);

    return { url: result.url, type, verificationStatus: cor.verificationStatus };
  }

  /**
   * Upload multiple de photos du point de dépôt.
   * Ajoute aux photos existantes (append, pas remplacement).
   * Max recommandé côté frontend : 5 fichiers.
   */
  async uploadPhotosDepot(
    userId: string,
    files: Express.Multer.File[],
  ): Promise<{ urls: string[] }> {
    const cor = await this.findCorOrFail(userId);

    const results = await Promise.all(
      files.map(f =>
        this.uploadService.uploadImage(f, UPLOAD_FOLDERS.DOCUMENT, { width: 1200, height: 900 }),
      ),
    );

    const newUrls = results.map(r => r.url);
    cor.documentPhotos = [...(cor.documentPhotos ?? []), ...newUrls];
    await this.corRepo.save(cor);

    this.logger.log(`[PHOTOS DEPOT] ${files.length} photos ajoutées — userId=${userId}`);
    return { urls: newUrls };
  }

  /**
   * Supprime un document officiel (Cloudinary + champ en base).
   */
  async deleteDocument(userId: string, type: DocumentType): Promise<{ message: string }> {
    const cor = await this.findCorOrFail(userId);
    const url = cor[DOC_FIELD[type]] as string | null;

    if (url) {
      await this.deleteCloudinaryFile(url);
      (cor as any)[DOC_FIELD[type]] = null;
      await this.corRepo.save(cor);
    }

    return { message: `Document "${type}" supprimé avec succès.` };
  }

  /** Supprime un fichier Cloudinary (silencieux en cas d'erreur) */
  private async deleteCloudinaryFile(url: string): Promise<void> {
    try {
      const match   = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
      if (!match) return;
      const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
      await this.uploadService.delete(match[1], isImage ? 'image' : 'raw');
    } catch {
      this.logger.warn(`Cloudinary delete échoué : ${url}`);
    }
  }
}