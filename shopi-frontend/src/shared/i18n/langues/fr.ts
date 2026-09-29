/* ============================================================
 * FICHIER : src/shared/i18n/langues/fr.ts
 *
 * RÔLE : Toutes les traductions en français, fusionnées dans le namespace
 *        unique « common ». Un fichier par langue : seul celui de la
 *        langue affichée est téléchargé (voir ../resources.ts).
 * ============================================================ */

import frLayout               from '../locales/fr/entreprise/layout.json';
import frOverview             from '../locales/fr/entreprise/overview.json';
import frCommandes            from '../locales/fr/entreprise/commandes.json';
import frRetours               from '../locales/fr/entreprise/retours.json';
import frProduits               from '../locales/fr/entreprise/produits.json';
import frAjouter                 from '../locales/fr/entreprise/ajouter.json';
import frServices                from '../locales/fr/entreprise/services.json';
import frAjouterService           from '../locales/fr/entreprise/ajouterService.json';
import frInventaire               from '../locales/fr/entreprise/inventaire.json';
import frFournisseurs           from '../locales/fr/entreprise/fournisseurs.json';
import frPromotions                from '../locales/fr/entreprise/promotions.json';
import frAnalytics                  from '../locales/fr/entreprise/analytics.json';
import frLivreurs                    from '../locales/fr/entreprise/livreurs.json';
import frCorrespondants               from '../locales/fr/entreprise/correspondants.json';
import frProfilCorrespondant           from '../locales/fr/entreprise/profilCorrespondant.json';
import frProfilLivreur                  from '../locales/fr/entreprise/profilLivreur.json';
import frFinances                        from '../locales/fr/entreprise/finances.json';
import frWallet                           from '../locales/fr/entreprise/wallet.json';
import frClients                           from '../locales/fr/entreprise/clients.json';
import frClientProfil                       from '../locales/fr/entreprise/clientProfil.json';
import frAvis                                from '../locales/fr/entreprise/avis.json';
import frParametres                           from '../locales/fr/entreprise/parametres.json';
import frEquipe                                from '../locales/fr/entreprise/equipe.json';
import frBoutiquePreview                        from '../locales/fr/entreprise/boutiquePreview.json';
import frMessagerie                              from '../locales/fr/entreprise/messagerie.json';
import frSeo                                      from '../locales/fr/entreprise/seo.json';
import frHome                from '../locales/fr/home/home.json';
import frHeader               from '../locales/fr/home/header.json';
import frFooter                from '../locales/fr/home/footer.json';
import frBoutiquesPage          from '../locales/fr/home/boutiquesPage.json';
import frCataloguePage          from '../locales/fr/home/cataloguePage.json';
import frTypeEntreprisePage    from '../locales/fr/home/typeEntreprisePage.json';
import frBoutiqueDetail          from '../locales/fr/home/boutiqueDetail.json';
import frProduitDetail            from '../locales/fr/home/produitDetail.json';
import frPanierCommande            from '../locales/fr/home/panierCommande.json';
import frFollowToggle                from '../locales/fr/home/followToggle.json';
import frLivreursPage                 from '../locales/fr/home/livreursPage.json';
import frCorrespondantsPage            from '../locales/fr/home/correspondantsPage.json';
import frOffresPage                     from '../locales/fr/home/offresPage.json';
import frSharedCards                     from '../locales/fr/home/sharedCards.json';
import frCompare                         from '../locales/fr/home/compare.json';
import frSettingsPage    from '../locales/fr/client/settingsPage.json';
import frClientDashboard  from '../locales/fr/client/dashboard.json';
import frPartenaireLayout from '../locales/fr/partenaire/layout.json';
import frPartenaireOverview from '../locales/fr/partenaire/overview.json';
import frPartenaireCodes from '../locales/fr/partenaire/codes.json';
import frPartenaireActeurs from '../locales/fr/partenaire/acteurs.json';
import frPartenaireCommissions from '../locales/fr/partenaire/commissions.json';
import frPartenaireSignalements from '../locales/fr/partenaire/signalements.json';
import frPartenaireParametres from '../locales/fr/partenaire/parametres.json';
import frLivreurLayout from '../locales/fr/livreur/layout.json';
import frLivreurOverview from '../locales/fr/livreur/overview.json';
import frLivreurMissionCard from '../locales/fr/livreur/missionCard.json';
import frLivreurRefuseModal from '../locales/fr/livreur/refuseMissionModal.json';
import frLivreurMissions from '../locales/fr/livreur/missions.json';
import frLivreurEnCours from '../locales/fr/livreur/encours.json';
import frLivreurHistorique from '../locales/fr/livreur/historique.json';
import frLivreurBoutiques from '../locales/fr/livreur/boutiques.json';
import frLivreurRevenus from '../locales/fr/livreur/revenus.json';
import frLivreurZone from '../locales/fr/livreur/zone.json';
import frLivreurAjouterCorrespondant from '../locales/fr/livreur/ajouterCorrespondant.json';
import frLivreurParametres from '../locales/fr/livreur/parametres.json';
import frLivreurSecProfil from '../locales/fr/livreur/secProfil.json';
import frLivreurSecDocuments from '../locales/fr/livreur/secDocuments.json';
import frLivreurSecZone from '../locales/fr/livreur/secZone.json';
import frLivreurSecVehicule from '../locales/fr/livreur/secVehicule.json';
import frLivreurSecPaiement from '../locales/fr/livreur/secPaiement.json';
import frLivreurSecSecurite from '../locales/fr/livreur/secSecurite.json';
import frLivreurSecNotifications from '../locales/fr/livreur/secNotifications.json';
import frLivreurSecConfidentialite from '../locales/fr/livreur/secConfidentialite.json';
import frLivreurSecDanger from '../locales/fr/livreur/secDanger.json';
import frLivreurReseau from '../locales/fr/livreur/reseau.json';
import frLivreurProfilReseau from '../locales/fr/livreur/profilLivreurReseau.json';

