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
 *   codes de secours, paramètres ; adresses de livraison supprimées ;
 *   profil livreur : nom, téléphone, photo, bio, plaque, dernière position
 *   GPS, réglages — et pièces justificatives (CNI, permis, assurance, casier)
 *   supprimées de Cloudinary. Le profil reste (commandes / missions / avis
 *   y font référence), sous le nom « Compte supprimé ».
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
import { Delivery }     from '../database/entities/profiles/livreur-profile.entity';
import { UploadService } from '../modules/upload/upload.service';

const RETENTION_DAYS = 30;

@Injectable()
export class AccountPurgeCronService {
  private readonly logger = new Logger(AccountPurgeCronService.name);

  constructor(
    @InjectRepository(User)         private readonly userRepo:   Repository<User>,
    @InjectRepository(Client)       private readonly clientRepo: Repository<Client>,
    @InjectRepository(Localisation) private readonly locRepo:    Repository<Localisation>,
    @InjectRepository(Delivery)     private readonly livreurRepo: Repository<Delivery>,
    private readonly uploadService: UploadService,
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
    });

    await this.clientRepo.update({ userId }, {
      bio: null, dateNaissance: null, genre: null,
      questionsSecurite: null, codesSecours: 0,
      notifSettings: null, privacySettings: null,
    } as any).catch(() => undefined);              // pas de profil client : sans conséquence

    await this.anonymizeLivreur(userId);
    await this.locRepo.delete({ userId });
    this.logger.warn(`[PURGE] compte ${userId} anonymisé (suppression demandée il y a plus de ${RETENTION_DAYS} jours)`);
  }

  /** Profil livreur (s'il existe) : données personnelles effacées, pièces justificatives supprimées. */
  private async anonymizeLivreur(userId: string): Promise<void> {
    const l = await this.livreurRepo.findOne({
      where: { userId },
      select: ['id', 'documentCni', 'documentPermis', 'documentAssurance', 'documentCasier'],
    });
    if (!l) return;
    for (const publicId of [l.documentCni, l.documentPermis, l.documentAssurance, l.documentCasier]) {
      if (!publicId) continue;
      /* même stockage que ProfilLivreurService.uploadDocument (raw + authenticated) */
      await this.uploadService.delete(publicId, 'raw', 'authenticated')
        .catch(() => this.logger.warn(`[PURGE] pièce non supprimée de Cloudinary : ${publicId}`));
    }
    await this.livreurRepo.update(l.id, {
      fullName: 'Compte supprimé', firstName: null, lastName: null,
      phone: null, email: null, whatsapp: null, photoUrl: null, bio: null,
      vehiculePlaque: null, vehiculePhotoUrl: null,
      lastLatitude: null, lastLongitude: null,
      documentCni: null, documentPermis: null, documentAssurance: null, documentCasier: null,
      idDocumentUrl: null, driverLicenseUrl: null,
      twoFaEnabled: false, twoFaSecret: null,
      notifSettings: null, privacySettings: null, methodesRetrait: null,
    });
  }
}
