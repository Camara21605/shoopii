/* ============================================================
 * FICHIER : src/database/entities/entreprise.table/service-like.entity.ts
 * RÔLE    : Likes / J'aime sur les prestations de service par les clients.
 *           Miroir de product-like.entity.ts.
 *
 * ─── RÈGLES MÉTIER ───────────────────────────────────────────
 *  - Un client ne peut liker qu'UNE FOIS un service donné
 *    → Contrainte UNIQUE sur (clientId, serviceId)
 *  - Un like supprimé = unlike (toggle)
 *  - Le compteur likes est dénormalisé dans Service.likesCount
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn,
  ManyToOne, JoinColumn, Column,
  CreateDateColumn, Unique, Index,
} from 'typeorm';
import { Client }  from '../profiles/client-profile.entity';
import { Service } from './service.entity';

@Entity('service_likes')
@Unique(['clientId', 'serviceId'])
export class ServiceLike {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Client, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Index()
  @Column({ name: 'clientId', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Service, service => service.likes, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @Index()
  @Column({ name: 'serviceId', type: 'uuid' })
  serviceId: string;

  @CreateDateColumn()
  createdAt: Date;
}
