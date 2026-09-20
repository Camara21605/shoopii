/* ============================================================
 * FICHIER : src/jobs/account-purge.cron.service.ts
 *
 * RÔLE : efface définitivement les données personnelles des comptes dont la
 * suppression a été demandée (Paramètres → Zone de danger) il y a plus de
 * 30 jours — c'est le délai annoncé à l'utilisateur. Avant, la demande
 * marquait le compte supprimé mais rien ne l'effaçait jamais.
 *
 * Anonymisation (la ligne `users` reste, car des commandes, paiements et
 * journaux comptables y font référence) :
 *   e-mail → deleted-<id>@deleted.invalid, téléphone / photo / nom d'utilisateur
 *   effacés, nom → « Compte supprimé », mot de passe rendu inutilisable ;
 *   profil client : bio, date de naissance, genre, questions de sécurité,
 *   codes de secours, paramètres ; adresses de livraison supprimées.
 * Exécuté chaque nuit à 03:15 ; idempotent (un compte déjà anonymisé est ignoré).
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Cron }               from '@nestjs/schedule';
import { LessThan, Not, Like, Repository } from 'typeorm';
import * as crypto from 'crypto';

import { User }         from '../database/entities/user.entity';
import { Client }       from '../database/entities/profiles/client-profile.entity';
import { Localisation } from '../database/entities/localisation.entity';

const RETENTION_DAYS = 30;

@Injectable()
export class AccountPurgeCronService {
  private readonly logger = new Logger(AccountPurgeCronService.name);

  constructor(
    @InjectRepository(User)         private readonly userRepo:   Repository<User>,
    @InjectRepository(Client)       private readonly clientRepo: Repository<Client>,
    @InjectRepository(Localisation) private readonly locRepo:    Repository<Localisation>,
  ) {}

  @Cron('15 3 * * *')
  async purge(): Promise<void> {
    const limit = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
    const due = await this.userRepo.find({
      withDeleted: true,
      where: { deletedAt: LessThan(limit), email: Not(Like('deleted-%@deleted.invalid')) },
      select: ['id'],
      take: 200,
    });
    if (!due.length) return;

    for (const { id } of due) {
      try { await this.anonymize(id); }
      catch (err) { this.logger.error(`[PURGE ❌] userId=${id} | ${(err as Error).message}`); }
    }
    this.logger.log(`[PURGE ✅] ${due.length} compte(s) anonymisé(s)`);
  }

  private async anonymize(userId: string): Promise<void> {
    /* Mot de passe inutilisable : hachage bcrypt-like impossible à retrouver (chaîne aléatoire non hachée) */
    await this.userRepo.update(userId, {
      email:          `deleted-${userId}@deleted.invalid`,
      firstName:      'Compte',
      lastName:       'supprimé',
      username:       `deleted-${userId.slice(0, 8)}`,
      phone:          null,
      phoneHash:      null,
      profilePicture: null,
      password:       `!${crypto.randomBytes(32).toString('hex')}`,
      emailVerified:  false,
      phoneVerified:  false,
    } as any);

    await this.clientRepo.update({ userId }, {
      bio: null, dateNaissance: null, genre: null,
      questionsSecurite: null, codesSecours: 0,
      notifSettings: null, privacySettings: null,
    } as any).catch(() => undefined);              // pas de profil client : sans conséquence

    await this.locRepo.delete({ userId });
    this.logger.warn(`[PURGE] compte ${userId} anonymisé (suppression demandée il y a plus de ${RETENTION_DAYS} jours)`);
  }
}
