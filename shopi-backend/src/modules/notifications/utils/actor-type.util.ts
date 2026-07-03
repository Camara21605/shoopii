import { NotificationActorType } from 'src/database/entities/notification/notification.entitiy';

/** Mapping rôle JWT → NotificationActorType.
 *  Source unique de vérité — utilisée par le controller ET le gateway. */
export const ROLE_TO_ACTOR_TYPE: Record<string, NotificationActorType> = {
  company:       NotificationActorType.COMPANY,
  client:        NotificationActorType.CLIENT,
  delivery:      NotificationActorType.DELIVERY,
  correspondent: NotificationActorType.CORRESPONDENT,
  partner:       NotificationActorType.PARTNER,
  admin:         NotificationActorType.ADMIN,
  super_admin:   NotificationActorType.SUPER_ADMIN,
};
