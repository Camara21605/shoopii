/* ============================================================
 * FICHIER : src/modules/contact-directory/contact-joined.service.ts
 * MODULE : ContactDirectoryModule
 * ROLE : « X a rejoint Shoneya » — comme Telegram : quand un numéro qui figure
 *        dans le répertoire synchronisé d'autres utilisateurs crée un compte,
 *        ces utilisateurs sont prévenus et peuvent lui écrire d'un toucher.
 * RESPONSABILITES :
 *   - relier les lignes user_contacts encore sans compte (matchedUserId NULL)
 *     au nouveau compte : l'onglet Contacts l'affiche aussitôt ;
 *   - notifier chaque propriétaire de répertoire UNE fois (dans l'app + push),
 *     avec le nom qu'il a lui-même donné au contact ;
 *   - ne jamais bloquer ni faire échouer une inscription (appel « fire and
 *     forget », erreurs journalisées).
 * POURQUOI seulement les lignes sans compte : un numéro déjà relié (ex. le
 *   compte client lié d'un professionnel, même numéro) n'est pas un nouvel
 *   arrivant — pas de seconde notification.
 * VIE PRIVÉE : aucun numéro en clair — seule l'empreinte SHA-256 (users.phoneHash,
 *   même calcul que le répertoire mobile) est comparée.
 * DEPENDANCES : TypeORM (UserContact, User), NotificationService, ContactDirectoryService
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-10-18
 * ============================================================ */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';

import { UserContact } from 'src/database/entities/contacts/user-contact.entity';
import { User } from 'src/database/entities/user.entity';
import {
  NotificationActorType, NotificationPriority, NotificationType,
} from 'src/database/entities/notification/notification.entity';
import { NotificationService } from 'src/modules/notifications/services/notification.service';

import { ContactDirectoryService } from './contact-directory.service';

/** Plafond par inscription : un numéro très partagé ne doit pas saturer la file. */
const MAX_NOTIFIED = 500;

@Injectable()
export class ContactJoinedService {
  private readonly logger = new Logger(ContactJoinedService.name);

  constructor(
    @InjectRepository(UserContact) private readonly contactRepo: Repository<UserContact>,
    @InjectRepository(User)        private readonly userRepo:    Repository<User>,
    private readonly directory:     ContactDirectoryService,
    private readonly notifications: NotificationService,
  ) {}

  /** À appeler après la création d'un compte (ou un changement de numéro). Ne lève jamais. */
  notifyLater(userId: string): void {
    setImmediate(() => {
      this.onAccountWithPhone(userId).catch(err =>
        this.logger.error(`[ContactJoined] userId=${userId} | ${(err as Error).message}`),
      );
    });
  }

  async onAccountWithPhone(userId: string): Promise<number> {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'phoneHash'] as (keyof User)[] });
    const hash = user?.phoneHash;
    if (!hash) return 0;

    /* Répertoires qui contiennent ce numéro sans le connaître encore sur Shoneya */
    const rows = await this.contactRepo.find({
      where:  { phoneHash: hash, matchedUserId: IsNull(), isBlocked: false, ownerUserId: Not(userId) },
      select: ['id', 'ownerUserId', 'displayName'],
      take:   MAX_NOTIFIED,
    });
    if (rows.length === 0) return 0;

    await this.contactRepo.update({ id: In(rows.map(r => r.id)) }, { matchedUserId: userId, matchedAt: new Date() });

    const me = (await this.directory.cardsFor([userId])).get(userId);
    if (!me) return 0;   // compte sans profil joignable : relié, mais rien à proposer
    const owners = await this.directory.cardsFor(rows.map(r => r.ownerUserId));

    let sent = 0;
    for (const row of rows) {
      const owner = owners.get(row.ownerUserId);
      if (!owner) continue;
      const local = row.displayName?.trim();
      const title = `${me.name} est sur Shoneya`;
      const body = local && local.toLowerCase() !== me.name.toLowerCase()
        ? `Votre contact « ${local.slice(0, 60)} » vient de rejoindre Shoneya. Envoyez-lui un message 👋`
        : 'Un de vos contacts vient de rejoindre Shoneya. Envoyez-lui un message 👋';
      try {
        await this.notifications.create({
          recipientType: owner.type as unknown as NotificationActorType,
          recipientId:   owner.id,
          actorType:     me.type as unknown as NotificationActorType,
          actorId:       me.id,
          type:          NotificationType.CONTACT_JOINED,
          priority:      NotificationPriority.NORMAL,
          title:         title.slice(0, 100),
          body:          body.slice(0, 255),
          imageUrl:      me.logo,
          actionUrl:     '/messagerie',
          payload:       { targetType: me.type, targetId: me.id },
          groupKey:      `contact.joined:${me.userId}`,
        });
        sent++;
      } catch (err) {
        this.logger.warn(`[ContactJoined] notification non envoyée à ${row.ownerUserId} | ${(err as Error).message}`);
      }
    }
    this.logger.log(`[ContactJoined] userId=${userId} → ${rows.length} répertoire(s), ${sent} notification(s)`);
    return sent;
  }
}
