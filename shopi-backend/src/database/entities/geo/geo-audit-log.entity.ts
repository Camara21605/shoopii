/* ================================================================
 * FICHIER : src/database/entities/geo/geo-audit-log.entity.ts
 *
 * Journal d'audit du référentiel géographique — une ligne par
 * modification réelle (création/modification/suppression/activation/
 * désactivation/import) sur l'un des 6 niveaux (pays → zone).
 *
 * Écrite exclusivement par GeoService, jamais modifiée après coup —
 * même logique d'immuabilité que PaiementDistribution.
 * ================================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type GeoAuditAction  = 'create' | 'update' | 'delete' | 'activate' | 'deactivate' | 'import';
export type GeoAuditNiveau  = 'pays' | 'region' | 'prefecture' | 'commune' | 'quartier' | 'zone';

@Entity('geo_audit_logs')
export class GeoAuditLog {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'enum', enum: ['create', 'update', 'delete', 'activate', 'deactivate', 'import'] })
  action: GeoAuditAction;

  @Index()
  @Column({ type: 'enum', enum: ['pays', 'region', 'prefecture', 'commune', 'quartier', 'zone'] })
  niveau: GeoAuditNiveau;

  /** UUID de l'item concerné — pas de FK formelle (item parfois supprimé, ou "import" = plusieurs items) */
  @Column({ type: 'uuid', nullable: true, name: 'item_id' })
  itemId: string | null;

  @Column({ length: 255, name: 'item_nom' })
  itemNom: string;

  @Column({ length: 50, name: 'item_code' })
  itemCode: string;

  @Column({ length: 255 })
  auteur: string;

  @Column({ type: 'uuid', nullable: true, name: 'auteur_user_id' })
  auteurUserId: string | null;

  @Column({ type: 'text' })
  details: string;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
