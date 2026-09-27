/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/company-status-sync.subscriber.ts
 *
 * RÔLE : garder la VISIBILITÉ d'une boutique (Company.status) alignée sur
 * le statut du COMPTE de son propriétaire (User.status), quel que soit
 * l'endroit qui change ce dernier.
 *
 * BUG CORRIGÉ — deux statuts vivaient séparément :
 *   - l'administration valide / refuse / suspend / réactive le COMPTE
 *     (User.status) — admin-acteurs, super-admin, suspension automatique
 *     après signalements… (5 chemins différents) ;
 *   - les pages publiques n'affichent que les boutiques Company.status
 *     = 'active'.
 * Résultat : une entreprise VALIDÉE restait invisible (Company.status
 * toujours 'pending'), et une entreprise SUSPENDUE restait visible. La
 * seule façon d'apparaître était de se passer soi-même « active » dans les
 * paramètres — faille corrigée dans BoutiqueParametresService.updateBoutique.
 *
 * Règles (compte d'entreprise uniquement, et seulement quand le statut du
 * compte CHANGE) :
 *   compte → ACTIVE (validé, réactivé, débloqué)      ⇒ boutique visible
 *   compte → PENDING                                   ⇒ boutique en attente
 *   compte → SUSPENDED / BANNED / INACTIVE             ⇒ boutique masquée
 * Le propriétaire garde ensuite la main sur « visible / en pause » depuis
 * ses paramètres, tant que son compte est actif.
 *
 * Écoute les `save()` d'entités User (tous les chemins ci-dessus passent par
 * save), dans la même transaction que la modification du compte.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';

import { User, UserStatus } from 'src/database/entities/user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { Company, CompanyStatus } from 'src/database/entities/profiles/entreprise-profile.entity';

const TARGET: Partial<Record<UserStatus, CompanyStatus>> = {
  [UserStatus.ACTIVE]:    CompanyStatus.ACTIVE,
  [UserStatus.PENDING]:   CompanyStatus.PENDING,
  [UserStatus.SUSPENDED]: CompanyStatus.SUSPENDED,
  [UserStatus.BANNED]:    CompanyStatus.SUSPENDED,
  [UserStatus.INACTIVE]:  CompanyStatus.SUSPENDED,
};

@Injectable()
export class CompanyStatusSyncSubscriber implements EntitySubscriberInterface<User> {
  private readonly logger = new Logger(CompanyStatusSyncSubscriber.name);

  constructor(@InjectDataSource() dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return User;
  }

  async afterUpdate(event: UpdateEvent<User>): Promise<void> {
    const after  = event.entity as Partial<User> | undefined;
    const before = event.databaseEntity as User | undefined;
    if (!after || !before) return;

    const role   = (after.role ?? before.role) as UserRole | undefined;
    const status = after.status;
    if (role !== UserRole.COMPANY || !status || status === before.status) return;

    const target = TARGET[status];
    if (!target) return;

    const userId = (after.id ?? before.id) as string;
    const repo = event.manager.getRepository(Company);
    const result = await repo.update(
      { userId },
      target === CompanyStatus.ACTIVE ? { status: target, suspendedUntil: null } : { status: target },
    );
    if (result.affected) {
      this.logger.log(`[SYNC] Compte ${before.status} → ${status} ⇒ boutique ${target} — userId=${userId}`);
    }
  }
}
