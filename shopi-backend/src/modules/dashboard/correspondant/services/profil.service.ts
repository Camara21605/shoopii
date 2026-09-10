/* ============================================================
 * FICHIER : services/profil.service.ts
 * SECTION : §1 — Profil & Identité
 *
 * Responsabilités :
 *   getParametres()  → fusion User + Correspondent + Horaires
 *   updateProfil()   → User (firstName/lastName/email/phone) +
 *                      Correspondent (bio/langues/typeCorrespondant)
 *   uploadPhoto()    → User.profilePicture via Cloudinary
 * ============================================================ */

import {
  Injectable, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Correspondent }    from '../../../../database/entities/profiles/correspondant-profile.entity';
import { CorrespondantHoraire, DEFAULT_HORAIRES }
                            from '../../../../database/entities/profiles/correspondant-horaire.entity';
import { User }             from '../../../../database/entities/user.entity';
import { UploadService, UPLOAD_FOLDERS } from '../../../upload/upload.service';
import { SessionService } from '../../../session/session.service';
import { parseUserAgent } from '../../../../common/utils/user-agent.util';

import { UpdateProfilDto }  from '../dto/correspondant-parametres.dto';
import { CorrespondantBaseService } from './base.service';

export interface CurrentSessionInfo {
  device:         string;
  browser:        string;
  ipAddress:      string | null;
  connectedSince: string;
}

@Injectable()
export class ProfilService extends CorrespondantBaseService {

  private readonly logger = new Logger(ProfilService.name);

  constructor(
    @InjectRepository(Correspondent) corRepo: Repository<Correspondent>,
    @InjectRepository(User)          userRepo: Repository<User>,

    @InjectRepository(CorrespondantHoraire)
    private readonly horaireRepo: Repository<CorrespondantHoraire>,

    private readonly uploadService: UploadService,
    private readonly dataSource: DataSource,
    private readonly sessionService: SessionService,
  ) {
    super(corRepo, userRepo);
  }

  /**
   * BUG CORRIGÉ — la carte "Sessions actives" (SecSecurite.tsx) affichait
   * 2 appareils ("iPhone 14 Pro", "MacBook Air") ENTIÈREMENT codés en dur,
   * identiques pour tout le monde, avec "Déconnecter"/"Tout déconnecter"
   * qui ne faisaient qu'un toast sans jamais rien déconnecter. Shoneya
   * n'autorise qu'UNE session active à la fois par compte (voir
   * SessionService) : il n'y a donc jamais eu plusieurs appareils à
   * lister. Remplacé par la session RÉELLE actuellement active
   * (device/navigateur/IP/date), même mécanisme que
   * BoutiqueParametresService (entreprise) / ProfilLivreurService.
   */
  private async attachCurrentSession<T extends object>(payload: T, currentSessionId?: string | null): Promise<T & { currentSession: CurrentSessionInfo | null }> {
    const meta = await this.sessionService.getSessionMeta(currentSessionId);
    return {
      ...payload,
      currentSession: meta ? {
        ...parseUserAgent(meta.userAgent),
        ipAddress:      meta.ipAddress,
        connectedSince: meta.createdAt,
      } : null,
    };
  }

  // ─── GET GLOBAL ────────────────────────────────────────────

  /**
   * Retourne toutes les données fusionnées :
   *   User  → firstName, lastName, email, phone, profilePicture
   *   Correspondent → tous les autres champs
   *   Horaires → array depuis correspondant_horaires
   *
   * Si aucun horaire en base → initialise avec DEFAULT_HORAIRES.
   */
  async getParametres(userId: string, currentSessionId?: string | null) {
    const cor  = await this.findCorOrFail(userId);
    const user = await this.findUserOrFail(userId);

    let horaires = await this.horaireRepo.find({
      where: { correspondantId: cor.id },
      order: { jour: 'ASC' },
    });

    if (horaires.length === 0) {
      /* Premier accès aux paramètres : création des horaires par défaut */
      const defaults = DEFAULT_HORAIRES.map(h =>
        this.horaireRepo.create({ correspondantId: cor.id, ...h }),
      );
      horaires = await this.horaireRepo.save(defaults);
    }

    /* Fusion : champs User en premier, puis Correspondent */
    return this.attachCurrentSession({
      firstName:      user.firstName,
      lastName:       user.lastName,
      email:          user.email,
      phone:          user.phone,
      profilePicture: user.profilePicture,
      ...cor,
      horaires,
    }, currentSessionId);
  }

