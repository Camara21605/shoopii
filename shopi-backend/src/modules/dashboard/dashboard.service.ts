// // ============================================================
// // FICHIER  : src/modules/dashboard/dashboard.service.ts
// // RÔLE     : Service commun du dashboard.
// //            Redirige vers le bon service selon le rôle JWT.
// //
// // ACTEURS SUPPORTÉS :
// //   super_admin, administrateur, entreprise,
// //   livreur, client, partenaire, correspondant
// // ============================================================

// import { Injectable, ForbiddenException } from '@nestjs/common';

// // ── Import des services de chaque acteur ──────────────────
// import { SuperAdminDashboardService }     from './super-admin/super-admin-dashboard.service';
// // import { AdministrateurDashboardService } from './administrateur/administrateur-dashboard.service';
// import { EntrepriseDashboardService }     from './entreprise/entreprise-dashboard.service';
// // import { LivreurDashboardService }        from './livreur/livreur-dashboard.service';
// // import { ClientDashboardService }         from './client/client-dashboard.service';
// // import { PartenaireDashboardService }     from './partenaire/partenaire-dashboard.service';
// // import { CorrespondantDashboardService }  from './correspondant/correspondant-dashboard.service';

// // ── Type utilitaire pour le payload JWT ───────────────────
// interface JwtUser {
//   id:    number;
//   email: string;
//   role:  string; // 'super_admin' | 'administrateur' | 'entreprise' | 'livreur' | 'client' | 'partenaire' | 'correspondant'
// }

// @Injectable()
// export class DashboardService {

//   constructor(
//     // ① Injection de TOUS les services acteurs
//     private readonly superAdminService:     SuperAdminDashboardService,
//     // private readonly administrateurService: AdministrateurDashboardService,
//     private readonly entrepriseService:     EntrepriseDashboardService,
//             // private readonly livreurService:        LivreurDashboardService,
//             // private readonly clientService:         ClientDashboardService,
//             // private readonly partenaireService:     PartenaireDashboardService,
//             // private readonly correspondantService:  CorrespondantDashboardService,
//   ) {}

//   // ──────────────────────────────────────────────────────────
//   // getDashboardForUser()
//   // Appelée par GET /dashboard/me
//   // Retourne les données du bon acteur selon le rôle JWT
//   // ──────────────────────────────────────────────────────────
//   async getDashboardForUser(user: JwtUser) {
//     switch (user.role) {

//       case 'super_admin':
//         return {
//           role: 'super_admin',
//           data: await this.superAdminService.getStats(user.id),
//         };

//       case 'administrateur':
//         return {
//           role: 'administrateur',
//           data: await this.administrateurService.getStats(user.id),
//         };

//       case 'entreprise':
//         return {
//           role: 'entreprise',
//           data: await this.entrepriseService.getStats(user.id),
//         };

//       case 'livreur':
//         return {
//           role: 'livreur',
//           data: await this.livreurService.getStats(user.id),
//         };

//       case 'client':
//         return {
//           role: 'client',
//           data: await this.clientService.getStats(user.id),
//         };

//       case 'partenaire':
//         return {
//           role: 'partenaire',
//           data: await this.partenaireService.getStats(user.id),
//         };

//       case 'correspondant':
//         return {
//           role: 'correspondant',
//           data: await this.correspondantService.getStats(user.id),
//         };

//       default:
//         throw new ForbiddenException(`Rôle inconnu : ${user.role}`);
//     }
//   }

//   // ──────────────────────────────────────────────────────────
//   // getGlobalStats()
//   // Réservé au super_admin via GET /dashboard/global
//   // Agrège les métriques globales de la plateforme
//   // ──────────────────────────────────────────────────────────
//   async getGlobalStats() {
//     const [superAdmin, entreprise, livreur, client, partenaire, correspondant] =
//       await Promise.all([
//         this.superAdminService.getPlatformOverview(),
//         this.entrepriseService.getGlobalCount(),
//         this.livreurService.getGlobalCount(),
//         this.clientService.getGlobalCount(),
//         this.partenaireService.getGlobalCount(),
//         this.correspondantService.getGlobalCount(),
//       ]);

//     return {
//       generatedAt: new Date(),
//       platform: superAdmin,
//       actors: {
//         entreprises:    entreprise,
//         livreurs:       livreur,
//         clients:        client,
//         partenaires:    partenaire,
//         correspondants: correspondant,
//       },
//     };
//   }
// }