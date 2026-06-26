/* ============================================================
 * FICHIER : src/modules/commande/services/commande-feedback.service.ts
 *
 * RÔLE : retours de fin de commande (notations + litiges).
 *   - envoyerNotations  : POST /commandes/:id/notes
 *     → Sauvegarde l'avis dans company_avis
 *     → Met à jour averageRating + totalRatings sur Company
 *   - signalerProbleme  : POST /commandes/:id/litige
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User }        from '../../../database/entities/user.entity';
import { Commande, CommandeStatus } from '../../../database/entities/commande/commande.entity';
import { Company }     from '../../../database/entities/profiles/entreprise-profile.entity';
import { Client }      from '../../../database/entities/profiles/client-profile.entity';
import { CompanyAvis } from '../../../database/entities/entreprise.table/company-avis.entity';

import { EnvoyerNotationsDto, LitigeDto } from '../dto/notation.dto';

@Injectable()
export class CommandeFeedbackService {
  constructor(
    @InjectRepository(Commande)    private readonly commandeRepo: Repository<Commande>,
    @InjectRepository(Company)     private readonly companyRepo:  Repository<Company>,
    @InjectRepository(Client)      private readonly clientRepo:   Repository<Client>,
    @InjectRepository(CompanyAvis) private readonly avisRepo:     Repository<CompanyAvis>,
  ) {}

  /* ════════════════════════════════════════════════════════
   * POST /commandes/:id/notes
   ════════════════════════════════════════════════════════ */
  async envoyerNotations(
    commandeId: string,
    user: User,
    dto: EnvoyerNotationsDto,
  ): Promise<{ ok: boolean }> {

    /* 1. Vérifier la commande */
    const commande = await this.commandeRepo.findOne({
      where:  { id: commandeId },
      select: ['id', 'companyId', 'clientId', 'status'],
    });
    if (!commande) throw new NotFoundException('Commande introuvable.');

    /* 2. Note de l'entreprise */
    const entrepriseNote = dto.notes.find(n => n.role === 'entreprise');

    if (entrepriseNote && commande.companyId) {

      /* 3. Nom du client (snapshot) */
      let clientNom       = 'Client Shopi';
      let clientInitiales = 'C';
      try {
        const firstName = user.firstName ?? '';
        const lastName  = user.lastName  ?? '';
        const fullName  = `${firstName} ${lastName}`.trim();
        if (fullName) {
          clientNom = fullName;
          clientInitiales = [firstName[0], lastName[0]]
            .filter(Boolean)
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'C';
        }
      } catch { /* silencieux */ }

      /* 4. Sauvegarder l'avis (ignore si déjà existant pour cette commande) */
      const existingAvis = await this.avisRepo.findOne({ where: { commandeId } });
      if (!existingAvis) {
        const avis = this.avisRepo.create({
          companyId:       commande.companyId,
          commandeId,
          clientNom,
          clientInitiales,
          note:            entrepriseNote.note,
          commentaire:     entrepriseNote.commentaire ?? null,
        });
        await this.avisRepo.save(avis);
      }

      /* 5. Mettre à jour la moyenne glissante sur Company */
      const company = await this.companyRepo.findOne({
        where:  { id: commande.companyId },
        select: ['id', 'averageRating', 'totalRatings'],
      });
      if (company && !existingAvis) {
        const oldTotal = company.totalRatings ?? 0;
        const oldAvg   = Number(company.averageRating) || 0;
        const newTotal = oldTotal + 1;
        const newAvg   = parseFloat(
          ((oldAvg * oldTotal + entrepriseNote.note) / newTotal).toFixed(2),
        );
        company.averageRating = newAvg;
        company.totalRatings  = newTotal;
        await this.companyRepo.save(company);
      }
    }

    return { ok: true };
  }

  /* ════════════════════════════════════════════════════════
   * POST /commandes/:id/litige
   ════════════════════════════════════════════════════════ */
  async signalerProbleme(
    commandeId: string,
    _user: User,
    _dto: LitigeDto,
  ): Promise<{ ok: boolean }> {
    const commande = await this.commandeRepo.findOne({ where: { id: commandeId } });
    if (!commande) throw new NotFoundException('Commande introuvable.');
    commande.status = CommandeStatus.DISPUTED;
    await this.commandeRepo.save(commande);
    return { ok: true };
  }
}
