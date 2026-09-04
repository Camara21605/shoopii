/* ============================================================
 * FICHIER : src/modules/commande/services/commande-creation.service.ts
 *
 * RÔLE : création des commandes à partir du panier client.
 *   - creerDepuisPanier : POST /client/commandes
 * ============================================================ */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';

import { User } from '../../../database/entities/user.entity';
import { PanierItem } from '../../../database/entities/panier-item.entity';
import { Product } from '../../../database/entities/entreprise.table/product.entity';
import { Client } from '../../../database/entities/profiles/client-profile.entity';
import { Company } from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery } from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../database/entities/profiles/correspondant-profile.entity';
import {
  Commande, CommandeStatus, ModeLivraison, LivreurAssignmentStatus,
} from '../../../database/entities/commande/commande.entity';
import { CommandeItem } from '../../../database/entities/commande/commande-item.entity';
import {
  CommandeCode, CodeActeurType, CodeCommandeStatus,
} from '../../../database/entities/commande/commande-code.entity';

import { CreateCommandeDto } from '../dto/create-commande.dto';
import { CODE_EXPIRY_MS, genererCode, readPrix } from './commande.helpers';
import { NotificationEventService } from 'src/modules/notifications/events/notification-event.service';
import { DeliveryGroupService } from 'src/modules/delivery-group/delivery-group.service';
import { PaiementInitiationService } from 'src/modules/paiement/services/paiement-initiation.service';
import { MethodePaiementSession } from '../../../database/entities/paiement/paiement-session.entity';