const traductions = {
  ...frLayout, ...frOverview, ...frCommandes, ...frRetours, ...frProduits, ...frAjouter, ...frServices, ...frAjouterService, ...frInventaire, ...frFournisseurs,
  ...frPromotions, ...frAnalytics, ...frLivreurs, ...frCorrespondants, ...frProfilCorrespondant, ...frProfilLivreur,
  ...frFinances, ...frWallet, ...frClients, ...frClientProfil, ...frAvis, ...frParametres, ...frEquipe,
  ...frBoutiquePreview, ...frMessagerie, ...frSeo,
  ...frHome, ...frHeader, ...frFooter, ...frBoutiquesPage, ...frCataloguePage, ...frTypeEntreprisePage, ...frBoutiqueDetail, ...frProduitDetail,
  ...frPanierCommande, ...frFollowToggle, ...frLivreursPage, ...frCorrespondantsPage, ...frOffresPage, ...frSharedCards,
  ...frCompare,
  ...frSettingsPage, ...frClientDashboard,
  ...frPartenaireLayout, ...frPartenaireOverview, ...frPartenaireCodes, ...frPartenaireActeurs, ...frPartenaireCommissions, ...frPartenaireSignalements, ...frPartenaireParametres,
  ...frLivreurLayout, ...frLivreurOverview, ...frLivreurMissionCard, ...frLivreurRefuseModal, ...frLivreurMissions, ...frLivreurEnCours, ...frLivreurHistorique, ...frLivreurBoutiques, ...frLivreurRevenus, ...frLivreurZone, ...frLivreurAjouterCorrespondant, ...frLivreurParametres, ...frLivreurSecProfil, ...frLivreurSecDocuments, ...frLivreurSecZone, ...frLivreurSecVehicule, ...frLivreurSecPaiement, ...frLivreurSecSecurite, ...frLivreurSecNotifications, ...frLivreurSecConfidentialite, ...frLivreurSecDanger, ...frLivreurReseau, ...frLivreurProfilReseau,
};

export default traductions;
