/* ============================================================
 * FICHIER : src/shared/i18n/langues/zh.ts
 *
 * RÔLE : Toutes les traductions en chinois, fusionnées dans le namespace
 *        unique « common ». Un fichier par langue : seul celui de la
 *        langue affichée est téléchargé (voir ../resources.ts).
 * ============================================================ */

import zhLayout               from '../locales/zh/entreprise/layout.json';
import zhOverview             from '../locales/zh/entreprise/overview.json';
import zhCommandes            from '../locales/zh/entreprise/commandes.json';
import zhRetours               from '../locales/zh/entreprise/retours.json';
import zhProduits               from '../locales/zh/entreprise/produits.json';
import zhAjouter                 from '../locales/zh/entreprise/ajouter.json';
import zhInventaire               from '../locales/zh/entreprise/inventaire.json';
import zhFournisseurs           from '../locales/zh/entreprise/fournisseurs.json';
import zhPromotions                from '../locales/zh/entreprise/promotions.json';
import zhAnalytics                  from '../locales/zh/entreprise/analytics.json';
import zhLivreurs                    from '../locales/zh/entreprise/livreurs.json';
import zhCorrespondants               from '../locales/zh/entreprise/correspondants.json';
import zhProfilCorrespondant           from '../locales/zh/entreprise/profilCorrespondant.json';
import zhProfilLivreur                  from '../locales/zh/entreprise/profilLivreur.json';
import zhFinances                        from '../locales/zh/entreprise/finances.json';
import zhWallet                           from '../locales/zh/entreprise/wallet.json';
import zhClients                           from '../locales/zh/entreprise/clients.json';
import zhClientProfil                       from '../locales/zh/entreprise/clientProfil.json';
import zhAvis                                from '../locales/zh/entreprise/avis.json';
import zhParametres                           from '../locales/zh/entreprise/parametres.json';
import zhEquipe                                from '../locales/zh/entreprise/equipe.json';
import zhBoutiquePreview                        from '../locales/zh/entreprise/boutiquePreview.json';
import zhMessagerie                              from '../locales/zh/entreprise/messagerie.json';
import zhSeo                                      from '../locales/zh/entreprise/seo.json';
import zhHome                from '../locales/zh/home/home.json';
import zhHeader               from '../locales/zh/home/header.json';
import zhFooter                from '../locales/zh/home/footer.json';
import zhBoutiquesPage          from '../locales/zh/home/boutiquesPage.json';
import zhCataloguePage          from '../locales/zh/home/cataloguePage.json';
import zhTypeEntreprisePage    from '../locales/zh/home/typeEntreprisePage.json';
import zhBoutiqueDetail          from '../locales/zh/home/boutiqueDetail.json';
import zhProduitDetail            from '../locales/zh/home/produitDetail.json';
import zhPanierCommande            from '../locales/zh/home/panierCommande.json';
import zhFollowToggle                from '../locales/zh/home/followToggle.json';
import zhLivreursPage                 from '../locales/zh/home/livreursPage.json';
import zhCorrespondantsPage            from '../locales/zh/home/correspondantsPage.json';
import zhOffresPage                     from '../locales/zh/home/offresPage.json';
import zhSharedCards                     from '../locales/zh/home/sharedCards.json';
import zhCompare                         from '../locales/zh/home/compare.json';
import zhSettingsPage    from '../locales/zh/client/settingsPage.json';
import zhClientDashboard  from '../locales/zh/client/dashboard.json';
import zhLivreurParametres from '../locales/zh/livreur/parametres.json';
import zhLivreurSecProfil from '../locales/zh/livreur/secProfil.json';
import zhLivreurSecDocuments from '../locales/zh/livreur/secDocuments.json';
import zhLivreurSecZone from '../locales/zh/livreur/secZone.json';
import zhLivreurSecVehicule from '../locales/zh/livreur/secVehicule.json';
import zhLivreurSecPaiement from '../locales/zh/livreur/secPaiement.json';
import zhLivreurSecSecurite from '../locales/zh/livreur/secSecurite.json';
import zhLivreurSecNotifications from '../locales/zh/livreur/secNotifications.json';
import zhLivreurSecConfidentialite from '../locales/zh/livreur/secConfidentialite.json';
import zhLivreurSecDanger from '../locales/zh/livreur/secDanger.json';
import zhLivreurLayoutParams from '../locales/zh/livreur/layout.json';   // partiel : types de livraison
import zhLivreurZoneParams from '../locales/zh/livreur/zone.json';       // partiel : chargement des zones

const traductions = {
  ...zhLayout, ...zhOverview, ...zhCommandes, ...zhRetours, ...zhProduits, ...zhAjouter, ...zhInventaire, ...zhFournisseurs,
  ...zhPromotions, ...zhAnalytics, ...zhLivreurs, ...zhCorrespondants, ...zhProfilCorrespondant, ...zhProfilLivreur,
  ...zhFinances, ...zhWallet, ...zhClients, ...zhClientProfil, ...zhAvis, ...zhParametres, ...zhEquipe,
  ...zhBoutiquePreview, ...zhMessagerie, ...zhSeo,
  ...zhHome, ...zhHeader, ...zhFooter, ...zhBoutiquesPage, ...zhCataloguePage, ...zhTypeEntreprisePage, ...zhBoutiqueDetail, ...zhProduitDetail,
  ...zhPanierCommande, ...zhFollowToggle, ...zhLivreursPage, ...zhCorrespondantsPage, ...zhOffresPage, ...zhSharedCards,
  ...zhCompare,
  ...zhSettingsPage, ...zhClientDashboard,
  ...zhLivreurParametres, ...zhLivreurSecProfil, ...zhLivreurSecDocuments, ...zhLivreurSecZone, ...zhLivreurSecVehicule, ...zhLivreurSecPaiement, ...zhLivreurSecSecurite, ...zhLivreurSecNotifications, ...zhLivreurSecConfidentialite, ...zhLivreurSecDanger, ...zhLivreurLayoutParams, ...zhLivreurZoneParams,
};

export default traductions;
