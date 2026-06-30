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
        cni:       { url: livreur.documentCni,       present: !!livreur.documentCni       },
        permis:    { url: livreur.documentPermis,    present: !!livreur.documentPermis    },
        assurance: { url: livreur.documentAssurance, present: !!livreur.documentAssurance },
        casier:    { url: livreur.documentCasier,    present: !!livreur.documentCasier    },
      },
    };
  }

  /* ── POST document ── */
  async uploadDocument(userId: string, type: DocumentType, file: Express.Multer.File) {
    if (!DOC_FIELD_MAP[type]) throw new BadRequestException(
      `Type invalide : "${type}". Valeurs acceptées : cni, permis, assurance, casier`,
    );
    const livreur = await this.findOrFail(userId);
    const ancienneUrl = livreur[DOC_FIELD_MAP[type]] as string | null;
    if (ancienneUrl) await this.deleteCloudinary(ancienneUrl);

    const result = await this.uploadService.uploadDocument(file, UPLOAD_FOLDERS.DOCUMENT);
    (livreur as any)[DOC_FIELD_MAP[type]] = result.url;

    if (livreur.documentCni && livreur.documentPermis) {
      livreur.verificationStatus = LivreurVerificationStatus.REVIEWING;
    }

    await this.livreurRepo.save(livreur);
    this.logger.log(`[DOC] ${type} uploadé — userId=${userId}`);
    return { url: result.url, type };
  }

  /* ── DELETE document ── */
  async deleteDocument(userId: string, type: DocumentType) {
    const livreur = await this.findOrFail(userId);
    const url = livreur[DOC_FIELD_MAP[type]] as string | null;
    if (url) {
      await this.deleteCloudinary(url);
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
}