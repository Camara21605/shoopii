/* ============================================================
 * FICHIER : src/database/entities/localisation.entity.ts
 * RÔLE    : Gestion des adresses utilisateur (lié à User)
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  Index, ManyToOne, JoinColumn,
} from 'typeorm';

import { User } from './user.entity';

/* ============================================================
 * TYPE D'ADRESSE
 * ============================================================ */
export enum TypeAdresse {
  DOMICILE  = 'domicile',
  BUREAU    = 'bureau',
  BOUTIQUE  = 'boutique',
  ENTREPOT  = 'entrepot',
  RELAIS    = 'relais',
  DEPART    = 'depart',
  AUTRE     = 'autre',
}

/* ============================================================
 * ENTITÉ LOCALISATION
 * ============================================================ */

@Entity('localisations')
export class Localisation {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ============================================================
   * RELATION UTILISATEUR
   * ============================================================ */

  @ManyToOne(() => User, user => user.localisations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  /* ============================================================
   * TYPE D'ADRESSE
   * ============================================================ */

  @Column({
    type: 'enum',
    enum: TypeAdresse,
    default: TypeAdresse.DOMICILE,
  })
  typeAdresse: TypeAdresse;

  @Column({ type: 'varchar', length: 100, nullable: true })
  libelle: string | null;

  @Column({ type: 'boolean', default: false })
  estDefaut: boolean;

  /* ============================================================
   * ADRESSE STRUCTURÉE
   * ============================================================ */

  @Column({ type: 'varchar', length: 255, nullable: true })
  rue: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  quartier: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  commune: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  ville: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  prefecture: string | null;

  @Column({ type: 'varchar', length: 5, default: 'GN' })
  pays: string;

  /* ============================================================
   * GPS
   * ============================================================ */

  @Index()
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  latitude: number | null;

  @Index()
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  longitude: number | null;

  /* ============================================================
   * INFOS COMPLÉMENTAIRES
   * ============================================================ */

  @Column({ type: 'varchar', length: 20, nullable: true })
  codePostal: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  region: string | null;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telephone: string | null;

  /* ============================================================
   * TIMESTAMPS
   * ============================================================ */

  @CreateDateColumn()
  creeLe: Date;

  @UpdateDateColumn()
  misAJourLe: Date;
}