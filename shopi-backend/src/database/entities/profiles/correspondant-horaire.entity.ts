/* ============================================================
 * FICHIER : src/database/entities/profiles/correspondant-horaire.entity.ts
 *
 * Table : correspondant_horaires
 * Calquée sur company_horaires pour cohérence avec entreprise.
 *
 * Contrainte UNIQUE(correspondantId, jour) = max 1 ligne par jour.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, Unique,
} from 'typeorm';

import { Correspondent } from './correspondant-profile.entity';

export enum JourSemaine {
  LUNDI    = 'Lun',
  MARDI    = 'Mar',
  MERCREDI = 'Mer',
  JEUDI    = 'Jeu',
  VENDREDI = 'Ven',
  SAMEDI   = 'Sam',
  DIMANCHE = 'Dim',
}

/** Ordre canonique pour trier les horaires */
export const JOURS_ORDER: JourSemaine[] = [
  JourSemaine.LUNDI, JourSemaine.MARDI,   JourSemaine.MERCREDI,
  JourSemaine.JEUDI, JourSemaine.VENDREDI, JourSemaine.SAMEDI, JourSemaine.DIMANCHE,
];

/** Horaires par défaut à la création du profil */
export const DEFAULT_HORAIRES = [
  { jour: JourSemaine.LUNDI,    ouverture: '07:00', fermeture: '20:00', actif: true  },
  { jour: JourSemaine.MARDI,    ouverture: '07:00', fermeture: '20:00', actif: true  },
  { jour: JourSemaine.MERCREDI, ouverture: '07:00', fermeture: '20:00', actif: true  },
  { jour: JourSemaine.JEUDI,    ouverture: '07:00', fermeture: '20:00', actif: true  },
  { jour: JourSemaine.VENDREDI, ouverture: '07:00', fermeture: '20:00', actif: true  },
  { jour: JourSemaine.SAMEDI,   ouverture: '08:00', fermeture: '19:00', actif: true  },
  { jour: JourSemaine.DIMANCHE, ouverture: '09:00', fermeture: '17:00', actif: false },
];

@Entity('correspondant_horaires')
@Unique(['correspondantId', 'jour'])
export class CorrespondantHoraire {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Correspondent, cor => cor.horaires, {
    nullable: false, onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'correspondantId' })
  correspondant: Correspondent;

  @Column({ name: 'correspondantId', type: 'varchar', length: 36 })
  correspondantId: string;

  @Column({ type: 'enum', enum: JourSemaine })
  jour: JourSemaine;

  /** Heure d'ouverture au format HH:MM (ex : "07:00") */
  @Column({ type: 'varchar', length: 5 })
  ouverture: string;

  /** Heure de fermeture au format HH:MM (ex : "20:00") */
  @Column({ type: 'varchar', length: 5 })
  fermeture: string;

  /** false = fermé ce jour-là */
  @Column({ type: 'boolean', default: true })
  actif: boolean;
}