/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/services/danger-livreur.service.ts
 * RÔLE : Section 10 — Zone sensible
 *   GET    /parametres/danger            → état actuel (actif, en pause, désactivé…)
 *   PATCH  /parametres/danger/pause      → pause sans limite de durée
 *   PATCH  /parametres/danger/desactiver → pause de 30 jours, reprise automatique
 *   PATCH  /parametres/danger/reprendre  → reprendre son activité
 *   DELETE /parametres/danger/supprimer  → suppression du compte
 * Pause, désactivation et suppression requièrent le mot de passe.
 *
 * BUGS CORRIGÉS :
 *   - Pause : passait le livreur en statut PENDING, c'est-à-dire « en attente
 *     de validation » par son entreprise — il réapparaissait comme candidat à
 *     valider et ne pouvait jamais reprendre de lui-même (aucune route).
 *   - Désactivation : réutilisait SUSPENDED, la sanction posée par
 *     l'entreprise (qui pouvait donc le « réactiver » à sa place).
 *     Pause et désactivation ne touchent plus au statut (qui appartient à
 *     l'entreprise / l'administration) : elles posent `suspendedUntil`
 *     (PAUSE_INDEFINIE ou J+30), lu partout où un livreur peut être trouvé
 *     ou recevoir du travail (liste publique, carte, recherche, diffusion et
 *     acceptation de missions, choix du livreur d'une commande).
 *   - Suppression : `remove()` effaçait le profil (commandes et missions
 *     orphelines, historique cassé) et laissait le compte utilisateur actif,
 *     connectable, sans profil. Désormais, comme pour l'entreprise : refus
 *     s'il reste des livraisons en cours ou des fonds au portefeuille,
 *     sessions fermées, compte supprimé (soft delete) puis anonymisé au bout
 *     de 30 jours (jobs/account-purge.cron.service.ts — profil livreur et
 *     pièces justificatives compris).
 *   - `save()` d'une entité entière écrasait les colonnes modifiées entre-temps.
 * ============================================================ */

import {
  Injectable, NotFoundException, BadRequestException,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { Delivery, LivreurStatus } from 'src/database/entities/profiles/livreur-profile.entity';
import { User }                    from 'src/database/entities/user.entity';
import { RefreshToken }            from 'src/database/entities/refresh-token.entity';
import { Wallet }                  from 'src/database/entities/wallet.entity';
import { Commande, CommandeStatus, LivreurAssignmentStatus } from 'src/database/entities/commande/commande.entity';
import { SessionService }          from 'src/modules/session/session.service';
import { LivreurDangerConfirmDto } from '../dto/livreur-parametres.dto';

/** `suspendedUntil` d'une pause sans limite de durée (jamais atteinte par le cron). */
export const PAUSE_INDEFINIE = new Date('9999-12-31T00:00:00.000Z');

/** Livreur en pause ou désactivé par lui-même (voir en-tête). */
export function estEnPause(l: Pick<Delivery, 'suspendedUntil'>): boolean {
  return l.suspendedUntil != null;
}

export type EtatCompteLivreur = 'actif' | 'pause' | 'desactive' | 'suspendu' | 'banni';

const COMMANDES_EN_COURS = [
  CommandeStatus.PENDING, CommandeStatus.PAID, CommandeStatus.IN_PROGRESS,
  CommandeStatus.AWAITING_CLIENT, CommandeStatus.DISPUTED,
];

@Injectable()
export class DangerLivreurService {

  private readonly logger = new Logger(DangerLivreurService.name);

  constructor(
    @InjectRepository(Delivery)       private readonly livreurRepo:  Repository<Delivery>,
    @InjectRepository(User)           private readonly userRepo:     Repository<User>,
    @InjectRepository(RefreshToken)   private readonly tokenRepo:    Repository<RefreshToken>,
    @InjectRepository(Wallet)         private readonly walletRepo:   Repository<Wallet>,
    @InjectRepository(Commande)       private readonly commandeRepo: Repository<Commande>,
    private readonly sessionService: SessionService,
  ) {}

  async getEtat(userId: string): Promise<{ etat: EtatCompteLivreur; jusquau: Date | null }> {
    return this.etat(await this.findOrFail(userId));
  }

  async pauseCompte(userId: string, dto: LivreurDangerConfirmDto) {
    await this.verifyPassword(userId, dto.password);
    const livreur = await this.findOrFail(userId);
    this.assertPeutSeMettreEnPause(livreur);
    await this.livreurRepo.update(livreur.id, { suspendedUntil: PAUSE_INDEFINIE });
    this.logger.warn(`[DANGER] Activité mise en pause — userId=${userId}`);
    return { message: 'Activité mise en pause. Reprenez-la depuis ce menu quand vous voulez.', ...this.etat({ ...livreur, suspendedUntil: PAUSE_INDEFINIE } as Delivery) };
  }

  async desactiverCompte(userId: string, dto: LivreurDangerConfirmDto) {
    await this.verifyPassword(userId, dto.password);
    const livreur = await this.findOrFail(userId);
    this.assertPeutSeMettreEnPause(livreur);

    const reactivationAt = new Date();
    reactivationAt.setDate(reactivationAt.getDate() + 30);
    await this.livreurRepo.update(livreur.id, { suspendedUntil: reactivationAt });
    this.logger.warn(`[DANGER] Compte désactivé 30j — userId=${userId} | reprise le ${reactivationAt.toISOString()}`);
    return {
      message: 'Compte désactivé. Votre activité reprendra automatiquement dans 30 jours.',
      reactivationAt,
      ...this.etat({ ...livreur, suspendedUntil: reactivationAt } as Delivery),
    };
  }

  async reprendre(userId: string) {
    const livreur = await this.findOrFail(userId);
    if (!estEnPause(livreur)) throw new BadRequestException('Votre activité n’est pas en pause.');
    /* Ancienne désactivation (avant correctif) : statut SUSPENDED + date — jamais posée par l'entreprise */
    const patch: Pick<Partial<Delivery>, 'suspendedUntil' | 'status'> = { suspendedUntil: null };
    if (livreur.status === LivreurStatus.SUSPENDED) patch.status = LivreurStatus.ACTIVE;
    await this.livreurRepo.update(livreur.id, patch);
    this.logger.log(`[DANGER] Activité reprise — userId=${userId}`);
    return { message: 'Activité reprise.', ...this.etat({ ...livreur, ...patch } as Delivery) };
  }

  async supprimerCompte(userId: string, dto: LivreurDangerConfirmDto) {
    await this.verifyPassword(userId, dto.password);
    const livreur = await this.findOrFail(userId);

    const [commandes, missions] = await Promise.all([
      this.commandeRepo.count({
        where: {
          livreurId: livreur.id,
          livreurAssignmentStatus: In([LivreurAssignmentStatus.PENDING, LivreurAssignmentStatus.ACCEPTED]),
          status: In(COMMANDES_EN_COURS),
        },
      }),
      /* SQL direct : l'entité LivreurMission n'est pas déclarée dans la liste
       * des entités TypeORM (config/database.config.ts) → tout repository
       * dessus échoue (« No metadata for LivreurMission »). */
      this.commandeRepo.query(
        `SELECT count(*)::int AS n FROM livreur_missions WHERE "assignedDeliveryId" = $1 AND status = 'accepted'`,
        [livreur.id],
      ).then((r: { n: number }[]) => r[0]?.n ?? 0),
    ]);
    if (commandes + missions > 0) {
      throw new BadRequestException(`Impossible de supprimer le compte : ${commandes + missions} livraison(s) vous sont encore confiée(s). Terminez-les ou refusez-les, puis réessayez.`);
    }
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (wallet && (Number(wallet.balance) > 0 || Number(wallet.pendingBalance) > 0)) {
      throw new BadRequestException('Impossible de supprimer le compte : votre portefeuille contient encore des fonds. Retirez-les d’abord.');
    }

    /* Le profil reste (masqué) : commandes, missions et avis passés y font référence */
    await this.livreurRepo.update(livreur.id, { suspendedUntil: PAUSE_INDEFINIE });
    await this.closeAllSessions(userId);
    await this.userRepo.softDelete(userId);

    this.logger.error(`[DANGER] ⚠️ Compte SUPPRIMÉ — userId=${userId} | livreurId=${livreur.id} (anonymisation dans 30 jours)`);
    return { message: 'Compte supprimé. Vos données personnelles seront effacées définitivement dans 30 jours.' };
  }

  /* ──────────────────────────────────────────────────────────
   * HELPERS
   * ────────────────────────────────────────────────────────── */

  private etat(l: Delivery): { etat: EtatCompteLivreur; jusquau: Date | null } {
    if (l.status === LivreurStatus.BANNED) return { etat: 'banni', jusquau: null };
    if (l.status === LivreurStatus.SUSPENDED && !estEnPause(l)) return { etat: 'suspendu', jusquau: null };
    if (!estEnPause(l)) return { etat: 'actif', jusquau: null };
    return new Date(l.suspendedUntil!).getTime() >= PAUSE_INDEFINIE.getTime()
      ? { etat: 'pause', jusquau: null }
      : { etat: 'desactive', jusquau: l.suspendedUntil };
  }

  private assertPeutSeMettreEnPause(l: Delivery) {
    if (estEnPause(l)) throw new BadRequestException('Votre activité est déjà en pause.');
    if (l.status === LivreurStatus.SUSPENDED || l.status === LivreurStatus.BANNED) {
      throw new BadRequestException('Votre compte est suspendu : cette action n’est pas disponible.');
    }
  }

  /** Ferme TOUTES les sessions du compte : refresh tokens, sessions Redis, jetons d'accès déjà émis. */
  private async closeAllSessions(userId: string): Promise<void> {
    const active = await this.tokenRepo.find({ where: { userId, revoked: false }, select: ['id', 'sessionId'] });
    await this.tokenRepo.update({ userId, revoked: false }, { revoked: true, revokedReason: 'ACCOUNT_CLOSED' });
    for (const sid of new Set(active.map(t => t.sessionId).filter((x): x is string => !!x))) {
      await this.sessionService.endSession(userId, sid).catch(() => undefined);
    }
    await this.userRepo.update(userId, { lastLogoutAt: new Date() });   // invalide les access tokens déjà émis
  }

  private async verifyPassword(userId: string, password: string) {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'password'] });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    const valid = await bcrypt.compare(password ?? '', user.password);
    if (!valid) throw new UnauthorizedException('Mot de passe incorrect. Action refusée.');
  }

  async findOrFail(userId: string): Promise<Delivery> {
    const l = await this.livreurRepo.findOne({ where: { userId } });
    if (!l) throw new NotFoundException('Profil livreur introuvable.');
    return l;
  }
}
