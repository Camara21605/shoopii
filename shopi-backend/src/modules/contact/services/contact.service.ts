/* ============================================================
 * FICHIER  : src/modules/contact/services/contact.service.ts
 * ROLE     : Soumission et gestion des messages du formulaire de contact.
 *
 * RESPONSABILITES :
 *   - Valider l'anti-spam par IP (max 3 messages / heure).
 *   - Persister le message en base avec hash SHA-256 de l'IP.
 *   - Envoyer l'email interne à l'équipe Shopi.
 *   - Envoyer l'email de confirmation à l'expéditeur.
 *   - Lister les messages côté admin avec pagination et filtre par statut.
 *   - Marquer un message comme lu (status → READ).
 *
 * DESIGN :
 *   La logique d'escalade (Contact → Ticket support) est dans
 *   ContactEscalationService, conformément au principe SRP.
 *
 * DEPENDANCES :
 *   - ContactMessage (InjectRepository)
 *   - MailService    (envoi emails)
 *   - ConfigService  (SUPPORT_EMAIL)
 * ============================================================ */

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { ConfigService }    from '@nestjs/config';
import * as crypto          from 'crypto';

import {
  ContactMessage,
  ContactMessageStatus,
  ContactMessageType,
} from '../../../database/entities/contact/contact-message.entity';
import { CreateContactMessageDto } from '../dto/contact.dto';
import { MailService } from '../../email/email.service';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectRepository(ContactMessage)
    private readonly repo:        Repository<ContactMessage>,
    private readonly mailService: MailService,
    private readonly config:      ConfigService,
  ) {}

  /* ── Soumission d'un message (route publique) ─────────────── */

  async submit(
    dto:    CreateContactMessageDto,
    userId: string | null,
    ip:     string | null,
  ): Promise<{ id: string; reference: string }> {
    const ipHash = ip
      ? crypto.createHash('sha256').update(ip).digest('hex')
      : null;

    /* Anti-spam : 3 messages max par IP dans la dernière heure. */
    if (ipHash) {
      const recentCount = await this.repo
        .createQueryBuilder('c')
        .where('c.ipHash = :ipHash', { ipHash })
        .andWhere("c.createdAt > NOW() - INTERVAL '1 hour'")
        .getCount();

      if (recentCount >= 3) {
        throw new HttpException(
          'Trop de messages envoyés. Réessayez dans une heure.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const msg = this.repo.create({
      name:    dto.name,
      email:   dto.email,
      subject: dto.subject,
      body:    dto.body,
      type:    dto.type ?? ContactMessageType.GENERAL,
      userId,
      ipHash,
    });

    const saved = await this.repo.save(msg);

    /* Email interne vers l'équipe Shopi */
    const supportEmail = this.config.get<string>('SUPPORT_EMAIL', 'support@shopi.gn');
    try {
      await this.mailService.sendContactEmail({
        toEmail:  supportEmail,
        toName:   'Équipe Shopi',
        fromName: dto.name,
        sujet:    dto.subject,
        message:  dto.body,
      });
    } catch (e) {
      this.logger.warn(`[CONTACT] Email interne failed: ${e}`);
    }

    /* Email de confirmation à l'expéditeur */
    try {
      await this.mailService.sendContactConfirmation({
        toEmail:   dto.email,
        firstName: dto.name,
        subject:   dto.subject,
      });
    } catch (e) {
      this.logger.warn(`[CONTACT] Email confirmation failed for ${dto.email}: ${e}`);
    }

    this.logger.log(`[CONTACT] Message soumis par ${dto.email} | id: ${saved.id}`);
    return { id: saved.id, reference: `CONTACT-${saved.id.slice(0, 8).toUpperCase()}` };
  }

  /* ── Côté admin ──────────────────────────────────────────── */

  async findAll(
    page = 1,
    limit = 20,
    status?: string,
  ): Promise<{ data: ContactMessage[]; total: number }> {
    const qb = this.repo.createQueryBuilder('c')
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere('c.status = :status', { status });

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async markRead(id: string): Promise<void> {
    await this.repo.update(id, { status: ContactMessageStatus.READ });
  }
}
