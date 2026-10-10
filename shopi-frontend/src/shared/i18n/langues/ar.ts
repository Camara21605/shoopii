/* ============================================================
 * FICHIER : src/shared/i18n/langues/ar.ts
 *
 * RÔLE : Toutes les traductions en arabe, fusionnées dans le namespace
 *        unique « common ». Un fichier par langue : seul celui de la
 *        langue affichée est téléchargé (voir ../resources.ts).
 * ============================================================ */

import arLayout               from '../locales/ar/entreprise/layout.json';
import arOverview             from '../locales/ar/entreprise/overview.json';
import arCommandes            from '../locales/ar/entreprise/commandes.json';
import arRetours               from '../locales/ar/entreprise/retours.json';
import arProduits               from '../locales/ar/entreprise/produits.json';
import arAjouter                 from '../locales/ar/entreprise/ajouter.json';
import arInventaire               from '../locales/ar/entreprise/inventaire.json';
import arFournisseurs           from '../locales/ar/entreprise/fournisseurs.json';
import arPromotions                from '../locales/ar/entreprise/promotions.json';
import arAnalytics                  from '../locales/ar/entreprise/analytics.json';
import arLivreurs                    from '../locales/ar/entreprise/livreurs.json';
import arCorrespondants               from '../locales/ar/entreprise/correspondants.json';
import arProfilCorrespondant           from '../locales/ar/entreprise/profilCorrespondant.json';
import arProfilLivreur                  from '../locales/ar/entreprise/profilLivreur.json';
import arFinances                        from '../locales/ar/entreprise/finances.json';
import arWallet                           from '../locales/ar/entreprise/wallet.json';
import arClients                           from '../locales/ar/entreprise/clients.json';
import arClientProfil                       from '../locales/ar/entreprise/clientProfil.json';
import arAvis                                from '../locales/ar/entreprise/avis.json';
import arParametres                           from '../locales/ar/entreprise/parametres.json';
import arEquipe                                from '../locales/ar/entreprise/equipe.json';
import arBoutiquePreview                        from '../locales/ar/entreprise/boutiquePreview.json';
import arMessagerie                              from '../locales/ar/entreprise/messagerie.json';
import arSeo                                      from '../locales/ar/entreprise/seo.json';
import arHome                from '../locales/ar/home/home.json';
import arHeader               from '../locales/ar/home/header.json';
import arFooter                from '../locales/ar/home/footer.json';
import arBoutiquesPage          from '../locales/ar/home/boutiquesPage.json';
import arCataloguePage          from '../locales/ar/home/cataloguePage.json';
import arTypeEntreprisePage    from '../locales/ar/home/typeEntreprisePage.json';
import arBoutiqueDetail          from '../locales/ar/home/boutiqueDetail.json';
import arProduitDetail            from '../locales/ar/home/produitDetail.json';
import arPanierCommande            from '../locales/ar/home/panierCommande.json';
import arFollowToggle                from '../locales/ar/home/followToggle.json';
import arLivreursPage                 from '../locales/ar/home/livreursPage.json';
import arCorrespondantsPage            from '../locales/ar/home/correspondantsPage.json';
import arOffresPage                     from '../locales/ar/home/offresPage.json';
import arSharedCards                     from '../locales/ar/home/sharedCards.json';
import arCompare                         from '../locales/ar/home/compare.json';
import arSettingsPage    from '../locales/ar/client/settingsPage.json';
import arClientDashboard  from '../locales/ar/client/dashboard.json';
import arLivreurParametres from '../locales/ar/livreur/parametres.json';
import arLivreurSecProfil from '../locales/ar/livreur/secProfil.json';
import arLivreurSecDocuments from '../locales/ar/livreur/secDocuments.json';
import arLivreurSecZone from '../locales/ar/livreur/secZone.json';
import arLivreurSecVehicule from '../locales/ar/livreur/secVehicule.json';
import arLivreurSecPaiement from '../locales/ar/livreur/secPaiement.json';
import arLivreurSecSecurite from '../locales/ar/livreur/secSecurite.json';
import arLivreurSecNotifications from '../locales/ar/livreur/secNotifications.json';
import arLivreurSecConfidentialite from '../locales/ar/livreur/secConfidentialite.json';
import arLivreurSecDanger from '../locales/ar/livreur/secDanger.json';
import arLivreurLayoutParams from '../locales/ar/livreur/layout.json';   // partiel : types de livraison
import arLivreurZoneParams from '../locales/ar/livreur/zone.json';       // partiel : chargement des zones

const traductions = {
  ...arLayout, ...arOverview, ...arCommandes, ...arRetours, ...arProduits, ...arAjouter, ...arInventaire, ...arFournisseurs,
  ...arPromotions, ...arAnalytics, ...arLivreurs, ...arCorrespondants, ...arProfilCorrespondant, ...arProfilLivreur,
  ...arFinances, ...arWallet, ...arClients, ...arClientProfil, ...arAvis, ...arParametres, ...arEquipe,
  ...arBoutiquePreview, ...arMessagerie, ...arSeo,
  ...arHome, ...arHeader, ...arFooter, ...arBoutiquesPage, ...arCataloguePage, ...arTypeEntreprisePage, ...arBoutiqueDetail, ...arProduitDetail,
  ...arPanierCommande, ...arFollowToggle, ...arLivreursPage, ...arCorrespondantsPage, ...arOffresPage, ...arSharedCards,
  ...arCompare,
  ...arSettingsPage, ...arClientDashboard,
  ...arLivreurParametres, ...arLivreurSecProfil, ...arLivreurSecDocuments, ...arLivreurSecZone, ...arLivreurSecVehicule, ...arLivreurSecPaiement, ...arLivreurSecSecurite, ...arLivreurSecNotifications, ...arLivreurSecConfidentialite, ...arLivreurSecDanger, ...arLivreurLayoutParams, ...arLivreurZoneParams,
};

export default traductions;
