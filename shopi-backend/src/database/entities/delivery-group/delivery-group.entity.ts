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

@Entity('delivery_groups')
export class DeliveryGroup {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Référence unique de la commande associée (1 groupe par commande). */
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  commandeId: string;

  @Column({ type: 'varchar', length: 50 })
  commandeNumero: string;

  @Column({ type: 'varchar', length: 255 })
  companyName: string;

  /** Description libre modifiable par les membres (ex : instructions de livraison). */
  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  description: string | null;

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
