/* ============================================================
 * FICHIER : src/database/entities/entreprise.table/company-supplier-link.entity.ts
 * RÔLE    : Lien d'approvisionnement entre deux entreprises Shopi —
 *           une entreprise "acheteuse" se connecte à une entreprise
 *           "fournisseur" qui vend en gros (venteEnGros=true), afin
 *           d'accéder à son catalogue de réapprovisionnement depuis
 *           la page Inventaire (action "Synchroniser le stock").
 *
 * Une ligne par (buyerCompanyId, supplierCompanyId) — pas de sens à
 * connecter deux fois la même entreprise, ni à se connecter à soi-même.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
  Unique, Index, Check,
} from 'typeorm';
import { Company } from '../profiles/entreprise-profile.entity';

@Entity('company_supplier_links')
@Unique(['buyerCompanyId', 'supplierCompanyId'])
@Check(`"buyerCompanyId" != "supplierCompanyId"`)
export class CompanySupplierLink {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Entreprise qui s'approvisionne (celle qui a initié la connexion) */
  @Column({ type: 'uuid' })
  @Index()
  buyerCompanyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyerCompanyId' })
  buyerCompany: Company;

  /** Entreprise fournisseur (celle qui vend en gros) */
  @Column({ type: 'uuid' })
  @Index()
  supplierCompanyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplierCompanyId' })
  supplierCompany: Company;

  @CreateDateColumn()
  createdAt: Date;
}
