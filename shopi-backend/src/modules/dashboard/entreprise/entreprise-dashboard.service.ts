// // ============================================================
// // FICHIER  : src/modules/dashboard/entreprise/entreprise-dashboard.service.ts
// // RÔLE     : Service principal de l'espace entreprise.
// //            Fournit les stats, overview, profil et notifications
// //            de l'entreprise connectée.
// //
// // MÉTHODES PUBLIQUES :
// //   getStats(userId)          → métriques clés boutique
// //   getOverview(userId)       → aperçu rapide dashboard
// //   getProfil(userId)         → profil entreprise complet
// //   updateProfil(userId, dto) → mise à jour profil
// //   getNotifications(userId)  → notifications non lues
// //   getGlobalCount()          → count total (pour DashboardService commun)
// // ============================================================

import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

// // ── Entités ───────────────────────────────────────────────
// import { User }              from '../../../database/entities/user.entity';
// import { Company } from '../../../database/entities/profiles/entreprise-profile.entity';
// import { Product }           from '../../../database/entities/entreprise.table/product.entity';
// // import { Commande }          from '../../../database/entities/commande.entity';
// // import { Notification }      from '../../../database/entities/notification.entity';

// // ── DTO ───────────────────────────────────────────────────
// // import { UpdateEntrepriseProfilDto } from './dto/update-entreprise-profil.dto';

 @Injectable()
 export class EntrepriseDashboardService {

//   constructor(
//     @InjectRepository(User)
//     private readonly userRepo: Repository<User>,

    // @InjectRepository(Company)
    // private readonly profilRepo: Repository<Company>,

//     @InjectRepository(Product)
//     private readonly productRepo: Repository<Product>,

//     // @InjectRepository(Commande)
//     // private readonly commandeRepo: Repository<Commande>,

//     // @InjectRepository(Notification)
//     // private readonly notifRepo: Repository<Notification>,
//   ) {}

//   // ──────────────────────────────────────────────────────────
//   // getStats()
//   // Appelée par GET /dashboard/entreprise/stats
//   // ET par DashboardService.getDashboardForUser() (role=entreprise)
//   // ──────────────────────────────────────────────────────────
//   async getStats(userId: number) {
//     const profil = await this._getProfil(userId);

//     const today = new Date();
//     const debutMois = new Date(today.getFullYear(), today.getMonth(), 1);

//     // ① Nombre de produits actifs
//     // const totalProduits = await this.productRepo.count({
//     //   where: { entrepriseProfile: { id: profil.id }, isActive: true },
//     // });

//     // ② Commandes du jour
//     // const commandesAujourdhui = await this.commandeRepo
//     //   .createQueryBuilder('c')
//     //   .where('c.entrepriseId = :id', { id: profil.id })
//     //   .andWhere('DATE(c.createdAt) = CURDATE()')
//     //   .getCount();

//     // ③ Commandes du mois
//     // const commandesDuMois = await this.commandeRepo
//     //   .createQueryBuilder('c')
//     //   .where('c.entrepriseId = :id', { id: profil.id })
//     //   .andWhere('c.createdAt >= :debut', { debut: debutMois })
//     //   .getCount();

//     // // ④ Revenu total
//     // const revenuTotal = await this.commandeRepo
//     //   .createQueryBuilder('c')
//     //   .select('SUM(c.montantTotal)', 'total')
//     //   .where('c.entrepriseId = :id', { id: profil.id })
//     //   .andWhere("c.statut = 'livree'")
//     //   .getRawOne();

//     // // ⑤ Revenu du mois
//     // const revenuMois = await this.commandeRepo
//     //   .createQueryBuilder('c')
//     //   .select('SUM(c.montantTotal)', 'total')
//     //   .where('c.entrepriseId = :id', { id: profil.id })
//     //   .andWhere("c.statut = 'livree'")
//     //   .andWhere('c.createdAt >= :debut', { debut: debutMois })
//     //   .getRawOne();

//     // ⑥ Taux de livraison réussie
//     // const totalCommandes = await this.commandeRepo.count({
//     //   where: { entrepriseId: profil.id },
//     // });
//     // const commandesLivrees = await this.commandeRepo.count({
//     //   where: { entrepriseId: profil.id, statut: 'livree' },
//     // });
//     // const tauxLivraison = totalCommandes > 0
//     //   ? Math.round((commandesLivrees / totalCommandes) * 100)
//     //   : 0;

//     return {
//       produits: {
//         total: totalProduits,
//       },
//       commandes: {
//         aujourdhui:  commandesAujourdhui,
//         mois:        commandesDuMois,
//         total:       totalCommandes,
//         livrees:     commandesLivrees,
//         tauxLivraison: `${tauxLivraison}%`,
//       },
//       revenus: {
//         total: Number(revenuTotal?.total ?? 0),
//         mois:  Number(revenuMois?.total ?? 0),
//       },
//       generatedAt: new Date(),
//     };
//   }

//   // ──────────────────────────────────────────────────────────
//   // getOverview()
//   // Appelée par GET /dashboard/entreprise/overview
//   // Données pour la page d'accueil du dashboard
//   // ──────────────────────────────────────────────────────────
//   async getOverview(userId: number) {
//     const profil = await this._getProfil(userId);

//     // ① 5 dernières commandes
//     const dernieresCommandes = await this.commandeRepo.find({
//       where: { entrepriseId: profil.id },
//       order: { createdAt: 'DESC' },
//       take: 5,
//       relations: ['client'],
//     });

//     // ② Produits en rupture de stock (stock = 0)
//     const rupturesStock = await this.productRepo.find({
//       where: { entrepriseProfile: { id: profil.id }, stock: 0, isActive: true },
//       select: ['id', 'nom', 'prix'],
//     });

//     // ③ Commandes en attente de traitement
//     const commandesEnAttente = await this.commandeRepo.count({
//       where: { entrepriseId: profil.id, statut: 'en_attente' },
//     });

//     // ④ Revenu des 7 derniers jours (graphe)
//     const revenuSemaine = await this.commandeRepo
//       .createQueryBuilder('c')
//       .select("DATE(c.createdAt)", 'jour')
//       .addSelect('SUM(c.montantTotal)', 'revenu')
//       .where('c.entrepriseId = :id', { id: profil.id })
//       .andWhere("c.statut = 'livree'")
//       .andWhere('c.createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)')
//       .groupBy('jour')
//       .orderBy('jour', 'ASC')
//       .getRawMany();

//     return {
//       dernieresCommandes,
//       rupturesStock: {
//         count:    rupturesStock.length,
//         produits: rupturesStock,
//       },
//       alertes: {
//         commandesEnAttente,
//       },
//       revenuSemaine,
//     };
//   }

//   // ──────────────────────────────────────────────────────────
//   // getProfil()
//   // Appelée par GET /dashboard/entreprise/profil
//   // ──────────────────────────────────────────────────────────
//   async getProfil(userId: number) {
//     const profil = await this.profilRepo.findOne({
//       where: { user: { id: userId } },
//       relations: ['user'],
//     });

//     if (!profil) throw new NotFoundException('Profil entreprise introuvable');

//     return {
//       id:            profil.id,
//       nomEntreprise: profil.nomEntreprise,
//       rccm:          profil.rccm,
//       nif:           profil.nif,
//       adresse:       profil.adresse,
//       telephone:     profil.telephone,
//       logo:          profil.logo,
//       banniere:      profil.banniere,
//       email:         profil.user.email,
//       createdAt:     profil.createdAt,
//     };
//   }

//   // ──────────────────────────────────────────────────────────
//   // updateProfil()
//   // Appelée par PUT /dashboard/entreprise/profil
//   // ──────────────────────────────────────────────────────────
//   async updateProfil(userId: number, dto: UpdateEntrepriseProfilDto) {
//     const profil = await this._getProfil(userId);

//     Object.assign(profil, dto);
//     await this.profilRepo.save(profil);

//     return { message: 'Profil mis à jour avec succès', profil };
//   }

//   // ──────────────────────────────────────────────────────────
//   // getNotifications()
//   // Appelée par GET /dashboard/entreprise/notifications
//   // ──────────────────────────────────────────────────────────
//   async getNotifications(userId: number) {
//     const notifications = await this.notifRepo.find({
//       where: { user: { id: userId }, lu: false },
//       order: { createdAt: 'DESC' },
//       take: 20,
//     });

//     return {
//       count: notifications.length,
//       notifications,
//     };
//   }

//   // ──────────────────────────────────────────────────────────
//   // getGlobalCount()
//   // Appelée par DashboardService.getGlobalStats()
//   // Utilisée pour la vue agrégée super admin
//   // ──────────────────────────────────────────────────────────
//   async getGlobalCount() {
//     const total  = await this.profilRepo.count();
//     const actifs = await this.userRepo.count({
//       where: { role: 'entreprise', isActive: true },
//     });

//     return { total, actifs };
//   }

//   // ──────────────────────────────────────────────────────────
//   // _getProfil()  [méthode privée]
//   // Récupère le profil entreprise depuis le userId JWT.
//   // Mutualisée pour éviter la duplication dans chaque méthode.
//   // ──────────────────────────────────────────────────────────
//   private async _getProfil(userId: number): Promise<EntrepriseProfile> {
//     const profil = await this.profilRepo.findOne({
//       where: { user: { id: userId } },
//     });

//     if (!profil) throw new NotFoundException('Profil entreprise introuvable');

//     return profil;
//   }
 }