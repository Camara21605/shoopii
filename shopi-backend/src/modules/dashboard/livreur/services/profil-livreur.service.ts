/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/services/profil-livreur.service.ts
 *
 * ✅ CORRECTIONS :
 *   1. updateProfil : champs explicites au lieu de Object.assign
 *      (firstName, lastName, email maintenant dans l'entité)
 *   2. updateProfil : fullName recalculé depuis firstName + lastName
 *   3. uploadPhoto : retourne { photoUrl } (pas { photo })
 * ============================================================ */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Delivery, LivreurVerificationStatus } from 'src/database/entities/profiles/livreur-profile.entity';
import { User }         from 'src/database/entities/user.entity';
import { UploadService, UPLOAD_FOLDERS } from 'src/modules/upload/upload.service';
import { UpdateLivreurProfilDto } from '../dto/livreur-parametres.dto';

type DocumentType = 'cni' | 'permis' | 'assurance' | 'casier';

const DOC_FIELD_MAP: Record<DocumentType, keyof Delivery> = {
  cni:       'documentCni',
  permis:    'documentPermis',
  assurance: 'documentAssurance',
  casier:    'documentCasier',
};

/* SÉCURITÉ — CNI, permis de conduire, assurance, casier judiciaire :
 * uploadés en type:'authenticated' (voir UploadService.uploadDocument),
 * jamais en public type:'upload'. Le champ Delivery stocke un public_id
 * Cloudinary, jamais une URL consultable directement, et aucune route ne
 * renvoie plus cette valeur brute au client (seulement `present:boolean`
 * — voir getDocuments() et le filtre dans getParametres()). Même
 * correctif que les modules Entreprise et Correspondant. */

@Injectable()
export class ProfilLivreurService {

  private readonly logger = new Logger(ProfilLivreurService.name);

  constructor(
    @InjectRepository(Delivery) private readonly livreurRepo: Repository<Delivery>,
    @InjectRepository(User)     private readonly userRepo:    Repository<User>,
    private readonly uploadService: UploadService,
  ) {}

  /* ── GET léger : photo + nom uniquement ── */
  async getAvatarInfo(userId: string): Promise<{ photoUrl: string | null; fullName: string }> {
    const livreur = await this.livreurRepo.findOne({
      where: { userId },
      select: ['photoUrl', 'fullName'],
    });
    if (!livreur) throw new NotFoundException('Profil livreur introuvable.');
    return { photoUrl: livreur.photoUrl ?? null, fullName: livreur.fullName ?? '' };
  }

  /* ── GET global ── */
  async getParametres(userId: string): Promise<Delivery> {
    const livreur = await this.livreurRepo.findOne({
      where: { userId },
      relations: ['horaires'],
    });
    if (!livreur) throw new NotFoundException('Profil livreur introuvable.');
    return this.redactSensitiveDocuments(livreur);
  }

  /* SÉCURITÉ — voir commentaire en tête de fichier. getParametres()
   * renvoie l'entité Delivery quasi brute (alimente toute la page
   * paramètres, y compris SecDocuments.tsx qui ne lit que present/absent,
   * jamais la valeur) : sans ce filtre, le public_id des 4 documents
   * sensibles partait tel quel dans la réponse JSON. */
  private redactSensitiveDocuments(livreur: Delivery): Delivery {
    const REDACTED = '••••••';
    if (livreur.documentCni)       livreur.documentCni       = REDACTED;
    if (livreur.documentPermis)    livreur.documentPermis    = REDACTED;
    if (livreur.documentAssurance) livreur.documentAssurance = REDACTED;
    if (livreur.documentCasier)    livreur.documentCasier    = REDACTED;
    return livreur;
  }

