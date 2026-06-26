/* ============================================================
 * FICHIER : src/modules/commande/services/commande-query.service.ts
 *
 * RÔLE : lecture des commandes (détail + listes par rôle).
 *   - getCommandeDetail : GET /commandes/:id
 *   - listEntreprise    : GET /entreprise/commandes
 *   - listClient        : GET /client/commandes
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { User } from '../../../database/entities/user.entity';
import { Client } from '../../../database/entities/profiles/client-profile.entity';
import { Company } from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery } from '../../../database/entities/profiles/livreur-profile.entity';
import { Commande, CommandeStatus } from '../../../database/entities/commande/commande.entity';
import { CodeActeurType, CodeCommandeStatus } from '../../../database/entities/commande/commande-code.entity';

import {
  ACTEUR_INFO, Acteur, ActeurRole, Commission, CommandeDetailResponse,
  CommandeListItem, EnCoursResponse, EnCoursStep, HistListItem, MissionListItem,
  initiales, mapHistStatus, mapOrderStatus,
} from './commande.helpers';

@Injectable()
export class CommandeQueryService {
  constructor(
    @InjectRepository(Commande) private readonly commandeRepo: Repository<Commande>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(Delivery) private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  /* ════════════════════════════════════════════════════════
   * GET /commandes/:id — détail pour la page de suivi
   ════════════════════════════════════════════════════════ */
  async getCommandeDetail(commandeId: string, user: User): Promise<CommandeDetailResponse> {
    const commande = await this.commandeRepo.findOne({
      where: { id: commandeId },
      relations: ['items', 'codes'],
    });
    if (!commande) throw new NotFoundException('Commande introuvable.');

    const company = await this.companyRepo.findOne({ where: { id: commande.companyId } });
    const delivery = commande.livreurId ? await this.deliveryRepo.findOne({ where: { id: commande.livreurId } }) : null;

    const codesTries = [...commande.codes]
      .filter(c => c.acteurType !== CodeActeurType.PARTENAIRE)
      .sort((a, b) => a.ordre - b.ordre);

    const acteurs: Acteur[] = codesTries.map(code => {
      const role = code.acteurType as unknown as ActeurRole;
      const info = ACTEUR_INFO[role];
      return {
        role,
        nom: code.acteurNom,
        sousTitre: info.sousTitre,
        initiales: initiales(code.acteurNom),
        icone: info.icone,
        action: info.action,
        valideA: code.validatedAt
          ? code.validatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : undefined,
      };
    });

    const currentStep = codesTries.filter(c => c.status === CodeCommandeStatus.VALIDATED).length;
    const times = codesTries.map(c => c.validatedAt
      ? c.validatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : undefined);

    /* Codes visibles uniquement pour leur propre destinataire */
    const codes = { entreprise: '', livreur: '', correspondant: '', client: '' } as Record<ActeurRole, string>;
    for (const code of codesTries) {
      if (code.acteurId === user.id && code.status !== CodeCommandeStatus.AWAITING_UNLOCK) {
        codes[code.acteurType as unknown as ActeurRole] = code.code;
      }
    }

    const articles = commande.items.map(item => ({
      emoji: '📦',
      nom: item.nomProduit,
      boutique: company?.companyName ?? 'Boutique',
      qty: item.quantite,
      prix: Number(item.prixUnitaire),
    }));

    const commissions: Commission[] = [
      {
        role: 'entreprise', nom: company?.companyName ?? 'Boutique',
        libelle: 'Vente produit',
        montant: Number(commande.sousTotal) - Number(commande.commissionShopi),
        icone: 'fa-store',
      },
      {
        role: 'shopi', nom: 'Shopi',
        libelle: 'Commission plateforme',
        montant: Number(commande.commissionShopi),
        icone: 'fa-bolt',
      },
    ];
    if (delivery && Number(commande.fraisLivraison) > 0) {
      commissions.push({
        role: 'livreur', nom: delivery.fullName,
        libelle: 'Frais de livraison',
        montant: Number(commande.fraisLivraison),
        icone: 'fa-motorcycle',
      });
    }

    return {
      id: commande.numero,
      datePaiement: (commande.datePaiement ?? commande.createdAt).toISOString(),
      destination: commande.adresseLivraison ?? commande.villeLivraison ?? '',
      acteurs,
      articles,
      montant: {
        sousTotal: Number(commande.sousTotal),
        livraison: Number(commande.fraisLivraison),
        fraisCorrespondant: 0,
        total: Number(commande.total),
      },
      commissions,
      codes,
      currentStep,
      times,
    };
  }

  /* ════════════════════════════════════════════════════════
   * GET /entreprise/commandes — liste des commandes de la boutique
   ════════════════════════════════════════════════════════ */
  async listEntreprise(user: User): Promise<CommandeListItem[]> {
    const company = await this.companyRepo.findOne({ where: { userId: user.id } });
    if (!company) return [];

    const commandes = await this.commandeRepo.find({
      where: { companyId: company.id },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
    if (commandes.length === 0) return [];

    const clientIds = [...new Set(commandes.map(c => c.clientId))];
    const livreurIds = [...new Set(commandes.map(c => c.livreurId).filter((id): id is string => !!id))];

    const [clients, deliveries] = await Promise.all([
      this.clientRepo.find({ where: { id: In(clientIds) } }),
      livreurIds.length ? this.deliveryRepo.find({ where: { id: In(livreurIds) } }) : Promise.resolve([]),
    ]);
    const clientById = new Map(clients.map(c => [c.id, c]));
    const deliveryById = new Map(deliveries.map(d => [d.id, d]));

    return commandes.map(c => {
      const firstItem = c.items[0];
      return {
        id: c.numero,
        uuid: c.id,
        em: '📦',
        nm: firstItem?.nomProduit ?? '—',
        vt: firstItem?.varianteChoisie ?? '',
        client: clientById.get(c.clientId)?.fullName ?? '—',
        price: Number(c.total),
        status: mapOrderStatus(c.status),
        date: c.createdAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        livreur: (c.livreurId && deliveryById.get(c.livreurId)?.fullName) ?? '—',
        zone: c.villeLivraison ?? '—',
      };
    });
  }

  /* ════════════════════════════════════════════════════════
   * GET /client/commandes — historique des commandes du client
   ════════════════════════════════════════════════════════ */
  async listClient(user: User): Promise<CommandeListItem[]> {
    const client = await this.clientRepo.findOne({ where: { userId: user.id } });
    if (!client) return [];

    const commandes = await this.commandeRepo.find({
      where: { clientId: client.id },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
    if (commandes.length === 0) return [];

    const companyIds = [...new Set(commandes.map(c => c.companyId))];
    const livreurIds = [...new Set(commandes.map(c => c.livreurId).filter((id): id is string => !!id))];

    const [companies, deliveries] = await Promise.all([
      this.companyRepo.find({ where: { id: In(companyIds) } }),
      livreurIds.length ? this.deliveryRepo.find({ where: { id: In(livreurIds) } }) : Promise.resolve([]),
    ]);
    const companyById = new Map(companies.map(c => [c.id, c]));
    const deliveryById = new Map(deliveries.map(d => [d.id, d]));

    return commandes.map(c => {
      const firstItem = c.items[0];
      return {
        id: c.numero,
        uuid: c.id,
        em: '📦',
        nm: firstItem?.nomProduit ?? '—',
        vt: firstItem?.varianteChoisie ?? '',
        client: companyById.get(c.companyId)?.companyName ?? '—',
        price: Number(c.total),
        status: mapOrderStatus(c.status),
        date: c.createdAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        livreur: (c.livreurId && deliveryById.get(c.livreurId)?.fullName) ?? '—',
        zone: c.villeLivraison ?? '—',
      };
    });
  }

  /* ════════════════════════════════════════════════════════
   * GET /livreur/missions — commandes assignées au livreur
   ════════════════════════════════════════════════════════ */
  async listLivreur(user: User): Promise<MissionListItem[]> {
    const delivery = await this.deliveryRepo.findOne({ where: { userId: user.id } });
    if (!delivery) return [];

    const commandes = await this.commandeRepo.find({
      where: {
        livreurId: delivery.id,
        status: In([CommandeStatus.PAID, CommandeStatus.IN_PROGRESS, CommandeStatus.AWAITING_CLIENT]),
      },
      relations: ['items', 'codes'],
      order: { createdAt: 'DESC' },
    });
    if (commandes.length === 0) return [];

    const clientIds = [...new Set(commandes.map(c => c.clientId))];
    const companyIds = [...new Set(commandes.map(c => c.companyId))];

    const [clients, companies] = await Promise.all([
      this.clientRepo.find({ where: { id: In(clientIds) } }),
      this.companyRepo.find({ where: { id: In(companyIds) } }),
    ]);
    const clientById = new Map(clients.map(c => [c.id, c]));
    const companyById = new Map(companies.map(c => [c.id, c]));

    return commandes.map(c => {
      const firstItem = c.items[0];
      const livreurCode = c.codes.find(code => code.acteurType === CodeActeurType.LIVREUR);

      let missionStatus: MissionListItem['status'] = 'new';
      if (livreurCode?.status === CodeCommandeStatus.VALIDATED) missionStatus = 'active';
      else if (c.status !== CommandeStatus.PAID) missionStatus = 'prep';

      return {
        id: c.numero,
        uuid: c.id,
        em: '📦',
        nm: firstItem?.nomProduit ?? '—',
        shop: companyById.get(c.companyId)?.companyName ?? 'Boutique',
        client: clientById.get(c.clientId)?.fullName ?? '—',
        from: companyById.get(c.companyId)?.commune ?? companyById.get(c.companyId)?.ville ?? 'Boutique',
        to: c.villeLivraison ?? c.adresseLivraison ?? '—',
        dist: '—',
        fee: Number(c.fraisLivraison),
        speed: 'std',
        status: missionStatus,
        urgent: false,
        date: c.createdAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      };
    });
  }

  /* ════════════════════════════════════════════════════════
   * GET /livreur/historique — commandes terminées du livreur
   ════════════════════════════════════════════════════════ */
  async listLivreurHistorique(user: User): Promise<HistListItem[]> {
    const delivery = await this.deliveryRepo.findOne({ where: { userId: user.id } });
    if (!delivery) return [];

    const commandes = await this.commandeRepo.find({
      where: {
        livreurId: delivery.id,
        status: In([
          CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED,
          CommandeStatus.CANCELLED, CommandeStatus.REFUNDED, CommandeStatus.DISPUTED,
        ]),
      },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
    if (commandes.length === 0) return [];

    const companyIds = [...new Set(commandes.map(c => c.companyId))];
    const companies = await this.companyRepo.find({ where: { id: In(companyIds) } });
    const companyById = new Map(companies.map(c => [c.id, c]));

    return commandes.map(c => {
      const firstItem = c.items[0];
      const status = mapHistStatus(c.status);
      return {
        id: c.numero,
        uuid: c.id,
        em: '📦',
        nm: firstItem?.nomProduit ?? '—',
        shop: companyById.get(c.companyId)?.companyName ?? 'Boutique',
        fee: Number(c.fraisLivraison),
        dist: '—',
        speed: 'std',
        status,
        date: c.createdAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        earn: status === 'done',
      };
    });
  }

  /* ════════════════════════════════════════════════════════
   * GET /livreur/encours — mission active du livreur
   ════════════════════════════════════════════════════════ */
  async getLivreurEnCours(user: User): Promise<EnCoursResponse | null> {
    const delivery = await this.deliveryRepo.findOne({ where: { userId: user.id } });
    if (!delivery) return null;

    const commande = await this.commandeRepo.findOne({
      where: {
        livreurId: delivery.id,
        status: In([CommandeStatus.PAID, CommandeStatus.IN_PROGRESS, CommandeStatus.AWAITING_CLIENT]),
      },
      relations: ['items', 'codes'],
      order: { createdAt: 'DESC' },
    });
    if (!commande) return null;

    const livreurCode = commande.codes.find(c => c.acteurType === CodeActeurType.LIVREUR);
    if (!livreurCode || livreurCode.status !== CodeCommandeStatus.VALIDATED) return null;

    const [company, client] = await Promise.all([
      this.companyRepo.findOne({ where: { id: commande.companyId } }),
      this.clientRepo.findOne({ where: { id: commande.clientId } }),
    ]);
    const clientUser = client ? await this.userRepo.findOne({ where: { id: client.userId } }) : null;

    const firstItem = commande.items[0];

    const codesTries = [...commande.codes]
      .filter(c => c.acteurType !== CodeActeurType.PARTENAIRE)
      .sort((a, b) => a.ordre - b.ordre);

    let currentFound = false;
    const steps: EnCoursStep[] = codesTries.map(code => {
      let status: EnCoursStep['status'];
      if (code.status === CodeCommandeStatus.VALIDATED) {
        status = 'done';
      } else if (!currentFound) {
        status = 'active';
        currentFound = true;
      } else {
        status = 'next';
      }

      const role = code.acteurType as unknown as ActeurRole;
      let label: string;
      let sub: string;
      switch (role) {
        case 'entreprise':
          label = 'Commande préparée';
          sub = company?.companyName ?? 'Boutique';
          break;
        case 'livreur':
          label = 'Colis pris en charge';
          sub = 'Récupéré par vous auprès de la boutique';
          break;
        case 'correspondant':
          label = 'Remis au point relais';
          sub = 'Réception au point relais';
          break;
        default:
          label = 'Confirmation de réception';
          sub = `${client?.fullName ?? 'Le client'} doit confirmer la réception`;
      }

      return {
        role,
        label,
        sub,
        status,
        time: code.validatedAt
          ? code.validatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : null,
      };
    });

    return {
      id: commande.numero,
      uuid: commande.id,
      em: '📦',
      nm: firstItem?.nomProduit ?? '—',
      shop: company?.companyName ?? 'Boutique',
      fee: Number(commande.fraisLivraison),
      speed: 'std',
      client: {
        nom: client?.fullName ?? 'Client',
        telephone: clientUser?.phone ?? null,
        adresse: commande.adresseLivraison ?? commande.villeLivraison ?? '—',
        instructions: commande.notesClient,
      },
      steps,
      etaAt: commande.datelivraisonEstimee ? commande.datelivraisonEstimee.toISOString() : null,
    };
  }
}
