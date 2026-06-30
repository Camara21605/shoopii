import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { ReturnRequest } from './return-request.entity';

export enum EvidenceType {
  IMAGE    = 'image',
  VIDEO    = 'video',
  DOCUMENT = 'document',
}

@Entity('return_evidences')
export class ReturnEvidence {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ReturnRequest, r => r.evidences, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'returnRequestId' })
  returnRequest!: ReturnRequest;

  @Column({ name: 'returnRequestId', type: 'uuid' })
  returnRequestId!: string;

  @Column({ type: 'varchar', length: 500 })
  url!: string;

  @Column({ type: 'varchar', length: 200 })
  publicId!: string;

  @Column({ type: 'enum', enum: EvidenceType, default: EvidenceType.IMAGE })
  type!: EvidenceType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  filename!: string | null;

  @Column({ type: 'int', nullable: true })
  size!: number | null;

  @Column({ type: 'varchar', length: 20, default: 'client' })
  uploadedBy!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
