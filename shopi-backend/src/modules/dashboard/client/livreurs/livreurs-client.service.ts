/* ================================================================
 * FICHIER : src/modules/dashboard/client/livreurs/livreurs-client.service.ts
 *
 * RÔLE : Service métier des livreurs côté client (page /livreurs).
 *        Liste publique + filtres + tri + pagination + isSuivi,
 *        profil complet, statistiques réseau.
 *
 * ════════════════════════════════════════════════════════════════
 * CORRECTIONS APPLIQUÉES (alignement avec l'entité Delivery réelle)
 * ════════════════════════════════════════════════════════════════
 *   AVANT (incorrect)        →  APRÈS (champ réel de Delivery)
 *   ──────────────────────────────────────────────────────────────
 *   role: 'livreur'          →  role: 'delivery'  (UserRole.DELIVERY)
 *   u.isActive               →  u.status = 'active'
 *   u.avatar                 →  lp.photoUrl
 *   zonesPrincipales         →  zone
 *   vehiculeType             →  VehicleType  (attention : V majuscule)
 *   totalLivraisons          →  totalDeliveries
 *   reviewsCount             →  totalRatings
 *   disponible (bool)        →  availability === AVAILABLE
 *   zonesLivraison           →  communesActives (json string[])
 *   tarifs (json)            →  construit depuis tarifBase / tarifParKm…
 *   langues (json)           →  langues (string CSV → split)
 *   horaires (json)          →  relation LivreurHoraire (jointure)
 *   immatriculation          →  vehiculePlaque
 *   permis                   →  documentPermis
 *   assurance (bool)         →  !!documentAssurance
 *
 *   + Follow : followerUserId/followedUserId/followType n'existent pas.
 *     La table follows utilise followerId / targetId / targetType /
 *     followerType (IDs de PROFIL, pas de user) + isSubscribed.
 *
 *   + card.id = lp.id (id du PROFIL livreur), pas u.id.
 *     C'est cet id que le frontend envoie à POST /suivis/livreurs/:id.
 * ════════════════════════════════════════════════════════════════
 *
 * PARTAGE :
 *   Exporté par ClientModule, injecté par SuivisModule
 *   pour les routes /suivis/livreurs.
 * ================================================================ */

import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

/* ── Entités ── */
import { User,  UserStatus } from '../../../../database/entities/user.entity';
import { UserRole } from '../../../../common/enums/user-role.enum';
import {
  Delivery,
  DeliveryStatus,
  DeliveryAvailability,
} from '../../../../database/entities/profiles/livreur-profile.entity';
import {
  Follow,
  FollowStatus,
  FollowerActorType,
  TargetActorType,
} from '../../../../database/entities/follow/follow.entity';
import { Client } from '../../../../database/entities/profiles/client-profile.entity';
import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';

/* ── DTO ── */
import { QueryLivreursDto } from './dto/query-livreurs.dto';

/* ════════════════════════════════════════════════════════════════
 * TYPES DE RETOUR (contrat avec le frontend)
 * ════════════════════════════════════════════════════════════════ */

/** Données d'une card livreur (vue liste). */
export interface LivreurCardData {
  id:              string;   // id du PROFIL livreur (Delivery.id)
  fullName:        string;
  profilePicture:  string | null;
  zone:            string;
  vehicule:        string;   // libellé formaté avec emoji
  vehiculeType:    string;   // type brut (moto, voiture…)
  totalLivraisons: number;
  averageRating:   number;
  reviewsCount:    number;
  ponctualite:     number;
  experience:      string;
  disponible:      boolean;
  isSuivi:         boolean;
}

/** Profil complet d'un livreur (vue détail). */
export interface LivreurProfileFull extends LivreurCardData {
  bio:             string | null;
  telephone:       string | null;
  whatsapp:        string | null;
  zones:           string[];
  tarifs:          Record<string, number>;
  langues:         string[];
  horaires:        Record<string, string>;
  immatriculation: string | null;
  assurance:       boolean;
  permis:          string | null;
  createdAt:       Date;
  abonnesCount:    number;
}

/** Statistiques réseau (hero banner). */
export interface LivreursNetworkStats {
  totalLivreurs:     number;
  averageRating:     string;
  totalLivraisons:   number;
  communesCouvertes: number;
}

/* ════════════════════════════════════════════════════════════════
 * SERVICE
 * ════════════════════════════════════════════════════════════════ */
