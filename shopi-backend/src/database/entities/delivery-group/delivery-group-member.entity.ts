import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { DeliveryGroup } from './delivery-group.entity';

export enum GroupMemberType {
  CLIENT        = 'client',
  COMPANY       = 'company',
  DELIVERY      = 'delivery',
  CORRESPONDENT = 'correspondent',
  /** Uniquement pour un membre ajouté à un groupe CUSTOM (voir DeliveryGroupKind.CUSTOM) —
   *  un groupe de commande n'implique jamais de partenaire. */
  PARTNER       = 'partner',
}

@Index('IDX_dgm_group_user', ['groupId', 'userId'])
@Index('IDX_dgm_user_active', ['userId', 'isActive'])
@Entity('delivery_group_members')
export class DeliveryGroupMember {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  groupId: string;

  @ManyToOne(() => DeliveryGroup, g => g.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: DeliveryGroup;

  @Column({ type: 'enum', enum: GroupMemberType })
  actorType: GroupMemberType;

  /** UUID du profil (clients.id, companies.id, …). */
  @Column({ type: 'uuid' })
  actorId: string;

  /** UUID de l'utilisateur JWT (users.id) — pour les rooms Socket.IO. */
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  displayName: string;

  /** false = ancien livreur retiré du groupe après remplacement. */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Administrateur du groupe (uniquement significatif pour DeliveryGroupKind.
   *  CUSTOM — voir DeliveryGroupService.setMemberAdmin/assertGroupAdmin) : peut
   *  changer la photo du groupe et nommer/retirer d'autres administrateurs,
   *  comme sur WhatsApp/Telegram. Le créateur du groupe est admin par défaut
   *  (voir createCustomGroup). Sans effet pour un groupe ORDER (auto-créé par
   *  une commande, membres/permissions gérés par le système, pas de notion
   *  d'admin). */
  @Column({ type: 'boolean', default: false })
  isAdmin: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastReadAt: Date | null;

  @Column({ type: 'int', default: 0 })
  unreadCount: number;

  @CreateDateColumn()
  joinedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  leftAt: Date | null;
}
