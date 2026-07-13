import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('help_search_queries')
export class HelpSearchQuery {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 500 })
  query!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'int', default: 0 })
  resultsCount!: number;

  /* false = requête sans résultats → contenu manquant à créer */
  @Column({ type: 'boolean', default: false })
  hasResults!: boolean;

  @Index()
  @CreateDateColumn()
  createdAt!: Date;
}
