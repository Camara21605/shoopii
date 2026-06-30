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
import { Client } from '../../../database/entities/profiles/client-profile.entity';
import { Company } from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery } from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../database/entities/profiles/correspondant-profile.entity';
import {
  Commande, CommandeStatus, ModeLivraison,
} from '../../../database/entities/commande/commande.entity';
import { CommandeItem } from '../../../database/entities/commande/commande-item.entity';
import {
  CommandeCode, CodeActeurType, CodeCommandeStatus,
} from '../../../database/entities/commande/commande-code.entity';

import { CreateCommandeDto } from '../dto/create-commande.dto';
import { CODE_EXPIRY_MS, genererCode, readPrix } from './commande.helpers';

@Injectable()
export class CommandeCreationService {
  constructor(
    @InjectRepository(Commande) private readonly commandeRepo: Repository<Commande>,
    @InjectRepository(CommandeItem) private readonly itemRepo: Repository<CommandeItem>,
    @InjectRepository(CommandeCode) private readonly codeRepo: Repository<CommandeCode>,
    @InjectRepository(PanierItem) private readonly panierRepo: Repository<PanierItem>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(Delivery) private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Correspondent)       private readonly correspondantRepo:     Repository<Correspondent>,
    @InjectRepository(PlatformSettings)   private readonly platformSettingsRepo:  Repository<PlatformSettings>,
  ) {}

  /* ════════════════════════════════════════════════════════
   * POST /client/commandes — créer une/des commandes depuis le panier
   ════════════════════════════════════════════════════════ */
  async creerDepuisPanier(user: User, dto: CreateCommandeDto): Promise<{ id: string }> {
    const panierItems = await this.panierRepo.find({
      where: { userId: user.id },
      relations: ['produit'],
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

    let firstCommandeId: string | null = null;

    for (const [companyId, items] of groups) {
      const company = await this.companyRepo.findOne({ where: { id: companyId } });
      if (!company) continue;

      let modeLivraison = ModeLivraison.PICKUP;
      if (delivery) modeLivraison = ModeLivraison.LIVREUR;
      else if (correspondant) modeLivraison = ModeLivraison.CORRESPONDANT;

      const sousTotal      = items.reduce((s, pi) => s + readPrix(pi.produit) * pi.qty, 0);
      const fraisLivraison = 0;

      /* Taux de commission lu depuis PlatformSettings (défaut 3 % si table vide) */
      const platformSettings  = await this.platformSettingsRepo.findOne({ where: { id: 1 } });
      const commissionRate    = platformSettings
        ? Number(platformSettings.platformCommission) / 100
        : 0.03;
      const commissionShopi   = Math.round(sousTotal * commissionRate);
      const total             = sousTotal + fraisLivraison;

      const commande = this.commandeRepo.create({
        numero: await this.genererNumero(),
        clientId: client.id,
        companyId: company.id,
        livreurId: delivery?.id ?? null,
        correspondantId: correspondant?.id ?? null,
        partenaireId: null,
        status: CommandeStatus.PAID,
        modeLivraison,
        sousTotal,
        fraisLivraison,
        commissionShopi,
        total,
        adresseLivraison: dto.destination ?? null,
        villeLivraison: dto.destination ?? null,
        methodePaiement: dto.payMode ?? null,
        datePaiement: new Date(),
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

      if (delivery) {
        codes.push(this.codeRepo.create({
          commandeId: saved.id,
          code: genererCode(),
          acteurType: CodeActeurType.LIVREUR,
          acteurId: delivery.userId,
          acteurNom: delivery.fullName,
          ordre: 2,
          status: CodeCommandeStatus.PENDING,
          expiresAt,
        }));
      }

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
