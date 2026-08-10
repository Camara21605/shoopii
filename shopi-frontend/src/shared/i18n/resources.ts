/* ============================================================
 * FICHIER : src/shared/i18n/resources.ts
 *
 * RÔLE : Point d'entrée UNIQUE des fichiers de traduction.
 *        Chaque langue réellement traduite doit être importée
 *        et ajoutée ici — c'est cet objet qui sert de source de
 *        vérité pour déterminer les langues supportées
 *        (voir supportedLangs.ts), donc pour griser ou non une
 *        langue dans le sélecteur (SecLangue.tsx).
 *
 *        Un dossier par dashboard, un fichier par page/section :
 *          locales/<lang>/entreprise/  → dashboard entreprise
 *          locales/<lang>/home/        → site public (storefront)
 *          locales/<lang>/client/      → espace personnel du client
 *        Tous ces fichiers sont fusionnés dans le namespace UNIQUE
 *        "common". Aucun changement de code n'est requis dans les
 *        composants : ceux-ci utilisent toujours t('clé') → common.
 * ============================================================ */

// ── Français ────────────────────────────────────────────────
// entreprise/
import frLayout               from './locales/fr/entreprise/layout.json';
import frOverview             from './locales/fr/entreprise/overview.json';
import frCommandes            from './locales/fr/entreprise/commandes.json';
import frRetours               from './locales/fr/entreprise/retours.json';
import frProduits               from './locales/fr/entreprise/produits.json';
import frAjouter                 from './locales/fr/entreprise/ajouter.json';
import frInventaire               from './locales/fr/entreprise/inventaire.json';
import frPromotions                from './locales/fr/entreprise/promotions.json';
import frAnalytics                  from './locales/fr/entreprise/analytics.json';
import frLivreurs                    from './locales/fr/entreprise/livreurs.json';
import frCorrespondants               from './locales/fr/entreprise/correspondants.json';
import frProfilCorrespondant           from './locales/fr/entreprise/profilCorrespondant.json';
import frProfilLivreur                  from './locales/fr/entreprise/profilLivreur.json';
import frFinances                        from './locales/fr/entreprise/finances.json';
import frWallet                           from './locales/fr/entreprise/wallet.json';
import frClients                           from './locales/fr/entreprise/clients.json';
import frClientProfil                       from './locales/fr/entreprise/clientProfil.json';
import frAvis                                from './locales/fr/entreprise/avis.json';
import frParametres                           from './locales/fr/entreprise/parametres.json';
import frEquipe                                from './locales/fr/entreprise/equipe.json';
import frBoutiquePreview                        from './locales/fr/entreprise/boutiquePreview.json';
import frMessagerie                              from './locales/fr/entreprise/messagerie.json';
import frSeo                                      from './locales/fr/entreprise/seo.json';
// home/
import frHome                from './locales/fr/home/home.json';
import frHeader               from './locales/fr/home/header.json';
import frFooter                from './locales/fr/home/footer.json';
import frBoutiquesPage          from './locales/fr/home/boutiquesPage.json';
import frBoutiqueDetail          from './locales/fr/home/boutiqueDetail.json';
import frProduitDetail            from './locales/fr/home/produitDetail.json';
import frPanierCommande            from './locales/fr/home/panierCommande.json';
import frFollowToggle                from './locales/fr/home/followToggle.json';
import frLivreursPage                 from './locales/fr/home/livreursPage.json';
import frCorrespondantsPage            from './locales/fr/home/correspondantsPage.json';
import frOffresPage                     from './locales/fr/home/offresPage.json';
import frSharedCards                     from './locales/fr/home/sharedCards.json';
// client/
import frSettingsPage    from './locales/fr/client/settingsPage.json';
import frClientDashboard  from './locales/fr/client/dashboard.json';

