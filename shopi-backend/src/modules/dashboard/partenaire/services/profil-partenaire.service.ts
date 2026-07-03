/* ============================================================
 * FICHIER : services/profil-partenaire.service.ts
 *
 * RÔLE : Profil, localisation et photo du partenaire.
 *
 * Endpoints gérés :
 *   GET    /parametres/me       → { profilePicture, fullName }  (léger, topbar)
 *   GET    /parametres          → données complètes (toutes les sections)
 *   PATCH  /parametres/profil   → infos personnelles
 *   POST   /parametres/photo    → upload photo → User.profilePicture
 *   PATCH  /parametres/zone     → localisation + zone d'activité
 *
 * IMPORTANT :
 *   - firstName / lastName / email → entité User (mise à jour via userRepo)
 *   - name / phone / bio / zone / localisation → entité Partner
 *   - profilePicture → User.profilePicture (Cloudinary via UploadService)
 * ============================================================ */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { Partner }      from 'src/database/entities/profiles/partenaire-profile.entity';
import { User }         from 'src/database/entities/user.entity';
import { UploadService, UPLOAD_FOLDERS } from 'src/modules/upload/upload.service';
import {
  UpdatePartenaireProfilDto,
  UpdatePartenaireZoneDto,
} from '../dto/partenaire-parametres.dto';

/* ── Interface de la réponse complète ── */
export interface PartenaireParametresResponse {
  /* Identité */
  id:             string;
  userId:         string;
  firstName:      string | null;
  lastName:       string | null;
  email:          string | null;
  phone:          string | null;
  name:           string;
  bio:            string | null;
  profilePicture: string | null;
  /* Statut */
  status:         string;
  palier:         string;      // calculé depuis les stats
  isVerified:     boolean;
  memberSince:    string;      // ISO date
  /* Zone */
  zone:           string | null;
  adresse:        string | null;
  commune:        string | null;
  ville:          string | null;
  region:         string | null;
  pays:           string;
  codePostal:     string | null;
  latitude:       number | null;
  longitude:      number | null;
  /* Stats */
  totalCompanies:     number;
  totalDeliveries:    number;
  totalCorrespondants:number;
  /* Sécurité */
  twoFaEnabled:   boolean;
  twoFaMethod:    string | null;
  /* Préférences (JSON parsé) */
  notifSettings:    Record<string, boolean> | null;
  privacySettings:  Record<string, boolean> | null;
  preferences:      Record<string, string>  | null;
}

/* ── Helper : calcule le palier partenaire ── */
function computePalier(p: Partner): string {
  const total = p.totalCompanies + p.totalDeliveries + p.totalCorrespondants;
  if (total >= 50) return 'platinum';
  if (total >= 20) return 'gold';
  if (total >= 5)  return 'silver';
  return 'bronze';
}

/* ── Helper : parse sécurisé d'un champ JSON texte ── */
function safeParse<T>(text: string | null | undefined): T | null {
  if (!text) return null;
  try { return JSON.parse(text) as T; }
  catch { return null; }
}

/* ═══════════════════════════════════════════════════════════ */

@Injectable()
export class ProfilPartenaireService {

  private readonly logger = new Logger(ProfilPartenaireService.name);

