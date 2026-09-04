/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/clients/crm-campaign.service.ts
 *
 * RÔLE : Implémente les 4 "Actions CRM" de la page Clients & Abonnés
 *   1. Newsletter VIP           → segment VIP
 *   2. Offre fidélité           → segments Fidèle + Régulier
 *   3. Relance clients inactifs → acheteurs sans commande depuis 30j+
 *   4. Rapport segments PDF     → export PDF de la répartition
 *
 * ENVOI (1-3) — jamais de SMTP synchrone dans la requête HTTP : chaque
 * destinataire reçoit une Notification (in-app + email si ses propres
 * préférences l'autorisent) via NotificationEventService, qui insère en
 * base puis met le dispatch EMAIL en file BullMQ — voir
 * notification.queue.ts pour la philosophie du projet à ce sujet.
 * ============================================================ */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';

import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { ClientsService, ClientRow } from './clients.service';
import { NotificationEventService } from 'src/modules/notifications/events/notification-event.service';
import { CrmCampaignType } from './dto/crm-campaign.dto';

/** Garde-fou anti-abus : une campagne ne cible jamais plus de N clients
 * d'un coup (au-delà, il faudrait un vrai outil d'emailing dédié). */
const MAX_RECIPIENTS = 300;

/** Un acheteur est considéré "inactif" sans commande depuis ce délai. */
const INACTIVITE_JOURS = 30;

@Injectable()
export class CrmCampaignService {

  private readonly logger = new Logger(CrmCampaignService.name);

  constructor(
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    private readonly clientsService: ClientsService,
    private readonly notifEventSvc:  NotificationEventService,
  ) {}

  /* ══════════════════════════════════════════════════════════════
   * APERÇU — avant envoi, pour la modale de confirmation frontend
   * ════════════════════════════════════════════════════════════ */
  async preview(userId: string, type: CrmCampaignType) {
    const company    = await this.resolveCompany(userId);
    const recipients = await this.resolveRecipients(company.id, type);

    return {
      count:            recipients.length,
      sample:           recipients.slice(0, 10).map(r => ({ fullName: r.fullName, email: r.email })),
      suggestedSubject: this.suggested(type, company.companyName).subject,
      suggestedMessage: this.suggested(type, company.companyName).message,
    };
  }

  /* ══════════════════════════════════════════════════════════════
   * ENVOI RÉEL — après confirmation côté frontend
   * ════════════════════════════════════════════════════════════ */
  async send(userId: string, type: CrmCampaignType, subject: string, message: string) {
    const company    = await this.resolveCompany(userId);
    const recipients = (await this.resolveRecipients(company.id, type)).slice(0, MAX_RECIPIENTS);

    if (recipients.length === 0) {
      throw new BadRequestException('Aucun client dans ce segment pour le moment.');
    }

    const results = await Promise.allSettled(
      recipients.map(r => this.notifEventSvc.notifyCrmMessage({
        clientId:    r.id,
        companyId:   company.id,
        companyName: company.companyName,
        subject,
        message,
      })),
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - sent;

    this.logger.log(`[CRM] ${type} — companyId=${company.id} → ${sent} envoyés, ${failed} échoués`);

    return { sent, failed, total: recipients.length };
  }

  /* ══════════════════════════════════════════════════════════════
   * RAPPORT PDF — répartition des segments + top clients
   * ════════════════════════════════════════════════════════════ */
  async generateSegmentsPdf(userId: string): Promise<Buffer> {
    const company = await this.resolveCompany(userId);
    const result  = await this.clientsService.getClients(company.id, {
      source: 'all', segment: 'all', page: 1, limit: 1000,
      sortBy: 'totalSpent', sortOrder: 'DESC',
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const fmtGnf = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} GNF`;

      doc.fontSize(18).text(`Rapport clients — ${company.companyName}`, { align: 'left' });
      doc.fontSize(10).fillColor('#666')
        .text(`Généré le ${new Date().toLocaleString('fr-FR')}`, { align: 'left' });
      doc.moveDown(1.5);

      doc.fillColor('#000').fontSize(13).text('Répartition des segments');
      doc.moveDown(0.5);
      const stats = result.stats;
      const segLines: [string, number][] = [
        ['VIP',      stats.vip],
        ['Fidèles',  stats.fideles],
        ['Réguliers',stats.reguliers],
        ['Nouveaux', stats.nouveaux],
        ['Abonnés',  stats.abonnes],
      ];
      for (const [label, count] of segLines) {
        const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
        doc.fontSize(11).text(`${label} : ${count} (${pct}%)`);
      }
      doc.moveDown(0.5);
      doc.fontSize(11).text(`Total clients : ${stats.total}`);
      doc.text(`CA total : ${fmtGnf(stats.caTotal)}`);
      doc.text(`Panier moyen : ${fmtGnf(stats.panierMoyen)}`);
      doc.moveDown(1.5);

      doc.fontSize(13).text('Top clients (par dépense)');
      doc.moveDown(0.5);
      const top = result.data.slice(0, 30);
      if (top.length === 0) {
        doc.fontSize(11).fillColor('#666').text('Aucun client pour le moment.');
      } else {
        for (const c of top) {
          doc.fontSize(10).fillColor('#000')
            .text(`${c.fullName}  —  ${c.segment}  —  ${c.totalOrders} commande(s)  —  ${fmtGnf(c.totalSpent)}`);
        }
      }

      doc.end();
    });
  }

  /* ══════════════════════════════════════════════════════════════
   * HELPERS PRIVÉS
   * ════════════════════════════════════════════════════════════ */

  private async resolveRecipients(companyId: string, type: CrmCampaignType): Promise<ClientRow[]> {
    if (type === 'newsletter') {
      const r = await this.clientsService.getClients(companyId, {
        segment: 'VIP', source: 'buyers', page: 1, limit: MAX_RECIPIENTS,
      });
      return r.data;
    }

    if (type === 'fidelite') {
      const [fideles, reguliers] = await Promise.all([
        this.clientsService.getClients(companyId, { segment: 'Fidèle',   source: 'buyers', page: 1, limit: MAX_RECIPIENTS }),
        this.clientsService.getClients(companyId, { segment: 'Régulier', source: 'buyers', page: 1, limit: MAX_RECIPIENTS }),
      ]);
      return [...fideles.data, ...reguliers.data];
    }

    /* relance — acheteurs dont la dernière commande date d'au moins
     * INACTIVITE_JOURS jours. Aucun filtre backend dédié pour cette
     * fenêtre temporelle dans ClientsService.getClients() : on charge
     * tous les acheteurs (borné par MAX_RECIPIENTS) et on filtre ici. */
    const all = await this.clientsService.getClients(companyId, {
      source: 'buyers', page: 1, limit: MAX_RECIPIENTS,
      sortBy: 'lastOrderAt', sortOrder: 'ASC',
    });
    const cutoff = Date.now() - INACTIVITE_JOURS * 24 * 60 * 60 * 1000;
    return all.data.filter(c => c.lastOrderAt && new Date(c.lastOrderAt).getTime() < cutoff);
  }

  private suggested(type: CrmCampaignType, companyName: string): { subject: string; message: string } {
    switch (type) {
      case 'newsletter':
        return {
          subject: `${companyName} — Découvrez nos nouveautés en avant-première`,
          message: `Bonjour,\n\nEn tant que client VIP de ${companyName}, vous êtes parmi les premiers informés de nos nouveautés et offres exclusives.\n\nMerci pour votre fidélité !\n\nL'équipe ${companyName}`,
        };
      case 'fidelite':
        return {
          subject: `${companyName} — Une offre spéciale pour vous remercier`,
          message: `Bonjour,\n\nPour vous remercier de votre confiance, nous avons une offre spéciale à vous proposer sur votre prochaine commande.\n\nÀ très vite chez ${companyName} !`,
        };
      default:
        return {
          subject: `${companyName} — Ça faisait longtemps !`,
          message: `Bonjour,\n\nNous ne vous avons pas vu depuis un moment et vos produits préférés vous attendent chez ${companyName}. N'hésitez pas à revenir faire un tour sur notre boutique.\n\nÀ bientôt !`,
        };
    }
  }

  /* BUG CORRIGÉ — même correctif que clients.service.ts/returns.service.ts/
   * sav.service.ts/returns-stats.service.ts : `id` (cas normal, actorId
   * signé serveur) en priorité, `userId` en repli déterministe. */
  private async resolveCompany(userId: string): Promise<Company> {
    let company = await this.companyRepo.findOne({ where: { id: userId }, select: ['id', 'companyName'] });
    if (!company) company = await this.companyRepo.findOne({ where: { userId }, select: ['id', 'companyName'] });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}
