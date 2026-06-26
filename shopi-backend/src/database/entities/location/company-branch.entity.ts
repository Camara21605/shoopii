/* ============================================================
 * FICHIER : src/database/entities/location/company-branch.entity.ts
 * RÔLE    : Agences / succursales d'une entreprise.
 *           Chaque entreprise peut avoir plusieurs points de vente
 *           avec leur propre géolocalisation et rayon de livraison.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
  Index,
} from 'typeorm';

import { Company } from '../profiles/entreprise-profile.entity';

@Entity('company_branches')
@Index('IDX_branch_company', ['companyId'])
@Index('IDX_branch_coords',  ['latitude', 'longitude'])
export class CompanyBranch {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ── Relation entreprise ─────────────────────────────── */

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  companyId: string;

  /* ── Identité de l'agence ────────────────────────────── */

  /** Nom de l'agence : "Magasin Kaloum", "Entrepôt Ratoma" */
  @Column({ type: 'varchar', length: 255 })
  nom: string;

  /** Type : siège, magasin, entrepôt, point_relais */
  @Column({
    type: 'enum',
    enum: ['siege', 'magasin', 'entrepot', 'point_relais', 'autre'],
    default: 'magasin',
  })
  type: 'siege' | 'magasin' | 'entrepot' | 'point_relais' | 'autre';

  /* ── Adresse structurée ──────────────────────────────── */

  @Column({ type: 'varchar', length: 500, nullable: true })
  adresse: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  quartier: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  commune: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  ville: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  region: string | null;

  @Column({ type: 'varchar', length: 10, default: 'GN' })
  pays: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  codePostal: string | null;

  /* ── GPS ─────────────────────────────────────────────── */

  @Index()
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  latitude: number | null;

  @Index()
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  longitude: number | null;

  /** Rayon de livraison depuis cette agence (km) */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 10 })
  rayonLivraisonKm: number;

  /* ── Contact ─────────────────────────────────────────── */

  @Column({ type: 'varchar', length: 20, nullable: true })
  telephone: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  repere: string | null;

  /* ── État ────────────────────────────────────────────── */

  @Column({ type: 'boolean', default: true })
  actif: boolean;

  /** Agence principale / siège */
  @Column({ type: 'boolean', default: false })
  estPrincipal: boolean;

  /* ── Timestamps ──────────────────────────────────────── */

  @CreateDateColumn()
  creeLe: Date;

  @UpdateDateColumn()
  misAJourLe: Date;
}
