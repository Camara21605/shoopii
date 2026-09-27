/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/services/danger-parametres.service.ts
 *
 * RÔLE : Gère la zone sensible (section 12)
 *   PATCH /parametres/danger/pause       → mettre en pause la boutique
 *   PATCH /parametres/danger/desactiver  → désactiver 30 jours
 *   DELETE /parametres/danger/supprimer  → supprimer la boutique ET le compte
 *
 * Mot de passe actuel exigé pour les 3 actions ; propriétaire uniquement
 * (TeamOwnerGuard, voir parametres.controller.ts).
 *
 * BUGS CORRIGÉS :
 *   - Suppression : `companyRepo.remove()` effaçait la fiche entreprise alors
 *     que les commandes y font référence (clé sans contrainte : commandes
 *     orphelines, historique client cassé) et laissait le compte utilisateur
 *     actif, connectable, sans boutique. Désormais, comme pour un client
 *     (client/services/preferences.service.ts) : refus s'il reste des
 *     commandes en cours ou des fonds au portefeuille, boutique masquée,
 *     sessions fermées, compte supprimé (soft delete) puis anonymisé au bout
 *     de 30 jours par jobs/account-purge.cron.service.ts.
 *   - Pause : après une désactivation 30 j, la date de réactivation restait
 *     en place et le cron (jobs/expiry-cron.service.ts) rouvrait une boutique
 *     que l'on venait de mettre en pause sans limite de durée.
 *   - `save()` d'une entité entière écrasait les colonnes modifiées entre-temps
 *     par une autre requête : seules les colonnes concernées sont écrites.
 * ============================================================ */

