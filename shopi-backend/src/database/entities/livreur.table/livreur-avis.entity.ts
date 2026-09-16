/* ============================================================
 * FICHIER : src/database/entities/livreur.table/livreur-avis.entity.ts
 *
 * TABLE   : livreur_avis
 * RÔLE    : Stocke les avis clients sur un livreur. Miroir exact de
 *           company-avis.entity.ts pour l'acteur DELIVERY.
 *           Créé automatiquement après validation d'une commande
 *           et notation du livreur (POST /commandes/:id/notes),
 *           seulement si ce livreur a réellement livré la commande
 *           (voir CommandeFeedbackService.envoyerNotations).
 *
 * Contrainte UNIQUE (commandeId) → un seul avis livreur par commande.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

@Entity('livreur_avis')
@Index('IDX_avis_livreur', ['livreurId'])
export class LivreurAvis {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Livreur noté */
  @Index()
  @Column({ type: 'uuid' })
  livreurId: string;

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

  /** Réponse publique du livreur à cet avis (Dashboard livreur > Évaluation) */
  @Column({ type: 'text', nullable: true })
  reponse: string | null;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
