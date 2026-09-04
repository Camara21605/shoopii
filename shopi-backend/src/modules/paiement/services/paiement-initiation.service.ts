/* ============================================================
 * FICHIER : src/modules/paiement/services/paiement-initiation.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Orchestre l'initiation d'un paiement pour une commande.
 *
 * Étapes :
 *   1. Valide la commande (status PENDING, montant cohérent)
 *   2. Vérifie qu'aucune session CONFIRMED n'existe déjà
 *   3. Crée une PaiementSession avec status INITIATED
 *   4. Appelle le provider via PaymentProviderFactory
 *   5. Met à jour la session avec le providerTransactionId
 *   6. Si provider = internal → confirme immédiatement
 *   7. Retourne les données nécessaires pour le frontend
 *
 * ─────────────────────────────────────────────────────────────
 * IDEMPOTENCE
 * ─────────────────────────────────────────────────────────────
 *
 *  Si la même commande est soumise deux fois :
 *    → On retourne la session en cours si status IN (INITIATED, PENDING)
 *    → On crée une nouvelle session si la précédente est FAILED/EXPIRED
 *    → On rejette si CONFIRMED (déjà payé)
 *
 * ─────────────────────────────────────────────────────────────
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/modules/paiement/services/paiement-initiation.service.ts
 * ============================================================ */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService }    from '@nestjs/config';
import { Repository }       from 'typeorm';
import { randomUUID }       from 'crypto';

import { Commande, CommandeStatus } from '../../../database/entities/commande/commande.entity';
import { User }                     from '../../../database/entities/user.entity';
import { UserRole }                 from '../../../common/enums/user-role.enum';
import {
  PaiementSession,
  PaiementSessionStatus,
  PaiementProvider,
  MethodePaiementSession,
} from '../../../database/entities/paiement/paiement-session.entity';

import { PaymentProviderFactory }       from '../providers/payment-provider.factory';
import { PaiementWebhookService }       from './paiement-webhook.service';
import type { InitierPaiementDto }      from '../dto/initier-paiement.dto';
import { PlatformSettingsCacheService } from '../../performance-engine/services/platform-settings-cache.service';
import type { PlatformSettings }        from '../../../database/entities/platform-settings.entity';

/* ─── Durée de validité d'une session de paiement ────────────── */
const SESSION_TTL_MS = 60 * 60 * 1000;  // 1 heure

/** Association méthode de paiement mobile money → colonne PlatformSettings
 *  correspondante. Les autres méthodes (carte, virement, wallet, cash) ne
 *  sont pas concernées par ces interrupteurs. */
const METHODE_SETTING_KEY: Partial<Record<MethodePaiementSession, keyof PlatformSettings>> = {
  [MethodePaiementSession.ORANGE_MONEY]: 'orangeMoneyEnabled',
  [MethodePaiementSession.MTN_MONEY]:    'mtnMoneyEnabled',
  [MethodePaiementSession.WAVE]:         'waveEnabled',
};

@Injectable()
export class PaiementInitiationService {

  private readonly logger     = new Logger(PaiementInitiationService.name);
  private readonly frontendUrl: string;
  private readonly backendUrl:  string;

  constructor(
    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(PaiementSession)
    private readonly sessionRepo: Repository<PaiementSession>,

    private readonly providerFactory: PaymentProviderFactory,
    private readonly webhookService:  PaiementWebhookService,
    private readonly config:          ConfigService,

    /* BUG CORRIGÉ — PlatformSettings.mtnMoneyEnabled/orangeMoneyEnabled/
     * waveEnabled (Paramètres Plateforme > Paiements) se sauvegardaient en
     * base sans jamais être lus : un client pouvait payer par n'importe quel
     * opérateur même désactivé par le super-admin. */
    private readonly settingsCache: PlatformSettingsCacheService,
  ) {
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    this.backendUrl  = config.get<string>('BACKEND_URL')  ?? 'http://localhost:3001';
  }

  /* ════════════════════════════════════════════════════════
   * POST /paiement/initier
   ════════════════════════════════════════════════════════ */

