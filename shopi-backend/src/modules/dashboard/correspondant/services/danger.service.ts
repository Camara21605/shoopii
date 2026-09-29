/* ============================================================
 * FICHIER : services/danger.service.ts
 * SECTION : §11 — Zone sensible
 *
 * Responsabilités :
 *   suspendreCompte()  → activité en PAUSE (status = DISABLED), réversible par reprendre()
 *   desactiverCompte() → même pause (ancien « 30 jours » : voir plus bas)
 *   reprendre()        → fin de la pause (status = ACTIVE)
 *   supprimerCompte()  → status = DELETED + compte utilisateur supprimé (anonymisé après
 *                        30 jours par AccountPurgeCronService) + toutes les sessions coupées
 *
 * BUGS CORRIGÉS (audit 2026-09) :
 *   - AUCUN mot de passe demandé, aucune limite d'essais : une session volée suffisait
 *     pour suspendre ou supprimer le compte en deux clics → mot de passe exigé pour
 *     les trois actions (limite de débit dans le contrôleur).
 *   - « Suspendre » écrivait SUSPENDED, le statut que posent l'entreprise / l'admin : une
 *     suspension décidée par eux devenait impossible à distinguer d'une pause volontaire.
 *     La pause volontaire est DISABLED ; seule elle peut être reprise par le correspondant.
 *   - « Vos partenaires ont été notifiés » : aucune notification n'était envoyée (message retiré).
 *   - « Désactivé pour 30 jours » : rien ne réactivait jamais le compte, et aucune reprise
 *     n'existait. La désactivation est désormais une pause qu'on reprend depuis ce menu
 *     (une reprise automatique à date demanderait une nouvelle colonne en base).
 *   - « Supprimer » ne supprimait rien : le compte restait connecté (sessions, connexions
 *     temps réel) et n'était jamais purgé ; aucune vérification des colis en cours ni du
 *     portefeuille. Même règles que la suppression d'un compte livreur.
 *   - `save()` de toute la fiche → seul le statut est écrit.
 * ============================================================ */

import {
  Injectable, BadRequestException, NotFoundException, UnauthorizedException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository }   from 'typeorm';
import * as bcrypt          from 'bcryptjs';

import {
  Correspondent,
  CorrespondantStatus,
} from '../../../../database/entities/profiles/correspondant-profile.entity';
import { User }             from '../../../../database/entities/user.entity';
import { RefreshToken }     from '../../../../database/entities/refresh-token.entity';
import { Wallet }           from '../../../../database/entities/wallet.entity';
import { Commande, CommandeStatus } from '../../../../database/entities/commande/commande.entity';
import { SessionService }   from '../../../session/session.service';
import { NotificationBroadcastService } from '../../../notifications/services/notification-broadcast.service';
import { CorrespondantBaseService } from './base.service';

/** Commandes encore en cours : un colis peut être en dépôt chez le correspondant. */
const COMMANDES_EN_COURS = [
  CommandeStatus.PENDING, CommandeStatus.PAID, CommandeStatus.IN_PROGRESS,
  CommandeStatus.AWAITING_CLIENT, CommandeStatus.DISPUTED,
];

@Injectable()
export class DangerService extends CorrespondantBaseService {

  private readonly logger = new Logger(DangerService.name);

  constructor(
    @InjectRepository(Correspondent) corRepo:  Repository<Correspondent>,
    @InjectRepository(User)          userRepo: Repository<User>,
    @InjectRepository(RefreshToken)  private readonly tokenRepo:    Repository<RefreshToken>,
    @InjectRepository(Wallet)        private readonly walletRepo:   Repository<Wallet>,
    @InjectRepository(Commande)      private readonly commandeRepo: Repository<Commande>,
    private readonly sessionService: SessionService,
    private readonly notifBroadcast: NotificationBroadcastService,
  ) {
    super(corRepo, userRepo);
  }