@Injectable()
export class CommandeCreationService {
  constructor(
    @InjectRepository(Commande) private readonly commandeRepo: Repository<Commande>,
    @InjectRepository(CommandeItem) private readonly itemRepo: Repository<CommandeItem>,
    @InjectRepository(CommandeCode) private readonly codeRepo: Repository<CommandeCode>,
    @InjectRepository(PanierItem) private readonly panierRepo: Repository<PanierItem>,
    @InjectRepository(Product)    private readonly productRepo: Repository<Product>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(Delivery) private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Correspondent)       private readonly correspondantRepo:     Repository<Correspondent>,
    @InjectRepository(PlatformSettings)   private readonly platformSettingsRepo:  Repository<PlatformSettings>,
    private readonly notifEventSvc: NotificationEventService,
    private readonly deliveryGroupSvc: DeliveryGroupService,
    private readonly paiementInitiationSvc: PaiementInitiationService,
  ) {}

  /* ════════════════════════════════════════════════════════
   * POST /client/commandes — créer une/des commandes depuis le panier
   ════════════════════════════════════════════════════════ */
  async creerDepuisPanier(user: User, dto: CreateCommandeDto): Promise<{ id: string }> {
    const panierItems = await this.panierRepo.find({
      where: { userId: user.id },
      /* produit.media requis pour imageProduit (ligne ~154) —
       * Product.media n'est plus eager, voir product.entity.ts. */
      relations: ['produit', 'produit.media'],
    });
    if (panierItems.length === 0) throw new BadRequestException('Votre panier est vide.');

    const selected = dto.items?.length
      ? panierItems.filter(pi => dto.items!.some(i => i.panierItemId === pi.id))
      : panierItems;
    if (selected.length === 0) throw new BadRequestException('Aucun article sélectionné.');

    const client = await this.clientRepo.findOne({ where: { userId: user.id } });
    if (!client) throw new NotFoundException('Profil client introuvable.');

    let delivery: Delivery | null = null;
    if (dto.livreurId) delivery = await this.deliveryRepo.findOne({ where: { id: dto.livreurId } });

    let correspondant: Correspondent | null = null;
    if (!delivery && dto.correspondantId) {
      correspondant = await this.correspondantRepo.findOne({ where: { id: dto.correspondantId } });
    }

    /* Regrouper les articles du panier par boutique (1 commande / boutique) */
    const groups = new Map<string, PanierItem[]>();
    for (const pi of selected) {
      const companyId = (pi.produit as any)?.companyId;
      if (!companyId) continue;
      if (!groups.has(companyId)) groups.set(companyId, []);
      groups.get(companyId)!.push(pi);
    }
    if (groups.size === 0) throw new BadRequestException('Articles invalides.');

    /* ── Vérification de stock avant toute création ─────────────
     * Fail-fast : on vérifie TOUS les articles avant de créer
     * la moindre commande, pour éviter un état partiel.         */
    for (const pi of selected) {
      const produit = pi.produit as any;
      const stockActuel = produit?.stock ?? 0;
      if (pi.qty > stockActuel) {
        const nom = produit?.nom ?? 'Produit inconnu';
        throw new BadRequestException(
          `Stock insuffisant pour "${nom}" (disponible : ${stockActuel}, demandé : ${pi.qty}).`,
        );
      }
    }

    let firstCommandeId: string | null = null;

    for (const [companyId, items] of groups) {
      const company = await this.companyRepo.findOne({ where: { id: companyId } });
      if (!company) continue;

      let modeLivraison = ModeLivraison.PICKUP;
      if (delivery) modeLivraison = ModeLivraison.LIVREUR;
      else if (correspondant) modeLivraison = ModeLivraison.CORRESPONDANT;

      const sousTotal      = items.reduce((s, pi) => s + readPrix(pi.produit) * pi.qty, 0);
      const fraisLivraison = 0;

      /* Estimation affichée avant paiement (défaut 6 % — aligné sur le défaut
       * déclaré de PlatformSettings.platformCommission, voir l'entité). Ce
       * n'est qu'un aperçu transitoire : dès que initier() ci-dessous aura
       * confirmé le paiement, payment-webhook-processor.service.ts écrase ce
       * champ avec le montant RÉEL calculé par le CommissionEngine. */
      const platformSettings  = await this.platformSettingsRepo.findOne({ where: { id: 1 } });
      const commissionRate    = platformSettings
        ? Number(platformSettings.platformCommission) / 100
        : 0.06;
      const commissionShopi   = Math.round(sousTotal * commissionRate);
      const total             = sousTotal + fraisLivraison;

      const commande = this.commandeRepo.create({
        numero: await this.genererNumero(),
        clientId: client.id,
        companyId: company.id,
        livreurId: delivery?.id ?? null,
        livreurAssignmentStatus: delivery ? LivreurAssignmentStatus.PENDING : null,
        livreurAssignedBy: delivery ? 'client' : null,
        correspondantId: correspondant?.id ?? null,
        partenaireId: null,
        /* BUG CORRIGÉ — status était mis à PAID directement ici, sans jamais
         * passer par PaiementInitiationService/CommissionEngine : aucune
         * PaiementDistribution n'était jamais créée pour les commandes
         * passées via le vrai parcours d'achat, donc aucun wallet acteur
         * n'était jamais crédité (voir l'appel à initier() plus bas, qui
         * fait passer la commande à PAID pour de vrai une fois le calcul
         * de commission et le séquestre effectivement réalisés). */
        status: CommandeStatus.PENDING,
        modeLivraison,
        sousTotal,
        fraisLivraison,
        commissionShopi,
        total,
        prenomLivraison:   dto.prenomLivraison   ?? null,
        nomLivraison:      dto.nomLivraison       ?? null,
        telephoneLivraison:dto.telephoneLivraison ?? null,
        villeLivraison:    dto.villeLivraison     ?? dto.destination ?? null,
        communeLivraison:  dto.communeLivraison   ?? null,
        adresseLivraison:  dto.adressePrecise     ?? dto.destination ?? null,
        notesClient:       dto.instructions       ?? null,
        methodePaiement:   dto.payMode            ?? null,
      });
      const saved = await this.commandeRepo.save(commande);
      if (!firstCommandeId) firstCommandeId = saved.id;

      /* Articles (snapshot) */
      const commandeItems = items.map(pi => this.itemRepo.create({
        commandeId: saved.id,
        productId: pi.produitId,
        nomProduit: (pi.produit as any)?.nom ?? 'Produit',
        imageProduit: (pi.produit as any)?.media?.[0]?.url ?? null,
        varianteChoisie: pi.variante ?? null,
        quantite: pi.qty,
        prixUnitaire: readPrix(pi.produit),
        prixAncien: (pi.produit as any)?.prixAncien ?? null,
        sousTotal: readPrix(pi.produit) * pi.qty,
      }));
      await this.itemRepo.save(commandeItems);

      /* ── Décrémentation atomique du stock ───────────────────
       * Une seule requête UPDATE par produit avec GREATEST pour
       * éviter les valeurs négatives en cas de race condition.  */
      for (const pi of items) {
        await this.productRepo
          .createQueryBuilder()
          .update(Product)
          .set({ stock: () => `GREATEST(stock - ${pi.qty}, 0)` })
          .where('id = :id', { id: pi.produitId })
          .execute();
      }

      /* Notification → tous les acteurs de la commande */
      void this.notifEventSvc.notifyOrderPlaced({
        companyId:         company.id,
        clientId:          client.id,
        clientName:        client.fullName ?? `${user.firstName} ${user.lastName}`.trim(),
        orderRef:          saved.numero,
        commandeId:        saved.id,
        totalAmount:       saved.total,
        /* Livreur et correspondant sont optionnels selon le mode de livraison choisi */
        ...(delivery      && { livreurId:        delivery.id,       livreurName:        delivery.fullName       ?? '' }),
        ...(correspondant && { correspondantId:  correspondant.id,  correspondantName:  correspondant.fullName  ?? '' }),
      });

      /* Groupe de livraison automatique */
      void this.deliveryGroupSvc.createGroupForCommande(
        saved.id,
        saved.numero,
        {
          client:  { id: client.id, userId: user.id, name: client.fullName ?? `${user.firstName} ${user.lastName}`.trim() },
          company: { id: company.id, userId: company.userId, name: company.companyName },
          ...(delivery ? { livreur: { id: delivery.id, userId: delivery.userId, name: delivery.fullName ?? '' } } : {}),
          ...(correspondant ? { correspondant: { id: correspondant.id, userId: correspondant.userId, name: correspondant.fullName ?? '' } } : {}),
        },
      );

      /* Codes de validation */
      const now = new Date();
      const expiresAt = new Date(now.getTime() + CODE_EXPIRY_MS);
      const codes: CommandeCode[] = [];

      codes.push(this.codeRepo.create({
        commandeId: saved.id,
        code: genererCode(),
        acteurType: CodeActeurType.ENTREPRISE,
        acteurId: company.userId,
        acteurNom: company.companyName,
        ordre: 1,
        status: CodeCommandeStatus.PENDING,
        expiresAt,
      }));

      /* Code LIVREUR : PAS généré ici — seulement quand le livreur ACCEPTE
       * la mission (voir CommandeLivreurAssignmentService.accepter()). Tant
       * qu'il n'a pas répondu, livreurAssignmentStatus reste PENDING et
       * aucun code n'existe pour ce rôle. */

      if (correspondant) {
        codes.push(this.codeRepo.create({
          commandeId: saved.id,
          code: genererCode(),
          acteurType: CodeActeurType.CORRESPONDANT,
          acteurId: correspondant.userId,
          acteurNom: correspondant.fullName,
          ordre: 3,
          status: CodeCommandeStatus.PENDING,
          expiresAt,
        }));
      }

      /* Code client — toujours généré, verrouillé jusqu'à validation des autres */
      codes.push(this.codeRepo.create({
        commandeId: saved.id,
        code: genererCode(),
        acteurType: CodeActeurType.CLIENT,
        acteurId: user.id,
        acteurNom: client.fullName ?? `${user.firstName} ${user.lastName}`,
        ordre: 5,
        status: CodeCommandeStatus.AWAITING_UNLOCK,
        expiresAt,
      }));

      await this.codeRepo.save(codes);

      /* ── Paiement par solde Shopi (méthode WALLET → toujours résolue vers
       * InternalProvider par PaymentProviderFactory, quel que soit
       * PAYMENT_PROVIDER, car aucun provider externe ne supporte WALLET —
       * voir payment-provider.factory.ts). Confirme synchroniquement :
       * calcule la vraie répartition via CommissionEngine, crée les
       * PaiementDistribution, verrouille l'escrow, et repasse la commande
       * à PAID. Si ça échoue, la commande reste PENDING (état honnête —
       * mieux qu'un faux PAID sans aucune distribution, comme avant). */
      await this.paiementInitiationSvc.initier(user, {
        commandeId: saved.id,
        methode:    MethodePaiementSession.WALLET,
      });
    }

    /* Vider le panier après création */
    await this.panierRepo.remove(selected);

    return { id: firstCommandeId as string };
  }

  /* ── Numéro lisible "CMD-2025-00142" ── */
  private async genererNumero(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.commandeRepo.count();
    return `CMD-${year}-${String(count + 1).padStart(5, '0')}`;
  }
}
