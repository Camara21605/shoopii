/* ================================================================
 * FICHIER : src/database/entities/appearance-preference.entity.ts
 *
 * RÔLE : Préférences visuelles persistées par utilisateur.
 *        Chaque admin possède une ligne unique dans cette table.
 *
 * CHAMPS : thème, couleur d'accent, police, densité, rayons,
 *          animations, sidebar, accessibilité.
 *
 * RELATION : OneToOne → User (clé étrangère userId, CASCADE DELETE).
 * ================================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity('appearance_preferences')
/* Garantit une seule ligne par utilisateur */
@Unique('UNIQ_appearance_user', ['userId'])
export class AppearancePreference {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** UUID de l'utilisateur propriétaire */
  @Column({ type: 'uuid' })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /* ── Thème ──────────────────────────────────────────────────── */

  /**
   * Mode d'affichage : 'light' | 'dark' | 'auto'
   * En mode 'auto', le frontend suit prefers-color-scheme.
   */
  @Column({ type: 'varchar', length: 10, default: 'light' })
  theme: string;

  /* ── Couleur ────────────────────────────────────────────────── */

  /**
   * Couleur d'accent principale appliquée via CSS variables.
   * Valeurs : 'blue' | 'teal' | 'violet' | 'emerald' | 'amber' | 'rose'
   */
  @Column({ type: 'varchar', length: 20, default: 'blue' })
  accentColor: string;

  /* ── Typographie ────────────────────────────────────────────── */

  /**
   * Famille de police de l'interface.
   * Valeurs : 'DM Sans' | 'Inter' | 'Roboto' | 'Poppins' | 'Nunito'
   * DM Sans est la police par défaut du design system Shopi.
   */
  @Column({ type: 'varchar', length: 50, default: 'DM Sans' })
  fontFamily: string;

  /**
   * Échelle de taille du texte.
   * 'normal' = 15px | 'grand' = 16px | 'tres-grand' = 17px
   */
  @Column({ type: 'varchar', length: 20, default: 'normal' })
  fontScale: string;

  /* ── Mise en page ───────────────────────────────────────────── */

  /**
   * Densité d'espacement des éléments.
   * 'compact' | 'normal' | 'comfortable'
   */
  @Column({ type: 'varchar', length: 20, default: 'normal' })
  density: string;

  /**
   * Arrondi des coins des éléments (cards, boutons, inputs…).
   * 'small' | 'medium' | 'large'
   */
  @Column({ type: 'varchar', length: 20, default: 'medium' })
  borderRadius: string;

  /* ── Interface ──────────────────────────────────────────────── */

  /** Sidebar réduite par défaut (icônes uniquement, sans labels) */
  @Column({ type: 'boolean', default: false })
  sidebarCollapsed: boolean;

  /** Activer les transitions, hover-effects et animations des composants */
  @Column({ type: 'boolean', default: true })
  animationsEnabled: boolean;

  /* ── Accessibilité ──────────────────────────────────────────── */

  /** Mode contraste élevé : renforce le contraste du texte et des bordures */
  @Column({ type: 'boolean', default: false })
  highContrast: boolean;

  /**
   * Réduire les mouvements (implémente prefers-reduced-motion).
   * Désactive les transitions longues et les animations décoratives.
   */
  @Column({ type: 'boolean', default: false })
  reduceMotion: boolean;

  /* ── Timestamps ─────────────────────────────────────────────── */

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