// ── Anglais ─────────────────────────────────────────────────
// entreprise/
import enLayout               from './locales/en/entreprise/layout.json';
import enOverview             from './locales/en/entreprise/overview.json';
import enCommandes            from './locales/en/entreprise/commandes.json';
import enRetours               from './locales/en/entreprise/retours.json';
import enProduits               from './locales/en/entreprise/produits.json';
import enAjouter                 from './locales/en/entreprise/ajouter.json';
import enInventaire               from './locales/en/entreprise/inventaire.json';
import enPromotions                from './locales/en/entreprise/promotions.json';
import enAnalytics                  from './locales/en/entreprise/analytics.json';
import enLivreurs                    from './locales/en/entreprise/livreurs.json';
import enCorrespondants               from './locales/en/entreprise/correspondants.json';
import enProfilCorrespondant           from './locales/en/entreprise/profilCorrespondant.json';
import enProfilLivreur                  from './locales/en/entreprise/profilLivreur.json';
import enFinances                        from './locales/en/entreprise/finances.json';
import enWallet                           from './locales/en/entreprise/wallet.json';
import enClients                           from './locales/en/entreprise/clients.json';
import enClientProfil                       from './locales/en/entreprise/clientProfil.json';
import enAvis                                from './locales/en/entreprise/avis.json';
import enParametres                           from './locales/en/entreprise/parametres.json';
import enEquipe                                from './locales/en/entreprise/equipe.json';
import enBoutiquePreview                        from './locales/en/entreprise/boutiquePreview.json';
import enMessagerie                              from './locales/en/entreprise/messagerie.json';
import enSeo                                      from './locales/en/entreprise/seo.json';
// home/
import enHome                from './locales/en/home/home.json';
import enHeader               from './locales/en/home/header.json';
import enFooter                from './locales/en/home/footer.json';
import enBoutiquesPage          from './locales/en/home/boutiquesPage.json';
import enBoutiqueDetail          from './locales/en/home/boutiqueDetail.json';
import enProduitDetail            from './locales/en/home/produitDetail.json';
import enPanierCommande            from './locales/en/home/panierCommande.json';
import enFollowToggle                from './locales/en/home/followToggle.json';
import enLivreursPage                 from './locales/en/home/livreursPage.json';
import enCorrespondantsPage            from './locales/en/home/correspondantsPage.json';
import enOffresPage                     from './locales/en/home/offresPage.json';
import enSharedCards                     from './locales/en/home/sharedCards.json';
// client/
import enSettingsPage    from './locales/en/client/settingsPage.json';
import enClientDashboard  from './locales/en/client/dashboard.json';

// ── Arabe ───────────────────────────────────────────────────
// entreprise/
import arLayout               from './locales/ar/entreprise/layout.json';
import arOverview             from './locales/ar/entreprise/overview.json';
import arCommandes            from './locales/ar/entreprise/commandes.json';
import arRetours               from './locales/ar/entreprise/retours.json';
import arProduits               from './locales/ar/entreprise/produits.json';
import arAjouter                 from './locales/ar/entreprise/ajouter.json';
import arInventaire               from './locales/ar/entreprise/inventaire.json';
import arPromotions                from './locales/ar/entreprise/promotions.json';
import arAnalytics                  from './locales/ar/entreprise/analytics.json';
import arLivreurs                    from './locales/ar/entreprise/livreurs.json';
import arCorrespondants               from './locales/ar/entreprise/correspondants.json';
import arProfilCorrespondant           from './locales/ar/entreprise/profilCorrespondant.json';
import arProfilLivreur                  from './locales/ar/entreprise/profilLivreur.json';
import arFinances                        from './locales/ar/entreprise/finances.json';
import arWallet                           from './locales/ar/entreprise/wallet.json';
import arClients                           from './locales/ar/entreprise/clients.json';
import arClientProfil                       from './locales/ar/entreprise/clientProfil.json';
import arAvis                                from './locales/ar/entreprise/avis.json';
import arParametres                           from './locales/ar/entreprise/parametres.json';
import arEquipe                                from './locales/ar/entreprise/equipe.json';
import arBoutiquePreview                        from './locales/ar/entreprise/boutiquePreview.json';
import arMessagerie                              from './locales/ar/entreprise/messagerie.json';
import arSeo                                      from './locales/ar/entreprise/seo.json';
// home/
import arHome                from './locales/ar/home/home.json';
import arHeader               from './locales/ar/home/header.json';
import arFooter                from './locales/ar/home/footer.json';
import arBoutiquesPage          from './locales/ar/home/boutiquesPage.json';
import arBoutiqueDetail          from './locales/ar/home/boutiqueDetail.json';
import arProduitDetail            from './locales/ar/home/produitDetail.json';
import arPanierCommande            from './locales/ar/home/panierCommande.json';
import arFollowToggle                from './locales/ar/home/followToggle.json';
import arLivreursPage                 from './locales/ar/home/livreursPage.json';
import arCorrespondantsPage            from './locales/ar/home/correspondantsPage.json';
import arOffresPage                     from './locales/ar/home/offresPage.json';
import arSharedCards                     from './locales/ar/home/sharedCards.json';
// client/
import arSettingsPage    from './locales/ar/client/settingsPage.json';
import arClientDashboard  from './locales/ar/client/dashboard.json';

