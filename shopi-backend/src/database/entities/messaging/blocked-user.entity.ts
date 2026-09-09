/* ============================================================
 * FICHIER : src/database/entities/messaging/blocked-user.entity.ts
 *
 * RÔLE : Blocage entre deux utilisateurs dans la messagerie.
 *
 * BUG CORRIGÉ — le bouton "Bloquer le contact" de InfoPanel.tsx était un
 * stub (toast factice). La table user_contacts (voir user-contact.entity.ts)
 * existait déjà avec un champ isBlocked, mais elle est conçue pour la
 * découverte de contacts par numéro de téléphone (clé unique
 * ownerUserId+phoneHash) — bloquer quelqu'un depuis une conversation
 * n'implique pas forcément que son numéro ait déjà été synchronisé,
 * donc aucune ligne n'existerait à mettre à jour. Cette table dédiée,
 * indépendante de la synchro de contacts, couvre le cas général.
 *
 * Un blocage dans UN SENS suffit à bloquer l'envoi dans les DEUX sens
 * (voir MessagerieService.sendMessage) — comportement volontairement
 * simple : pas de "message envoyé mais jamais reçu" silencieux.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index, Unique,
} from 'typeorm';

@Unique('UQ_blocked_pair', ['blockerUserId', 'blockedUserId'])
@Index('IDX_blocked_blocker', ['blockerUserId'])
@Index('IDX_blocked_blocked', ['blockedUserId'])
@Entity('blocked_users')
export class BlockedUser {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** users.id de la personne qui bloque. */
  @Column({ type: 'uuid' })
  blockerUserId: string;

  /** users.id de la personne bloquée. */
  @Column({ type: 'uuid' })
  blockedUserId: string;

  @CreateDateColumn()
  createdAt: Date;
}