  /* ── Pause de l'activité (réversible) ── */
  async suspendreCompte(userId: string, password: string) {
    await this.verifyPassword(userId, password);
    const cor = await this.findCorOrFail(userId);
    this.assertPeutSeMettreEnPause(cor);

    await this.corRepo.update(cor.id, { status: CorrespondantStatus.DISABLED });
    this.logger.warn(`[PAUSE] Activité mise en pause — userId=${userId}`);
    return {
      message: 'Activité mise en pause : vous n’apparaissez plus aux clients ni aux boutiques. Reprenez-la depuis ce menu quand vous voulez.',
      status:  CorrespondantStatus.DISABLED,
    };
  }

  /* Ancienne « désactivation 30 jours » : aucune reprise automatique n'existait — même pause. */
  async desactiverCompte(userId: string, password: string) {
    return this.suspendreCompte(userId, password);
  }

  async reprendre(userId: string) {
    const cor = await this.findCorOrFail(userId);
    if (cor.status !== CorrespondantStatus.DISABLED) {
      throw new BadRequestException(cor.status === CorrespondantStatus.SUSPENDED
        ? 'Votre compte a été suspendu par Shoneya ou votre entreprise : contactez le support.'
        : 'Votre activité n’est pas en pause.');
    }
    await this.corRepo.update(cor.id, { status: CorrespondantStatus.ACTIVE });
    this.logger.log(`[PAUSE] Activité reprise — userId=${userId}`);
    return { message: 'Activité reprise : vous êtes de nouveau visible.', status: CorrespondantStatus.ACTIVE };
  }

  /* ── Suppression du compte ── */
  async supprimerCompte(userId: string, password: string) {
    await this.verifyPassword(userId, password);
    const cor = await this.findCorOrFail(userId);

    const enCours = await this.commandeRepo.count({
      where: { correspondantId: cor.id, status: In(COMMANDES_EN_COURS) },
    });
    if (enCours > 0) {
      throw new BadRequestException(`Impossible de supprimer le compte : ${enCours} commande(s) passent encore par votre relais. Terminez-les d’abord.`);
    }
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (wallet && (Number(wallet.balance) > 0 || Number(wallet.pendingBalance) > 0)) {
      throw new BadRequestException('Impossible de supprimer le compte : votre portefeuille contient encore des fonds. Retirez-les d’abord.');
    }

    await this.corRepo.update(cor.id, { status: CorrespondantStatus.DELETED });
    await this.closeAllSessions(userId);
    await this.userRepo.softDelete(userId);   // anonymisé après 30 jours (AccountPurgeCronService)

    this.logger.error(`[SUPPRESSION] Compte supprimé — userId=${userId} | correspondantId=${cor.id} (anonymisation dans 30 jours)`);
    return {
      message: 'Compte supprimé. Vos données personnelles seront effacées définitivement dans 30 jours. Contactez le support pour annuler.',
    };
  }

  /* ── Helpers ── */

  private assertPeutSeMettreEnPause(cor: Correspondent) {
    if (cor.status === CorrespondantStatus.DISABLED) throw new BadRequestException('Votre activité est déjà en pause.');
    if (cor.status === CorrespondantStatus.SUSPENDED) {
      throw new BadRequestException('Votre compte est suspendu : cette action n’est pas disponible.');
    }
    if (cor.status === CorrespondantStatus.DELETED) throw new BadRequestException('Ce compte est en cours de suppression.');
  }

  /** Coupe tout : jetons de rafraîchissement, sessions, jetons d'accès déjà émis et connexions temps réel. */
  private async closeAllSessions(userId: string): Promise<void> {
    const active = await this.tokenRepo.find({ where: { userId, revoked: false }, select: ['id', 'sessionId'] });
    await this.tokenRepo.update({ userId, revoked: false }, { revoked: true, revokedReason: 'ACCOUNT_CLOSED' });
    for (const sid of new Set(active.map(t => t.sessionId).filter((x): x is string => !!x))) {
      await this.sessionService.endSession(userId, sid).catch(() => undefined);
    }
    await this.userRepo.update(userId, { lastLogoutAt: new Date() });
    void this.notifBroadcast.fermerSessionsTempsReel(userId, 'ACCOUNT_CLOSED');
  }

  private async verifyPassword(userId: string, password: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'password'] });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    if (!(await bcrypt.compare(password ?? '', user.password))) {
      throw new UnauthorizedException('Mot de passe incorrect. Action refusée.');
    }
  }
}