  /* ── PATCH profil ── */
  async updateProfil(userId: string, dto: UpdateLivreurProfilDto): Promise<Delivery> {
    const livreur = await this.findOrFail(userId);

    // ✅ Assignation explicite — pas d'Object.assign qui pourrait assigner des champs inexistants
    if (dto.firstName     !== undefined) livreur.firstName     = dto.firstName     ?? null;
    if (dto.lastName      !== undefined) livreur.lastName      = dto.lastName      ?? null;
    if (dto.bio           !== undefined) livreur.bio           = dto.bio           ?? null;
    if (dto.phone         !== undefined) livreur.phone         = dto.phone         ?? null;
    if (dto.email         !== undefined) livreur.email         = dto.email         ?? null;
    if (dto.langues       !== undefined) livreur.langues       = dto.langues       ?? null;
    if (dto.ville         !== undefined) livreur.ville         = dto.ville         ?? null;
    if (dto.deliveryEmoji !== undefined) livreur.deliveryEmoji = dto.deliveryEmoji ?? '🛵';

    // ✅ fullName recalculé automatiquement
    const first = livreur.firstName ?? '';
    const last  = livreur.lastName  ?? '';
    const computed = `${first} ${last}`.trim();
    if (computed) livreur.fullName = computed;

    const updated = await this.livreurRepo.save(livreur);
    this.logger.log(`[PROFIL] Mis à jour — userId=${userId} → "${updated.fullName}"`);
    return updated;
  }

  /* ── POST photo ── */
  async uploadPhoto(userId: string, file: Express.Multer.File): Promise<{ photoUrl: string }> {
    const livreur = await this.findOrFail(userId);

    if (livreur.photoUrl) await this.deleteCloudinary(livreur.photoUrl);

    const result = await this.uploadService.uploadImage(
      file, UPLOAD_FOLDERS.AVATAR, { width: 400, height: 400 },
    );

    livreur.photoUrl = result.url;
    await this.livreurRepo.save(livreur);
    this.logger.log(`[PHOTO] Uploadée — userId=${userId}`);

    // ✅ Retourne { photoUrl } (pas { photo }) pour correspondre au hook frontend
    return { photoUrl: result.url };
  }

  /* ── GET documents ── */
  async getDocuments(userId: string) {
    const livreur = await this.findOrFail(userId);
    return {
      verificationStatus: livreur.verificationStatus,
      documents: {
        cni:       { present: !!livreur.documentCni       },
        permis:    { present: !!livreur.documentPermis    },
        assurance: { present: !!livreur.documentAssurance },
        casier:    { present: !!livreur.documentCasier    },
      },
    };
  }

  /* ── POST document ── */
  async uploadDocument(userId: string, type: DocumentType, file: Express.Multer.File) {
    if (!DOC_FIELD_MAP[type]) throw new BadRequestException(
      `Type invalide : "${type}". Valeurs acceptées : cni, permis, assurance, casier`,
    );
    const livreur = await this.findOrFail(userId);
    const ancienneValeur = livreur[DOC_FIELD_MAP[type]] as string | null;
    if (ancienneValeur) await this.deleteStoredDocument(ancienneValeur);

    const result = await this.uploadService.uploadDocument(file, UPLOAD_FOLDERS.DOCUMENT);
    (livreur as any)[DOC_FIELD_MAP[type]] = result.publicId;

    if (livreur.documentCni && livreur.documentPermis) {
      livreur.verificationStatus = LivreurVerificationStatus.REVIEWING;
    }

    await this.livreurRepo.save(livreur);
    this.logger.log(`[DOC] ${type} uploadé — userId=${userId}`);
    return { present: true, type };
  }

  /* ── DELETE document ── */
  async deleteDocument(userId: string, type: DocumentType) {
    const livreur = await this.findOrFail(userId);
    const valeur = livreur[DOC_FIELD_MAP[type]] as string | null;
    if (valeur) {
      await this.deleteStoredDocument(valeur);
      (livreur as any)[DOC_FIELD_MAP[type]] = null;
      await this.livreurRepo.save(livreur);
    }
    return { message: `Document "${type}" supprimé.` };
  }

  /* ── Helpers ── */
  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }

  /** Pour photoUrl (avatar, public type:'upload') — extraction du
   * public_id par regex depuis l'URL stockée. */
  private async deleteCloudinary(url: string): Promise<void> {
    try {
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
      if (match) {
        const isImage = /\.(webp|jpg|jpeg|png|gif)$/i.test(url);
        await this.uploadService.delete(match[1], isImage ? 'image' : 'raw');
      }
    } catch {
      this.logger.warn(`Cloudinary delete échoué : ${url}`);
    }
  }

  /** Pour les 4 documents sensibles (type:'authenticated') — le champ
   * stocke déjà un public_id brut, aucune extraction nécessaire. */
  private async deleteStoredDocument(publicId: string): Promise<void> {
    try {
      await this.uploadService.delete(publicId, 'raw', 'authenticated');
    } catch {
      this.logger.warn(`Cloudinary delete échoué : ${publicId}`);
    }
  }
}