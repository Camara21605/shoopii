import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('help_categories')
export class HelpCategory {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  slug!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 100, default: 'fa-circle-question' })
  icon!: string;

  @Column({ type: 'int', default: 0 })
  displayOrder!: number;

  /* ['all'] | ['client','company','delivery','partner','correspondent'] */
  @Column({ type: 'simple-array', nullable: true })
  audience!: string[] | null;

  /* Dénormalisé — mis à jour à chaque publish/unpublish */
  @Column({ type: 'int', default: 0 })
  articleCount!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