// ── Chinois ─────────────────────────────────────────────────
// entreprise/
import zhLayout               from './locales/zh/entreprise/layout.json';
import zhOverview             from './locales/zh/entreprise/overview.json';
import zhCommandes            from './locales/zh/entreprise/commandes.json';
import zhRetours               from './locales/zh/entreprise/retours.json';
import zhProduits               from './locales/zh/entreprise/produits.json';
import zhAjouter                 from './locales/zh/entreprise/ajouter.json';
import zhInventaire               from './locales/zh/entreprise/inventaire.json';
import zhPromotions                from './locales/zh/entreprise/promotions.json';
import zhAnalytics                  from './locales/zh/entreprise/analytics.json';
import zhLivreurs                    from './locales/zh/entreprise/livreurs.json';
import zhCorrespondants               from './locales/zh/entreprise/correspondants.json';
import zhProfilCorrespondant           from './locales/zh/entreprise/profilCorrespondant.json';
import zhProfilLivreur                  from './locales/zh/entreprise/profilLivreur.json';
import zhFinances                        from './locales/zh/entreprise/finances.json';
import zhWallet                           from './locales/zh/entreprise/wallet.json';
import zhClients                           from './locales/zh/entreprise/clients.json';
import zhClientProfil                       from './locales/zh/entreprise/clientProfil.json';
import zhAvis                                from './locales/zh/entreprise/avis.json';
import zhParametres                           from './locales/zh/entreprise/parametres.json';
import zhEquipe                                from './locales/zh/entreprise/equipe.json';
import zhBoutiquePreview                        from './locales/zh/entreprise/boutiquePreview.json';
import zhMessagerie                              from './locales/zh/entreprise/messagerie.json';
import zhSeo                                      from './locales/zh/entreprise/seo.json';
// home/
import zhHome                from './locales/zh/home/home.json';
import zhHeader               from './locales/zh/home/header.json';
import zhFooter                from './locales/zh/home/footer.json';
import zhBoutiquesPage          from './locales/zh/home/boutiquesPage.json';
import zhBoutiqueDetail          from './locales/zh/home/boutiqueDetail.json';
import zhProduitDetail            from './locales/zh/home/produitDetail.json';
import zhPanierCommande            from './locales/zh/home/panierCommande.json';
import zhFollowToggle                from './locales/zh/home/followToggle.json';
import zhLivreursPage                 from './locales/zh/home/livreursPage.json';
import zhCorrespondantsPage            from './locales/zh/home/correspondantsPage.json';
import zhOffresPage                     from './locales/zh/home/offresPage.json';
import zhSharedCards                     from './locales/zh/home/sharedCards.json';
// client/
import zhSettingsPage    from './locales/zh/client/settingsPage.json';
import zhClientDashboard  from './locales/zh/client/dashboard.json';

