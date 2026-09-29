/* ============================================================
 * FICHIER : src/shared/i18n/langues/en.ts
 *
 * RÔLE : Toutes les traductions en anglais, fusionnées dans le namespace
 *        unique « common ». Un fichier par langue : seul celui de la
 *        langue affichée est téléchargé (voir ../resources.ts).
 * ============================================================ */

import enLayout               from '../locales/en/entreprise/layout.json';
import enOverview             from '../locales/en/entreprise/overview.json';
import enCommandes            from '../locales/en/entreprise/commandes.json';
import enRetours               from '../locales/en/entreprise/retours.json';
import enProduits               from '../locales/en/entreprise/produits.json';
import enAjouter                 from '../locales/en/entreprise/ajouter.json';
import enServices                from '../locales/en/entreprise/services.json';
import enAjouterService           from '../locales/en/entreprise/ajouterService.json';
import enInventaire               from '../locales/en/entreprise/inventaire.json';
import enFournisseurs           from '../locales/en/entreprise/fournisseurs.json';
import enPromotions                from '../locales/en/entreprise/promotions.json';
import enAnalytics                  from '../locales/en/entreprise/analytics.json';
import enLivreurs                    from '../locales/en/entreprise/livreurs.json';
import enCorrespondants               from '../locales/en/entreprise/correspondants.json';
import enProfilCorrespondant           from '../locales/en/entreprise/profilCorrespondant.json';
import enProfilLivreur                  from '../locales/en/entreprise/profilLivreur.json';
import enFinances                        from '../locales/en/entreprise/finances.json';
import enWallet                           from '../locales/en/entreprise/wallet.json';
import enClients                           from '../locales/en/entreprise/clients.json';
import enClientProfil                       from '../locales/en/entreprise/clientProfil.json';
import enAvis                                from '../locales/en/entreprise/avis.json';
import enParametres                           from '../locales/en/entreprise/parametres.json';
import enEquipe                                from '../locales/en/entreprise/equipe.json';
import enBoutiquePreview                        from '../locales/en/entreprise/boutiquePreview.json';
import enMessagerie                              from '../locales/en/entreprise/messagerie.json';
import enSeo                                      from '../locales/en/entreprise/seo.json';
import enHome                from '../locales/en/home/home.json';
import enHeader               from '../locales/en/home/header.json';
import enFooter                from '../locales/en/home/footer.json';
import enBoutiquesPage          from '../locales/en/home/boutiquesPage.json';
import enCataloguePage          from '../locales/en/home/cataloguePage.json';
import enTypeEntreprisePage    from '../locales/en/home/typeEntreprisePage.json';
import enBoutiqueDetail          from '../locales/en/home/boutiqueDetail.json';
import enProduitDetail            from '../locales/en/home/produitDetail.json';
import enPanierCommande            from '../locales/en/home/panierCommande.json';
import enFollowToggle                from '../locales/en/home/followToggle.json';
import enLivreursPage                 from '../locales/en/home/livreursPage.json';
import enCorrespondantsPage            from '../locales/en/home/correspondantsPage.json';
import enOffresPage                     from '../locales/en/home/offresPage.json';
import enSharedCards                     from '../locales/en/home/sharedCards.json';
import enCompare                         from '../locales/en/home/compare.json';
import enSettingsPage    from '../locales/en/client/settingsPage.json';
import enClientDashboard  from '../locales/en/client/dashboard.json';
import enPartenaireLayout from '../locales/en/partenaire/layout.json';
import enPartenaireOverview from '../locales/en/partenaire/overview.json';
import enPartenaireCodes from '../locales/en/partenaire/codes.json';
import enPartenaireActeurs from '../locales/en/partenaire/acteurs.json';
import enPartenaireCommissions from '../locales/en/partenaire/commissions.json';
import enPartenaireSignalements from '../locales/en/partenaire/signalements.json';
import enPartenaireParametres from '../locales/en/partenaire/parametres.json';
import enLivreurLayout from '../locales/en/livreur/layout.json';
import enLivreurOverview from '../locales/en/livreur/overview.json';
import enLivreurMissionCard from '../locales/en/livreur/missionCard.json';
import enLivreurRefuseModal from '../locales/en/livreur/refuseMissionModal.json';
import enLivreurMissions from '../locales/en/livreur/missions.json';
import enLivreurEnCours from '../locales/en/livreur/encours.json';
import enLivreurHistorique from '../locales/en/livreur/historique.json';
import enLivreurBoutiques from '../locales/en/livreur/boutiques.json';
import enLivreurRevenus from '../locales/en/livreur/revenus.json';
import enLivreurZone from '../locales/en/livreur/zone.json';
import enLivreurAjouterCorrespondant from '../locales/en/livreur/ajouterCorrespondant.json';
import enLivreurParametres from '../locales/en/livreur/parametres.json';
import enLivreurSecProfil from '../locales/en/livreur/secProfil.json';
import enLivreurSecDocuments from '../locales/en/livreur/secDocuments.json';
import enLivreurSecZone from '../locales/en/livreur/secZone.json';
import enLivreurSecVehicule from '../locales/en/livreur/secVehicule.json';
import enLivreurSecPaiement from '../locales/en/livreur/secPaiement.json';
import enLivreurSecSecurite from '../locales/en/livreur/secSecurite.json';
import enLivreurSecNotifications from '../locales/en/livreur/secNotifications.json';
import enLivreurSecConfidentialite from '../locales/en/livreur/secConfidentialite.json';
import enLivreurSecDanger from '../locales/en/livreur/secDanger.json';
import enLivreurReseau from '../locales/en/livreur/reseau.json';
import enLivreurProfilReseau from '../locales/en/livreur/profilLivreurReseau.json';

