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
import { Repository, In }   from 'typeorm';

import { Partner }       from 'src/database/entities/profiles/partenaire-profile.entity';
import { User }          from 'src/database/entities/user.entity';
import { GeoPrefecture } from 'src/database/entities/geo/geo-prefecture.entity';
import { GeoCommune }    from 'src/database/entities/geo/geo-commune.entity';
import { GeoQuartier }   from 'src/database/entities/geo/geo-quartier.entity';
import { UploadService, UPLOAD_FOLDERS } from 'src/modules/upload/upload.service';
import { SessionService } from 'src/modules/session/session.service';
import { parseUserAgent } from 'src/common/utils/user-agent.util';
import {
  UpdatePartenaireProfilDto,
  UpdatePartenaireZoneDto,
} from '../dto/partenaire-parametres.dto';

export interface CurrentSessionInfo {
  device:         string;
  browser:        string;
  ipAddress:      string | null;
  connectedSince: string;
}

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
  /** ISO date à partir de laquelle le nom redevient modifiable, ou null si déjà libre. */
  nameChangeAllowedAt: string | null;
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
  /** Session réellement active (device/navigateur/IP/date) — null si Redis
   *  indisponible ou sessionId absent (voir SessionService.getSessionMeta). */
  currentSession: CurrentSessionInfo | null;
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

/** Nombre de mois pendant lesquels le nom reste verrouillé après un changement. */
const NAME_CHANGE_LOCK_MONTHS = 3;

