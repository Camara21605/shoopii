/* ============================================================
 * FICHIER  : src/modules/contact/services/contact-escalation.service.ts
 * ROLE     : Conversion d'un message de contact en ticket de support.
 *
 * RESPONSABILITES :
 *   - Récupérer le ContactMessage par id.
 *   - Garantir l'idempotence (ne pas créer deux fois le même ticket).
 *   - Mapper ContactMessageType → SupportTicketType.
 *   - Déléguer la création du ticket à SupportService.
 *   - Lier le ContactMessage au ticket créé (supportTicketId).
 *
 * DEPENDANCES :
 *   - ContactMessage  (InjectRepository)
 *   - SupportService  (crée le ticket côté support)
 *
 * DESIGN :
 *   Séparé de ContactService (soumission + liste + markRead) pour respecter
 *   le principe de responsabilité unique (SRP).
 *   Injecté directement dans ContactController pour la route d'escalade.
 * ============================================================ */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import {
  ContactMessage,
  ContactMessageStatus,
  ContactMessageType,
} from '../../../database/entities/contact/contact-message.entity';
import {
  SupportTicketType,
} from '../../../database/entities/support/support-ticket.entity';
import { SupportService } from '../../support/services/support.service';

/* Mapping ContactMessageType → SupportTicketType.
 * Les types sans équivalent tombent sur GENERAL (fallback). */
const TYPE_MAP: Partial<Record<ContactMessageType, SupportTicketType>> = {
  [ContactMessageType.BILLING]:     SupportTicketType.BILLING,
  [ContactMessageType.SECURITY]:    SupportTicketType.FRAUD,
  [ContactMessageType.GENERAL]:     SupportTicketType.GENERAL,
  [ContactMessageType.PARTNERSHIP]: SupportTicketType.GENERAL,
  [ContactMessageType.PRESS]:       SupportTicketType.GENERAL,
  [ContactMessageType.OTHER]:       SupportTicketType.GENERAL,
};

@Injectable()
export class ContactEscalationService {
  private readonly logger = new Logger(ContactEscalationService.name);

  constructor(
    @InjectRepository(ContactMessage)
    private readonly contactRepo:   Repository<ContactMessage>,
    private readonly supportService: SupportService,
  ) {}

  /* ── Escalade d'un message de contact en ticket de support ──── */

  async escalate(
    contactId: string,
    agentId:   string,
    agentName: string,
  ): Promise<{ ticketId: string; reference: string }> {

    const contact = await this.contactRepo.findOne({ where: { id: contactId } });
    if (!contact) throw new NotFoundException(`ContactMessage "${contactId}" introuvable.`);

    /* Idempotence — si déjà escaladé, renvoie le ticket existant.
     * Évite les doublons si l'agent clique deux fois. */
    if (contact.supportTicketId) {
      this.logger.log(
        `[ESCALADE] Contact ${contactId} déjà escaladé → ticket ${contact.supportTicketId}`,
      );
      return { ticketId: contact.supportTicketId, reference: '' };
    }

    /* Création du ticket de support.
     * Si le contact est un visiteur non connecté (userId null),
     * on utilise un identifiant fictif — SupportTicket.userId est nullable. */
    const ticket = await this.supportService.createTicket(
      contact.userId ?? `contact:${contactId}`,
      'client',
      contact.name,
      contact.email,
      {
        type:         TYPE_MAP[contact.type] ?? SupportTicketType.GENERAL,
        subject:      contact.subject,
        firstMessage: contact.body,
      },
    );

    /* Liaison bidirectionnelle :
     * ContactMessage.supportTicketId → ticket.id
     * Le statut passe à REPLIED (l'escalade est une réponse de traitement). */
    await this.contactRepo.update(contactId, {
      supportTicketId: ticket.id,
      status:          ContactMessageStatus.REPLIED,
    });

    this.logger.log(
      `[ESCALADE] Contact ${contactId} → ticket ${ticket.reference} (agent: ${agentName})`,
    );

    return { ticketId: ticket.id, reference: ticket.reference };
  }
}