  constructor(
    @InjectRepository(Partner) private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(User)    private readonly userRepo:    Repository<User>,
    private readonly uploadService: UploadService,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET léger — utilisé par la topbar pour éviter un chargement complet
   * ────────────────────────────────────────────────────────── */
  async getAvatarInfo(userId: string): Promise<{ profilePicture: string | null; fullName: string }> {
    /* Charge en parallèle pour la performance */
    const [partner, user] = await Promise.all([
      this.partnerRepo.findOne({ where: { userId }, select: ['id', 'name'] }),
      this.userRepo.findOne({ where: { id: userId }, select: ['profilePicture', 'firstName', 'lastName'] }),
    ]);
    if (!partner) throw new NotFoundException('Profil partenaire introuvable.');

    const firstName  = user?.firstName ?? '';
    const lastName   = user?.lastName  ?? '';
    const fullName   = `${firstName} ${lastName}`.trim() || partner.name;

    return {
      profilePicture: user?.profilePicture ?? null,
      fullName,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * GET global — toutes les données des paramètres
   * ────────────────────────────────────────────────────────── */
  async getParametres(userId: string): Promise<PartenaireParametresResponse> {
    const [partner, user] = await Promise.all([
      this.partnerRepo.findOne({ where: { userId } }),
      this.userRepo.findOne({ where: { id: userId }, select: ['id', 'firstName', 'lastName', 'email', 'phone', 'profilePicture', 'emailVerified', 'createdAt'] }),
    ]);
    if (!partner) throw new NotFoundException('Profil partenaire introuvable.');

    return this.toResponse(partner, user);
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH profil — infos personnelles
   * ────────────────────────────────────────────────────────── */
  async updateProfil(userId: string, dto: UpdatePartenaireProfilDto): Promise<PartenaireParametresResponse> {
    const [partner, user] = await Promise.all([
      this.findOrFail(userId),
      this.userRepo.findOne({ where: { id: userId } }),
    ]);
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    /* ── Champs sur User ── */
    if (dto.firstName !== undefined) user.firstName = dto.firstName?.trim() ?? user.firstName;
    if (dto.lastName  !== undefined) user.lastName  = dto.lastName?.trim()  ?? user.lastName;

    /* ── Champs sur Partner ── */
    if (dto.name  !== undefined) partner.name  = dto.name?.trim()  || partner.name;
    if (dto.phone !== undefined) partner.phone = dto.phone?.trim() ?? null;
    if (dto.bio   !== undefined) partner.bio   = dto.bio?.trim()   ?? null;

    await Promise.all([
      this.userRepo.save(user),
      this.partnerRepo.save(partner),
    ]);

    this.logger.log(`[PROFIL] Mis à jour — userId=${userId}`);
    return this.toResponse(partner, user);
  }

  /* ──────────────────────────────────────────────────────────
   * POST photo — upload Cloudinary → User.profilePicture
   * ────────────────────────────────────────────────────────── */
  async uploadPhoto(userId: string, file: Express.Multer.File): Promise<{ profilePicture: string }> {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');

    const result = await this.uploadService.uploadImage(file, UPLOAD_FOLDERS.AVATAR, {
      width: 400, height: 400,
    });

    await this.userRepo.update({ id: userId }, { profilePicture: result.url });
    this.logger.log(`[PHOTO] Photo mise à jour — userId=${userId} | url=${result.url}`);
    return { profilePicture: result.url };
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH zone — localisation + zone d'activité
   * ────────────────────────────────────────────────────────── */
  async updateZone(userId: string, dto: UpdatePartenaireZoneDto): Promise<PartenaireParametresResponse> {
    const partner = await this.findOrFail(userId);

    /* Assignation explicite champ par champ */
    if (dto.zone      !== undefined) partner.zone      = dto.zone?.trim()   ?? null;
    if (dto.adresse   !== undefined) partner.adresse   = dto.adresse?.trim()  ?? null;
    if (dto.commune   !== undefined) partner.commune   = dto.commune?.trim()  ?? null;
    if (dto.ville     !== undefined) partner.ville     = dto.ville?.trim()    ?? null;
    if (dto.region    !== undefined) partner.region    = dto.region?.trim()   ?? null;
    if (dto.pays      !== undefined) partner.pays      = dto.pays?.trim()     || 'GN';
    if (dto.codePostal!== undefined) partner.codePostal= dto.codePostal?.trim()?? null;
    if (dto.latitude  !== undefined) partner.latitude  = dto.latitude  ?? null;
    if (dto.longitude !== undefined) partner.longitude = dto.longitude ?? null;

    const updated = await this.partnerRepo.save(partner);
    const user    = await this.userRepo.findOne({ where: { id: userId } });

    this.logger.log(`[ZONE] Zone mise à jour — userId=${userId} | ville=${updated.ville}`);
    return this.toResponse(updated, user);
  }

  /* ──────────────────────────────────────────────────────────
   * HELPER — findOrFail
   * ────────────────────────────────────────────────────────── */
  async findOrFail(userId: string): Promise<Partner> {
    const p = await this.partnerRepo.findOne({ where: { userId } });
    if (!p) throw new NotFoundException('Profil partenaire introuvable.');
    return p;
  }

  /* ──────────────────────────────────────────────────────────
   * HELPER — sérialise la réponse complète
   * ────────────────────────────────────────────────────────── */
  private toResponse(partner: Partner, user: User | null): PartenaireParametresResponse {
    return {
      id:             partner.id,
      userId:         partner.userId,
      firstName:      user?.firstName      ?? null,
      lastName:       user?.lastName       ?? null,
      email:          user?.email          ?? null,
      phone:          partner.phone        ?? user?.phone ?? null,
      name:           partner.name,
      bio:            partner.bio          ?? null,
      profilePicture: user?.profilePicture ?? null,
      status:         partner.status,
      palier:         computePalier(partner),
      isVerified:     !!(user?.emailVerified),
      memberSince:    partner.createdAt?.toISOString() ?? '',
      zone:           partner.zone         ?? null,
      adresse:        partner.adresse      ?? null,
      commune:        partner.commune      ?? null,
      ville:          partner.ville        ?? null,
      region:         partner.region       ?? null,
      pays:           partner.pays,
      codePostal:     partner.codePostal   ?? null,
      latitude:       partner.latitude     ?? null,
      longitude:      partner.longitude    ?? null,
      totalCompanies:     partner.totalCompanies,
      totalDeliveries:    partner.totalDeliveries,
      totalCorrespondants:partner.totalCorrespondants,
      twoFaEnabled:   partner.twoFaEnabled,
      twoFaMethod:    partner.twoFaMethod  ?? null,
      notifSettings:    safeParse<Record<string, boolean>>(partner.notifSettings),
      privacySettings:  safeParse<Record<string, boolean>>(partner.privacySettings),
      preferences:      safeParse<Record<string, string>>(partner.preferences),
    };
  }
}
