/* ============================================================
 * FICHIER      : src/modules/company-team/events/company-team.events.ts
 * MODULE       : Company Team
 * ROLE         : Définit les événements publiés par le système d'équipe.
 *
 * CONSOMMATEURS :
 *   - NotificationsModule — envoie des notifications au propriétaire et au membre
 *   - ReportingEngine     — intègre les événements dans les rapports
 *   - AuditService        — complète le journal d'audit
 *
 * UTILISATION :
 *   this.eventEmitter.emit('team.member.created', new TeamMemberCreatedEvent(...))
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

/* ── Constantes événement ────────────────────────────────────── */
export const TEAM_EVENTS = {
  MEMBER_CREATED:      'team.member.created',
  MEMBER_UPDATED:      'team.member.updated',
  MEMBER_SUSPENDED:    'team.member.suspended',
  MEMBER_REACTIVATED:  'team.member.reactivated',
  MEMBER_DELETED:      'team.member.deleted',
  PERMISSION_UPDATED:  'team.permission.updated',
  MEMBER_LOGGED_IN:    'team.member.logged_in',
  MEMBER_LOGGED_OUT:   'team.member.logged_out',
  PASSWORD_RESET:      'team.password.reset',
} as const;

/* ── Classes d'événements ────────────────────────────────────── */

export class TeamMemberCreatedEvent {
  constructor(
    public readonly companyId:    string,
    public readonly memberId:     string,
    public readonly memberUserId: string,
    public readonly memberEmail:  string,
    public readonly memberName:   string,
    public readonly createdById:  string,
  ) {}
}

export class TeamMemberUpdatedEvent {
  constructor(
    public readonly companyId:  string,
    public readonly memberId:   string,
    public readonly changes:    Record<string, unknown>,
    public readonly updatedById: string,
  ) {}
}

export class TeamMemberSuspendedEvent {
  constructor(
    public readonly companyId:   string,
    public readonly memberId:    string,
    public readonly memberEmail: string,
    public readonly memberName:  string,
    public readonly reason:      string | null,
    public readonly suspendedById: string,
  ) {}
}

export class TeamMemberReactivatedEvent {
  constructor(
    public readonly companyId:     string,
    public readonly memberId:      string,
    public readonly memberEmail:   string,
    public readonly memberName:    string,
    public readonly reactivatedById: string,
  ) {}
}

export class TeamMemberDeletedEvent {
  constructor(
    public readonly companyId:   string,
    public readonly memberId:    string,
    public readonly memberEmail: string,
    public readonly deletedById: string,
  ) {}
}

export class TeamPermissionUpdatedEvent {
  constructor(
    public readonly companyId:   string,
    public readonly memberId:    string,
    public readonly memberEmail: string,
    public readonly before:      Record<string, unknown>,
    public readonly after:       Record<string, unknown>,
    public readonly updatedById: string,
  ) {}
}

export class TeamMemberLoggedInEvent {
  constructor(
    public readonly companyId:  string,
    public readonly memberId:   string,
    public readonly userId:     string,
    public readonly ipAddress:  string | null,
  ) {}
}

export class TeamPasswordResetEvent {
  constructor(
    public readonly companyId:   string,
    public readonly memberId:    string,
    public readonly memberEmail: string,
    public readonly memberName:  string,
    public readonly resetById:   string,
  ) {}
}
