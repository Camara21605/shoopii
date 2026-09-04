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

/* SÉCURITÉ — les 5 documents ici (dont un extrait de casier judiciaire,
 * particulièrement sensible) partaient sur Cloudinary en type:'upload'
 * public par défaut : leur URL était fetchable par quiconque la
 * connaît/devine, sans aucune vérification Cloudinary, et repartait telle
 * quelle dans les réponses API alors que le frontend n'utilise que le
 * booléen présent/absent. Même correctif que le module Entreprise
 * (documents-parametres.service.ts) : upload en type:'authenticated'
 * (voir UploadService.uploadDocument), stockage d'un public_id plutôt
 * qu'une URL, jamais renvoyé au client. `documentPhotos` (photos du
 * point de dépôt, uploadées via uploadImage/type:'upload') reste public
 * — ce sont des photos de vitrine, pas des pièces justificatives. */

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
   * Génère une URL signée à la demande pour que le correspondant
   * consulte SON PROPRE document ("Voir le document" dans SecDocuments.tsx)
   * — jamais stockée, jamais renvoyée par getDocuments(). L'appartenance
   * est vérifiée via findCorOrFail(userId) : impossible de consulter le
   * document d'un autre correspondant en changeant juste le :type dans
   * l'URL, puisque le public_id vient toujours du PROFIL de l'appelant.
   */
  async getDocumentUrl(userId: string, type: DocumentType): Promise<{ url: string }> {
    if (!DOC_FIELD[type]) {
      throw new BadRequestException(`Type invalide : "${type}".`);
    }
    const cor = await this.findCorOrFail(userId);
    const publicId = cor[DOC_FIELD[type]] as string | null;
    if (!publicId) throw new BadRequestException(`Document "${type}" non uploadé.`);
    return { url: this.uploadService.getSignedUrl(publicId, 'raw') };
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
        cni:       { present: !!cor.documentCni       },
        bail:      { present: !!cor.documentBail      },
        assurance: { present: !!cor.documentAssurance },
        casier:    { present: !!cor.documentCasier    },
        registre:  { present: !!cor.documentRegistre  },
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
  ): Promise<{ present: true; type: DocumentType; verificationStatus: VerificationStatus }> {
    if (!DOC_FIELD[type]) {
      throw new BadRequestException(
        `Type invalide : "${type}". Valeurs acceptées : ${Object.keys(DOC_FIELD).join(', ')}`,
      );
    }

    const cor = await this.findCorOrFail(userId);

    /* Supprimer l'ancienne version */
    const ancienneValeur = cor[DOC_FIELD[type]] as string | null;
    if (ancienneValeur) await this.deleteStoredDocument(ancienneValeur);

    /* Upload le nouveau — type:'authenticated' côté UploadService, on ne
     * stocke que le public_id, jamais l'URL (voir commentaire en tête de
     * fichier). */
    const result = await this.uploadService.uploadDocument(file, UPLOAD_FOLDERS.DOCUMENT);
    (cor as any)[DOC_FIELD[type]] = result.publicId;

    /* Passage en REVIEWING si les 2 docs principaux sont présents */
    if (cor.documentCni && cor.documentBail) {
      cor.verificationStatus = VerificationStatus.REVIEWING;
    }

    await this.corRepo.save(cor);
    this.logger.log(`[DOC] ${type} uploadé — userId=${userId}`);

    return { present: true, type, verificationStatus: cor.verificationStatus };
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
    const valeur = cor[DOC_FIELD[type]] as string | null;

    if (valeur) {
      await this.deleteStoredDocument(valeur);
      (cor as any)[DOC_FIELD[type]] = null;
      await this.corRepo.save(cor);
    }

    return { message: `Document "${type}" supprimé avec succès.` };
  }

  /**
   * Supprime un document Cloudinary (silencieux en cas d'erreur). Les 5
   * types gérés ici stockent tous un public_id brut, uploadés en
   * type:'authenticated' (voir uploadDocument()) — jamais d'URL à
   * parser, contrairement aux photos de dépôt (publiques, non gérées par
   * cette méthode).
   */
  private async deleteStoredDocument(publicId: string): Promise<void> {
    try {
      await this.uploadService.delete(publicId, 'raw', 'authenticated');
    } catch {
      this.logger.warn(`Cloudinary delete échoué : ${publicId}`);
    }
  }
}