/* ============================================================
 * FICHIER : src/database/entities/livreur.table/livreur-horaire.entity.ts
 *
 * RÔLE : Horaires de disponibilité du livreur par jour.
 * Table SQL : livreur_horaires
 * Contrainte : UNIQUE(livreurId, jour)
 *
 * Analogue à company-horaire.entity.ts pour les boutiques.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, Unique,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

import { Delivery } from '../profiles/livreur-profile.entity';

export enum JourSemaine {
  LUNDI    = 'lundi',
  MARDI    = 'mardi',
  MERCREDI = 'mercredi',
  JEUDI    = 'jeudi',
  VENDREDI = 'vendredi',
  SAMEDI   = 'samedi',
  DIMANCHE = 'dimanche',
}

export const JOURS_ORDER: JourSemaine[] = [
  JourSemaine.LUNDI, JourSemaine.MARDI, JourSemaine.MERCREDI,
  JourSemaine.JEUDI, JourSemaine.VENDREDI, JourSemaine.SAMEDI,
  JourSemaine.DIMANCHE,
];

/** Horaires par défaut : 7h→21h du lundi au samedi, dimanche OFF */
export const DEFAULT_HORAIRES_LIVREUR: Record<JourSemaine, { ouverture: string; fermeture: string; actif: boolean }> = {
  [JourSemaine.LUNDI]:    { ouverture: '07:00', fermeture: '21:00', actif: true  },
  [JourSemaine.MARDI]:    { ouverture: '07:00', fermeture: '21:00', actif: true  },
  [JourSemaine.MERCREDI]: { ouverture: '07:00', fermeture: '21:00', actif: true  },
  [JourSemaine.JEUDI]:    { ouverture: '07:00', fermeture: '21:00', actif: true  },
  [JourSemaine.VENDREDI]: { ouverture: '07:00', fermeture: '21:00', actif: true  },
  [JourSemaine.SAMEDI]:   { ouverture: '07:00', fermeture: '21:00', actif: true  },
  [JourSemaine.DIMANCHE]: { ouverture: '08:00', fermeture: '18:00', actif: false },
};

@Entity('livreur_horaires')
@Unique(['livreurId', 'jour'])
export class LivreurHoraire {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Delivery, d => d.horaires, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'livreurId' })
  livreur!: Delivery;

  @Column({ type: 'uuid' })
  livreurId!: string;

  @Column({ type: 'enum', enum: JourSemaine })
  jour!: JourSemaine;

  /** Heure début de disponibilité. NULL = indisponible ce jour. */
  @Column({ type: 'time', nullable: true })
  ouverture!: string | null;

  /** Heure fin de disponibilité. */
  @Column({ type: 'time', nullable: true })
  fermeture!: string | null;

  /** Ce jour est-il un jour de travail ? */
  @Column({ type: 'boolean', default: true })
  actif!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}