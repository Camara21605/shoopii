/* ============================================================
 * FICHIER : messaging-permissions.module.ts
 *
 * RÔLE : Module NestJS qui déclare et wire le moteur de permissions
 *        avec tous ses évaluateurs et services.
 *
 * AJOUTER UN NOUVEL ÉVALUATEUR :
 *   1. Créer MyNewEvaluator dans evaluators/
 *   2. L'ajouter dans le tableau evaluators ci-dessous
 *   3. C'est tout — zéro modification du moteur
 * ============================================================ */

import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/* Entités */
import { MessagingAuditLog } from 'src/database/entities/messaging/messaging-audit-log.entity';
import { UserContact }       from 'src/database/entities/contacts/user-contact.entity';
import { Follow }            from 'src/database/entities/follow/follow.entity';
import { Commande }          from 'src/database/entities/commande/commande.entity';

/* Évaluateurs */
import { ClientClientEvaluator }                 from './evaluators/client-client.evaluator';
import { ClientCompanyEvaluator }                from './evaluators/client-company.evaluator';
import { CompanyClientEvaluator }                from './evaluators/company-client.evaluator';
import { CompanyDeliveryEvaluator }              from './evaluators/company-delivery.evaluator';
import { DeliveryDeliveryEvaluator }             from './evaluators/delivery-delivery.evaluator';
import { CorrespondentCorrespondentEvaluator }   from './evaluators/correspondent-correspondent.evaluator';
import { PartnerAsSourceEvaluator, PartnerAsTargetEvaluator } from './evaluators/partner.evaluator';

/* Services */
import { PermissionCacheService }     from './permission-cache.service';
import { MessagingAuditService }      from './messaging-audit.service';
import { MessagingPermissionEngine }  from './messaging-permission.engine';
import { PERMISSION_EVALUATORS }      from './interfaces/permission-evaluator.interface';

const evaluatorClasses = [
  ClientClientEvaluator,
  ClientCompanyEvaluator,
  CompanyClientEvaluator,
  CompanyDeliveryEvaluator,
  DeliveryDeliveryEvaluator,
  CorrespondentCorrespondentEvaluator,
  PartnerAsSourceEvaluator,
  PartnerAsTargetEvaluator,
];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessagingAuditLog,
      UserContact,
      Follow,
      Commande,
    ]),
  ],
  providers: [
    /* Évaluateurs individuels */
    ...evaluatorClasses,

    /*
     * Tableau d'évaluateurs injecté dans le moteur.
     * Utilise useFactory pour construire le tableau depuis le DI container.
     *
     * POURQUOI useFactory plutôt que useValue :
     *   useValue n'injecte pas les dépendances (Follow, Commande repos).
     *   useFactory résout d'abord toutes les instances du DI, puis les passe.
     */
    {
      provide:    PERMISSION_EVALUATORS,
      useFactory: (
        cc:  ClientClientEvaluator,
        cco: ClientCompanyEvaluator,
        co:  CompanyClientEvaluator,
        cd:  CompanyDeliveryEvaluator,
        dd:  DeliveryDeliveryEvaluator,
        cr:  CorrespondentCorrespondentEvaluator,
        ps:  PartnerAsSourceEvaluator,
        pt:  PartnerAsTargetEvaluator,
      ) => [cc, cco, co, cd, dd, cr, ps, pt],
      inject: evaluatorClasses,
    },

    PermissionCacheService,
    MessagingAuditService,
    MessagingPermissionEngine,
  ],
  exports: [
    MessagingPermissionEngine,
    PermissionCacheService,
    MessagingAuditService,
  ],
})
export class MessagingPermissionsModule {}
