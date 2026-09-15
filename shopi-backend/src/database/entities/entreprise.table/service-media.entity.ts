/* ============================================================
 * FICHIER : src/database/entities/entreprise.table/service-media.entity.ts
 * RÔLE    : Médias d'une prestation de service : images, vidéo.
 *           ordre = 0 → média principal. Miroir de product-media.entity.ts.
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';

import { Service } from './service.entity';

export enum ServiceMediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

@Entity('service_media')
export class ServiceMedia {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ServiceMediaType, default: ServiceMediaType.IMAGE })
  type: ServiceMediaType;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  originalName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ type: 'bigint', nullable: true })
  size: number | null;

  @Column({ type: 'int', nullable: true })
  duration: number | null;

  @Column({ type: 'int', default: 0 })
  ordre: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  alt: string | null;

  @ManyToOne(() => Service, (service) => service.media, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @Column({ name: 'serviceId', type: 'uuid' })
  serviceId: string;

  @CreateDateColumn()
  createdAt: Date;
}
