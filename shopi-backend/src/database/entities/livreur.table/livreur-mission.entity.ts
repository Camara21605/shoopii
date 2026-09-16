/* ============================================================
 * FICHIER : src/database/entities/livreur.table/livreur-mission.entity.ts
 *
 * RÔLE : Mission de livraison DIFFUSÉE par une entreprise à ses
 * livreurs disponibles — distincte des livraisons issues du parcours
 * commande client (voir Commande.livreurId, déjà assignées à un
 * livreur précis dès la création). Une mission naît SANS livreur
 * assigné ('open'), est notifiée aux livreurs disponibles de
 * l'entreprise, et le premier à l'accepter devient assignedDeliveryId
 * ('accepted') — l'entreprise peut aussi la marquer 'completed' une
 * fois effectuée, ou l'annuler tant qu'elle est encore 'open'.
 *
 * Comblait un vide documenté : livreur-dashboard.module.ts mentionnait
 * déjà "Missions actives → MissionsService (à créer)" et
 * NotificationType docs citait déjà l'exemple "Nouvelle mission
 * disponible dans votre zone 📦" — aucun des deux n'était branché.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum MissionStatus {
  OPEN      = 'open',
  ACCEPTED  = 'accepted',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('livreur_missions')
export class LivreurMission {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Entreprise qui diffuse la mission — pas de relation TypeORM (voir
   *  Delivery.companyId) : simple colonne, résolue depuis le JWT côté service. */
  @Index()
  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Zone/adresse indicative — texte libre, même convention que Delivery.zone. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  zone!: string | null;

  /** Récompense proposée en GNF — optionnelle (la rémunération réelle
   *  d'une mission hors-commande n'est pas gérée par le moteur de
   *  commission/escrow, volontairement hors périmètre ici). */
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  reward!: number | null;

  @Column({ type: 'boolean', default: false })
  urgent!: boolean;

  @Column({ type: 'enum', enum: MissionStatus, default: MissionStatus.OPEN })
  status!: MissionStatus;

  /** Livreur qui a accepté la mission — Delivery.id, pas de relation
   *  TypeORM pour rester cohérent avec Delivery.companyId ci-dessus. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  assignedDeliveryId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
