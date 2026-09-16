/* ============================================================
 * FICHIER : src/modules/dashboard/client/services/service-favoris.service.ts
 *
 * RÔLE : Gestion des prestations favorites (❤️) d'un client.
 *   Miroir exact de favoris.service.ts (produits) pour l'entité Service
 *   dédiée (voir service.entity.ts / service-like.entity.ts).
 *   - toggle()      → like / unlike (table service_likes)
 *   - getAll()      → liste des prestations favorites du client
 *   - getLikedIds() → IDs des prestations likées (état du cœur)
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository }              from '@nestjs/typeorm';
import { In, Repository }                from 'typeorm';

import { ServiceLike } from '../../../../database/entities/entreprise.table/service-like.entity';
import { Service }     from '../../../../database/entities/entreprise.table/service.entity';
import { Client }      from '../../../../database/entities/profiles/client-profile.entity';
import { User }        from '../../../../database/entities/user.entity';
import { NotificationEventService } from '../../../notifications/events/notification-event.service';

@Injectable()
export class ServiceFavorisService {
  constructor(
    @InjectRepository(ServiceLike)
    private readonly likeRepo: Repository<ServiceLike>,

    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    private readonly notifEventSvc: NotificationEventService,
  ) {}

  private async resolveClientId(user: User): Promise<string> {
    const actorId = (user as any).actorId as string | undefined;
    if (actorId) return actorId;

    const client = await this.clientRepo.findOne({
      where:  { userId: user.id },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Profil client introuvable.');
    return client.id;
  }

  /* ════════════════════════════════════════════════════════
   * POST /client/favoris-services/:serviceId/toggle
   * ════════════════════════════════════════════════════════ */
  async toggle(user: User, serviceId: string) {
    const clientId = await this.resolveClientId(user);

    const [service, existing] = await Promise.all([
      this.serviceRepo.findOne({
        where:              { id: serviceId },
        select:             { id: true, likesCount: true, companyId: true, nom: true },
        loadEagerRelations: false,
      }),
      this.likeRepo.findOne({
        where:  { clientId, serviceId },
        select: { id: true },
      }),
    ]);

    if (!service) throw new NotFoundException('Prestation introuvable.');

    const liked = !existing;

    if (liked) {
      await Promise.all([
        this.likeRepo.insert({ clientId, serviceId }),
        this.serviceRepo.update(serviceId, { likesCount:     () => '"likesCount" + 1'      } as any),
        this.clientRepo.update(clientId,   { totalFavorites: () => '"totalFavorites" + 1'  } as any),
      ]);
    } else {
      await Promise.all([
        this.likeRepo.delete({ clientId, serviceId }),
        this.serviceRepo.update(serviceId, { likesCount:     () => 'GREATEST(0, "likesCount" - 1)'      } as any),
        this.clientRepo.update(clientId,   { totalFavorites: () => 'GREATEST(0, "totalFavorites" - 1)'  } as any),
      ]);
    }

    const newLikesCount = liked
      ? (service.likesCount ?? 0) + 1
      : Math.max(0, (service.likesCount ?? 0) - 1);

    if (liked) {
      void this.notifEventSvc.notifyServiceLiked({
        companyId:   service.companyId,
        serviceId:   service.id,
        serviceName: service.nom,
        clientId,
      });
    }

    return { liked, likesCount: newLikesCount };
  }

  /* ════════════════════════════════════════════════════════
   * GET /client/favoris-services
   * ════════════════════════════════════════════════════════ */
  async getAll(user: User) {
    const clientId = await this.resolveClientId(user);

    const likes = await this.likeRepo.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
    });
    if (likes.length === 0) return [];

    const services = await this.serviceRepo.find({
      where:     { id: In(likes.map(l => l.serviceId)) },
      relations: ['media', 'category'],
    });
    const serviceMap = new Map(services.map(s => [s.id, s]));

    return likes
      .map(like => {
        const s = serviceMap.get(like.serviceId);
        if (!s) return null;

        const images = (s.media ?? []).slice().sort((a, b) => a.ordre - b.ordre);
        return {
          id:         like.id,
          serviceId:  s.id,
          nom:        s.nom,
          prix:       s.prix,
          prixAncien: s.prixAncien,
          pricingType: s.pricingType,
          emoji:      s.category?.icone ?? '🛠️',
          imageUrl:   images[0]?.url ?? null,
        };
      })
      .filter(Boolean);
  }

  /* ════════════════════════════════════════════════════════
   * GET /client/favoris-services/ids
   * ════════════════════════════════════════════════════════ */
  async getLikedIds(user: User): Promise<string[]> {
    const clientId = await this.resolveClientId(user);
    const likes = await this.likeRepo.find({
      where:  { clientId },
      select: { serviceId: true },
    });
    return likes.map(l => l.serviceId);
  }
}
