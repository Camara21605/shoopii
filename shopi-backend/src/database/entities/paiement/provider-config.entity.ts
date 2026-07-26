/* ============================================================
 * FICHIER : src/database/entities/paiement/provider-config.entity.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Configuration dynamique des providers de paiement.
 * Gérée par le Super Admin via l'interface d'administration.
 *
 * POURQUOI
 * ─────────────────────────────────────────────────────────────
 * Permet d'activer/désactiver un provider, de switcher entre
 * environnement test et production, et de configurer les clés
 * API sans redéploiement de l'application.
 *
 * SÉCURITÉ
 * ─────────────────────────────────────────────────────────────
 * Les colonnes apiKey, apiSecret, webhookSecret sont stockées
 * en clair ici (MVP). En production, les valeur devraient être
 * chiffrées via un vault (ex: HashiCorp, AWS KMS).
 * Le champ `config` permet d'ajouter des options spécifiques
 * à chaque provider sans modifier le schéma.
 *
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/database/entities/paiement/provider-config.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

import { PaiementProvider } from './paiement-session.entity';

/* ============================================================
 * ENUMS
 * ============================================================ */

export enum ProviderEnvironment {
  TEST       = 'test',
  PRODUCTION = 'production',
}

/* ============================================================
 * ENTITY
 * ============================================================ */

@Unique('UQ_provider_config_provider', ['provider'])
@Index('IDX_provider_config_active', ['isActive'])
@Entity('payment_provider_configs')
export class ProviderConfig {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * IDENTIFICATION DU PROVIDER
   * ========================================================== */

  @Column({ type: 'enum', enum: PaiementProvider })
  provider: PaiementProvider;

  /* ==========================================================
   * ACTIVATION
   * ========================================================== */

  /** Si false, le provider est désactivé et ne peut recevoir de paiements */
  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  /** Environnement actif : test (bac à sable) ou production */
  @Column({
    type: 'enum',
    enum: ProviderEnvironment,
    default: ProviderEnvironment.TEST,
  })
  environment: ProviderEnvironment;

  /* ==========================================================
   * CLÉS API (production)
   * ========================================================== */

  @Column({ type: 'varchar', length: 500, nullable: true })
  apiKey: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  apiSecret: string | null;

  /** Secret HMAC utilisé pour vérifier la signature des webhooks */
  @Column({ type: 'varchar', length: 500, nullable: true })
  webhookSecret: string | null;

  /* ==========================================================
   * CLÉS API (test / bac à sable)
   * ========================================================== */

  @Column({ type: 'varchar', length: 500, nullable: true })
  testApiKey: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  testApiSecret: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  testWebhookSecret: string | null;

  /* ==========================================================
   * LIMITES FINANCIÈRES
   * ========================================================== */

  /** Montant minimum accepté par ce provider (en GNF) */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 100 })
  minAmount: number;

  /** Montant maximum accepté par ce provider (en GNF) */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 10_000_000 })
  maxAmount: number;

  /** Plafond journalier pour ce provider. NULL = pas de plafond */
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  dailyLimit: number | null;

  /* ==========================================================
   * CONFIGURATION SPÉCIFIQUE AU PROVIDER
   * ========================================================== */

  /**
   * JSON libre pour les paramètres propres à chaque provider.
   * Ex: { "merchantId": "...", "countryCode": "GN", "callbackPath": "/..." }
   */
  @Column({ type: 'json', nullable: true })
  config: Record<string, unknown> | null;

  /* ==========================================================
   * AUDIT D'ACTIVATION
   * ========================================================== */

  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  activatedByUserId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  deactivatedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  deactivatedByUserId: string | null;

  /* ==========================================================
   * DATES
   * ========================================================== */

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