@Injectable()
export class LivreursClientService {
  private readonly logger = new Logger(LivreursClientService.name);

  constructor(
    @InjectRepository(Delivery)
    private readonly profileRepo: Repository<Delivery>,

    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Correspondent)
    private readonly correspondantRepo: Repository<Correspondent>,
  ) {}

  /* ──────────────────────────────────────────────────────────────
   * getLivreurs
   * Liste paginée + filtres + tri + isSuivi.
   * ────────────────────────────────────────────────────────────── */
  async getLivreurs(
    dto: QueryLivreursDto,
    userId?: string,
  ): Promise<{ data: LivreurCardData[]; total: number; page: number; limit: number }> {

    const { page = 1, limit = 20 } = dto;

    const qb = this.buildBaseQuery();
    this.applyFilters(qb, dto);
    this.applySorting(qb, dto);
    qb.skip((page - 1) * limit).take(limit);

    const [profiles, total] = await qb.getManyAndCount();

    /* Set des id de PROFILS livreurs suivis par l'utilisateur connecté */
    const followedIds = await this.getFollowedIds(userId);

    const data = profiles.map(p => this.toCardData(p, followedIds));

    return { data, total, page, limit };
  }

  /* ──────────────────────────────────────────────────────────────
   * getLivreurById
   * Profil complet par id de PROFIL livreur (Delivery.id).
   * Charge aussi la relation horaires pour la vue détail.
   * ────────────────────────────────────────────────────────────── */
  async getLivreurById(
    livreurProfileId: string,
    currentUserId?: string,
  ): Promise<LivreurProfileFull> {

    const profile = await this.profileRepo
      .createQueryBuilder('lp')
      .innerJoinAndSelect('lp.user', 'u')
      .leftJoinAndSelect('lp.horaires', 'h')
      .where('lp.id = :id', { id: livreurProfileId })
      .andWhere('u.role = :role', { role: UserRole.DELIVERY })
      .getOne();

    if (!profile) {
      throw new NotFoundException(`Livreur #${livreurProfileId} introuvable`);
    }

    const followedIds  = await this.getFollowedIds(currentUserId);
    const isSuivi      = followedIds.has(profile.id);
    const abonnesCount = await this.followRepo.count({
      where: {
        targetType:   TargetActorType.DELIVERY,
        targetId:     profile.id,
        isSubscribed: true,
        status:       FollowStatus.ACTIVE,
      },
    });

    return this.toProfileFull(profile, isSuivi, abonnesCount);
  }

  /* ──────────────────────────────────────────────────────────────
   * getNetworkStats
   * Statistiques pour le hero banner.
   * ────────────────────────────────────────────────────────────── */
  async getNetworkStats(): Promise<LivreursNetworkStats> {

    const total = await this.profileRepo
      .createQueryBuilder('lp')
      .innerJoin('lp.user', 'u')
      .where('u.role = :role', { role: UserRole.DELIVERY })
      .andWhere('u.status = :status', { status: UserStatus.ACTIVE })
      .getCount();

    const stats = await this.profileRepo
      .createQueryBuilder('lp')
      .innerJoin('lp.user', 'u')
      .where('u.role = :role', { role: UserRole.DELIVERY })
      .andWhere('u.status = :status', { status: UserStatus.ACTIVE })
      .select([
        'AVG(lp.averageRating)   AS avg_rating',
        'SUM(lp.totalDeliveries) AS total_livraisons',
      ])
      .getRawOne();

    return {
      totalLivreurs:     total,
      averageRating:     Number(stats?.avg_rating       ?? 0).toFixed(1),
      totalLivraisons:   Number(stats?.total_livraisons ?? 0),
      communesCouvertes: 23,
    };
  }

  /* ──────────────────────────────────────────────────────────────
   * getFollowedIds (PUBLIC — utilisé aussi par SuivisModule)
   * Retourne un Set des id de PROFILS livreurs suivis par userId.
   *
   * La table follows stocke des id de PROFIL (pas de user) :
   *   followerId  = id du profil de l'utilisateur connecté
   *                 (Client.id, Delivery.id ou Correspondent.id
   *                  selon son rôle — un livreur peut aussi suivre
   *                  d'autres livreurs)
   *   targetId    = id du profil livreur (Delivery.id)
   *   targetType  = TargetActorType.DELIVERY
   *   isSubscribed = true si abonnement actif
   * ────────────────────────────────────────────────────────────── */
  async getFollowedIds(userId?: string): Promise<Set<string>> {
    if (!userId) return new Set<string>();

    /* 1. Résoudre le rôle de l'utilisateur, puis l'id de son profil */
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'role'],
    });
    if (!user) return new Set<string>();

    let followerType: FollowerActorType;
    let followerId: string | undefined;

    switch (user.role) {
      case UserRole.DELIVERY:
        followerType = FollowerActorType.DELIVERY;
        followerId   = (await this.profileRepo.findOne({ where: { userId }, select: ['id'] }))?.id;
        break;
      case UserRole.CORRESPONDENT:
        followerType = FollowerActorType.CORRESPONDENT;
        followerId   = (await this.correspondantRepo.findOne({ where: { userId }, select: ['id'] }))?.id;
        break;
      default:
        followerType = FollowerActorType.CLIENT;
        followerId   = (await this.clientRepo.findOne({ where: { userId }, select: ['id'] }))?.id;
    }

    if (!followerId) return new Set<string>();

    /* 2. Récupérer les follows actifs de ce profil vers des livreurs */
    const rows = await this.followRepo.find({
      where: {
        followerType,
        followerId,
        targetType:   TargetActorType.DELIVERY,
        isSubscribed: true,
        status:       FollowStatus.ACTIVE,
      },
      select: ['targetId'],
    });

    return new Set(rows.map(r => r.targetId));
  }

  /* ──────────────────────────────────────────────────────────────
   * PRIVÉ : requête de base (livreurs actifs uniquement)
   * ────────────────────────────────────────────────────────────── */
  private buildBaseQuery(): SelectQueryBuilder<Delivery> {
    return this.profileRepo
      .createQueryBuilder('lp')
      .innerJoinAndSelect('lp.user', 'u')
      .where('u.role = :role', { role: UserRole.DELIVERY })
      .andWhere('u.status = :status', { status: UserStatus.ACTIVE });
  }

  /* ──────────────────────────────────────────────────────────────
   * PRIVÉ : filtres
   * ────────────────────────────────────────────────────────────── */
  private applyFilters(qb: SelectQueryBuilder<Delivery>, dto: QueryLivreursDto): void {

    /* Recherche par nom (fullName du profil livreur) */
    if (dto.search?.trim()) {
      qb.andWhere('lp.fullName LIKE :search', { search: `%${dto.search.trim()}%` });
    }

    /* Zone : recherche dans zone OU communesActives (JSON) */
    if (dto.zone && dto.zone !== 'all') {
      qb.andWhere(
        '(lp.zone LIKE :zone OR lp.communesActives LIKE :zone)',
        { zone: `%${dto.zone}%` },
      );
    }

    /* Type de véhicule (colonne VehicleType — V majuscule) */
    if (dto.vehicule) {
      qb.andWhere('lp.VehicleType = :vehicule', { vehicule: dto.vehicule });
    }

    /* Disponibles uniquement = availability AVAILABLE */
    if (dto.disponibleOnly === true) {
      qb.andWhere('lp.availability = :avail', { avail: DeliveryAvailability.AVAILABLE });
    }

    /* Note minimale */
    if (dto.minRating) {
      qb.andWhere('lp.averageRating >= :minRating', { minRating: dto.minRating });
    }
  }

  /* ──────────────────────────────────────────────────────────────
   * PRIVÉ : tri
   * ────────────────────────────────────────────────────────────── */
  private applySorting(qb: SelectQueryBuilder<Delivery>, dto: QueryLivreursDto): void {
    const order = dto.order ?? 'DESC';
    switch (dto.sortBy) {
      case 'note':
        qb.orderBy('lp.averageRating', order);
        break;
      case 'livraisons':
        qb.orderBy('lp.totalDeliveries', order);
        break;
      case 'disponible':
        /* Disponibles d'abord, puis par note décroissante */
        qb.orderBy('lp.availability', 'ASC') // 'available' avant 'offline'
          .addOrderBy('lp.averageRating', 'DESC');
        break;
      case 'recent':
        qb.orderBy('lp.createdAt', order);
        break;
      default:
        qb.orderBy('lp.averageRating', 'DESC');
    }
  }

  /* ──────────────────────────────────────────────────────────────
   * PRIVÉ : mapping vers card (vue liste)
   * ────────────────────────────────────────────────────────────── */
  private toCardData(profile: Delivery, followedIds: Set<string>): LivreurCardData {
    return {
      id:              profile.id, // id du PROFIL livreur (pour le follow)
      fullName:        this.resolveName(profile),
      profilePicture:  profile.photoUrl ?? null,
      zone:            profile.zone ?? 'Conakry',
      vehicule:        this.formatVehicule(profile.VehicleType, profile.vehiculeModele),
      vehiculeType:    profile.VehicleType ?? 'moto',
      totalLivraisons: profile.totalDeliveries ?? 0,
      averageRating:   Number(profile.averageRating ?? 0),
      reviewsCount:    profile.totalRatings ?? 0,
      ponctualite:     profile.ponctualite ?? 95,
      experience:      this.calcExperience(profile.createdAt),
      disponible:      profile.availability === DeliveryAvailability.AVAILABLE,
      isSuivi:         followedIds.has(profile.id),
    };
  }

  /* ──────────────────────────────────────────────────────────────
   * PRIVÉ : mapping vers profil complet (vue détail)
   * ────────────────────────────────────────────────────────────── */
  private toProfileFull(
    profile: Delivery,
    isSuivi: boolean,
    abonnesCount: number,
  ): LivreurProfileFull {
    const base = this.toCardData(
      profile,
      isSuivi ? new Set([profile.id]) : new Set(),
    );

    return {
      ...base,
      isSuivi,
      bio:             profile.bio ?? null,
      telephone:       profile.phone ?? profile.user?.phone ?? null,
      whatsapp:        profile.whatsapp ?? null,
      zones:           profile.communesActives ?? [],
      tarifs:          this.buildTarifs(profile),
      langues:         this.splitLangues(profile.langues),
      horaires:        this.buildHoraires(profile),
      immatriculation: profile.vehiculePlaque ?? null,
      assurance:       !!profile.documentAssurance, // a un doc d'assurance = assuré
      permis:          profile.documentPermis ?? null,
      createdAt:       profile.createdAt,
      abonnesCount,
    };
  }

  /* ════════════════════════════════════════════════════════════
   * UTILITAIRES PRIVÉS
   * ════════════════════════════════════════════════════════════ */

  /** Nom affiché : firstName+lastName si présents, sinon fullName. */
  private resolveName(profile: Delivery): string {
    if (profile.firstName || profile.lastName) {
      return `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim();
    }
    return profile.fullName ?? 'Livreur';
  }

  /** Expérience lisible depuis la date de création du profil. */
  private calcExperience(createdAt: Date): string {
    const months = Math.floor((Date.now() - new Date(createdAt).getTime()) / 2592000000);
    if (months < 12) return `${months} mois`;
    const years = Math.floor(months / 12);
    return `${years} an${years > 1 ? 's' : ''}`;
  }

  /** Libellé véhicule avec emoji. Ex : "🛵 Honda Dio". */
  private formatVehicule(type?: string, modele?: string | null): string {
    const icons: Record<string, string> = {
      moto: '🛵', voiture: '🚗', velo: '🚲',
      tricycle: '🛺', camion: '🚚', pieton: '🚶',
    };
    const icon = icons[type ?? 'moto'] ?? '🛵';
    return modele ? `${icon} ${modele}` : `${icon} ${type ?? 'Moto'}`;
  }

  /**
   * Construit l'objet tarifs depuis les colonnes de tarification.
   * Le frontend reçoit un objet clé/valeur lisible.
   */
  private buildTarifs(profile: Delivery): Record<string, number> {
    return {
      base:              Number(profile.tarifBase ?? 0),
      parKm:             Number(profile.tarifParKm ?? 0),
      supplementLourd:   Number(profile.supplementLourd ?? 0),
      majorationNocturne: Number(profile.majorationNocturne ?? 0),
    };
  }

  /** "Français, Soussou" → ["Français", "Soussou"]. */
  private splitLangues(langues?: string | null): string[] {
    if (!langues?.trim()) return [];
    return langues.split(',').map(l => l.trim()).filter(Boolean);
  }

  /**
   * Transforme la relation horaires en objet { jour: "07:00-21:00" }.
   * Les jours inactifs sont marqués "Fermé".
   */
  private buildHoraires(profile: Delivery): Record<string, string> {
    const result: Record<string, string> = {};
    if (!profile.horaires?.length) return result;

    for (const h of profile.horaires) {
      result[h.jour] = h.actif && h.ouverture && h.fermeture
        ? `${h.ouverture}-${h.fermeture}`
        : 'Fermé';
    }
    return result;
  }
}