/** null si le nom est actuellement modifiable, sinon la date de déverrouillage. */
function computeNameChangeAllowedAt(user: User): Date | null {
  if (!user.nameChangedAt) return null;
  const next = new Date(user.nameChangedAt);
  next.setMonth(next.getMonth() + NAME_CHANGE_LOCK_MONTHS);
  return next > new Date() ? next : null;
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
    @InjectRepository(GeoPrefecture) private readonly prefRepo:  Repository<GeoPrefecture>,
    @InjectRepository(GeoCommune)    private readonly commRepo:  Repository<GeoCommune>,
    @InjectRepository(GeoQuartier)   private readonly quartRepo: Repository<GeoQuartier>,
    private readonly uploadService: UploadService,
    private readonly sessionService: SessionService,
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
  async getParametres(userId: string, currentSessionId?: string | null): Promise<PartenaireParametresResponse> {
    const [partner, user] = await Promise.all([
      this.partnerRepo.findOne({ where: { userId } }),
      this.userRepo.findOne({ where: { id: userId }, select: ['id', 'firstName', 'lastName', 'email', 'phone', 'profilePicture', 'emailVerified', 'createdAt', 'nameChangedAt'] }),
    ]);
    if (!partner) throw new NotFoundException('Profil partenaire introuvable.');

    return this.toResponse(partner, user, currentSessionId);
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH profil — infos personnelles
   * ────────────────────────────────────────────────────────── */
  async updateProfil(userId: string, dto: UpdatePartenaireProfilDto, currentSessionId?: string | null): Promise<PartenaireParametresResponse> {
    const [partner, user] = await Promise.all([
      this.findOrFail(userId),
      this.userRepo.findOne({ where: { id: userId } }),
    ]);
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    /* ── Prénom/Nom — verrouillés 3 mois après chaque changement réel ──
     * Comparaison sur la valeur déjà présente pour ne pas déclencher le
     * verrou si le formulaire renvoie simplement la valeur inchangée. */
    const wantsFirstName = dto.firstName !== undefined && dto.firstName.trim() !== user.firstName;
    const wantsLastName  = dto.lastName  !== undefined && dto.lastName.trim()  !== user.lastName;
    if (wantsFirstName || wantsLastName) {
      const lockedUntil = computeNameChangeAllowedAt(user);
      if (lockedUntil) {
        throw new BadRequestException(
          `Le prénom et le nom ne peuvent être modifiés qu'une fois tous les ${NAME_CHANGE_LOCK_MONTHS} mois. ` +
          `Prochaine modification possible le ${lockedUntil.toLocaleDateString('fr-FR')}.`,
        );
      }
      user.nameChangedAt = new Date();
    }
    if (wantsFirstName) user.firstName = dto.firstName!.trim();
    if (wantsLastName)  user.lastName  = dto.lastName!.trim();

    /* ── Champs sur Partner ── */
    if (dto.name  !== undefined) partner.name  = dto.name?.trim()  || partner.name;
    if (dto.bio   !== undefined) partner.bio   = dto.bio?.trim()   ?? null;

    await Promise.all([
      this.userRepo.save(user),
      this.partnerRepo.save(partner),
    ]);

    this.logger.log(`[PROFIL] Mis à jour — userId=${userId}`);
    return this.toResponse(partner, user, currentSessionId);
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
   *
   * BUG CORRIGÉ — ville/commune/quartiers n'étaient validés ni côté
   * frontend (listes en dur, voir SecZone.tsx) ni côté backend : un
   * partenaire pouvait envoyer n'importe quelle chaîne libre, y compris
   * des valeurs jamais créées par le super-admin/administrateur dans le
   * référentiel géo (/geo). validateZoneGeo() impose désormais que ces
   * 3 champs correspondent exactement à des entrées ACTIVES du
   * référentiel réel, avec la bonne hiérarchie (commune ∈ ville,
   * quartier ∈ commune) — même table que /geo/items consommée par le
   * frontend, donc aucune valeur "fantôme" ne peut plus être stockée.
   * ────────────────────────────────────────────────────────── */
  async updateZone(userId: string, dto: UpdatePartenaireZoneDto, currentSessionId?: string | null): Promise<PartenaireParametresResponse> {
    const partner = await this.findOrFail(userId);

    await this.validateZoneGeo(dto, partner);

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
    return this.toResponse(updated, user, currentSessionId);
  }

  /* ── Valide ville/commune/quartiers contre le référentiel géo réel ── */
  private async validateZoneGeo(dto: UpdatePartenaireZoneDto, partner: Partner): Promise<void> {
    let prefecture: GeoPrefecture | null = null;

    if (dto.ville !== undefined) {
      const nom = dto.ville?.trim();
      if (nom) {
        prefecture = await this.prefRepo.findOne({ where: { nom, statut: 'actif' } });
        if (!prefecture) {
          throw new BadRequestException(
            `Ville "${nom}" introuvable dans le référentiel géographique — seules les villes configurées par un administrateur peuvent être sélectionnées.`,
          );
        }
      }
    } else if ((dto.commune || dto.zone) && partner.ville) {
      prefecture = await this.prefRepo.findOne({ where: { nom: partner.ville, statut: 'actif' } });
    }

    let commune: GeoCommune | null = null;

    if (dto.commune !== undefined) {
      const nom = dto.commune?.trim();
      if (nom) {
        if (!prefecture) {
          throw new BadRequestException('Sélectionnez une ville avant de choisir une commune.');
        }
        commune = await this.commRepo.findOne({ where: { nom, statut: 'actif', parentId: prefecture.id } });
        if (!commune) {
          throw new BadRequestException(
            `Commune "${nom}" introuvable pour la ville "${prefecture.nom}" dans le référentiel géographique.`,
          );
        }
      }
    } else if (dto.zone && partner.commune) {
      commune = await this.commRepo.findOne({ where: { nom: partner.commune, statut: 'actif' } });
    }

    if (dto.zone !== undefined) {
      const quartierNoms = (dto.zone ?? '').split(',').map(z => z.trim()).filter(Boolean);
      if (quartierNoms.length) {
        if (!commune) {
          throw new BadRequestException('Sélectionnez une commune avant de choisir des quartiers.');
        }
        const found = await this.quartRepo.find({
          where: { nom: In(quartierNoms), statut: 'actif', parentId: commune.id },
        });
        const foundNoms = new Set(found.map(q => q.nom));
        const invalides = quartierNoms.filter(n => !foundNoms.has(n));
        if (invalides.length) {
          throw new BadRequestException(
            `Quartier(s) introuvable(s) pour la commune "${commune.nom}" : ${invalides.join(', ')}.`,
          );
        }
      }
    }
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
  private async toResponse(partner: Partner, user: User | null, currentSessionId?: string | null): Promise<PartenaireParametresResponse> {
    const meta = await this.sessionService.getSessionMeta(currentSessionId);
    const currentSession: CurrentSessionInfo | null = meta ? {
      ...parseUserAgent(meta.userAgent),
      ipAddress:      meta.ipAddress,
      connectedSince: meta.createdAt,
    } : null;

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
      nameChangeAllowedAt: user ? (computeNameChangeAllowedAt(user)?.toISOString() ?? null) : null,
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
      currentSession,
      notifSettings:    safeParse<Record<string, boolean>>(partner.notifSettings),
      privacySettings:  safeParse<Record<string, boolean>>(partner.privacySettings),
      preferences:      safeParse<Record<string, string>>(partner.preferences),
    };
  }
}
