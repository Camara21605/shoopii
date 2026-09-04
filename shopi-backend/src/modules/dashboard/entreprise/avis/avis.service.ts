/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/avis/avis.service.ts
 *
 * RÔLE : Gère la page "Avis" du dashboard entreprise.
 *   GET  /dashboard/entreprise/avis              → liste + stats
 *   POST /dashboard/entreprise/avis/:id/reponse  → répondre à un avis
 *
 * Les avis eux-mêmes sont créés ailleurs (voir
 * CommandeFeedbackService.envoyerNotations, POST /commandes/:id/notes) —
 * ce module ne fait que LIRE company_avis et permettre d'y répondre.
 * Auparavant, aucune route backend n'existait pour cette page : les
 * vrais avis (déjà enregistrés en base par le flux client) restaient
 * invisibles côté entreprise, la page affichait toujours "Aucun avis".
 * ============================================================ */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { CompanyAvis } from 'src/database/entities/entreprise.table/company-avis.entity';
import { CommandeItem } from 'src/database/entities/commande/commande-item.entity';

export interface AvisRow {
  id:          string;
  clientNom:   string;
  clientInitiales: string;
  produitNom:  string;
  note:        number;
  commentaire: string;
  date:        string;
  reponse:     string | null;
  commandeId:  string;
}

@Injectable()
export class AvisService {

  constructor(
    @InjectRepository(Company)      private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyAvis)  private readonly avisRepo:    Repository<CompanyAvis>,
    @InjectRepository(CommandeItem) private readonly itemRepo:    Repository<CommandeItem>,
  ) {}

  /* ══════════════════════════════════════════════════════════════
   * GET — Liste des avis + statistiques
   * ════════════════════════════════════════════════════════════ */
  async getAvis(userId: string) {
    const company = await this.resolveCompany(userId);

    const rows = await this.avisRepo.find({
      where: { companyId: company.id },
      order: { createdAt: 'DESC' },
    });

    /* Nom du produit affiché par avis — dérivé des articles de la
     * commande source (snapshot nomProduit, jamais du produit courant :
     * il a pu être modifié/supprimé depuis). Une seule requête groupée
     * plutôt qu'un N+1 par avis. */
    const commandeIds = rows.map(r => r.commandeId);
    const items = commandeIds.length
      ? await this.itemRepo.find({
          where:  { commandeId: In(commandeIds) },
          select: ['commandeId', 'nomProduit'],
        })
      : [];
    const itemsByCommande = new Map<string, string[]>();
    for (const it of items) {
      const arr = itemsByCommande.get(it.commandeId) ?? [];
      arr.push(it.nomProduit);
      itemsByCommande.set(it.commandeId, arr);
    }

    const avis: AvisRow[] = rows.map(a => {
      const noms = itemsByCommande.get(a.commandeId) ?? [];
      const produitNom =
        noms.length === 0 ? '—' :
        noms.length === 1 ? noms[0] :
        `${noms[0]} (+${noms.length - 1} autre${noms.length > 2 ? 's' : ''})`;

      return {
        id:          a.id,
        clientNom:   a.clientNom,
        clientInitiales: a.clientInitiales,
        produitNom,
        note:        a.note,
        commentaire: a.commentaire ?? '',
        date:        a.createdAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        reponse:     a.reponse,
        commandeId:  a.commandeId,
      };
    });

    const total   = avis.length;
    const moyenne = total > 0
      ? Math.round((avis.reduce((s, a) => s + a.note, 0) / total) * 10) / 10
      : 0;

    const counts: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    for (const a of avis) {
      const k = String(a.note);
      if (k in counts) counts[k]++;
    }
    const distribution: Record<string, number> = {};
    for (const [k, v] of Object.entries(counts)) {
      distribution[k] = total > 0 ? Math.round((v / total) * 100) : 0;
    }

    const repondus = avis.filter(a => !!a.reponse).length;
    const tauxReponse = total > 0 ? Math.round((repondus / total) * 100) : 0;

    return { avis, stats: { moyenne, total, distribution, tauxReponse } };
  }

  /* ══════════════════════════════════════════════════════════════
   * POST — Répondre (ou modifier une réponse) à un avis
   * ════════════════════════════════════════════════════════════ */
  async repondre(userId: string, avisId: string, reponse: string): Promise<{ ok: boolean }> {
    const company = await this.resolveCompany(userId);

    const avis = await this.avisRepo.findOne({ where: { id: avisId } });
    if (!avis) throw new NotFoundException('Avis introuvable.');

    /* IDOR — un avis appartient à UNE boutique ; sans ce contrôle,
     * n'importe quelle entreprise authentifiée pouvait répondre à
     * l'avis d'une autre boutique en devinant/énumérant son UUID. */
    if (avis.companyId !== company.id) {
      throw new ForbiddenException("Cet avis n'appartient pas à votre boutique.");
    }

    avis.reponse     = reponse;
    avis.respondedAt = new Date();
    await this.avisRepo.save(avis);

    return { ok: true };
  }

  /* ══════════════════════════════════════════════════════════════
   * HELPER — même correctif déterministe que partout ailleurs dans
   * le dashboard entreprise : `id` (actorId signé serveur) en
   * priorité, `userId` en repli.
   * ════════════════════════════════════════════════════════════ */
  private async resolveCompany(userId: string): Promise<Company> {
    let company = await this.companyRepo.findOne({ where: { id: userId }, select: ['id', 'companyName'] });
    if (!company) company = await this.companyRepo.findOne({ where: { userId }, select: ['id', 'companyName'] });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}
