/* ============================================================
 * FICHIER : src/database/entities/correspondant.table/correspondant-avis.entity.ts
 *
 * TABLE   : correspondant_avis
 * RÔLE    : Stocke les avis clients sur un correspondant (point relais).
 *           Miroir exact de company-avis.entity.ts / livreur-avis.entity.ts
 *           pour l'acteur CORRESPONDENT.
 *           Créé automatiquement après validation d'une commande
 *           et notation du correspondant (POST /commandes/:id/notes),
 *           seulement si ce correspondant a réellement servi de relais
 *           sur cette commande (voir CommandeFeedbackService.envoyerNotations).
 *
 * Contrainte UNIQUE (commandeId) → un seul avis correspondant par commande.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

@Entity('correspondant_avis')
@Index('IDX_avis_correspondant', ['correspondantId'])
export class CorrespondantAvis {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Correspondant noté */
  @Index()
  @Column({ type: 'uuid' })
  correspondantId: string;

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

  /** Réponse publique du correspondant à cet avis (Dashboard > Évaluation) */
  @Column({ type: 'text', nullable: true })
  reponse: string | null;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
