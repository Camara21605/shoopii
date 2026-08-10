/* ============================================================
 * FICHIER : src/modules/auth/account-link.service.ts
 *
 * RÔLE : Logique métier de "Mon espace" — un compte pro (entreprise,
 *        livreur, correspondant, admin, partenaire) peut posséder un
 *        compte client lié, même email/téléphone, et basculer entre
 *        les deux sans se ré-authentifier.
 *
 * ARCHITECTURE (voir account-link.entity.ts) : deux lignes `users`
 * distinctes reliées par une ligne `account_links`, jamais fusionnées.
 * Le bannissement/statut de l'un ne se propage JAMAIS à l'autre — ce
 * service ne fait jamais de vérification croisée de statut entre les
 * deux comptes, volontairement.
 * ============================================================ */

import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { AccountLink, AccountLinkMethod, AccountLinkVerification, AccountLinkStatus } from '../../database/entities/account-link.entity';
import { User, UserStatus } from '../../database/entities/user.entity';
import { Client } from '../../database/entities/profiles/client-profile.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { AuthService, AuthServiceResult, TwoFaChallengeResult } from './auth.service';
import { TwoFaService } from './twofa/twofa.service';

const BCRYPT_ROUNDS = 12;

/** Code erreur Postgres "unique_violation" — TypeORM le recopie tel quel
 *  sur QueryFailedError (driver pg). Sert de dernier rempart contre une
 *  race condition gagnée par la contrainte DB (les gardes applicatifs
 *  au-dessus ne voient rien tant que l'autre transaction n'a pas commité). */
function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === '23505';
}

/** Rôles pro pouvant posséder un compte client lié — CLIENT et SUPER_ADMIN exclus. */
const PRO_ROLES: UserRole[] = [
  UserRole.COMPANY, UserRole.DELIVERY, UserRole.CORRESPONDENT, UserRole.PARTNER, UserRole.ADMIN,
];

export interface ClientAccountStatus {
  linked: boolean;
  /** Rempli uniquement si linked=true. */
  otherUserId?: string;
  otherRole?:   UserRole;
  /** Rempli uniquement si linked=false : un compte client non lié existe déjà
   *  avec le même email/téléphone → l'utilisateur doit prouver qu'il le possède
   *  avant liaison (jamais automatique). */
  existingClientFound?: boolean;
  /** Quel champ a permis de le retrouver — affiché côté frontend pour que
   *  l'utilisateur comprenne pourquoi ce compte lui est proposé. */
  matchedBy?: 'email' | 'phone';
}

interface UnlinkedClientMatch {
  user:      User;
  matchedBy: 'email' | 'phone';
}

@Injectable()
export class AccountLinkService {
  private readonly logger = new Logger(AccountLinkService.name);

  constructor(
    @InjectRepository(User)        private readonly userRepo:        Repository<User>,
    @InjectRepository(Client)      private readonly clientRepo:      Repository<Client>,
    @InjectRepository(Wallet)      private readonly walletRepo:      Repository<Wallet>,
    @InjectRepository(AccountLink) private readonly linkRepo:        Repository<AccountLink>,
    private readonly dataSource:  DataSource,
    private readonly authService: AuthService,
    private readonly twoFaService: TwoFaService,
  ) {}

  // ── GET /auth/client-account/status ───────────────────────────

  async getStatus(currentUserId: string): Promise<ClientAccountStatus> {
    const existingLink = await this.linkRepo.findOne({
      where: [
        { proUserId: currentUserId, status: AccountLinkStatus.ACTIVE },
        { clientUserId: currentUserId, status: AccountLinkStatus.ACTIVE },
      ],
    });
    if (existingLink) {
      const otherUserId = existingLink.proUserId === currentUserId
        ? existingLink.clientUserId : existingLink.proUserId;
      const other = await this.userRepo.findOne({ where: { id: otherUserId } });
      return { linked: true, otherUserId, otherRole: other?.role };
    }

    const me = await this.userRepo.findOneOrFail({ where: { id: currentUserId } });
    if (!PRO_ROLES.includes(me.role)) return { linked: false };

    const existingClient = await this.findUnlinkedClientMatching(me);
    return existingClient
      ? { linked: false, existingClientFound: true, matchedBy: existingClient.matchedBy }
      : { linked: false, existingClientFound: false };
  }

