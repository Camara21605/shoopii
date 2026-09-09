import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { DeliveryGroupMember } from './delivery-group-member.entity';
import { GroupMessage }        from './group-message.entity';

export enum DeliveryGroupStatus {
  ACTIVE    = 'active',
  COMPLETED = 'completed',
  EXPIRED   = 'expired',
  CANCELLED = 'cancelled',
}

/**
 * ORDER  — groupe automatique existant, créé à la validation d'une
 *          commande (voir createGroupForCommande). commandeId obligatoire.
 * CUSTOM — groupe libre créé manuellement par un utilisateur depuis
 *          "⋮ > Paramètres > Ajouter un groupe" (voir createCustomGroup) :
 *          pas de commande, pas d'expiration automatique 72h, membres
 *          choisis à la main. commandeId/commandeNumero/companyName
 *          restent null ; `name` porte le titre donné par le créateur.
 */
export enum DeliveryGroupKind {
  ORDER  = 'order',
  CUSTOM = 'custom',
}

@Entity('delivery_groups')
export class DeliveryGroup {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: DeliveryGroupKind, default: DeliveryGroupKind.ORDER })
  kind: DeliveryGroupKind;

  /** Référence unique de la commande associée (1 groupe par commande).
   *  null pour un groupe CUSTOM — un index unique Postgres autorise
   *  plusieurs lignes à NULL sans conflit. */
  @Index({ unique: true })
  @Column({ type: 'uuid', nullable: true })
  commandeId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  commandeNumero: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  companyName: string | null;

  /** Titre donné par le créateur — uniquement pour un groupe CUSTOM. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  /** users.id du créateur — uniquement pour un groupe CUSTOM. */
  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  /** Description libre modifiable par les membres (ex : instructions de livraison). */
  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  description: string | null;

  /** Photo de profil du groupe (URL Cloudinary, dossier avatars) — modifiable
   *  par n'importe quel membre actif, même règle que description ci-dessus.
   *  null = pas de photo, le frontend retombe alors sur l'émoji par défaut
   *  (📦 commande / 👥 groupe libre — voir useDeliveryGroups.groupToUser). */
  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  photoUrl: string | null;

  @Column({ type: 'enum', enum: DeliveryGroupStatus, default: DeliveryGroupStatus.ACTIVE })
  status: DeliveryGroupStatus;

  /** Date de livraison confirmée (CLIENT valide son code). */
  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  /** Date d'expiration = completedAt + 72h. Groupe archivé ensuite. */
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @OneToMany(() => DeliveryGroupMember, m => m.group, { cascade: ['insert'] })
  members: DeliveryGroupMember[];

  @OneToMany(() => GroupMessage, m => m.group)
  messages: GroupMessage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
