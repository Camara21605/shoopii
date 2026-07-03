/* ============================================================
 * FICHIER : user-contact.entity.ts
 *
 * RÔLE : Contacts téléphoniques importés d'un utilisateur,
 *        similaire à WhatsApp Contact Discovery.
 *
 * PROTECTION VIE PRIVÉE :
 *   On ne stocke JAMAIS le numéro de téléphone en clair.
 *   Seul le SHA-256 du numéro normalisé (E.164) est stocké.
 *
 *   Client : hash("233244123456") → "a3f9c2..."
 *   Serveur : compare avec la table users.phoneHash
 *
 *   Cela empêche toute reconstruction du répertoire même
 *   en cas de fuite de la table user_contacts.
 *
 * FLOW :
 *   1. Mobile importe les contacts → normalise → hash SHA-256
 *   2. Envoie SEULEMENT les hashes au serveur
 *   3. Serveur compare avec users.phoneHash
 *   4. Retourne les matchedUserId (sans révéler les numéros)
 *
 * SYNC INCRÉMENTALE :
 *   Seuls les hashes nouveaux/modifiés depuis lastSyncAt
 *   sont renvoyés au serveur.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  Index, Unique,
} from 'typeorm';

@Unique('UQ_contact_owner_hash', ['ownerUserId', 'phoneHash'])
@Index('IDX_contact_owner',   ['ownerUserId'])
@Index('IDX_contact_matched', ['matchedUserId'])
@Entity('user_contacts')
export class UserContact {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* Propriétaire du répertoire (users.id) */
  @Column({ type: 'uuid' })
  ownerUserId: string;

  /* SHA-256 du numéro normalisé en E.164 (ex: +224620000000 → hash) */
  @Column({ type: 'varchar', length: 64 })
  phoneHash: string;

  /* Nom d'affichage local du contact (optionnel, fourni par le client) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  displayName: string | null;

  /* UUID de l'utilisateur Shopi correspondant (null si pas encore inscrit) */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  matchedUserId: string | null;

  /* Quand le match a été trouvé */
  @Column({ type: 'timestamp', nullable: true })
  matchedAt: Date | null;

  /* Bloqué par le propriétaire du répertoire */
  @Column({ type: 'boolean', default: false })
  isBlocked: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
