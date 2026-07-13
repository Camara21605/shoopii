import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('help_faq_items')
export class HelpFaqItem {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  categorySlug!: string;

  @Column({ type: 'varchar', length: 500 })
  question!: string;

  @Column({ type: 'text' })
  answer!: string;

  @Column({ type: 'simple-array', nullable: true })
  audience!: string[] | null;

  @Column({ type: 'int', default: 0 })
  displayOrder!: number;

  @Column({ type: 'boolean', default: false })
  isPublished!: boolean;

  /* Lien optionnel vers un article détaillé */
  @Column({ type: 'uuid', nullable: true })
  relatedArticleId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