const traductions = {
  ...enLayout, ...enOverview, ...enCommandes, ...enRetours, ...enProduits, ...enAjouter, ...enServices, ...enAjouterService, ...enInventaire, ...enFournisseurs,
  ...enPromotions, ...enAnalytics, ...enLivreurs, ...enCorrespondants, ...enProfilCorrespondant, ...enProfilLivreur,
  ...enFinances, ...enWallet, ...enClients, ...enClientProfil, ...enAvis, ...enParametres, ...enEquipe,
  ...enBoutiquePreview, ...enMessagerie, ...enSeo,
  ...enHome, ...enHeader, ...enFooter, ...enBoutiquesPage, ...enCataloguePage, ...enTypeEntreprisePage, ...enBoutiqueDetail, ...enProduitDetail,
  ...enPanierCommande, ...enFollowToggle, ...enLivreursPage, ...enCorrespondantsPage, ...enOffresPage, ...enSharedCards,
  ...enCompare,
  ...enSettingsPage, ...enClientDashboard,
  ...enPartenaireLayout, ...enPartenaireOverview, ...enPartenaireCodes, ...enPartenaireActeurs, ...enPartenaireCommissions, ...enPartenaireSignalements, ...enPartenaireParametres,
  ...enLivreurLayout, ...enLivreurOverview, ...enLivreurMissionCard, ...enLivreurRefuseModal, ...enLivreurMissions, ...enLivreurEnCours, ...enLivreurHistorique, ...enLivreurBoutiques, ...enLivreurRevenus, ...enLivreurZone, ...enLivreurAjouterCorrespondant, ...enLivreurParametres, ...enLivreurSecProfil, ...enLivreurSecDocuments, ...enLivreurSecZone, ...enLivreurSecVehicule, ...enLivreurSecPaiement, ...enLivreurSecSecurite, ...enLivreurSecNotifications, ...enLivreurSecConfidentialite, ...enLivreurSecDanger, ...enLivreurReseau, ...enLivreurProfilReseau,
};

export default traductions;