// ── Portugais ───────────────────────────────────────────────
// entreprise/
import ptLayout               from './locales/pt/entreprise/layout.json';
import ptOverview             from './locales/pt/entreprise/overview.json';
import ptCommandes            from './locales/pt/entreprise/commandes.json';
import ptRetours               from './locales/pt/entreprise/retours.json';
import ptProduits               from './locales/pt/entreprise/produits.json';
import ptAjouter                 from './locales/pt/entreprise/ajouter.json';
import ptInventaire               from './locales/pt/entreprise/inventaire.json';
import ptPromotions                from './locales/pt/entreprise/promotions.json';
import ptAnalytics                  from './locales/pt/entreprise/analytics.json';
import ptLivreurs                    from './locales/pt/entreprise/livreurs.json';
import ptCorrespondants               from './locales/pt/entreprise/correspondants.json';
import ptProfilCorrespondant           from './locales/pt/entreprise/profilCorrespondant.json';
import ptProfilLivreur                  from './locales/pt/entreprise/profilLivreur.json';
import ptFinances                        from './locales/pt/entreprise/finances.json';
import ptWallet                           from './locales/pt/entreprise/wallet.json';
import ptClients                           from './locales/pt/entreprise/clients.json';
import ptClientProfil                       from './locales/pt/entreprise/clientProfil.json';
import ptAvis                                from './locales/pt/entreprise/avis.json';
import ptParametres                           from './locales/pt/entreprise/parametres.json';
import ptEquipe                                from './locales/pt/entreprise/equipe.json';
import ptBoutiquePreview                        from './locales/pt/entreprise/boutiquePreview.json';
import ptMessagerie                              from './locales/pt/entreprise/messagerie.json';
import ptSeo                                      from './locales/pt/entreprise/seo.json';
// home/
import ptHome                from './locales/pt/home/home.json';
import ptHeader               from './locales/pt/home/header.json';
import ptFooter                from './locales/pt/home/footer.json';
import ptBoutiquesPage          from './locales/pt/home/boutiquesPage.json';
import ptBoutiqueDetail          from './locales/pt/home/boutiqueDetail.json';
import ptProduitDetail            from './locales/pt/home/produitDetail.json';
import ptPanierCommande            from './locales/pt/home/panierCommande.json';
import ptFollowToggle                from './locales/pt/home/followToggle.json';
import ptLivreursPage                 from './locales/pt/home/livreursPage.json';
import ptCorrespondantsPage            from './locales/pt/home/correspondantsPage.json';
import ptOffresPage                     from './locales/pt/home/offresPage.json';
import ptSharedCards                     from './locales/pt/home/sharedCards.json';
// client/
import ptSettingsPage    from './locales/pt/client/settingsPage.json';
import ptClientDashboard  from './locales/pt/client/dashboard.json';

const fr = {
  ...frLayout, ...frOverview, ...frCommandes, ...frRetours, ...frProduits, ...frAjouter, ...frInventaire,
  ...frPromotions, ...frAnalytics, ...frLivreurs, ...frCorrespondants, ...frProfilCorrespondant, ...frProfilLivreur,
  ...frFinances, ...frWallet, ...frClients, ...frClientProfil, ...frAvis, ...frParametres, ...frEquipe,
  ...frBoutiquePreview, ...frMessagerie, ...frSeo,
  ...frHome, ...frHeader, ...frFooter, ...frBoutiquesPage, ...frBoutiqueDetail, ...frProduitDetail,
  ...frPanierCommande, ...frFollowToggle, ...frLivreursPage, ...frCorrespondantsPage, ...frOffresPage, ...frSharedCards,
  ...frSettingsPage, ...frClientDashboard,
};

