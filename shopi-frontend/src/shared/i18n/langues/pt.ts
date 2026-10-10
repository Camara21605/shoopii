/* ============================================================
 * FICHIER : src/shared/i18n/langues/pt.ts
 *
 * RÔLE : Toutes les traductions en portugais, fusionnées dans le namespace
 *        unique « common ». Un fichier par langue : seul celui de la
 *        langue affichée est téléchargé (voir ../resources.ts).
 * ============================================================ */

import ptLayout               from '../locales/pt/entreprise/layout.json';
import ptOverview             from '../locales/pt/entreprise/overview.json';
import ptCommandes            from '../locales/pt/entreprise/commandes.json';
import ptRetours               from '../locales/pt/entreprise/retours.json';
import ptProduits               from '../locales/pt/entreprise/produits.json';
import ptAjouter                 from '../locales/pt/entreprise/ajouter.json';
import ptInventaire               from '../locales/pt/entreprise/inventaire.json';
import ptFournisseurs           from '../locales/pt/entreprise/fournisseurs.json';
import ptPromotions                from '../locales/pt/entreprise/promotions.json';
import ptAnalytics                  from '../locales/pt/entreprise/analytics.json';
import ptLivreurs                    from '../locales/pt/entreprise/livreurs.json';
import ptCorrespondants               from '../locales/pt/entreprise/correspondants.json';
import ptProfilCorrespondant           from '../locales/pt/entreprise/profilCorrespondant.json';
import ptProfilLivreur                  from '../locales/pt/entreprise/profilLivreur.json';
import ptFinances                        from '../locales/pt/entreprise/finances.json';
import ptWallet                           from '../locales/pt/entreprise/wallet.json';
import ptClients                           from '../locales/pt/entreprise/clients.json';
import ptClientProfil                       from '../locales/pt/entreprise/clientProfil.json';
import ptAvis                                from '../locales/pt/entreprise/avis.json';
import ptParametres                           from '../locales/pt/entreprise/parametres.json';
import ptEquipe                                from '../locales/pt/entreprise/equipe.json';
import ptBoutiquePreview                        from '../locales/pt/entreprise/boutiquePreview.json';
import ptMessagerie                              from '../locales/pt/entreprise/messagerie.json';
import ptSeo                                      from '../locales/pt/entreprise/seo.json';
import ptHome                from '../locales/pt/home/home.json';
import ptHeader               from '../locales/pt/home/header.json';
import ptFooter                from '../locales/pt/home/footer.json';
import ptBoutiquesPage          from '../locales/pt/home/boutiquesPage.json';
import ptCataloguePage          from '../locales/pt/home/cataloguePage.json';
import ptTypeEntreprisePage    from '../locales/pt/home/typeEntreprisePage.json';
import ptBoutiqueDetail          from '../locales/pt/home/boutiqueDetail.json';
import ptProduitDetail            from '../locales/pt/home/produitDetail.json';
import ptPanierCommande            from '../locales/pt/home/panierCommande.json';
import ptFollowToggle                from '../locales/pt/home/followToggle.json';
import ptLivreursPage                 from '../locales/pt/home/livreursPage.json';
import ptCorrespondantsPage            from '../locales/pt/home/correspondantsPage.json';
import ptOffresPage                     from '../locales/pt/home/offresPage.json';
import ptSharedCards                     from '../locales/pt/home/sharedCards.json';
import ptCompare                         from '../locales/pt/home/compare.json';
import ptSettingsPage    from '../locales/pt/client/settingsPage.json';
import ptClientDashboard  from '../locales/pt/client/dashboard.json';
import ptLivreurParametres from '../locales/pt/livreur/parametres.json';
import ptLivreurSecProfil from '../locales/pt/livreur/secProfil.json';
import ptLivreurSecDocuments from '../locales/pt/livreur/secDocuments.json';
import ptLivreurSecZone from '../locales/pt/livreur/secZone.json';
import ptLivreurSecVehicule from '../locales/pt/livreur/secVehicule.json';
import ptLivreurSecPaiement from '../locales/pt/livreur/secPaiement.json';
import ptLivreurSecSecurite from '../locales/pt/livreur/secSecurite.json';
import ptLivreurSecNotifications from '../locales/pt/livreur/secNotifications.json';
import ptLivreurSecConfidentialite from '../locales/pt/livreur/secConfidentialite.json';
import ptLivreurSecDanger from '../locales/pt/livreur/secDanger.json';
import ptLivreurLayoutParams from '../locales/pt/livreur/layout.json';   // partiel : types de livraison
import ptLivreurZoneParams from '../locales/pt/livreur/zone.json';       // partiel : chargement des zones

const traductions = {
  ...ptLayout, ...ptOverview, ...ptCommandes, ...ptRetours, ...ptProduits, ...ptAjouter, ...ptInventaire, ...ptFournisseurs,
  ...ptPromotions, ...ptAnalytics, ...ptLivreurs, ...ptCorrespondants, ...ptProfilCorrespondant, ...ptProfilLivreur,
  ...ptFinances, ...ptWallet, ...ptClients, ...ptClientProfil, ...ptAvis, ...ptParametres, ...ptEquipe,
  ...ptBoutiquePreview, ...ptMessagerie, ...ptSeo,
  ...ptHome, ...ptHeader, ...ptFooter, ...ptBoutiquesPage, ...ptCataloguePage, ...ptTypeEntreprisePage, ...ptBoutiqueDetail, ...ptProduitDetail,
  ...ptPanierCommande, ...ptFollowToggle, ...ptLivreursPage, ...ptCorrespondantsPage, ...ptOffresPage, ...ptSharedCards,
  ...ptCompare,
  ...ptSettingsPage, ...ptClientDashboard,
  ...ptLivreurParametres, ...ptLivreurSecProfil, ...ptLivreurSecDocuments, ...ptLivreurSecZone, ...ptLivreurSecVehicule, ...ptLivreurSecPaiement, ...ptLivreurSecSecurite, ...ptLivreurSecNotifications, ...ptLivreurSecConfidentialite, ...ptLivreurSecDanger, ...ptLivreurLayoutParams, ...ptLivreurZoneParams,
};

export default traductions;
