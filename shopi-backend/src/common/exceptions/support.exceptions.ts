/* ============================================================
 * FICHIER  : src/common/exceptions/support.exceptions.ts
 * MODULE   : Common / Exceptions
 * ROLE     : Exceptions métier du module Support.
 *
 * RESPONSABILITES :
 *   - Centralise les erreurs liées aux tickets, messages et pièces jointes.
 *   - Chaque exception expose : message (FR), errorCode (machine-readable).
 *   - Les errorCodes permettent aux clients i18n de traduire sans parser
 *     le message humain — prépare l'internationalisation future.
 *
 * CONVENTION errorCode :
 *   DOMAINE_ACTION_RAISON en SCREAMING_SNAKE_CASE.
 *   Exemples : TICKET_NOT_FOUND, ATTACHMENT_TYPE_NOT_ALLOWED.
 *   Le code est stable (ne change jamais) même si le message humain évolue.
 *
 * SECURITE :
 *   Aucune information interne (stack trace, SQL, UUIDs internes) n'est
 *   exposée dans les messages — OWASP A09:2021 Security Logging.
 *
 * DEPENDANCES :
 *   - @nestjs/common (HttpException, HttpStatus)
 *
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-04
 * ============================================================ */

import { HttpException, HttpStatus } from '@nestjs/common';

/* ─── Tickets ──────────────────────────────────────────────── */

export class TicketNotFoundException extends HttpException {
  constructor(ticketId: string) {
    super(
      {
        message:   `Ticket introuvable ou accès non autorisé.`,
        errorCode: 'TICKET_NOT_FOUND',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class TicketAlreadyClosedException extends HttpException {
  constructor() {
    super(
      {
        message:   'Ce ticket est déjà fermé. Ouvrez un nouveau ticket si le problème persiste.',
        errorCode: 'TICKET_ALREADY_CLOSED',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class TicketNotOwnedException extends HttpException {
  constructor() {
    super(
      {
        message:   'Vous n\'êtes pas autorisé à accéder à ce ticket.',
        errorCode: 'TICKET_ACCESS_DENIED',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class TicketReferenceConflictException extends HttpException {
  constructor(reference: string) {
    super(
      {
        message:   `La référence de ticket est déjà utilisée. Veuillez réessayer.`,
        errorCode: 'TICKET_REFERENCE_CONFLICT',
      },
      HttpStatus.CONFLICT,
    );
  }
}

/* ─── Messages ─────────────────────────────────────────────── */

export class MessageNotFoundException extends HttpException {
  constructor(messageId: string) {
    super(
      {
        message:   'Message introuvable.',
        errorCode: 'MESSAGE_NOT_FOUND',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * Levée quand messageId est valide mais n'appartient pas au ticketId fourni.
 * Protège contre les attaques IDOR cross-ticket (OWASP A01:2021).
 * Le message volontairement vague ne révèle pas l'existence des autres tickets.
 */
export class MessageNotInTicketException extends HttpException {
  constructor(messageId: string, ticketId: string) {
    super(
      {
        message:   'Accès non autorisé à ce message.',
        errorCode: 'MESSAGE_ACCESS_DENIED',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

/**
 * Levée quand un client tente de supprimer une pièce jointe
 * qu'il n'a pas uploadée lui-même. (OWASP A01:2021 — IDOR)
 */
export class AttachmentNotOwnedException extends HttpException {
  constructor() {
    super(
      {
        message:   'Vous ne pouvez supprimer que les pièces jointes que vous avez envoyées.',
        errorCode: 'ATTACHMENT_ACCESS_DENIED',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class InternalMessageForbiddenException extends HttpException {
  constructor() {
    super(
      {
        message:   'Les notes internes sont réservées aux agents support.',
        errorCode: 'INTERNAL_MESSAGE_FORBIDDEN',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

/* ─── Pièces jointes ───────────────────────────────────────── */

export class AttachmentNotFoundException extends HttpException {
  constructor(attachmentId: string) {
    super(
      {
        message:   'Pièce jointe introuvable.',
        errorCode: 'ATTACHMENT_NOT_FOUND',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class AttachmentTooLargeException extends HttpException {
  constructor(filename: string, sizeBytes: number, maxBytes: number) {
    const sizeMB  = (sizeBytes  / 1_048_576).toFixed(1);
    const limitMB = (maxBytes   / 1_048_576).toFixed(0);
    super(
      {
        message:   `Le fichier (${sizeMB} MB) dépasse la taille maximale autorisée de ${limitMB} MB.`,
        errorCode: 'ATTACHMENT_TOO_LARGE',
        meta:      { sizeMB: parseFloat(sizeMB), limitMB: parseInt(limitMB, 10) },
      },
      HttpStatus.PAYLOAD_TOO_LARGE,
    );
  }
}

export class AttachmentTypeNotAllowedException extends HttpException {
  constructor(filename: string, mimeType: string) {
    super(
      {
        message:   'Ce format de fichier n\'est pas autorisé. Formats acceptés : PDF, PNG, JPG, WebP, MP4.',
        errorCode: 'ATTACHMENT_TYPE_NOT_ALLOWED',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class AttachmentUploadFailedException extends HttpException {
  constructor() {
    super(
      {
        message:   'L\'upload du fichier a échoué. Veuillez réessayer dans quelques instants.',
        errorCode: 'ATTACHMENT_UPLOAD_FAILED',
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}

/* ─── SLA ──────────────────────────────────────────────────── */

export class SlaAlreadyBreachedException extends HttpException {
  constructor(ticketRef: string) {
    super(
      {
        message:   'Le SLA de ce ticket est déjà marqué comme dépassé.',
        errorCode: 'SLA_ALREADY_BREACHED',
      },
      HttpStatus.CONFLICT,
    );
  }
}

/* ─── CSAT ─────────────────────────────────────────────────── */

export class CsatAlreadySubmittedException extends HttpException {
  constructor() {
    super(
      {
        message:   'Vous avez déjà soumis une évaluation pour ce ticket.',
        errorCode: 'CSAT_ALREADY_SUBMITTED',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class CsatNotAllowedException extends HttpException {
  constructor() {
    super(
      {
        message:   'L\'évaluation n\'est disponible que pour les tickets résolus ou fermés.',
        errorCode: 'CSAT_NOT_ALLOWED',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
