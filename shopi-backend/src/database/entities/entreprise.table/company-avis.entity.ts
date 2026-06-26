/* ============================================================
 * FICHIER : src/database/entities/entreprise.table/company-avis.entity.ts
 *
 * TABLE   : company_avis
 * RÔLE    : Stocke les avis clients sur une boutique.
 *           Créé automatiquement après validation d'une commande
 *           et notation par le client (POST /commandes/:id/notes).
 *
 * Contrainte UNIQUE (commandeId) → un seul avis par commande.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

@Entity('company_avis')
@Index('IDX_avis_company', ['companyId'])
export class CompanyAvis {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Boutique notée */
  @Index()
  @Column({ type: 'uuid' })
  companyId: string;

  /** Commande source (UNIQUE : un seul avis par commande) */
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  commandeId: string;

  /** Snapshot nom du client au moment de l'avis */
  @Column({ type: 'varchar', length: 255, default: 'Client Shopi' })
  clientNom: string;

  /** Initiales pour l'avatar (ex: "MD") */
  @Column({ type: 'varchar', length: 3, default: 'C' })
  clientInitiales: string;

  /** Note de 1 à 5 */
  @Column({ type: 'smallint' })
  note: number;

  /** Commentaire optionnel */
  @Column({ type: 'text', nullable: true })
  commentaire: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
