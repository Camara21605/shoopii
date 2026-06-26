/* ============================================================
 * FICHIER : src/database/entities/location/location-history.entity.ts
 * RÔLE    : Historique des positions GPS des livreurs.
 *           Conservé 30 jours puis purgé automatiquement.
 *           Permet le suivi en direct et l'analyse des parcours.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Index,
} from 'typeorm';

import { Delivery } from '../profiles/livreur-profile.entity';

@Entity('location_history')
@Index('IDX_lochist_delivery_ts', ['deliveryId', 'horodatage'])
@Index('IDX_lochist_coords',      ['latitude', 'longitude'])
export class LocationHistory {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ── Relation livreur ────────────────────────────────── */

  @ManyToOne(() => Delivery, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deliveryId' })
  delivery: Delivery;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  deliveryId: string;

  /* ── Coordonnées GPS ─────────────────────────────────── */

  @Column({ type: 'decimal', precision: 9, scale: 6 })
  latitude: number;

  @Column({ type: 'decimal', precision: 9, scale: 6 })
  longitude: number;

  /** Précision GPS en mètres */
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  precisionM: number | null;

  /** Cap de déplacement en degrés (0-360) */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  cap: number | null;

  /** Vitesse en km/h */
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  vitesseKmh: number | null;

  /* ── Session de partage ──────────────────────────────── */

  /**
   * Identifiant de session de partage.
   * Permet de regrouper une trajectoire complète (départ → arrivée).
   */
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  sessionId: string | null;

  /* ── Horodatage ──────────────────────────────────────── */

  /** Timestamp de la position GPS (peut différer de creeLe si batching) */
  @Index()
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  horodatage: Date;

  @CreateDateColumn()
  creeLe: Date;
}