  /** Compte CLIENT non lié partageant l'email OU le téléphone du compte pro. */
  private async findUnlinkedClientMatching(proUser: User): Promise<UnlinkedClientMatch | null> {
    const [byEmail, byPhone] = await Promise.all([
      this.userRepo.find({ where: { email: proUser.email, role: UserRole.CLIENT } }),
      proUser.phone
        ? this.userRepo.find({ where: { phone: proUser.phone, role: UserRole.CLIENT } })
        : Promise.resolve([] as User[]),
    ]);

    /* Seuls les liens ACTIFS comptent — un client dont le seul lien a été
     * révoqué redevient éligible à une nouvelle liaison. */
    const linkedClientIds = new Set(
      (await this.linkRepo.find({ where: { status: AccountLinkStatus.ACTIVE }, select: ['clientUserId'] }))
        .map(l => l.clientUserId),
    );

    const unlinkedByEmail = byEmail.find(c => !linkedClientIds.has(c.id));
    if (unlinkedByEmail) return { user: unlinkedByEmail, matchedBy: 'email' };

    const unlinkedByPhone = byPhone.find(c => !linkedClientIds.has(c.id));
    if (unlinkedByPhone) return { user: unlinkedByPhone, matchedBy: 'phone' };

    return null;
  }

  // ── POST /auth/create-linked-client ───────────────────────────

