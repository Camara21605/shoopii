/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/livreurs/services/missions.service.ts
 *
 * RÔLE : Diffusion de missions de livraison par une entreprise à ses
 * livreurs disponibles — bouton "Diffuser une mission" (actions
 * rapides) de LivreursPage.tsx. Voir LivreurMission entity pour le
 * contexte complet (pourquoi une entité séparée de Commande).
 *
 *  create()  → POST   /dashboard/entreprise/livreurs/missions
 *  findAll() → GET    /dashboard/entreprise/livreurs/missions
 *  cancel()  → PATCH  /dashboard/entreprise/livreurs/missions/:id/annuler
 * ============================================================ */

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { LivreurMission, MissionStatus } from 'src/database/entities/livreur.table/livreur-mission.entity';
import {
  Delivery,
  DeliveryStatus,
  DeliveryAvailability,
} from 'src/database/entities/profiles/livreur-profile.entity';
import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { User } from 'src/database/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { NotificationEventService } from 'src/modules/notifications/events/notification-event.service';
import { CreateMissionDto } from '../dto/mission.dto';

export interface MissionResponse {
  id:                 string;
  title:              string;
  description:        string | null;
  zone:               string | null;
  reward:             number | null;
  urgent:             boolean;
  status:             MissionStatus;
  assignedDeliveryId: string | null;
  assignedDeliveryName?: string | null;
  createdAt:          string;
  acceptedAt:         string | null;
  completedAt:        string | null;
}

@Injectable()
export class MissionsService {

  private readonly logger = new Logger(MissionsService.name);

  constructor(
    @InjectRepository(LivreurMission)
    private readonly missionRepo: Repository<LivreurMission>,

    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    private readonly notifEventSvc: NotificationEventService,
  ) {}

  /** Même logique que LivreursService.resolveCompanyId — dupliquée ici
   *  plutôt que partagée : éviter un couplage inter-module pour 5 lignes. */
  private async resolveCompanyId(user: User): Promise<string> {
    const actorId = (user as any).actorId as string | undefined;
    let company = await this.companyRepo.findOne({ where: { userId: user.id } });
    if (!company && actorId) company = await this.companyRepo.findOne({ where: { id: actorId } });
    if (!company) {
      throw new NotFoundException(
        'Profil entreprise introuvable. Vérifiez que le compte a été créé avec le rôle company.',
      );
    }
    return company.id;
  }

  private toResponse(m: LivreurMission, nameByDeliveryId: Record<string, string> = {}): MissionResponse {
    return {
      id:                 m.id,
      title:              m.title,
      description:        m.description,
      zone:               m.zone,
      reward:             m.reward != null ? Number(m.reward) : null,
      urgent:             m.urgent,
      status:             m.status,
      assignedDeliveryId: m.assignedDeliveryId,
      assignedDeliveryName: m.assignedDeliveryId ? (nameByDeliveryId[m.assignedDeliveryId] ?? null) : null,
      createdAt:          m.createdAt.toISOString(),
      acceptedAt:         m.acceptedAt ? m.acceptedAt.toISOString() : null,
      completedAt:        m.completedAt ? m.completedAt.toISOString() : null,
    };
  }

  // ══════════════════════════════════════════════════════════
  // CRÉER + DIFFUSER — POST /dashboard/entreprise/livreurs/missions
  // ══════════════════════════════════════════════════════════

  async create(dto: CreateMissionDto, user: User): Promise<MissionResponse> {
    const companyId = await this.resolveCompanyId(user);

    const mission = await this.missionRepo.save(this.missionRepo.create({
      companyId,
      title:       dto.title.trim(),
      description: dto.description?.trim() || null,
      zone:        dto.zone?.trim() || null,
      reward:      dto.reward ?? null,
      urgent:      dto.urgent ?? false,
      status:      MissionStatus.OPEN,
    }));

    // Livreurs disponibles de cette entreprise — seuls destinataires utiles
    // (un livreur hors-ligne/en course ne peut de toute façon pas l'accepter
    // dans l'immédiat ; il la verra quand même dans sa liste "disponibles"
    // au prochain chargement, seule la notification push cible les dispo).
    const disponibles = await this.deliveryRepo.find({
      where: {
        companyId,
        status:       DeliveryStatus.ACTIVE,
        availability: DeliveryAvailability.AVAILABLE,
      },
      select: ['id'],
    });

    if (disponibles.length > 0) {
      void this.notifEventSvc.notifyMissionAvailable({
        deliveryIds: disponibles.map(d => d.id),
        missionId:   mission.id,
        title:       mission.title,
        urgent:      mission.urgent,
      });
    }

    this.logger.log(`[MISSION DIFFUSÉE ✅] ID=${mission.id} | Entreprise=${companyId} | Destinataires=${disponibles.length}`);
    return this.toResponse(mission);
  }

  // ══════════════════════════════════════════════════════════
  // LISTER — GET /dashboard/entreprise/livreurs/missions
  // ══════════════════════════════════════════════════════════

  async findAll(user: User): Promise<MissionResponse[]> {
    const companyId = await this.resolveCompanyId(user);
    const missions = await this.missionRepo.find({
      where:  { companyId },
      order:  { createdAt: 'DESC' },
      take:   50,
    });

    const assignedIds = missions.map(m => m.assignedDeliveryId).filter((id): id is string => !!id);
    const names: Record<string, string> = {};
    if (assignedIds.length > 0) {
      const livreurs = await this.deliveryRepo.find({ where: { id: In(assignedIds) }, select: ['id', 'fullName'] });
      for (const l of livreurs) names[l.id] = l.fullName;
    }

    return missions.map(m => this.toResponse(m, names));
  }

  // ══════════════════════════════════════════════════════════
  // ANNULER — PATCH /dashboard/entreprise/livreurs/missions/:id/annuler
  // ══════════════════════════════════════════════════════════

  async cancel(id: string, user: User): Promise<MissionResponse> {
    const companyId = await this.resolveCompanyId(user);
    const mission = await this.missionRepo.findOne({ where: { id } });
    if (!mission) throw new NotFoundException('Mission introuvable.');
    if (mission.companyId !== companyId) throw new ForbiddenException('Accès refusé.');
    if (mission.status !== MissionStatus.OPEN) {
      throw new ForbiddenException(`Cette mission ne peut plus être annulée (statut: ${mission.status}).`);
    }

    mission.status = MissionStatus.CANCELLED;
    await this.missionRepo.save(mission);
    this.logger.log(`[MISSION ANNULÉE ✅] ID=${id}`);
    return this.toResponse(mission);
  }
}
