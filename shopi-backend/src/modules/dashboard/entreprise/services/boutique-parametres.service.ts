/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/services/boutique-parametres.service.ts
 *
 * RÔLE : Gère les sections Boutique & Identité + Contact & Localisation
 *   GET  /parametres                → charger toutes les données de la boutique
 *   PATCH /parametres/boutique      → mettre à jour les infos boutique
 *   PATCH /parametres/contact       → mettre à jour le contact et l'adresse
 *   POST  /parametres/logo          → uploader le logo (Cloudinary)
 *   POST  /parametres/cover         → uploader l'image de couverture
 *   DELETE /parametres/logo         → supprimer le logo
 * ============================================================ */

import {
  Injectable, NotFoundException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { User }    from 'src/database/entities/user.entity';
import { UploadService, UPLOAD_FOLDERS } from 'src/modules/upload/upload.service';

import { UpdateBoutiqueDto, UpdateContactDto } from '../dto/update-boutique.dto';

@Injectable()
export class BoutiqueParametresService {

  private readonly logger = new Logger(BoutiqueParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly uploadService: UploadService,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Charger toutes les données paramètres de la boutique
   * ────────────────────────────────────────────────────────── */

  async getParametres(userId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({
      where: { userId },
      relations: ['companyType', 'horaires'],
    });

    if (!company) {
      throw new NotFoundException('Profil entreprise introuvable.');
    }

    return company;
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Mettre à jour Boutique & Identité (section 1)
   * ────────────────────────────────────────────────────────── */

  async updateBoutique(userId: string, dto: UpdateBoutiqueDto): Promise<Company> {
    const company = await this.findCompanyOrFail(userId);

    // On applique uniquement les champs fournis dans le DTO
    Object.assign(company, dto);

    const updated = await this.companyRepo.save(company);
    this.logger.log(`[BOUTIQUE] Mis à jour — userId=${userId}`);

    return updated;
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Mettre à jour Contact & Localisation (section 2)
   * ────────────────────────────────────────────────────────── */

  async updateContact(userId: string, dto: UpdateContactDto): Promise<Company> {
    const company = await this.findCompanyOrFail(userId);

    Object.assign(company, dto);

    const updated = await this.companyRepo.save(company);
    this.logger.log(`[CONTACT] Mis à jour — userId=${userId}`);

    return updated;
  }

  /* ──────────────────────────────────────────────────────────
   * POST — Uploader le logo (Cloudinary)
   * ────────────────────────────────────────────────────────── */

  async uploadLogo(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ logo: string }> {
    const company = await this.findCompanyOrFail(userId);

    // Supprimer l'ancien logo s'il existe
    if (company.logo) {
      await this.deleteCloudinaryFile(company.logo);
    }

    const result = await this.uploadService.uploadImage(
      file,
      UPLOAD_FOLDERS.COMPANY,
      { width: 400, height: 400 },
    );

    company.logo = result.url;
    await this.companyRepo.save(company);

    this.logger.log(`[LOGO] Uploadé — userId=${userId} → ${result.url}`);
    return { logo: result.url };
  }

  /* ──────────────────────────────────────────────────────────
   * POST — Uploader l'image de couverture
   * ────────────────────────────────────────────────────────── */

  async uploadCover(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ coverImage: string }> {
    const company = await this.findCompanyOrFail(userId);

    if (company.coverImage) {
      await this.deleteCloudinaryFile(company.coverImage);
    }

    const result = await this.uploadService.uploadImage(
      file,
      UPLOAD_FOLDERS.COMPANY,
      { width: 1200, height: 400 },
    );

    company.coverImage = result.url;
    await this.companyRepo.save(company);

    this.logger.log(`[COVER] Uploadée — userId=${userId} → ${result.url}`);
    return { coverImage: result.url };
  }

  /* ──────────────────────────────────────────────────────────
   * DELETE — Supprimer le logo
   * ────────────────────────────────────────────────────────── */

  async deleteLogo(userId: string): Promise<{ message: string }> {
    const company = await this.findCompanyOrFail(userId);

    if (company.logo) {
      await this.deleteCloudinaryFile(company.logo);
      company.logo = null;
      await this.companyRepo.save(company);
    }

    return { message: 'Logo supprimé avec succès.' };
  }

  /* ──────────────────────────────────────────────────────────
   * HELPERS PRIVÉS
   * ────────────────────────────────────────────────────────── */

  private async findCompanyOrFail(userId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }

  /**
   * Extrait le publicId d'une URL Cloudinary et supprime le fichier.
   * Ex: https://res.cloudinary.com/.../shopi/companies/abc.webp → shopi/companies/abc
   */
  private async deleteCloudinaryFile(url: string): Promise<void> {
    try {
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
      if (match) {
        await this.uploadService.delete(match[1], 'image');
      }
    } catch {
      // Ne pas bloquer si la suppression Cloudinary échoue
      this.logger.warn(`Suppression Cloudinary échouée pour : ${url}`);
    }
  }
}
