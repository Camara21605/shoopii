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
import { Correspondent }     from 'src/database/entities/profiles/correspondant-profile.entity';

/* Évaluateurs */
import { ClientClientEvaluator }                 from './evaluators/client-client.evaluator';
import { ClientCompanyEvaluator }                from './evaluators/client-company.evaluator';
import { CompanyClientEvaluator }                from './evaluators/company-client.evaluator';
import { CompanyDeliveryEvaluator }              from './evaluators/company-delivery.evaluator';
import { DeliveryCompanyEvaluator }              from './evaluators/delivery-company.evaluator';
import { DeliveryDeliveryEvaluator }             from './evaluators/delivery-delivery.evaluator';
import { CorrespondentCorrespondentEvaluator }   from './evaluators/correspondent-correspondent.evaluator';
import { DeliveryCorrespondentEvaluator }        from './evaluators/delivery-correspondent.evaluator';
import { CorrespondentDeliveryEvaluator }        from './evaluators/correspondent-delivery.evaluator';
import { CompanyCorrespondentEvaluator }         from './evaluators/company-correspondent.evaluator';
import { CorrespondentCompanyEvaluator }         from './evaluators/correspondent-company.evaluator';
import { ClientDeliveryEvaluator }               from './evaluators/client-delivery.evaluator';
import { DeliveryClientEvaluator }               from './evaluators/delivery-client.evaluator';
import { ClientCorrespondentEvaluator }          from './evaluators/client-correspondent.evaluator';
import { CorrespondentClientEvaluator }          from './evaluators/correspondent-client.evaluator';
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
  DeliveryCompanyEvaluator,
  DeliveryDeliveryEvaluator,
  CorrespondentCorrespondentEvaluator,
  DeliveryCorrespondentEvaluator,
  CorrespondentDeliveryEvaluator,
  CompanyCorrespondentEvaluator,
  CorrespondentCompanyEvaluator,
  ClientDeliveryEvaluator,
  DeliveryClientEvaluator,
  ClientCorrespondentEvaluator,
  CorrespondentClientEvaluator,
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
      Correspondent,
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
        dc:  DeliveryCompanyEvaluator,
        dd:  DeliveryDeliveryEvaluator,
        cr:  CorrespondentCorrespondentEvaluator,
        dcr: DeliveryCorrespondentEvaluator,
        crd: CorrespondentDeliveryEvaluator,
        ccr: CompanyCorrespondentEvaluator,
        crc: CorrespondentCompanyEvaluator,
        cld: ClientDeliveryEvaluator,
        dcl: DeliveryClientEvaluator,
        clcr: ClientCorrespondentEvaluator,
        crcl: CorrespondentClientEvaluator,
        ps:  PartnerAsSourceEvaluator,
        pt:  PartnerAsTargetEvaluator,
      ) => [cc, cco, co, cd, dc, dd, cr, dcr, crd, ccr, crc, cld, dcl, clcr, crcl, ps, pt],
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
