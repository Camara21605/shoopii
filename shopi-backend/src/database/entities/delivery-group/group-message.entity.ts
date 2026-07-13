import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, Index, DeleteDateColumn,
} from 'typeorm';
import { DeliveryGroup }  from './delivery-group.entity';
import { GroupMemberType } from './delivery-group-member.entity';

export enum GroupMessageContentType {
  TEXT   = 'text',
  IMAGE  = 'image',
  VIDEO  = 'video',
  AUDIO  = 'audio',
  FILE   = 'file',
  SYSTEM = 'system',
  CALL   = 'call',
}

@Index('IDX_gm_group_date', ['groupId', 'createdAt'])
@Entity('group_messages')
export class GroupMessage {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  groupId: string;

  @ManyToOne(() => DeliveryGroup, g => g.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: DeliveryGroup;

  /** null pour les messages SYSTEM. */
  @Column({ type: 'enum', enum: GroupMemberType, nullable: true })
  senderType: GroupMemberType | null;

  @Column({ type: 'uuid', nullable: true })
  senderId: string | null;

  @Column({ type: 'uuid', nullable: true })
  senderUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  senderName: string | null;

  @Column({ type: 'enum', enum: GroupMessageContentType, default: GroupMessageContentType.TEXT })
  contentType: GroupMessageContentType;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  mediaUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mediaName: string | null;

  @Column({ type: 'bigint', nullable: true })
  mediaSize: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mediaMimeType: string | null;

  @Column({ type: 'int', nullable: true })
  mediaDuration: number | null;

  @Column({ type: 'uuid', nullable: true })
  replyToId: string | null;

  @Column({ type: 'boolean', default: false })
  isEdited: boolean;

  @Column({ type: 'timestamp', nullable: true })
  editedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  originalContent: string | null;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  deletedById: string | null;

  /** UserIds pour lesquels ce message est caché (suppression individuelle). */
  @Column({ type: 'json', nullable: true })
  deletedForUserIds: string[] | null;

  @Column({ type: 'json', nullable: true })
  reactions: Record<string, string[]> | null;

  @CreateDateColumn()
  createdAt: Date;
}