const en = {
  ...enLayout, ...enOverview, ...enCommandes, ...enRetours, ...enProduits, ...enAjouter, ...enInventaire,
  ...enPromotions, ...enAnalytics, ...enLivreurs, ...enCorrespondants, ...enProfilCorrespondant, ...enProfilLivreur,
  ...enFinances, ...enWallet, ...enClients, ...enClientProfil, ...enAvis, ...enParametres, ...enEquipe,
  ...enBoutiquePreview, ...enMessagerie, ...enSeo,
  ...enHome, ...enHeader, ...enFooter, ...enBoutiquesPage, ...enBoutiqueDetail, ...enProduitDetail,
  ...enPanierCommande, ...enFollowToggle, ...enLivreursPage, ...enCorrespondantsPage, ...enOffresPage, ...enSharedCards,
  ...enSettingsPage, ...enClientDashboard,
};

const ar = {
  ...arLayout, ...arOverview, ...arCommandes, ...arRetours, ...arProduits, ...arAjouter, ...arInventaire,
  ...arPromotions, ...arAnalytics, ...arLivreurs, ...arCorrespondants, ...arProfilCorrespondant, ...arProfilLivreur,
  ...arFinances, ...arWallet, ...arClients, ...arClientProfil, ...arAvis, ...arParametres, ...arEquipe,
  ...arBoutiquePreview, ...arMessagerie, ...arSeo,
  ...arHome, ...arHeader, ...arFooter, ...arBoutiquesPage, ...arBoutiqueDetail, ...arProduitDetail,
  ...arPanierCommande, ...arFollowToggle, ...arLivreursPage, ...arCorrespondantsPage, ...arOffresPage, ...arSharedCards,
  ...arSettingsPage, ...arClientDashboard,
};

const zh = {
  ...zhLayout, ...zhOverview, ...zhCommandes, ...zhRetours, ...zhProduits, ...zhAjouter, ...zhInventaire,
  ...zhPromotions, ...zhAnalytics, ...zhLivreurs, ...zhCorrespondants, ...zhProfilCorrespondant, ...zhProfilLivreur,
  ...zhFinances, ...zhWallet, ...zhClients, ...zhClientProfil, ...zhAvis, ...zhParametres, ...zhEquipe,
  ...zhBoutiquePreview, ...zhMessagerie, ...zhSeo,
  ...zhHome, ...zhHeader, ...zhFooter, ...zhBoutiquesPage, ...zhBoutiqueDetail, ...zhProduitDetail,
  ...zhPanierCommande, ...zhFollowToggle, ...zhLivreursPage, ...zhCorrespondantsPage, ...zhOffresPage, ...zhSharedCards,
  ...zhSettingsPage, ...zhClientDashboard,
};

const pt = {
  ...ptLayout, ...ptOverview, ...ptCommandes, ...ptRetours, ...ptProduits, ...ptAjouter, ...ptInventaire,
  ...ptPromotions, ...ptAnalytics, ...ptLivreurs, ...ptCorrespondants, ...ptProfilCorrespondant, ...ptProfilLivreur,
  ...ptFinances, ...ptWallet, ...ptClients, ...ptClientProfil, ...ptAvis, ...ptParametres, ...ptEquipe,
  ...ptBoutiquePreview, ...ptMessagerie, ...ptSeo,
  ...ptHome, ...ptHeader, ...ptFooter, ...ptBoutiquesPage, ...ptBoutiqueDetail, ...ptProduitDetail,
  ...ptPanierCommande, ...ptFollowToggle, ...ptLivreursPage, ...ptCorrespondantsPage, ...ptOffresPage, ...ptSharedCards,
  ...ptSettingsPage, ...ptClientDashboard,
};

export const resources = {
  fr: { common: fr },
  en: { common: en },
  ar: { common: ar },
  zh: { common: zh },
  pt: { common: pt },
} as const;
