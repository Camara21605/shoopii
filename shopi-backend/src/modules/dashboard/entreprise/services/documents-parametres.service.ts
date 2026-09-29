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
    const field   = DOC_FIELD_MAP[type];
    const ancienneValeur = company[field] as string | null;

    /* BUG CORRIGÉ — l'ancien fichier était supprimé AVANT l'envoi du nouveau :
     * un envoi qui échouait (réseau, format) faisait perdre les deux. Nouveau
     * fichier d'abord, ancien supprimé seulement une fois le nouveau enregistré. */
    let stored: string;
    if (type === 'photo') {
      const result = await this.uploadService.uploadImage(file, UPLOAD_FOLDERS.COMPANY);
      stored = result.url;               // public, vitrine boutique
    } else {
      const result = await this.uploadService.uploadDocument(file, UPLOAD_FOLDERS.DOCUMENT);
      stored = result.publicId;          // jamais l'URL — voir le commentaire en tête de fichier
    }

    /* BUG CORRIGÉ (documents perdus) — `save(company)` réécrivait TOUTE la fiche
     * avec la copie lue au début de la requête : deux envois rapprochés (CNI puis
     * RCCM choisis coup sur coup) s'écrasaient l'un l'autre — chacun répondait
     * « OK » mais un seul document restait en base, et le dossier ne passait
     * jamais « en cours d'examen ». On n'écrit plus que LA colonne du document,
     * puis le statut est recalculé sur les valeurs relues en base. */
    await this.companyRepo.update(company.id, { [field]: stored });
    await this.refreshVerificationStatus(company.id);
    if (ancienneValeur && ancienneValeur !== stored) await this.deleteStoredDocument(type, ancienneValeur);
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

    if (!DOC_FIELD_MAP[type]) {
      throw new BadRequestException(`Type de document invalide : ${type}`);
    }
    const valeur = company[DOC_FIELD_MAP[type]] as string | null;
    if (valeur) {
      /* Même correctif qu'à l'envoi : seule la colonne du document est écrite */
      await this.companyRepo.update(company.id, { [DOC_FIELD_MAP[type]]: null });
      await this.deleteStoredDocument(type, valeur);
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
  private allMandatoryDocumentsPresent(company: Pick<Company, 'ownerIdDocument' | 'documentRccm' | 'documentBancaire'>): boolean {
    return !!(company.ownerIdDocument && company.documentRccm && company.documentBancaire);
  }

  /**
   * Dossier complet (3 obligatoires, relus en base) et pas encore vérifié →
   * « en cours d'examen » (aussi après un refus : nouvel examen). Un dossier
   * VÉRIFIÉ garde son badge — la vérification reste l'affaire de l'administration.
   */
  private async refreshVerificationStatus(companyId: string): Promise<void> {
    const fresh = await this.companyRepo.findOne({
      where:  { id: companyId },
      select: ['id', 'ownerIdDocument', 'documentRccm', 'documentBancaire', 'verificationStatus'],
    });
    if (!fresh || !this.allMandatoryDocumentsPresent(fresh)) return;
    if (fresh.verificationStatus === VerificationStatus.PENDING || fresh.verificationStatus === VerificationStatus.REJECTED) {
      await this.companyRepo.update(companyId, { verificationStatus: VerificationStatus.REVIEWING });
    }
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