  async initier(
    user: User,
    dto:  InitierPaiementDto,
  ): Promise<{
    sessionId:   string;
    redirectUrl: string | null;
    ussdCode:    string | null;
    status:      string;
    message:     string;
  }> {

    /* ── 1. Valider la commande ─────────────────────────────── */

    const commande = await this.commandeRepo.findOne({
      where: { id: dto.commandeId },
    });

    if (!commande) {
      throw new NotFoundException('Commande introuvable.');
    }

    /* Autorisation — seul le client propriétaire de la commande peut en
     * initier le paiement. Sans ce contrôle, n'importe quel utilisateur
     * authentifié pouvait payer (et, en mode provider "internal", faire
     * auto-confirmer) la commande d'un autre client en devinant/obtenant
     * son UUID — un vecteur de fraude direct. */
    const actorId = (user as any).actorId as string | undefined;
    if (commande.clientId !== actorId) {
      throw new ForbiddenException("Cette commande ne vous appartient pas.");
    }

    if (commande.status !== CommandeStatus.PENDING) {
      if (commande.status === CommandeStatus.PAID) {
        throw new ConflictException('Cette commande a déjà été payée.');
      }
      throw new BadRequestException(
        `La commande est dans un statut incompatible avec un paiement: "${commande.status}".`,
      );
    }

    /* ── 2. Vérifier idempotence — session déjà confirmée ? ─── */

    const existingConfirmed = await this.sessionRepo.findOne({
      where: {
        commandeId: dto.commandeId,
        status:     PaiementSessionStatus.CONFIRMED,
      },
    });
    if (existingConfirmed) {
      throw new ConflictException('Un paiement confirmé existe déjà pour cette commande.');
    }

    /* Session INITIATED ou PENDING en cours → la renvoyer */
    const existingActive = await this.sessionRepo.findOne({
      where: [
        { commandeId: dto.commandeId, status: PaiementSessionStatus.INITIATED },
        { commandeId: dto.commandeId, status: PaiementSessionStatus.PENDING   },
      ],
    });
    if (existingActive && existingActive.expiresAt && existingActive.expiresAt > new Date()) {
      this.logger.log(`[Initiation] Session active réutilisée: ${existingActive.id}`);
      return {
        sessionId:   existingActive.id,
        redirectUrl: existingActive.redirectUrl,
        ussdCode:    existingActive.ussdCode,
        status:      existingActive.status,
        message:     'Session de paiement en cours.',
      };
    }

    /* ── 3. Résoudre le provider ────────────────────────────── */

    const methode = dto.methode as MethodePaiementSession;

    const settingKey = METHODE_SETTING_KEY[methode];
    if (settingKey) {
      const settings = await this.settingsCache.getSettings();
      if (!settings[settingKey]) {
        throw new BadRequestException(
          `Le moyen de paiement "${methode}" n'est actuellement pas disponible sur la plateforme.`,
        );
      }
    }

    const provider = this.providerFactory.resolve(methode);

    /* ── 4. Créer la PaiementSession ───────────────────────── */

    const idempotencyKey = `${dto.commandeId}_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const expiresAt      = new Date(Date.now() + SESSION_TTL_MS);

    const session = this.sessionRepo.create({
      commandeId:     dto.commandeId,
      commandeNumero: commande.numero,
      montant:        Number(commande.total),
      devise:         'GNF',
      provider:       provider.name as PaiementProvider,
      methode:        methode,
      status:         PaiementSessionStatus.INITIATED,
      idempotencyKey,
      clientUserId:   user.id,
      phonePaiement:  dto.phone ?? null,
      expiresAt,
    });
    const saved = await this.sessionRepo.save(session);

    this.logger.log(
      `[Initiation] Session ${saved.id} créée — commande: ${commande.numero} ` +
      `montant: ${commande.total} GNF — provider: ${provider.name}`,
    );

    /* ── 5. Appeler le provider ─────────────────────────────── */

    try {
      const result = await provider.createPayment({
        idempotencyKey,
        montant:        Number(commande.total),
        devise:         'GNF',
        phonePaiement:  dto.phone,
        methode,
        description:    `Commande Shopi ${commande.numero}`,
        commandeNumero: commande.numero,
        returnUrl:      `${this.frontendUrl}/commande/${dto.commandeId}/confirmation`,
        webhookUrl:     `${this.backendUrl}/api/paiement/webhook/${provider.name}`,
        clientNom:      `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        clientEmail:    user.email,
      });

      /* Mise à jour de la session avec les données provider */
      saved.providerTransactionId = result.providerTransactionId;
      saved.redirectUrl           = result.redirectUrl;
      saved.ussdCode              = result.ussdCode;
      saved.status                = PaiementSessionStatus.PENDING;
      await this.sessionRepo.save(saved);

      /* ── 6. Auto-confirmation si provider interne ────────── */

      if (provider.name === 'internal') {
        /*
         * En mode interne, le paiement est confirmé immédiatement.
         * On simule le webhook de confirmation directement.
         */
        await this.webhookService.confirmerPaiement(
          saved.id,
          result.providerTransactionId,
          Number(commande.total),
          idempotencyKey,
        );

        return {
          sessionId:   saved.id,
          redirectUrl: null,
          ussdCode:    null,
          status:      PaiementSessionStatus.CONFIRMED,
          message:     'Paiement confirmé (mode interne).',
        };
      }

      /* ── 7. Retourner les données au frontend ────────────── */

      return {
        sessionId:   saved.id,
        redirectUrl: result.redirectUrl,
        ussdCode:    result.ussdCode,
        status:      PaiementSessionStatus.PENDING,
        message:     result.redirectUrl
          ? 'Vous allez être redirigé vers la page de paiement.'
          : 'Un code vous a été envoyé par push notification.',
      };

    } catch (err) {
      /* Marquer la session comme échouée */
      saved.status       = PaiementSessionStatus.FAILED;
      saved.echecRaison  = (err as Error).message;
      await this.sessionRepo.save(saved);

      this.logger.error(`[Initiation] Échec provider pour session ${saved.id}:`, err);
      throw new BadRequestException(
        `Le paiement n'a pas pu être initié : ${(err as Error).message}`,
      );
    }
  }

  /* ── Statut d'une session ────────────────────────────────── */

  async getStatus(sessionId: string, user: User): Promise<{
    status:      string;
    confirmedAt: Date | null;
    redirectUrl: string | null;
  }> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session de paiement introuvable.');

    /* Autorisation — seul le client à l'origine du paiement peut en
     * consulter le statut (sinon fuite du statut/URL de paiement d'un
     * tiers à quiconque connaît l'UUID de session). */
    const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    if (!isAdmin && session.clientUserId !== user.id) {
      throw new ForbiddenException("Cette session de paiement ne vous appartient pas.");
    }

    return {
      status:      session.status,
      confirmedAt: session.confirmedAt,
      redirectUrl: session.redirectUrl,
    };
  }
}