  // ─── UPDATE PROFIL ─────────────────────────────────────────

  /**
   * Met à jour le profil en 3 étapes dans une transaction :
   *   1. User  ← firstName, lastName, email, phone
   *   2. Correspondent ← bio, langues, typeCorrespondant
   *   3. Correspondent.fullName ← recalculé depuis User.firstName + User.lastName
   *
   * Vérifie l'unicité email et téléphone avant d'appliquer.
   */
  async updateProfil(userId: string, dto: UpdateProfilDto) {
    const cor  = await this.findCorOrFail(userId);
    const user = await this.findUserOrFail(userId);

    return this.dataSource.transaction(async manager => {
      let userChanged = false;

      /* ── 1. Champs User ── */
      if (dto.firstName !== undefined) {
        user.firstName = dto.firstName;
        userChanged    = true;
      }
      if (dto.lastName !== undefined) {
        user.lastName = dto.lastName;
        userChanged   = true;
      }
      /* Unicité scopée par rôle (UNIQUE(email/phone, role)) : un compte pro
       * lié ou d'un autre rôle partageant ces coordonnées (même personne,
       * "Mon espace") ne doit pas bloquer ce correspondant — seul un AUTRE
       * compte CORRESPONDENT avec la même valeur est un vrai conflit. */
      if (dto.email?.trim()) {
        const existing = await manager.findOne(User, {
          where: { email: dto.email, role: user.role }, select: ['id'],
        });
        if (existing && existing.id !== userId) {
          throw new BadRequestException('Email déjà utilisé par un autre compte.');
        }
        user.email  = dto.email;
        userChanged = true;
      }
      if (dto.phone?.trim()) {
        const existing = await manager.findOne(User, {
          where: { phone: dto.phone, role: user.role }, select: ['id'],
        });
        if (existing && existing.id !== userId) {
          throw new BadRequestException('Téléphone déjà utilisé par un autre compte.');
        }
        user.phone  = dto.phone;
        userChanged = true;
      }

      if (userChanged) await manager.save(User, user);

      /* ── 2. Champs Correspondent ── */
      if (dto.bio               !== undefined) cor.bio               = dto.bio               ?? null;
      if (dto.langues           !== undefined) cor.langues           = dto.langues           ?? null;
      if (dto.typeCorrespondant !== undefined) cor.typeCorrespondant = dto.typeCorrespondant;

      /* ── 3. Recalcul du cache fullName ── */
      const computed = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
      if (computed) cor.fullName = computed;

      const updated = await manager.save(Correspondent, cor);
      this.logger.log(`[PROFIL] Mis à jour — userId=${userId} fullName="${cor.fullName}"`);

      /* Retourne l'objet fusionné pour le frontend */
      return {
        firstName: user.firstName, lastName: user.lastName,
        email: user.email, phone: user.phone, profilePicture: user.profilePicture,
        ...updated,
      };
    });
  }

  // ─── UPLOAD PHOTO ──────────────────────────────────────────

  /**
   * Upload la photo de profil sur Cloudinary.
   * Le résultat est stocké dans User.profilePicture (pas Correspondent).
   * L'ancienne photo est supprimée avant le nouvel upload.
   */
  async uploadPhoto(userId: string, file: Express.Multer.File): Promise<{ profilePicture: string }> {
    const user = await this.findUserOrFail(userId);

    /* Supprimer l'ancienne photo si elle existe */
    if (user.profilePicture) {
      await this.deleteCloudinaryFile(user.profilePicture);
    }

    const result = await this.uploadService.uploadImage(
      file, UPLOAD_FOLDERS.AVATAR, { width: 400, height: 400 },
    );

    user.profilePicture = result.url;
    await this.userRepo.save(user);

    this.logger.log(`[PHOTO] User.profilePicture mis à jour — userId=${userId}`);
    return { profilePicture: result.url };
  }

  // ─── Helper privé ──────────────────────────────────────────

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