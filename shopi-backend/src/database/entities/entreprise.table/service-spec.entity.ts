/* ============================================================
 * FICHIER : src/database/entities/entreprise.table/service-spec.entity.ts
 * RÔLE    : "Ce qui est inclus" / prérequis d'une prestation de service.
 *           Tableau clé/valeur → onglet "Détails" de la fiche service.
 *           Miroir de product-spec.entity.ts.
 *
 * Exemple :
 *   cle    = 'Durée du rendez-vous'
 *   valeur = '45 minutes'
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Service } from './service.entity';

@Entity('service_specs')
export class ServiceSpec {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  cle: string;

  @Column({ type: 'varchar', length: 500 })
  valeur: string;

  @Column({ type: 'int', default: 0 })
  ordre: number;

  @ManyToOne(() => Service, s => s.specs, {
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
