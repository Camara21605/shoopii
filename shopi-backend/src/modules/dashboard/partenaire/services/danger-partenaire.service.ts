/* ============================================================
 * FICHIER : src/modules/dashboard/partenaire/services/danger-partenaire.service.ts
 *
 * RÔLE : Zone sensible du partenaire — mot de passe exigé pour chaque action
 *        (limite de débit dans le contrôleur).
 *   PATCH  danger/pause       → pause sans limite (réversible via danger/reprendre)
 *   PATCH  danger/desactiver  → pause de 30 jours, reprise automatique (ExpiryCronService)
 *   PATCH  danger/reprendre   → fin de la pause
 *   DELETE danger/supprimer   → compte supprimé (anonymisé après 30 jours), sessions coupées
 *
 * Une pause ne touche PAS au statut : elle vit dans `suspendedUntil` (même mécanisme que
 * les livreurs). `status = SUSPENDED` reste réservé à l'administration.
 *
 * BUGS CORRIGÉS (audit 2026-09) :
 *   - « Pause » remettait le partenaire en PENDING : il retombait dans la file de
 *     validation de l'administrateur, et aucune reprise n'existait.
 *   - « Désactiver 30 jours » posait SUSPENDED (statut de l'administration) et rien ne le
 *     réactivait jamais : la tâche de réactivation ne traitait que livreurs et entreprises.
 *   - « Supprimer » effaçait brutalement la fiche partenaire (remove) alors que le compte de
 *     connexion restait actif et connecté (profil introuvable à chaque écran), sans vérifier
 *     le portefeuille. Désormais : suppression du compte (anonymisé à 30 j par
 *     AccountPurgeCronService), fiche conservée pour l'historique des commissions, toutes
 *     les sessions et connexions temps réel coupées.
 *   - `save()` de toute la fiche → seule la colonne concernée est écrite.
 * ============================================================ */

import {
  Injectable, NotFoundException, BadRequestException,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import * as bcrypt          from 'bcryptjs';

import { Partner, PartnerStatus } from 'src/database/entities/profiles/partenaire-profile.entity';
import { User }                   from 'src/database/entities/user.entity';
import { RefreshToken }           from 'src/database/entities/refresh-token.entity';
import { Wallet }                 from 'src/database/entities/wallet.entity';
import { SessionService }         from 'src/modules/session/session.service';
import { NotificationBroadcastService } from 'src/modules/notifications/services/notification-broadcast.service';
import { PartenaireDangerConfirmDto }  from '../dto/partenaire-parametres.dto';

/** Pause sans limite : date « infinie », jamais atteinte par la réactivation automatique. */
export const PAUSE_PARTENAIRE_INDEFINIE = new Date('9999-12-31T00:00:00.000Z');

/** Partenaire en pause (volontaire) : lien de parrainage inactif, compte conservé. */
export function partenaireEnPause(p: Pick<Partner, 'suspendedUntil'>): boolean {
  return p.suspendedUntil != null;
}

@Injectable()
export class DangerPartenaireService {

  private readonly logger = new Logger(DangerPartenaireService.name);

  constructor(
    @InjectRepository(Partner)      private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(User)         private readonly userRepo:    Repository<User>,
    @InjectRepository(RefreshToken) private readonly tokenRepo:   Repository<RefreshToken>,
    @InjectRepository(Wallet)       private readonly walletRepo:  Repository<Wallet>,
    private readonly sessionService: SessionService,
    private readonly notifBroadcast: NotificationBroadcastService,
  ) {}

  async pauseCompte(userId: string, dto: PartenaireDangerConfirmDto) {
    await this.verifyPassword(userId, dto.password);
    const partner = await this.findOrFail(userId);
    this.assertPeutSeMettreEnPause(partner);
    await this.partnerRepo.update(partner.id, { suspendedUntil: PAUSE_PARTENAIRE_INDEFINIE });
    this.logger.warn(`[DANGER] Compte mis en pause — userId=${userId}`);
    return { message: 'Compte mis en pause : votre lien de parrainage est inactif. Reprenez depuis ce menu quand vous voulez.', enPause: true, pauseJusquau: null };
  }

  async desactiverCompte(userId: string, dto: PartenaireDangerConfirmDto) {
    await this.verifyPassword(userId, dto.password);
    const partner = await this.findOrFail(userId);
    this.assertPeutSeMettreEnPause(partner);
    const reactivationAt = new Date();
    reactivationAt.setDate(reactivationAt.getDate() + 30);
    await this.partnerRepo.update(partner.id, { suspendedUntil: reactivationAt });
    this.logger.warn(`[DANGER] Compte désactivé 30j — userId=${userId} | réactivation=${reactivationAt.toISOString()}`);
    return {
      message: 'Compte désactivé. Il redeviendra actif automatiquement dans 30 jours (ou plus tôt depuis ce menu).',
      reactivationAt, enPause: true, pauseJusquau: reactivationAt,
    };
  }

  async reprendre(userId: string) {
    const partner = await this.findOrFail(userId);
    if (partner.status === PartnerStatus.SUSPENDED) {
      throw new BadRequestException('Votre compte a été suspendu par Shoneya : contactez le support.');
    }
    if (!partenaireEnPause(partner)) throw new BadRequestException('Votre compte n’est pas en pause.');
    await this.partnerRepo.update(partner.id, { suspendedUntil: null });
    this.logger.log(`[DANGER] Activité reprise — userId=${userId}`);
    return { message: 'Activité reprise : votre lien de parrainage est de nouveau actif.', enPause: false, pauseJusquau: null };
  }

  async supprimerCompte(userId: string, dto: PartenaireDangerConfirmDto) {
    await this.verifyPassword(userId, dto.password);
    const partner = await this.findOrFail(userId);

    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (wallet && (Number(wallet.balance) > 0 || Number(wallet.pendingBalance) > 0)) {
      throw new BadRequestException('Impossible de supprimer le compte : votre portefeuille contient encore des commissions. Retirez-les d’abord.');
    }

    /* La fiche est conservée (historique des commissions, acteurs recrutés) mais désactivée */
    await this.partnerRepo.update(partner.id, { suspendedUntil: PAUSE_PARTENAIRE_INDEFINIE });
    await this.closeAllSessions(userId);
    await this.userRepo.softDelete(userId);   // anonymisé après 30 jours (AccountPurgeCronService)

    this.logger.error(`[DANGER] ⚠️ Compte partenaire SUPPRIMÉ — userId=${userId} | partnerId=${partner.id} (anonymisation dans 30 jours)`);
    return { message: 'Compte supprimé. Vos données personnelles seront effacées définitivement dans 30 jours.' };
  }

  /* ── Helpers ── */

  private assertPeutSeMettreEnPause(p: Partner) {
    if (p.status === PartnerStatus.SUSPENDED) {
      throw new BadRequestException('Votre compte est suspendu : cette action n’est pas disponible.');
    }
    if (partenaireEnPause(p)) throw new BadRequestException('Votre compte est déjà en pause.');
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
    const user = await this.userRepo.findOne({
      where:  { id: userId },
      select: ['id', 'password'],
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    const valid = await bcrypt.compare(password ?? '', user.password);
    if (!valid) {
      throw new UnauthorizedException('Mot de passe incorrect. Action refusée.');
    }
  }

  async findOrFail(userId: string): Promise<Partner> {
    const p = await this.partnerRepo.findOne({ where: { userId } });
    if (!p) throw new NotFoundException('Profil partenaire introuvable.');
    return p;
  }
}
