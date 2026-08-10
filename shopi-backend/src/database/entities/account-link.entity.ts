/* ============================================================
 * FICHIER : src/database/entities/account-link.entity.ts
 *
 * Relie DEUX lignes "users" distinctes appartenant à la même personne
 * réelle : un compte professionnel (entreprise/livreur/correspondant/
 * admin/partenaire) et son compte client "Mon espace", même email/
 * téléphone.
 *
 * Le bannissement/statut du compte pro ou client ne se propage JAMAIS
 * à l'autre — ce n'est qu'un pointeur d'identité, pas une fusion de comptes.
 *
 * `status` (active/revoked) plutôt qu'une suppression définitive : permet
 * de délier un compte pro d'un compte client (ex. changement de titulaire)
 * sans perdre l'historique, et de relier ensuite un NOUVEAU compte client
 * sans être bloqué par une contrainte unique sur une ligne devenue obsolète.
 * L'unicité "au plus un lien actif par compte" est donc un index unique
 * PARTIEL (WHERE status='active'), pas une contrainte unique simple — les
 * lignes révoquées peuvent coexister librement.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
  OneToOne, JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum AccountLinkMethod {
  QUICK_CREATE      = 'quick_create',
  EXISTING_VERIFIED = 'existing_account_verified',
}

export enum AccountLinkVerification {
  PASSWORD  = 'password',
  OTP_EMAIL = 'otp_email',
  OTP_SMS   = 'otp_sms',
}

export enum AccountLinkStatus {
  ACTIVE  = 'active',
  REVOKED = 'revoked',
}

@Entity('account_links')
/* Index unique PARTIEL : au plus UNE ligne active par proUserId/clientUserId,
 * mais plusieurs lignes révoquées (historique) peuvent coexister — voir le
 * commentaire d'en-tête. Remplace l'ancien `@Index({unique:true})` simple
 * posé directement sur les colonnes, incompatible avec le statut révoqué. */
@Index('UNIQ_account_link_pro_active', ['proUserId'], { unique: true, where: `"status" = 'active'` })
@Index('UNIQ_account_link_client_active', ['clientUserId'], { unique: true, where: `"status" = 'active'` })
export class AccountLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* Relation exposée uniquement dans CE sens (AccountLink → User), jamais
   * l'inverse sur User : un compte pro/client peut avoir plusieurs lignes
   * AccountLink au fil du temps (une active + des révoquées), donc un
   * `@OneToOne` déclaré côté User (qui suppose une correspondance unique)
   * serait trompeur. Pour retrouver le lien ACTIF d'un utilisateur, passer
   * par AccountLinkService (filtre explicite sur status). */
  @OneToOne(() => User, { nullable: false, onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'proUserId' })
  proUser: User;

  @Column({ type: 'uuid' })
  proUserId: string;

  @OneToOne(() => User, { nullable: false, onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'clientUserId' })
  clientUser: User;

  @Column({ type: 'uuid' })
  clientUserId: string;

  @Column({ type: 'enum', enum: AccountLinkMethod })
  linkMethod: AccountLinkMethod;

  /** Preuve utilisée pour lier un compte client PRÉEXISTANT — null si "quick_create". */
  @Column({ type: 'enum', enum: AccountLinkVerification, nullable: true })
  verifiedVia: AccountLinkVerification | null;

  @Column({ type: 'enum', enum: AccountLinkStatus, default: AccountLinkStatus.ACTIVE })
  status: AccountLinkStatus;

  @Column({ type: 'timestamp' })
  linkedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
