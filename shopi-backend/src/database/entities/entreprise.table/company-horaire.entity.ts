/* ============================================================
 * FICHIER : src/database/entities/entreprise.table/company-horaire.entity.ts
 *
 * RÔLE
 * ────────────────────────────────────────────────────────────
 * Table des horaires d'ouverture par jour de la semaine.
 * Remplace les champs openTime / closeTime de Company qui ne
 * permettaient qu'une seule plage horaire (pas par jour).
 *
 * TABLE SQL : company_horaires
 *
 * CONTRAINTE : UNIQUE(companyId, jour) — une seule ligne par jour
 *
 * EXEMPLE DE DONNÉES
 * ────────────────────────────────────────────────────────────
 *   companyId | jour      | ouverture | fermeture | actif
 *   ──────────|───────────|───────────|───────────|──────
 *   uuid-1    | lundi     | 08:00:00  | 20:00:00  | true
 *   uuid-1    | mardi     | 08:00:00  | 20:00:00  | true
 *   uuid-1    | samedi    | 09:00:00  | 22:00:00  | true
 *   uuid-1    | dimanche  | NULL      | NULL      | false  ← fermé
 *
 * INITIALISATION
 * ────────────────────────────────────────────────────────────
 * Lors de la création d'une boutique, le service crée
 * automatiquement 7 lignes (lundi→dimanche) avec les
 * horaires par défaut 08:00 → 20:00, tous actifs sauf dimanche.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, Unique,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

import { Company } from '../profiles/entreprise-profile.entity';

/* ── Enum des jours de la semaine (ordre chronologique) ── */
export enum JourSemaine {
  LUNDI    = 'lundi',
  MARDI    = 'mardi',
  MERCREDI = 'mercredi',
  JEUDI    = 'jeudi',
  VENDREDI = 'vendredi',
  SAMEDI   = 'samedi',
  DIMANCHE = 'dimanche',
}

/* ── Ordre d'affichage (pour trier côté service) ── */
export const JOURS_ORDER: JourSemaine[] = [
  JourSemaine.LUNDI,
  JourSemaine.MARDI,
  JourSemaine.MERCREDI,
  JourSemaine.JEUDI,
  JourSemaine.VENDREDI,
  JourSemaine.SAMEDI,
  JourSemaine.DIMANCHE,
];

/* ── Horaires par défaut à l'initialisation ── */
export const DEFAULT_HORAIRES: Record<JourSemaine, { ouverture: string; fermeture: string; actif: boolean }> = {
  [JourSemaine.LUNDI]:    { ouverture: '08:00', fermeture: '20:00', actif: true  },
  [JourSemaine.MARDI]:    { ouverture: '08:00', fermeture: '20:00', actif: true  },
  [JourSemaine.MERCREDI]: { ouverture: '08:00', fermeture: '20:00', actif: true  },
  [JourSemaine.JEUDI]:    { ouverture: '08:00', fermeture: '20:00', actif: true  },
  [JourSemaine.VENDREDI]: { ouverture: '08:00', fermeture: '21:00', actif: true  },
  [JourSemaine.SAMEDI]:   { ouverture: '09:00', fermeture: '22:00', actif: true  },
  [JourSemaine.DIMANCHE]: { ouverture: '10:00', fermeture: '18:00', actif: false },
};

/* ============================================================ */

@Entity('company_horaires')
@Unique(['companyId', 'jour']) // ← un seul horaire par jour par boutique
export class CompanyHoraire {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /* ══════════════════════════════════════════════════════════
   * RELATION → COMPANY
   * ══════════════════════════════════════════════════════════ */

  /**
   * Boutique à laquelle appartient cet horaire.
   * CASCADE DELETE → supprimer la boutique supprime ses horaires.
   */
  @ManyToOne(() => Company, company => company.horaires, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  @Column({ type: 'uuid' })
  companyId!: string;

  /* ══════════════════════════════════════════════════════════
   * DONNÉES HORAIRE
   * ══════════════════════════════════════════════════════════ */

  /**
   * Jour de la semaine.
   * Enum stable utilisé comme clé dans les services.
   */
  @Column({ type: 'enum', enum: JourSemaine })
  jour!: JourSemaine;

  /**
   * Heure d'ouverture au format TIME MySQL "HH:MM:SS".
   * NULL si la boutique est fermée ce jour (actif = false).
   */
  @Column({ type: 'time', nullable: true })
  ouverture!: string | null;

  /**
   * Heure de fermeture au format TIME MySQL "HH:MM:SS".
   * NULL si la boutique est fermée ce jour (actif = false).
   */
  @Column({ type: 'time', nullable: true })
  fermeture!: string | null;

  /**
   * Ce jour est-il un jour d'ouverture ?
   * false → fermé (ouverture / fermeture sont ignorées).
   * true  → ouvert aux horaires définis.
   */
  @Column({ type: 'boolean', default: true })
  actif!: boolean;

  /* ══════════════════════════════════════════════════════════
   * TIMESTAMPS
   * ══════════════════════════════════════════════════════════ */

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}