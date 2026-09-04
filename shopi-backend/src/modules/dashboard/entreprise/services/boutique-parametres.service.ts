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
    /* BUG CORRIGÉ — le contrôleur passe `req.user.actorId ?? req.user.id` ;
     * pour un compte COMPANY, actorId est le Company.id (propriétaire OU
     * collaborateur, voir AuthService.findProfileId), jamais un User.id.
     * `where:{userId}` seul ne matchait donc quasiment jamais et déclenchait
     * la création d'une entreprise fantôme à chaque appel. On matche
     * désormais sur `id` (cas normal, actorId) OU `userId` (cas de repli,
     * si actorId était absent et que le param est un vrai User.id). */
    /* BUG CORRIGÉ (suite, 2026-09-02) — le `where:[{id},{userId}]` ci-dessus
     * restait un OR SQL en une seule requête, sans ordre garanti. Ça s'est
     * avéré loin d'être théorique : une entreprise fantôme (créée par CE
     * `if (!company)` ci-dessous, très probablement pendant une exécution
     * d'un ancien build compilé — voir la confusion dist/main.js/start:dev
     * récurrente sur ce projet) a fini avec un `userId` identique à l'`id`
     * d'une vraie entreprise. Résultat : chaque appel `where:[{id},{userId}]`
     * matchait alors LES DEUX fiches, et Postgres pouvait retourner l'une ou
     * l'autre selon le plan de requête — des réglages (ex: "Afficher les
     * prix barrés") ont ainsi pu être enregistrés sur la fiche fantôme,
     * jamais lue par aucune page publique, au lieu de la vraie. On tente
     * maintenant `id` en priorité, `userId` seulement en repli, dans deux
     * requêtes séquentielles déterministes plutôt qu'un OR ambigu. */
    let company = await this.companyRepo.findOne({
      where: { id: userId },
      relations: ['companyType', 'horaires'],
    });
    if (!company) {
      company = await this.companyRepo.findOne({
        where: { userId },
        relations: ['companyType', 'horaires'],
      });
    }

    if (!company) {
      // Compte company sans profil (ex : insertion manuelle en BDD).
      // On crée un profil vide pour éviter le 404 répété côté client.
      const user = await this.userRepo.findOne({ where: { id: userId } });
      const defaultName = user
        ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email.split('@')[0]
        : 'Ma Boutique';

      const stub = this.companyRepo.create({ userId, companyName: defaultName });
      await this.companyRepo.save(stub);
      this.logger.warn(`[PARAMETRES] Profil auto-créé pour userId=${userId}`);

      company = await this.companyRepo.findOne({
        where: { id: stub.id },
        relations: ['companyType', 'horaires'],
      });

      if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    }

    return this.redactSensitiveDocuments(company);
  }

  /* SÉCURITÉ — GET /parametres renvoie l'entité Company quasi brute (elle
   * alimente les 12 sections d'un coup, y compris DocumentsSection.tsx qui
   * ne lit que la présence/absence d'un document, jamais sa valeur, voir
   * DocumentsParametresService.getDocuments() pour le même correctif côté
   * route dédiée). Sans ce filtre, le public_id Cloudinary des 4 pièces
   * sensibles (CNI, RCCM, relevé bancaire, NIF — voir SENSITIVE_DOC_TYPES
   * dans DocumentsParametresService) partait tel quel dans la réponse
   * JSON, visible depuis les DevTools, pour une valeur que le frontend
   * n'utilise que comme booléen. On la remplace par un marqueur opaque —
   * toujours "truthy" pour `isPresent = !!url`, jamais exploitable. */
  private redactSensitiveDocuments(company: Company): Company {
    const REDACTED = '••••••';
    if (company.ownerIdDocument)   company.ownerIdDocument   = REDACTED;
    if (company.documentRccm)      company.documentRccm      = REDACTED;
    if (company.documentBancaire)  company.documentBancaire  = REDACTED;
    if (company.documentNif)       company.documentNif       = REDACTED;
    // documentPhoto (vitrine boutique) n'est pas sensible — inchangé.
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

  /* FIX m4 (historique) — le rejet du fallback par companyId visait un
   * companyId fourni PAR LE CLIENT (query/body, donc falsifiable → accès
   * cross-tenant). Ici, `userId` est en réalité `req.user.actorId`, signé
   * côté serveur dans le JWT à la connexion (voir AuthService.findProfileId) —
   * non falsifiable sans forger le JWT entier, donc le même risque ne
   * s'applique pas. Sans le clause `id`, ce lookup ne matchait quasiment
   * jamais (voir getParametres ci-dessus pour le détail du bug). */
  /* BUG CORRIGÉ (suite) — même correctif que getParametres() ci-dessus :
   * `id` en priorité, `userId` en repli déterministe, plutôt qu'un OR
   * ambigu en une seule requête. */
  private async findCompanyOrFail(userId: string): Promise<Company> {
    let company = await this.companyRepo.findOne({ where: { id: userId } });
    if (!company) company = await this.companyRepo.findOne({ where: { userId } });
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
