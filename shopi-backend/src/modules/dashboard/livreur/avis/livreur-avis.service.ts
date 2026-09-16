/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/avis/livreur-avis.service.ts
 *
 * RÔLE : Gère la page "Évaluation" du dashboard livreur.
 *   GET  /dashboard/livreur/avis              → liste + stats
 *   POST /dashboard/livreur/avis/:id/reponse  → répondre à un avis
 *
 * Miroir de src/modules/dashboard/entreprise/avis/avis.service.ts pour
 * l'acteur DELIVERY. Les avis eux-mêmes sont créés ailleurs (voir
 * CommandeFeedbackService.envoyerNotations, POST /commandes/:id/notes) —
 * ce module ne fait que LIRE livreur_avis et permettre d'y répondre.
 * ============================================================ */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Delivery }    from 'src/database/entities/profiles/livreur-profile.entity';
import { LivreurAvis } from 'src/database/entities/livreur.table/livreur-avis.entity';
import { Commande }    from 'src/database/entities/commande/commande.entity';
import { NotificationActorType } from 'src/database/entities/notification/notification.entitiy';
import { NotificationEventService } from 'src/modules/notifications/events/notification-event.service';

export interface LivreurAvisRow {
  id:              string;
  clientNom:       string;
  clientInitiales: string;
  commandeRef:     string;
  note:            number;
  commentaire:     string;
  date:            string;
  reponse:         string | null;
  commandeId:      string;
}

@Injectable()
export class LivreurAvisService {

  constructor(
    @InjectRepository(Delivery)    private readonly livreurRepo:  Repository<Delivery>,
    @InjectRepository(LivreurAvis) private readonly avisRepo:     Repository<LivreurAvis>,
    @InjectRepository(Commande)    private readonly commandeRepo: Repository<Commande>,
    private readonly notifEventSvc: NotificationEventService,
  ) {}

  /* ══════════════════════════════════════════════════════════════
   * GET — Liste des avis + statistiques
   * ════════════════════════════════════════════════════════════ */
  async getAvis(userId: string) {
    const livreur = await this.resolveLivreur(userId);

    const rows = await this.avisRepo.find({
      where: { livreurId: livreur.id },
      order: { createdAt: 'DESC' },
    });

    /* Référence de commande affichée par avis — une seule requête groupée
     * plutôt qu'un N+1 par avis (même pattern que AvisService côté
     * entreprise avec CommandeItem). */
    const commandeIds = rows.map(r => r.commandeId);
    const commandes = commandeIds.length
      ? await this.commandeRepo.find({
          where:  { id: In(commandeIds) },
          select: ['id', 'numero'],
        })
      : [];
    const numeroByCommande = new Map(commandes.map(c => [c.id, c.numero]));

    const avis: LivreurAvisRow[] = rows.map(a => ({
      id:              a.id,
      clientNom:       a.clientNom,
      clientInitiales: a.clientInitiales,
      commandeRef:     numeroByCommande.get(a.commandeId) ?? '—',
      note:            a.note,
      commentaire:     a.commentaire ?? '',
      date:            a.createdAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      reponse:         a.reponse,
      commandeId:      a.commandeId,
    }));

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
    const livreur = await this.resolveLivreur(userId);

    const avis = await this.avisRepo.findOne({ where: { id: avisId } });
    if (!avis) throw new NotFoundException('Avis introuvable.');

    /* IDOR — un avis appartient à UN livreur ; sans ce contrôle, n'importe
     * quel livreur authentifié pouvait répondre à l'avis d'un autre en
     * devinant/énumérant son UUID. */
    if (avis.livreurId !== livreur.id) {
      throw new ForbiddenException("Cet avis ne vous appartient pas.");
    }

    avis.reponse     = reponse;
    avis.respondedAt = new Date();
    await this.avisRepo.save(avis);

    /* Notifie le client — alimente le badge "Avis" de son profil
     * (voir useSidebarBadges.ts côté client). Fire-and-forget. */
    const commande = await this.commandeRepo.findOne({
      where: { id: avis.commandeId }, select: ['clientId'],
    });
    if (commande?.clientId) {
      void this.notifEventSvc.notifyReviewReplied({
        clientId:   commande.clientId,
        actorType:  NotificationActorType.DELIVERY,
        actorId:    livreur.id,
        actorName:  livreur.fullName,
        commandeId: avis.commandeId,
      });
    }

    return { ok: true };
  }

  /* ══════════════════════════════════════════════════════════════
   * HELPER — même convention que le reste du dashboard livreur (voir
   * LivreurDashboardService) : résolution par userId, pas par actorId.
   * ════════════════════════════════════════════════════════════ */
  private async resolveLivreur(userId: string): Promise<Delivery> {
    const livreur = await this.livreurRepo.findOne({
      where:  { userId },
      select: ['id', 'fullName'],
    });
    if (!livreur) throw new NotFoundException('Profil livreur introuvable.');
    return livreur;
  }
}
