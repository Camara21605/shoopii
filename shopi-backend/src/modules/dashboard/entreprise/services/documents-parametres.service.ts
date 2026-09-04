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

/* SÉCURITÉ — "photo" (photo boutique physique) est légitimement publique
 * (uploadImage, type:'upload' par défaut) : c'est une vitrine, pas une
 * pièce justificative. Les 4 autres (cni/rccm/bancaire/nif) sont de
 * vraies pièces d'identité/financières sensibles : uploadées en
 * type:'authenticated' (voir UploadService.uploadDocument) — leur champ
 * Company stocke désormais un public_id Cloudinary, jamais une URL
 * consultable directement, et aucune route ne renvoie plus cette valeur
 * brute au client (seulement `present: boolean`, voir getDocuments()). */

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

    /* SÉCURITÉ — plus de champ `url` ici pour les 4 documents sensibles :
     * le frontend n'a jamais utilisé que la présence/absence (voir
     * DocumentsSection.tsx, `isPresent = !!url`), jamais affiché de lien
     * cliquable. Renvoyer l'URL ne servait donc à rien pour l'UI et
     * exposait inutilement l'identifiant Cloudinary dans la réponse API
     * (visible depuis les DevTools) d'une pièce d'identité/relevé
     * bancaire. `photo` (vitrine boutique, non sensible) garde son URL. */
    return {
      verificationStatus: company.verificationStatus,
      documents: {
        cni:      { present: !!company.ownerIdDocument  },
        rccm:     { present: !!company.documentRccm     },
        bancaire: { present: !!company.documentBancaire },
        photo:    { url: company.documentPhoto, present: !!company.documentPhoto },
        nif:      { present: !!company.documentNif      },
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

    const company = await this.findCompanyOrFail(userId);

    // Supprimer l'ancien document si déjà uploadé
    const ancienneValeur = company[DOC_FIELD_MAP[type]] as string | null;
    if (ancienneValeur) {
      await this.deleteStoredDocument(type, ancienneValeur);
    }

    // Upload selon le type : image pour photo boutique, document PDF pour les autres
    let stored: string;
    if (type === 'photo') {
      const result = await this.uploadService.uploadImage(file, UPLOAD_FOLDERS.COMPANY);
      stored = result.url;               // public, vitrine boutique
    } else {
      const result = await this.uploadService.uploadDocument(file, UPLOAD_FOLDERS.DOCUMENT);
      stored = result.publicId;          // jamais l'URL — voir le commentaire en tête de fichier
    }

    (company as any)[DOC_FIELD_MAP[type]] = stored;

    // Repasser en "reviewing" si tous les docs obligatoires sont présents
    if (this.allMandatoryDocumentsPresent(company)) {
      company.verificationStatus = VerificationStatus.REVIEWING;
    }

    await this.companyRepo.save(company);
    this.logger.log(`[DOCUMENT] ${type} uploadé — userId=${userId}`);

    return { present: true, type };
  }

  /* ──────────────────────────────────────────────────────────
   * DELETE — Supprimer un document
   * ────────────────────────────────────────────────────────── */

  async deleteDocument(
    userId: string,
    type: DocumentType,
  ): Promise<{ message: string }> {
    const company = await this.findCompanyOrFail(userId);

    const valeur = company[DOC_FIELD_MAP[type]] as string | null;
    if (valeur) {
      await this.deleteStoredDocument(type, valeur);
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

  /* FIX m4 (historique, param client) — sans rapport ici : `userId` est en
   * réalité req.user.actorId, signé serveur (voir boutique-parametres.
   * service.ts pour le détail du bug que ce `[{id},{userId}]` corrige). */
  /* BUG CORRIGÉ — l'ancien `where:[{id},{userId}]` était un OR SQL sans
   * ordre garanti : quand une AUTRE entreprise a par accident un userId
   * identique à l'id de celle-ci (bug de profil fantôme, voir getParametres
   * dans boutique-parametres.service.ts), Postgres pouvait retourner l'une
   * ou l'autre selon le plan de requête — a réellement fait persister des
   * réglages sur la mauvaise fiche. `id` (cas normal, actorId) est
   * désormais toujours tenté en priorité ; `userId` n'est qu'un repli. */
  private async findCompanyOrFail(userId: string): Promise<Company> {
    let company = await this.companyRepo.findOne({ where: { id: userId } });
    if (!company) company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }

  /**
   * "photo" stocke une URL publique classique (type:'upload') — on en
   * extrait le public_id par regex, comme les logos/covers ailleurs dans
   * ce module. Les 4 documents sensibles stockent DÉJÀ un public_id brut
   * (voir uploadDocument() ci-dessus) : aucune extraction nécessaire, et
   * il faut passer type:'authenticated' à la suppression — sans quoi
   * Cloudinary ne retrouve pas la ressource (le triplet public_id +
   * resource_type + type l'identifie entièrement, voir UploadService.delete).
   */
  private async deleteStoredDocument(type: DocumentType, valeur: string): Promise<void> {
    try {
      if (type === 'photo') {
        const match = valeur.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
        if (match) await this.uploadService.delete(match[1], 'image');
        return;
      }
      await this.uploadService.delete(valeur, 'raw', 'authenticated');
    } catch {
      this.logger.warn(`Suppression Cloudinary échouée — type=${type}`);
    }
  }
}