import {
  Injectable, NotFoundException, UnauthorizedException, BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { IsString, MinLength } from 'class-validator';

import {
  Company,
  CompanyStatus,
} from 'src/database/entities/profiles/entreprise-profile.entity';
import { User } from 'src/database/entities/user.entity';
import { RefreshToken } from 'src/database/entities/refresh-token.entity';
import { Wallet } from 'src/database/entities/wallet.entity';
import { Commande, CommandeStatus } from 'src/database/entities/commande/commande.entity';
import { SessionService } from 'src/modules/session/session.service';

/* ── DTO de confirmation (mot de passe requis pour toute action sensible) ── */
export class DangerConfirmDto {
  @IsString()
  @MinLength(1)
  password!: string;
}

@Injectable()
export class DangerParametresService {

  private readonly logger = new Logger(DangerParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(RefreshToken) private readonly tokenRepo:    Repository<RefreshToken>,
    @InjectRepository(Wallet)       private readonly walletRepo:   Repository<Wallet>,
    @InjectRepository(Commande)     private readonly commandeRepo: Repository<Commande>,
    private readonly sessionService: SessionService,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * PATCH — Mettre la boutique en pause (sans limite de durée)
   * La boutique est masquée mais toutes les données sont conservées ;
   * elle se rouvre depuis Paramètres > Boutique (« Visible »).
   * ────────────────────────────────────────────────────────── */

  async pauseBoutique(userId: string, dto: DangerConfirmDto): Promise<{ message: string }> {
    await this.verifyPassword(userId, dto.password);
    const company = await this.findCompanyOrFail(userId);

    await this.companyRepo.update(company.id, { status: CompanyStatus.SUSPENDED, suspendedUntil: null });

    this.logger.warn(`[DANGER] Boutique mise en pause — userId=${userId}`);
    return { message: 'Boutique mise en pause. Réactivez-la depuis les paramètres.' };
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Désactiver 30 jours
   * Comme la pause, avec une réouverture automatique (expiry-cron).
   * ────────────────────────────────────────────────────────── */

  async desactiverCompte(userId: string, dto: DangerConfirmDto): Promise<{ message: string; reactivationAt: Date }> {
    await this.verifyPassword(userId, dto.password);
    const company = await this.findCompanyOrFail(userId);

    const reactivationAt = new Date();
    reactivationAt.setDate(reactivationAt.getDate() + 30);

    await this.companyRepo.update(company.id, { status: CompanyStatus.SUSPENDED, suspendedUntil: reactivationAt });
    this.logger.warn(
      `[DANGER] Boutique désactivée 30j — userId=${userId} | réactivation le ${reactivationAt.toISOString()}`,
    );
    return {
      message:         'Boutique désactivée. Elle rouvrira automatiquement dans 30 jours.',
      reactivationAt,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * DELETE — Supprimer la boutique et le compte
   * Irréversible pour l'utilisateur ; la fiche entreprise reste (masquée)
   * car les commandes passées y font référence.
   * ────────────────────────────────────────────────────────── */

  async supprimerBoutique(userId: string, dto: DangerConfirmDto): Promise<{ message: string }> {
    await this.verifyPassword(userId, dto.password);
    const company = await this.findCompanyOrFail(userId);
    const ownerId = company.userId;

    const enCours = await this.commandeRepo.count({
      where: {
        companyId: company.id,
        status: In([CommandeStatus.PENDING, CommandeStatus.PAID, CommandeStatus.IN_PROGRESS, CommandeStatus.AWAITING_CLIENT, CommandeStatus.DISPUTED]),
      },
    });
    if (enCours > 0) {
      throw new BadRequestException(`Impossible de supprimer la boutique : ${enCours} commande(s) en cours ou en litige. Attendez leur fin puis réessayez.`);
    }
    const wallet = await this.walletRepo.findOne({ where: { userId: ownerId } });
    if (wallet && (Number(wallet.balance) > 0 || Number(wallet.pendingBalance) > 0)) {
      throw new BadRequestException('Impossible de supprimer la boutique : votre portefeuille contient encore des fonds. Retirez-les d’abord.');
    }

    await this.companyRepo.update(company.id, { status: CompanyStatus.SUSPENDED, suspendedUntil: null });
    await this.closeAllSessions(ownerId);
    await this.userRepo.softDelete(ownerId);

    this.logger.error(`[DANGER] Boutique et compte SUPPRIMÉS — userId=${ownerId} | companyId=${company.id} (anonymisation dans 30 jours)`);
    return { message: 'Boutique et compte supprimés. Vos données personnelles seront effacées définitivement dans 30 jours.' };
  }

  /* ──────────────────────────────────────────────────────────
   * HELPERS PRIVÉS
   * ────────────────────────────────────────────────────────── */

  /** Ferme TOUTES les sessions du compte : refresh tokens, sessions Redis, jetons d'accès déjà émis. */
  private async closeAllSessions(userId: string): Promise<void> {
    const active = await this.tokenRepo.find({ where: { userId, revoked: false }, select: ['id', 'sessionId'] });
    await this.tokenRepo.update({ userId, revoked: false }, { revoked: true, revokedReason: 'ACCOUNT_CLOSED' });
    for (const sid of new Set(active.map(t => t.sessionId).filter((x): x is string => !!x))) {
      await this.sessionService.endSession(userId, sid).catch(() => undefined);
    }
    await this.userRepo.update(userId, { lastLogoutAt: new Date() });   // invalide les access tokens déjà émis
  }


  /**
   * Vérifie que le mot de passe fourni correspond bien au compte.
   * Appelé AVANT toute action sensible.
   */
  private async verifyPassword(userId: string, password: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'password'],
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Mot de passe incorrect. Action refusée.');
    }
  }

  /* FIX m4 (historique, param client) — sans rapport ici : `userId` est en
   * réalité req.user.actorId, signé serveur (voir boutique-parametres.
   * service.ts pour le détail du bug que ce `[{id},{userId}]` corrige). */
  /* BUG CORRIGÉ (suite) — le commentaire précédent affirmait qu'un OR
   * `where:[{id},{userId}]` ne pouvait "que" bloquer en 404, jamais
   * supprimer la mauvaise fiche. C'est faux dès qu'un profil fantôme
   * existe (userId d'une fiche == id d'une autre, cf. le bug de création
   * dans getParametres) : les DEUX fiches matchent alors l'OR, et l'ordre
   * de retour SQL sans ORDER BY n'est pas garanti — supprimerBoutique()
   * aurait pu supprimer la fiche fantôme OU la vraie selon le plan de
   * requête. `id` (cas normal, actorId) est désormais toujours tenté en
   * priorité ; `userId` n'est qu'un repli déterministe. */
  private async findCompanyOrFail(userId: string): Promise<Company> {
    let company = await this.companyRepo.findOne({ where: { id: userId } });
    if (!company) company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}
