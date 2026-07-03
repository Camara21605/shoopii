/* ============================================================
 * FICHIER : contact-matching.service.ts
 *
 * RÔLE : Fait correspondre les hashes de numéros de téléphone
 *        avec les utilisateurs enregistrés sur Shopi.
 *
 * PROTECTION VIE PRIVÉE :
 *   - Le client envoie des SHA-256 de numéros normalisés
 *   - Le serveur compare avec users.phoneHash (même format)
 *   - Jamais de numéro en clair côté serveur
 *
 * NORMALISATION (côté client mobile) :
 *   1. Lire le numéro brut du répertoire    → "0620 00 00 00"
 *   2. Retirer espaces, tirets, points      → "062000000"
 *   3. Ajouter l'indicatif pays (détecté)  → "+33620000000"
 *   4. Format E.164 strict                 → "+33620000000"
 *   5. SHA-256 du string E.164             → "a3f9c2..."
 *
 * PERFORMANCE :
 *   Batch SQL unique avec IN clause sur les hashes.
 *   Index sur users.phoneHash (VARCHAR(64)).
 *   Max 10 000 hashes par requête → split en batches de 500.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { In, Repository }     from 'typeorm';
import { User }               from 'src/database/entities/user.entity';
import { UserContact }        from 'src/database/entities/contacts/user-contact.entity';
import { PresenceService }    from 'src/modules/messagerie/services/presence.service';
import type { SyncedContactDto } from './dto/sync-contacts.dto';

const BATCH_SIZE = 500;

@Injectable()
export class ContactMatchingService {
  private readonly logger = new Logger(ContactMatchingService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(UserContact)
    private readonly contactRepo: Repository<UserContact>,

    private readonly presence: PresenceService,
  ) {}

  /**
   * Trouve quels hashes correspondent à des utilisateurs Shopi.
   *
   * @param hashes  - Liste de SHA-256 de numéros E.164
   * @param ownerUserId - userId du propriétaire du répertoire
   * @returns Map<hash → SyncedContactDto>
   */
  async matchHashes(
    hashes: string[],
    ownerUserId: string,
  ): Promise<Map<string, SyncedContactDto>> {
    const result = new Map<string, SyncedContactDto>();

    if (hashes.length === 0) return result;

    /* ── Traitement par batch ────────────────────────────── */
    for (let i = 0; i < hashes.length; i += BATCH_SIZE) {
      const batch   = hashes.slice(i, i + BATCH_SIZE);
      const matched = await this.matchBatch(batch, ownerUserId);
      matched.forEach((v, k) => result.set(k, v));
    }

    return result;
  }

  // ── Batch interne ────────────────────────────────────────────

  private async matchBatch(
    hashes: string[],
    _ownerUserId: string,
  ): Promise<Map<string, SyncedContactDto>> {
    const result = new Map<string, SyncedContactDto>();

    /* Recherche directe sur phoneHash */
    const users = await this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.client', 'cl')
      .leftJoinAndSelect('u.company', 'co')
      .where('u.phoneHash IN (:...hashes)', { hashes })
      .select([
        'u.id', 'u.phoneHash', 'u.role', 'u.firstName', 'u.lastName',
        'cl.id', 'co.id', 'co.companyName', 'co.logo',
      ])
      .getMany();

    /* Récupérer présence en batch */
    const userIds = users.map(u => u.id);
    const presenceMap = userIds.length > 0
      ? await this.presence.getBulkPresence(userIds)
      : new Map();

    for (const u of users) {
      if (!u.phoneHash) continue;

      const online    = presenceMap.get(u.id)?.online ?? false;
      const actorType = u.role ?? 'client';

      /* Nom d'affichage selon le rôle */
      let displayName: string;
      let avatar: string | null = null;

      if (u.role === 'company' && (u as any).company) {
        displayName = (u as any).company.companyName ?? 'Boutique';
        avatar      = (u as any).company.logo ?? null;
      } else {
        displayName = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'Utilisateur';
      }

      result.set(u.phoneHash, {
        hash:        u.phoneHash,
        userId:      u.id,
        displayName,
        avatar,
        actorType,
        online,
      });
    }

    return result;
  }

  // ── Persistance des contacts matchés ─────────────────────────

  /**
   * Met à jour la table user_contacts avec les nouveaux matches.
   * Utilise INSERT ... ON CONFLICT DO UPDATE pour la sync incrémentale.
   *
   * @returns Nombre de nouveaux matches
   */
  async persistMatches(
    ownerUserId: string,
    contacts: Array<{ hash: string; displayName?: string }>,
    matchMap: Map<string, SyncedContactDto>,
  ): Promise<number> {
    let newMatches = 0;

    /* Récupère les contacts existants pour comparaison */
    const existingHashes = new Set(
      (await this.contactRepo.find({
        where:  { ownerUserId },
        select: ['phoneHash'],
      })).map(c => c.phoneHash),
    );

    const toUpsert: Partial<UserContact>[] = [];

    for (const { hash, displayName } of contacts) {
      const matched = matchMap.get(hash);
      const isNew   = !existingHashes.has(hash);

      if (isNew) newMatches++;

      toUpsert.push({
        ownerUserId,
        phoneHash:      hash,
        displayName:    displayName ?? null,
        matchedUserId:  matched?.userId ?? null,
        matchedAt:      matched ? new Date() : null,
      });
    }

    /* Upsert batch */
    if (toUpsert.length > 0) {
      await this.contactRepo
        .createQueryBuilder()
        .insert()
        .into(UserContact)
        .values(toUpsert)
        .orUpdate(['displayName', 'matchedUserId', 'matchedAt', 'updatedAt'], ['ownerUserId', 'phoneHash'])
        .execute();
    }

    return newMatches;
  }

  // ── Lookup rapide ────────────────────────────────────────────

  /**
   * Vérifie si deux utilisateurs ont un contact mutuel.
   * Utilisé par ClientClientEvaluator (en backup si cache Redis miss).
   */
  async hasMutualContact(userIdA: string, userIdB: string): Promise<boolean> {
    const count = await this.contactRepo
      .createQueryBuilder('c')
      .where(
        '(c.ownerUserId = :a AND c.matchedUserId = :b AND c.isBlocked = false)' +
        ' OR (c.ownerUserId = :b AND c.matchedUserId = :a AND c.isBlocked = false)',
        { a: userIdA, b: userIdB },
      )
      .getCount();

    return count > 0;
  }
}
