/* ============================================================
 * FICHIER : src/modules/notifications/services/notification-actor-profile.service.ts
 *
 * RÔLE : Résout le profil (nom + avatar) de l'acteur qui a
 * déclenché une notification, à partir de (actorType, actorId).
 *
 * Utilisé pour enrichir INotificationDto.actor — affiché dans
 * le centre de notifications (ex: dashboard administrateur) afin
 * que l'admin voie QUI a déclenché l'événement, pas seulement
 * un texte générique.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { NotificationActorType } from 'src/database/entities/notification/notification.entitiy';
import { Client }        from 'src/database/entities/profiles/client-profile.entity';
import { Company }       from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from 'src/database/entities/profiles/livreur-profile.entity';
import { Correspondent } from 'src/database/entities/profiles/correspondant-profile.entity';
import { Partner }       from 'src/database/entities/profiles/partenaire-profile.entity';
import { Admin }         from 'src/database/entities/profiles/admin-profile.entity';

export interface IActorProfile {
  name:   string;
  avatar: string | null;
}

@Injectable()
export class NotificationActorProfileService {

  constructor(
    @InjectRepository(Client)        private readonly clientRepo:   Repository<Client>,
    @InjectRepository(Company)       private readonly companyRepo:  Repository<Company>,
    @InjectRepository(Delivery)      private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Correspondent) private readonly corrRepo:     Repository<Correspondent>,
    @InjectRepository(Partner)       private readonly partnerRepo:  Repository<Partner>,
    @InjectRepository(Admin)         private readonly adminRepo:    Repository<Admin>,
  ) {}

  /** Résout un seul acteur — utilisé par le canal IN_APP temps réel. */
  async resolveOne(
    type: NotificationActorType | null,
    id:   string | null,
  ): Promise<IActorProfile | null> {
    if (!type || !id) return null;
    const map = await this.resolveMany([{ type, id }]);
    return map.get(`${type}:${id}`) ?? null;
  }

  /**
   * Résout plusieurs acteurs en une seule passe — 1 requête par
   * type d'acteur présent, pour éviter le N+1 sur les listes paginées.
   */
  async resolveMany(
    entries: { type: NotificationActorType | null; id: string | null }[],
  ): Promise<Map<string, IActorProfile>> {
    const result = new Map<string, IActorProfile>();

    const idsByType = new Map<NotificationActorType, Set<string>>();
    for (const { type, id } of entries) {
      if (!type || !id) continue;
      if (!idsByType.has(type)) idsByType.set(type, new Set());
      idsByType.get(type)!.add(id);
    }

    await Promise.all(
      Array.from(idsByType.entries()).map(async ([type, idSet]) => {
        const ids = Array.from(idSet);

        switch (type) {
          case NotificationActorType.CLIENT: {
            const rows = await this.clientRepo.find({ where: { id: In(ids) }, relations: ['user'] });
            for (const r of rows) {
              const u = (r as any).user;
              const name = r.fullName?.trim()
                || (u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '')
                || 'Client';
              result.set(`${type}:${r.id}`, { name, avatar: u?.profilePicture ?? null });
            }
            break;
          }

          case NotificationActorType.COMPANY: {
            const rows = await this.companyRepo.find({ where: { id: In(ids) } });
            for (const r of rows) {
              result.set(`${type}:${r.id}`, { name: r.companyName || 'Boutique', avatar: r.logo ?? null });
            }
            break;
          }

          case NotificationActorType.DELIVERY: {
            const rows = await this.deliveryRepo.find({ where: { id: In(ids) }, relations: ['user'] });
            for (const r of rows) {
              const u = (r as any).user;
              result.set(`${type}:${r.id}`, { name: r.fullName || 'Livreur', avatar: u?.profilePicture ?? null });
            }
            break;
          }

          case NotificationActorType.CORRESPONDENT: {
            const rows = await this.corrRepo.find({ where: { id: In(ids) }, relations: ['user'] });
            for (const r of rows) {
              const u = (r as any).user;
              result.set(`${type}:${r.id}`, { name: r.fullName || 'Correspondant', avatar: u?.profilePicture ?? null });
            }
            break;
          }

          case NotificationActorType.PARTNER: {
            const rows = await this.partnerRepo.find({ where: { id: In(ids) }, relations: ['user'] });
            for (const r of rows) {
              const u = (r as any).user;
              result.set(`${type}:${r.id}`, { name: r.name || 'Partenaire', avatar: u?.profilePicture ?? null });
            }
            break;
          }

          case NotificationActorType.ADMIN:
          case NotificationActorType.SUPER_ADMIN: {
            const rows = await this.adminRepo.find({ where: { id: In(ids) }, relations: ['user'] });
            for (const r of rows) {
              const u = (r as any).user;
              result.set(`${type}:${r.id}`, {
                name:   r.fullName || (type === NotificationActorType.SUPER_ADMIN ? 'Super Admin' : 'Administrateur'),
                avatar: u?.profilePicture ?? null,
              });
            }
            break;
          }

          default:
            break;
        }
      }),
    );

    return result;
  }
}
