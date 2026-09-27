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

/* BUG CORRIGÉ — `decimal` sans conversion : PostgreSQL renvoie la coordonnée en
 * TEXTE ("9.641200"). L'écran « Mes adresses » plantait (toFixed sur une chaîne)
 * et modifier une adresse épinglée échouait (le texte renvoyé tel quel était
 * refusé par @IsNumber). Nombre en lecture ; NULL reste NULL (jamais 0,0). */
const coordTransformer = {
  to:   (v: number | null | undefined) => (v === undefined ? undefined : v),
  from: (v: string | number | null) => (v === null || v === undefined ? null : Number(v)),
};

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
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true, transformer: coordTransformer })
  latitude: number | null;

  @Index()
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true, transformer: coordTransformer })
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