  async createLinkedClient(proUserId: string, password: string): Promise<AuthServiceResult> {
    const proUser = await this.userRepo.findOneOrFail({ where: { id: proUserId } });
    if (!PRO_ROLES.includes(proUser.role)) {
      throw new ForbiddenException('Ce compte ne peut pas avoir de compte client lié.');
    }

    /* Idempotent : si déjà lié, on ne recrée rien — on connecte directement
     * au compte client existant (évite une erreur confuse en cas de double clic). */
    const existingLink = await this.linkRepo.findOne({ where: { proUserId, status: AccountLinkStatus.ACTIVE } });
    if (existingLink) {
      const clientUser = await this.userRepo.findOne({ where: { id: existingLink.clientUserId } });
      if (clientUser) {
        return this.authService.issueTokensForUser(clientUser, false, null, null);
      }
      /* Compte cible soft-supprimé entre-temps : le lien "actif" pointe dans
       * le vide. On le révoque au lieu de planter (findOneOrFail exclut les
       * lignes soft-deleted) pour laisser le pro recréer un nouveau compte
       * client lié ci-dessous — sans ça il resterait bloqué indéfiniment. */
      await this.linkRepo.update(existingLink.id, { status: AccountLinkStatus.REVOKED, revokedAt: new Date() });
      this.logger.warn(`[MON ESPACE ⚠️ lien orphelin révoqué] pro=${proUserId} → client=${existingLink.clientUserId} (compte cible introuvable)`);
    }

    /* Un compte CLIENT avec cet email/téléphone peut déjà exister sans être
     * "trouvable" par findUnlinkedClientMatching() — typiquement parce qu'il
     * est déjà lié à un AUTRE compte pro (deux pros partageant par coïncidence
     * les mêmes coordonnées, ou double clic concurrent sur "Créer"). Sans ce
     * garde, l'INSERT plus bas violerait silencieusement UNIQ_user_email_role
     * et remonterait une erreur Postgres brute plutôt qu'un message clair. */
    const anyExistingClient = await this.userRepo.findOne({
      where: proUser.phone
        ? [{ email: proUser.email, role: UserRole.CLIENT }, { phone: proUser.phone, role: UserRole.CLIENT }]
        : [{ email: proUser.email, role: UserRole.CLIENT }],
    });
    if (anyExistingClient) {
      throw new ConflictException(
        "Un compte client existe déjà avec cet email/téléphone, lié à un autre compte professionnel. " +
        'Contactez le support Shopi si vous pensez qu\'il s\'agit d\'une erreur.',
      );
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const username = await this.authService.generateUniqueUsername(proUser.firstName, proUser.lastName);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let clientUser: User;
    try {
      const clientEntity = this.userRepo.create({
        firstName: proUser.firstName,
        lastName:  proUser.lastName,
        email:     proUser.email,
        phone:     proUser.phone,
        phoneHash: proUser.phoneHash,
        username,
        password:  hashedPassword,
        role:      UserRole.CLIENT,
        status:    UserStatus.ACTIVE,
      });
      clientUser = await queryRunner.manager.save(User, clientEntity);

      await queryRunner.manager.save(Client, this.clientRepo.create({
        userId:   clientUser.id,
        fullName: `${clientUser.firstName} ${clientUser.lastName}`.trim(),
        status:   'active' as any,
      }));

      await queryRunner.manager.save(Wallet, this.walletRepo.create({ userId: clientUser.id }));

      await queryRunner.manager.save(AccountLink, this.linkRepo.create({
        proUserId,
        clientUserId: clientUser.id,
        linkMethod:   AccountLinkMethod.QUICK_CREATE,
        verifiedVia:  null,
        status:       AccountLinkStatus.ACTIVE,
        linkedAt:     new Date(),
      }));

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[MON ESPACE ❌ création] pro=${proUserId} | ${(err as Error).message}`);
      if (isUniqueViolation(err)) {
        throw new ConflictException('Ce compte a déjà été lié entre-temps. Rechargez la page.');
      }
      throw err;
    } finally {
      await queryRunner.release();
    }

    this.logger.log(`[MON ESPACE ✅ création] pro=${proUserId} → client=${clientUser.id}`);
    return this.authService.issueTokensForUser(clientUser, false, null, null);
  }

  // ── POST /auth/link-existing-client ───────────────────────────

  /**
   * @param proof soit { password } (mot de passe du compte client ciblé),
   *               soit { resetToken } (obtenu via le flux OTP existant
   *               forgot-password → verify-otp, réutilisé tel quel comme
   *               preuve de possession — voir AuthService.verifyResetToken).
   */
  async linkExistingClient(
    proUserId: string,
    proof: { password?: string; resetToken?: string },
  ): Promise<AuthServiceResult> {
    const proUser = await this.userRepo.findOneOrFail({ where: { id: proUserId } });
    if (!PRO_ROLES.includes(proUser.role)) {
      throw new ForbiddenException('Ce compte ne peut pas avoir de compte client lié.');
    }

    const existingLink = await this.linkRepo.findOne({ where: { proUserId, status: AccountLinkStatus.ACTIVE } });
    if (existingLink) {
      const clientUser = await this.userRepo.findOne({ where: { id: existingLink.clientUserId } });
      if (clientUser) {
        return this.authService.issueTokensForUser(clientUser, false, null, null);
      }
      await this.linkRepo.update(existingLink.id, { status: AccountLinkStatus.REVOKED, revokedAt: new Date() });
      this.logger.warn(`[MON ESPACE ⚠️ lien orphelin révoqué] pro=${proUserId} → client=${existingLink.clientUserId} (compte cible introuvable)`);
    }

    const match = await this.findUnlinkedClientMatching(proUser);
    if (!match) {
      throw new BadRequestException("Aucun compte client existant trouvé pour cet email/téléphone.");
    }
    const candidate = match.user;

    let verifiedVia: AccountLinkVerification;
    if (proof.resetToken) {
      let payload: { sub: string; purpose: string };
      try {
        payload = this.authService.verifyResetToken(proof.resetToken);
      } catch {
        throw new ForbiddenException('Preuve de possession invalide ou expirée. Recommencez.');
      }
      if (payload.purpose !== 'password-reset' || payload.sub !== candidate.id) {
        throw new ForbiddenException("Cette preuve ne correspond pas au compte client à lier.");
      }
      verifiedVia = AccountLinkVerification.OTP_EMAIL;
    } else if (proof.password) {
      /* Même verrouillage que /auth/login sur ce compte CIBLE : sans ça, ce
       * chemin permettrait de tester un mot de passe sans aucune limite —
       * handleFailedLogin() applique le compteur d'échecs/lockout partagé. */
      if (candidate.lockedUntil && candidate.lockedUntil > new Date()) {
        const min = Math.ceil((candidate.lockedUntil.getTime() - Date.now()) / 60_000);
        throw new ForbiddenException(`Compte verrouillé. Réessayez dans ${min} minute(s).`);
      }

      const withPwd = await this.userRepo
        .createQueryBuilder('u')
        .select(['u.id', 'u.password'])
        .where('u.id = :id', { id: candidate.id })
        .getOne();
      const valid = await bcrypt.compare(proof.password, withPwd!.password);
      if (!valid) {
        await this.authService.handleFailedLogin(candidate);
        throw new ForbiddenException('Mot de passe incorrect pour ce compte client.');
      }
      verifiedVia = AccountLinkVerification.PASSWORD;
    } else {
      throw new BadRequestException('Un mot de passe ou un code de vérification est requis.');
    }

    /* L'index unique partiel UNIQ_account_link_client_active en base est le
     * vrai garde-fou — ce check applicatif ne fait que produire un message
     * d'erreur clair plutôt qu'une 500 (race condition possible entre les
     * deux, mais l'index reste la source de vérité finale). */
    const alreadyLinkedElsewhere = await this.linkRepo.findOne({
      where: { clientUserId: candidate.id, status: AccountLinkStatus.ACTIVE },
    });
    if (alreadyLinkedElsewhere) {
      throw new ConflictException('Ce compte client est déjà lié à un autre compte professionnel.');
    }

    try {
      await this.linkRepo.save(this.linkRepo.create({
        proUserId,
        clientUserId: candidate.id,
        linkMethod:   AccountLinkMethod.EXISTING_VERIFIED,
        verifiedVia,
        status:       AccountLinkStatus.ACTIVE,
        linkedAt:     new Date(),
      }));
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Ce compte a déjà été lié entre-temps. Rechargez la page.');
      }
      throw err;
    }

    this.logger.log(`[MON ESPACE ✅ liaison] pro=${proUserId} → client=${candidate.id} via=${verifiedVia}`);
    return this.authService.issueTokensForUser(candidate, false, null, null);
  }

  // ── POST /auth/switch-account ──────────────────────────────────

  async switchAccount(currentUserId: string): Promise<AuthServiceResult | TwoFaChallengeResult> {
    const link = await this.linkRepo.findOne({
      where: [
        { proUserId: currentUserId, status: AccountLinkStatus.ACTIVE },
        { clientUserId: currentUserId, status: AccountLinkStatus.ACTIVE },
      ],
    });
    if (!link) throw new BadRequestException('Aucun compte lié à basculer.');

    const targetUserId = link.proUserId === currentUserId ? link.clientUserId : link.proUserId;
    /* findOne() exclut les lignes soft-deleted par défaut (pas de
     * withDeleted:true) — un compte supprimé est donc déjà traité comme
     * "introuvable" ici, sans logique supplémentaire à écrire. */
    const target = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!target) throw new BadRequestException('Compte lié introuvable.');

    /* Même contrôle que JwtStrategy — le bannissement ne se propage pas
     * entre comptes liés (jamais de vérification croisée sur le compte
     * SOURCE ici), mais un compte banni reste inaccessible pour lui-même,
     * switch inclus. */
    if (target.status === UserStatus.BANNED) {
      throw new ForbiddenException('Ce compte a été banni. Contactez le support Shopi.');
    }
    if (target.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Ce compte est suspendu. Contactez le support Shopi.');
    }

    /* Step-up 2FA : si la CIBLE a la 2FA active, l'exiger avant de finaliser
     * — sauf si déjà validée pour ce couple source→cible il y a moins de
     * SWITCH_2FA_GRACE_S (pas de code à ressaisir à chaque bascule pendant
     * la même session). */
    if (await this.twoFaService.isEnabled(target.role as UserRole, target.id)) {
      const graced = await this.authService.isSwitch2faGraced(currentUserId, targetUserId);
      if (!graced) {
        const challengeToken = this.authService.signSwitchTwoFaChallenge(targetUserId, currentUserId);
        this.logger.log(`[MON ESPACE 🔐 2FA requise] ${currentUserId} → ${targetUserId}`);
        return { requiresTwoFa: true, challengeToken };
      }
    }

    /* Journal d'audit : "qui, de quel compte vers quel compte, quand".
     * AuthLog n'a pas de colonne dédiée "fromUserId" — failureReason est un
     * simple varchar(255) libre malgré son nom, réutilisé ici pour porter
     * ce détail plutôt que d'ajouter une migration pour un seul champ. */
    this.authService.logEvent('account_switch', {
      userId: targetUserId, role: target.role,
      success: true, failureReason: `from=${currentUserId}`,
    });
    this.logger.log(`[MON ESPACE 🔀 switch] ${currentUserId} → ${targetUserId}`);
    return this.authService.issueTokensForUser(target, false, null, null);
  }

  // ── DELETE /auth/account-link ──────────────────────────────────

  /**
   * Délie le compte connecté (pro OU client) de son compte lié — marque
   * le lien `revoked`, JAMAIS de suppression/désactivation en cascade de
   * l'autre compte (voir l'en-tête du fichier : ce n'est qu'un pointeur
   * d'identité, pas une fusion). Les deux comptes restent utilisables
   * indépendamment ensuite, chacun avec son propre mot de passe.
   */
  async unlinkAccount(currentUserId: string): Promise<{ message: string }> {
    const link = await this.linkRepo.findOne({
      where: [
        { proUserId: currentUserId, status: AccountLinkStatus.ACTIVE },
        { clientUserId: currentUserId, status: AccountLinkStatus.ACTIVE },
      ],
    });
    if (!link) throw new BadRequestException('Aucun compte lié à délier.');

    await this.linkRepo.update(link.id, { status: AccountLinkStatus.REVOKED, revokedAt: new Date() });

    this.authService.logEvent('account_unlink', {
      userId: currentUserId, success: true, failureReason: `link=${link.id}`,
    });
    this.logger.log(`[MON ESPACE 🔓 déliaison] ${currentUserId} (lien ${link.id})`);
    return { message: 'Compte délié avec succès. Vos deux comptes restent actifs indépendamment.' };
  }
}
