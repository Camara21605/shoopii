# Structure du projet Shopi Frontend

> **Convention** :
> - `modules/` → logique métier (pages, services, hooks, types)
> - `dashboards/` → interfaces par rôle (pas de logique métier)
> - `shared/` → code réutilisable entre tous les modules
> - Chaque composant a son propre fichier CSS Module (`.module.css`)
> - Les CSS Modules sont toujours dans un dossier `styles/` au même niveau
>
> ⚠️ **Fichiers legacy / dupliqués** : le projet contient plusieurs fichiers
> "doublons" issus d'anciennes versions (ex. `global.home.css`,
> `AppContext_correspondant.tsx`, `Toast.home.tsx`...). Ils sont signalés avec
> ⚠️ ci-dessous. Avant de les supprimer, vérifier qu'aucun fichier ne les
> importe encore (recherche globale du nom).

```
src/
├── main.tsx                                          ← Point d'entrée React + Vite
│                                                       Importe variables.css puis global.css
│
├── index.html                                        ← Racine HTML (à la racine du projet)
│                                                       Charge Font Awesome 6.5 via CDN <link>
│                                                       Charge Google Fonts : Fraunces + DM Sans
│
├── app/
│   ├── App.tsx                                       ← Contrôleur principal de l'app
│   ├── router.tsx                                    ← Toutes les routes (React Router v7)
│   │                                                   Voir tableau "Correspondance Routes ↔ Fichiers"
│   │                                                   Définit aussi les gardes :
│   │                                                   PrivateRoute, PublicOnlyRoute,
│   │                                                   HomeRoute, SmartRedirect
│   └── providers/
│       └── AppProviders.tsx                          ← AuthProvider, ToastProvider, etc.
│
│
│ ─────────────────────────────────────────────────────────────────────────────
│  MODULES — Logique métier, indépendante des rôles
│ ─────────────────────────────────────────────────────────────────────────────
│
├── modules/
│   │
│   ├── auth/                                         ← Authentification (tous rôles)
│   │   ├── pages/
│   │   │   ├── Login.tsx                             ← Page unique Connexion + Inscription
│   │   │   │                                           Onglets gérés par useLoginPage()
│   │   │   │                                           Gère aussi les liens d'invitation
│   │   │   │                                           (?role=...&code=...&email=...)
│   │   │   ├── Otp.tsx                               ← ⚠️ FICHIER MORT — non importé, non routé
│   │   │   │                                           Appelle useAuth().login et
│   │   │   │                                           authService.verifyOtp() qui n'existent
│   │   │   │                                           pas → erreurs TS si compilé.
│   │   │   │                                           À supprimer ou réécrire si la
│   │   │   │                                           vérification par OTP est réactivée.
│   │   │   ├── login.css                             ← Styles de la page Login (importé par Login.tsx)
│   │   │   └── ForgotPassword.tsx                    ← Écran "Mot de passe oublié" (affiché dans Login.tsx)
│   │   │
│   │   ├── components/
│   │   │   ├── CodeBlock.tsx                         ← Bloc générique de saisie d'un code d'activation
│   │   │   │                                           (rôles avec codeType: 'single')
│   │   │   ├── CorrespondantCodeBlock.tsx            ← Bloc spécifique au rôle "correspondent"
│   │   │   │                                           (codeType: 'choice') : l'utilisateur choisit
│   │   │   │                                           d'abord qui l'a invité (entreprise/livreur)
│   │   │   │                                           puis saisit le code. Détection auto via
│   │   │   │                                           GET /codes/info/:code (fetch direct, pas
│   │   │   │                                           apiFetch, car page publique sans JWT)
│   │   │   ├── LeftPanel.tsx                         ← Panneau gauche (branding / illustration)
│   │   │   ├── LoginForm.tsx                         ← Formulaire de connexion
│   │   │   │                                           Affiche un seul bloc d'erreur encadré
│   │   │   │                                           (priorité : general > email > password)
│   │   │   ├── OtpCodeInput.tsx                      ← Saisie de code OTP en cases séparées
│   │   │   │                                           (utilisé par useOtpInput, lié à Otp.tsx mort)
│   │   │   ├── PasswordStrengthBar.tsx               ← Barre de force du mot de passe (Register)
│   │   │   ├── PhoneInput.tsx                        ← Champ téléphone avec indicatif pays
│   │   │   ├── RegisterForm.tsx                      ← Formulaire d'inscription
│   │   │   │                                           Validation instantanée via
│   │   │   │                                           handleRegisterChange (useLoginPage)
│   │   │   │                                           Affiche le bon bloc de code selon le rôle
│   │   │   │                                           (CodeBlock ou CorrespondantCodeBlock)
│   │   │   ├── RoleSelector.tsx                      ← Sélecteur de rôle (cartes ROLE_CONFIGS)
│   │   │   └── SuccessScreen.tsx                     ← Écran de succès après connexion/inscription
│   │   │
│   │   ├── services/
│   │   │   └── authService.ts                       ← Appels API : login, register, getMe, logout...
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.tsx                          ← Hook d'accès à l'utilisateur courant
│   │   │   ├── useLoginPage.ts                      ← ⭐ Hook central de la page Login
│   │   │   │                                          - États : activeTab, loginData, registerData,
│   │   │   │                                            loginErrors, registerErrors, isLoading...
│   │   │   │                                          - validateLogin() : validation à la soumission
│   │   │   │                                          - validateRegisterField() : valide UN champ
│   │   │   │                                            (réutilisée pour la saisie ET la soumission)
│   │   │   │                                          - handleRegisterChange() : met à jour
│   │   │   │                                            registerData ET revalide instantanément
│   │   │   │                                            le(s) champ(s) modifié(s)
│   │   │   │                                          - handleLogin() / handleRegister() :
│   │   │   │                                            appels API + navigation vers le dashboard
│   │   │   │                                            du rôle (ROLE_ROUTES)
│   │   │   ├── useOtpInput.ts                       ← Hook de gestion des cases OTP (lié à Otp.tsx mort)
│   │   │   └── usePasswordStrength.ts               ← Calcule le score de force du mot de passe
│   │   │
│   │   ├── roleConfigs.ts                            ← ROLE_CONFIGS, ROLE_LABELS, ROLE_DASHBOARD
│   │   │                                               Config visuelle + règles de code par rôle
│   │   │                                               (commentaires détaillés en français)
│   │   └── types.ts                                  ← UserRole, Role (alias), PublicUser,
│   │                                                    LoginFormData, RegisterFormData, FormErrors,
│   │                                                    CorrespondantType ('company' | 'delivery')...
│   │
│   ├── home/                                         ← Espace public + espace client connecté
│   │   │                                               (page d'accueil, boutiques, produits, panier,
│   │   │                                               livreurs, correspondants, messagerie, profils...)
│   │   │
│   │   ├── pages/
│   │   │   └── HomePage.tsx                          ← Route "/home" — Assemble toutes les sections
│   │   │                                               Accès : anonyme, client (complet),
│   │   │                                               autres rôles (navigation libre, actions
│   │   │                                               client bloquées par Header avec modal)
│   │   │
│   │   ├── data/
│   │   │   ├── mockData.ts                           ← Données mock + shuffleArray()
│   │   │   └── homeStoriesMockData.ts                ← Données du bandeau "stories" (HomeStoriesStrip)
│   │   │
│   │   ├── hooks/                                    ← Hooks transverses à la page d'accueil
│   │   │   ├── useHomeState.ts                       ← État global de la HomePage (toast, modals...)
│   │   │   ├── useCorrespondantsList.ts              ← Charge la liste des correspondants (cards/sections)
│   │   │   └── useLivreursList.ts                    ← Charge la liste des livreurs (cards/sections)
│   │   │
│   │   └── components/
│   │       │
│   │       ├── layout/                               ← Header + Footer (partagés par toutes les
│   │       │   │                                       pages "publiques" du module home)
│   │       │   ├── Header.tsx                        ← Topbar fixe (logo, recherche, nav, panier)
│   │       │   │                                       Bouton panier → navigate('/commande')
│   │       │   │                                       Liens vers /livreurs, /correspondants,
│   │       │   │                                       /messagerie, /mon-profil, /parametres
│   │       │   ├── Header.module.css
│   │       │   ├── Footer.tsx
│   │       │   └── Footer.module.css
│   │       │
│   │       ├── sections/                             ← Sections empilées sur la HomePage
│   │       │   ├── HeroSection.tsx / .module.css     ← Bandeau d'accueil principal
│   │       │   ├── TrustSection.tsx / .module.css    ← Badges de confiance (sécurité, paiement...)
│   │       │   ├── TypeEntrepriseSection.tsx / .module.css ← Types d'entreprises mises en avant
│   │       │   ├── CategoriesSection.tsx / .module.css     ← Grille des catégories de produits
│   │       │   ├── EcosystemeSection.tsx / .module.css     ← Présentation de l'écosystème Shopi
│   │       │   │                                            (client / entreprise / livreur / correspondant)
│   │       │   ├── PromotionsSection.tsx / .module.css     ← Carrousel de promotions
│   │       │   ├── HomeStoriesStrip.tsx                     ← Bandeau "stories" horizontal (type réseau social)
│   │       │   │                                            données : data/homeStoriesMockData.ts
│   │       │   │                                            style  : styles/HomeStoriesStrip.module.css
│   │       │   ├── RandomBloc.tsx / .module.css     ← Blocs aléatoires pondérés (produits×5)
│   │       │   └── HScrollSection.tsx / .module.css ← ⚠️ Doublon de ui/HScrollSection (même rôle :
│   │       │                                            conteneur de défilement horizontal). Les deux
│   │       │                                            existent ; vérifier laquelle est réellement
│   │       │                                            importée avant de modifier l'une des deux.
│   │       │
│   │       ├── cards/                                ← Cartes des blocs aléatoires
│   │       │   ├── CardProduit.tsx                   ← 3 modales : Voir / Boutique / Partager
│   │       │   │                                       ModalVoir → bouton "Voir détail"
│   │       │   │                                       → navigate('/produit/:id')
│   │       │   ├── CardProduit.module.css            ← Contient .mDetailBtn (nouveau bouton)
│   │       │   ├── CardEntreprise.tsx                ← Voir boutique → navigate('/boutique/:id')
│   │       │   ├── CardPartenaire.tsx
│   │       │   ├── CardCorrespondant.tsx             ← Carte correspondant (différente de
│   │       │   │                                       correspondants/components/CardCorrespondant.tsx,
│   │       │   │                                       utilisée uniquement dans les blocs aléatoires)
│   │       │   ├── CardLivreur.tsx
│   │       │   └── Cards.module.css
│   │       │
│   │       ├── ui/                                   ← Composants UI réutilisables du module home
│   │       │   ├── HScrollSection.tsx / .module.css  ← Voir remarque "doublon" ci-dessus
│   │       │   ├── SectionHeader.tsx / .module.css   ← En-tête de section (titre + lien "Voir tout")
│   │       │   └── Toast.tsx / .module.css           ← Toast local au module home
│   │       │                                            (≠ shared/components/ui/Toast.tsx
│   │       │                                            et ≠ Toast.home.tsx, voir SHARED)
│   │       │
│   │       ├── boutique/                             ← Page boutique publique
│   │       │   │                                       Route : /boutique/:id
│   │       │   │
│   │       │   ├── pages/
│   │       │   │   └── BoutiquePage.tsx              ← Assemble toutes les sections boutique
│   │       │   │
│   │       │   ├── sections/
│   │       │   │   ├── BoutiqueCover.tsx             ← Bannière navy + emojis flottants + avatar
│   │       │   │   ├── BoutiqueIdentity.tsx          ← Barre sticky (nom, stats, S'abonner)
│   │       │   │   ├── BoutiqueNav.tsx               ← Onglets (Produits/Promos/Livreurs/Avis/À propos)
│   │       │   │   ├── BoutiqueSidebar.tsx           ← Filtres (tri, catégories, prix, note, stock)
│   │       │   │   ├── ProduitsSection.tsx           ← Grille produits + chips filtres + pagination
│   │       │   │   ├── PromotionsSection.tsx         ← Cards promotions navy (% réduction)
│   │       │   │   ├── LivreursSection.tsx           ← Grille livreurs + résumé disponibles
│   │       │   │   ├── AvisSection.tsx               ← Note globale + barres + liste avis
│   │       │   │   └── AProposSection.tsx            ← Description + infos pratiques + livreurs
│   │       │   │
│   │       │   ├── components/
│   │       │   │   ├── CardProduitBoutique.tsx       ← Carte produit (grille / liste)
│   │       │   │   ├── CardLivreurBoutique.tsx       ← Carte livreur + toggle Suivre
│   │       │   │   │                                   (toggle relié à shared/services/follow.ts
│   │       │   │   │                                    et shared/hooks/useFollowToggle.ts)
│   │       │   │   └── ModalPartage.tsx              ← Modale partage réseaux sociaux
│   │       │   │
│   │       │   ├── data/
│   │       │   │   └── boutiqueMockData.ts           ← Données boutique + types
│   │       │   │                                       → GET /boutiques/:id
│   │       │   │
│   │       │   └── styles/
│   │       │       ├── BoutiquePage.module.css
│   │       │       ├── BoutiqueCover.module.css
│   │       │       ├── BoutiqueIdentity.module.css
│   │       │       ├── BoutiqueNav.module.css
│   │       │       ├── BoutiqueSidebar.module.css
│   │       │       ├── ProduitsSection.module.css
│   │       │       ├── PromotionsSection.module.css
│   │       │       ├── LivreursSection.module.css
│   │       │       ├── AvisSection.module.css
│   │       │       ├── AProposSection.module.css
│   │       │       ├── CardsProduit.module.css
│   │       │       ├── CardsLivreur.module.css
│   │       │       └── ModalPartage.module.css
│   │       │
│   │       ├── produit/                              ← Page détail produit
│   │       │   │                                       Route : /produit/:id
│   │       │   │                                       Appelé depuis CardProduit (ModalVoir)
│   │       │   │                                       → navigate('/produit/:id')
│   │       │   │
│   │       │   ├── pages/
│   │       │   │   └── ProduitPage.tsx               ← Layout 3 colonnes :
│   │       │   │                                       Col 1 : ProduitGallerie (sticky)
│   │       │   │                                       Col 2 : ProduitInfoSection + LivraisonSection
│   │       │   │                                       Col 3 : PanierPanel (sticky)
│   │       │   │
│   │       │   ├── sections/
│   │       │   │   ├── ProduitInfoSection.tsx        ← Titre, prix, variantes, quantité, CTA
│   │       │   │   │                                   Garanties + partage social
│   │       │   │   ├── LivraisonSection.tsx          ← 3 étapes dynamiques :
│   │       │   │   │                                   1. Adresse (continent → pays → ville)
│   │       │   │   │                                   2. Correspondant (si boutique internationale)
│   │       │   │   │                                   3. Mode livraison (standard ou livreur)
│   │       │   │   │                                   Calcul tarif : base × dist × vitesse
│   │       │   │   ├── PanierPanel.tsx               ← Récapitulatif sticky (col droite)
│   │       │   │   │                                   Prix + livraison + correspondant + total
│   │       │   │   │                                   Bouton Panier → navigate('/commande')
│   │       │   │   ├── TabsSection.tsx               ← 4 onglets :
│   │       │   │   │                                   Description / Caractéristiques /
│   │       │   │   │                                   Livraison & Correspondants / Avis
│   │       │   │   └── SimilairesSection.tsx         ← Grille 5 colonnes produits similaires
│   │       │   │
│   │       │   ├── components/
│   │       │   │   ├── ProduitGallerie.tsx           ← Image principale + 5 miniatures
│   │       │   │   │                                   Badges (Populaire / Promo / Importé)
│   │       │   │   │                                   Bouton favori ❤️ + partage
│   │       │   │   └── ModalPartage.tsx              ← Modale partage réseaux sociaux
│   │       │   │
│   │       │   ├── data/
│   │       │   │   └── produitMockData.ts            ← Données : produit, livreurs, correspondants
│   │       │   │                                       avis, géographie, vitesses
│   │       │   │                                       → GET /produits/:id
│   │       │   │
│   │       │   └── styles/
│   │       │       ├── ProduitPage.module.css
│   │       │       ├── ProduitGallerie.module.css
│   │       │       ├── ProduitInfoSection.module.css
│   │       │       ├── LivraisonSection.module.css
│   │       │       ├── PanierPanel.module.css
│   │       │       ├── TabsSection.module.css
│   │       │       ├── SimilairesSection.module.css
│   │       │       └── ModalPartage.module.css
│   │       │
│   │       ├── panier/                               ← Page commande (checkout)
│   │       │   │                                       Route : /commande (protégée — PrivateRoute)
│   │       │   │                                       Appelé depuis Header (bouton panier)
│   │       │   │                                       → navigate('/commande')
│   │       │   │
│   │       │   ├── pages/
│   │       │   │   └── CommandePage.tsx              ← Layout 2 colonnes :
│   │       │   │                                       Col gauche : 5 sections empilées
│   │       │   │                                       Col droite : SummaryPanel sticky
│   │       │   │
│   │       │   ├── sections/
│   │       │   │   ├── ArticlesSection.tsx           ← Panier modifiable (qty +/−, suppression)
│   │       │   │   ├── AdresseSection.tsx            ← Chips adresses + formulaire complet
│   │       │   │   │                                   Prénom, Nom, Tél 🇬🇳, Ville, Commune
│   │       │   │   │                                   Adresse précise + instructions
│   │       │   │   ├── LivraisonSection.tsx          ← Option 1 : standard gratuit
│   │       │   │   │                                   Option 2 : livreur avec vitesse
│   │       │   │   │                                   🐢 Éco / 🚴 Standard / 🚀 Express / ⚡ Ultra
│   │       │   │   │                                   + bloc correspondant (boutique intl)
│   │       │   │   ├── PaiementSection.tsx           ← 6 modes de paiement :
│   │       │   │   │                                   Orange Money, MTN, Carte, Cash, Virement, Wallet
│   │       │   │   │                                   Formulaires dynamiques par mode
│   │       │   │   │                                   Code promo : SHOPI20 = −20%
│   │       │   │   ├── RecapSection.tsx              ← Étape 5 — résumé final + CGV
│   │       │   │   │                                   En-tête navy, grille destinataire/livraison
│   │       │   │   └── SummaryPanel.tsx              ← Colonne droite sticky :
│   │       │   │                                       Articles miniatures + détail coûts
│   │       │   │                                       Total + bouton "Confirmer la commande"
│   │       │   │                                       3 garanties + carte ETA
│   │       │   │
│   │       │   ├── components/
│   │       │   │   ├── ProgressBar.tsx               ← Barre 4 étapes fixe sous le header
│   │       │   │   │                                   ✓ Panier → Livraison → Paiement → Confirmation
│   │       │   │   └── ModalSuccess.tsx              ← Modale confirmation (animation pop-in)
│   │       │   │                                       ID commande + timeline + boutons
│   │       │   │
│   │       │   ├── data/
│   │       │   │   └── panierData.ts                 ← Types + données mock :
│   │       │   │                                       CART_ITEMS, LIVREURS, CORRESPONDANTS
│   │       │   │                                       SPEEDS, ADRESSES, PAY_MODES
│   │       │   │                                       VILLES, COMMUNES
│   │       │   │                                       → GET /panier, GET /livreurs
│   │       │   │
│   │       │   └── styles/
│   │       │       ├── CommandePage.module.css
│   │       │       ├── ProgressBar.module.css
│   │       │       ├── ModalSuccess.module.css
│   │       │       ├── ArticlesSection.module.css
│   │       │       ├── AdresseSection.module.css
│   │       │       ├── LivraisonSection.module.css
│   │       │       ├── PaiementSection.module.css
│   │       │       ├── RecapSection.module.css
│   │       │       └── SummaryPanel.module.css
│   │       │
│   │       ├── livreurs/                             ← ✅ NOUVEAU — Annuaire public des livreurs
│   │       │   │                                       Route : /livreurs
│   │       │   │
│   │       │   ├── pages/
│   │       │   │   └── LivreursPage.tsx              ← Assemble Hero + Toolbar + Sidebar + grille
│   │       │   │
│   │       │   ├── sections/
│   │       │   │   ├── HeroBanner.tsx                ← Bannière d'en-tête de la page livreurs
│   │       │   │   ├── FilterToolbar.tsx             ← Barre de filtres/tri (haut de page)
│   │       │   │   ├── SidebarFilters.tsx            ← Filtres latéraux (zone, vitesse, note...)
│   │       │   │   └── SuggestionsRow.tsx            ← Rangée de suggestions de livreurs
│   │       │   │
│   │       │   ├── cards/
│   │       │   │   ├── CardLivreurGrid.tsx           ← Carte livreur — vue grille
│   │       │   │   └── CardLivreurList.tsx           ← Carte livreur — vue liste
│   │       │   │
│   │       │   ├── data/
│   │       │   │   └── livreursMockData.ts           ← Données mock des livreurs
│   │       │   │
│   │       │   ├── hooks/
│   │       │   │   └── useLivreurs.ts                ← Récupère/filtre la liste des livreurs
│   │       │   │
│   │       │   └── styles/
│   │       │       ├── LivreursPage.module.css
│   │       │       ├── HeroBanner.module.css
│   │       │       ├── FilterToolbar.module.css
│   │       │       ├── SidebarFilters.module.css
│   │       │       ├── SuggestionsRow.module.css
│   │       │       ├── CardLivreurGrid.module.css
│   │       │       └── CardLivreurList.module.css
│   │       │
│   │       ├── correspondants/                       ← ✅ NOUVEAU — Annuaire public des correspondants
│   │       │   │                                       Route : /correspondants
│   │       │   │
│   │       │   ├── pages/
│   │       │   │   └── CorrespondantsPage.tsx        ← Assemble Hero + Toolbar + Sidebar + liste
│   │       │   │
│   │       │   ├── sections/
│   │       │   │   ├── HeroCorrespondants.tsx        ← Bannière d'en-tête
│   │       │   │   ├── ToolbarCorrespondants.tsx     ← Barre de recherche/tri
│   │       │   │   └── SidebarCorrespondants.tsx     ← Filtres latéraux (pays, type...)
│   │       │   │
│   │       │   ├── components/
│   │       │   │   ├── CardCorrespondant.tsx         ← Carte correspondant (vue grille)
│   │       │   │   └── ListItemCorrespondant.tsx     ← Ligne correspondant (vue liste)
│   │       │   │
│   │       │   ├── data/
│   │       │   │   ├── types.ts                      ← Types Correspondant (module home)
│   │       │   │   └── correspondantsMock.ts         ← Données mock
│   │       │   │
│   │       │   ├── services/
│   │       │   │   └── correspondants.api.ts         ← Appels API correspondants (liste/recherche)
│   │       │   │                                       ≠ shared/services/api/correspondants.api.ts
│   │       │   │                                       (voir SHARED pour la différence)
│   │       │   │
│   │       │   ├── hooks/
│   │       │   │   └── useCorrespondants.ts          ← Récupère/filtre la liste des correspondants
│   │       │   │                                       (utilisé aussi par modules/home/hooks/
│   │       │   │                                       useCorrespondantsList.ts pour la HomePage)
│   │       │   │
│   │       │   └── styles/
│   │       │       └── Correspondants.module.css
│   │       │
│   │       ├── messagerie/                           ← ✅ NOUVEAU — Messagerie côté espace client
│   │       │   │                                       Route : /messagerie (protégée)
│   │       │   │                                       ⚠️ Existe AUSSI dans shared/messagerie/
│   │       │   │                                       (MessagerieCore, réutilisé par les
│   │       │   │                                       dashboards). Ce dossier-ci est la version
│   │       │   │                                       spécifique à l'espace client (page complète
│   │       │   │                                       avec son propre layout, sa propre liste de
│   │       │   │                                       conversations, etc.)
│   │       │   │
│   │       │   ├── pages/
│   │       │   │   └── MessageriePage.tsx            ← Page complète : Topbar + Liste conv. + Chat + Info
│   │       │   │
│   │       │   ├── sections/
│   │       │   │   ├── MessagerieTopbar.tsx          ← Barre supérieure (titre, recherche, nouvelle conv.)
│   │       │   │   ├── ConversationList.tsx          ← Colonne gauche : liste des conversations
│   │       │   │   ├── ChatWindow.tsx                ← Colonne centrale : fil de discussion
│   │       │   │   ├── ChatEmpty.tsx                 ← État vide (aucune conversation sélectionnée)
│   │       │   │   ├── InfoPanel.tsx                 ← Colonne droite : infos du contact/de la conv.
│   │       │   │   └── NewConvModal.tsx              ← Modale "Nouvelle conversation"
│   │       │   │
│   │       │   ├── components/
│   │       │   │   ├── ConvItem.tsx                  ← Élément de la liste de conversations
│   │       │   │   ├── MessageBubble.tsx             ← Bulle de message (envoyé/reçu)
│   │       │   │   └── MessageInput.tsx              ← Champ de saisie + envoi de message
│   │       │   │
│   │       │   ├── data/
│   │       │   │   └── messagerieMockData.ts         ← Données mock conversations/messages
│   │       │   │
│   │       │   └── styles/
│   │       │       ├── MessageriePage.module.css
│   │       │       ├── MessagerieTopbar.module.css
│   │       │       ├── ConversationList.module.css
│   │       │       ├── ConvItem.module.css
│   │       │       ├── ChatWindow.module.css
│   │       │       ├── ChatEmpty.module.css
│   │       │       ├── MessageBubble.module.css
│   │       │       ├── MessageInput.module.css
│   │       │       ├── InfoPanel.module.css
│   │       │       └── NewConvModal.module.css
│   │       │
│   │       ├── profil-client/                        ← ✅ NOUVEAU — Profil public/privé du client
│   │       │   │                                       Route : /mon-profil (protégée — client connecté)
│   │       │   │
│   │       │   ├── ProfilClientPage.tsx              ← Page autonome (pas de prop à passer,
│   │       │   │                                       lit l'utilisateur via AppContext)
│   │       │   ├── types.ts                          ← Types du profil client
│   │       │   │
│   │       │   ├── components/
│   │       │   │   ├── ProfilHeaderClient.tsx        ← En-tête (avatar, nom, stats)
│   │       │   │   ├── ProfilSidebarClient.tsx       ← Menu latéral des onglets du profil
│   │       │   │   └── ProfilTabsClient.tsx          ← Gestion des onglets (commandes, avis...)
│   │       │   │
│   │       │   ├── sections/                         ← Une section par onglet du profil
│   │       │   │   ├── SectionActivity.tsx           ← Activité récente du client
│   │       │   │   ├── SectionOrders.tsx             ← Historique des commandes
│   │       │   │   ├── SectionSubs.tsx               ← Abonnements (boutiques/livreurs suivis)
│   │       │   │   ├── SectionFavs.tsx               ← Favoris (produits/boutiques)
│   │       │   │   └── SectionReviews.tsx            ← Avis laissés par le client
│   │       │   │
│   │       │   ├── data/
│   │       │   │   └── profilClientData.ts           ← Données mock du profil
│   │       │   │
│   │       │   ├── services/
│   │       │   │   └── profilClient.api.ts           ← Appels API profil client
│   │       │   │
│   │       │   ├── hooks/
│   │       │   │   └── useProfilClient.ts            ← Charge les données du profil + onglets
│   │       │   │
│   │       │   └── styles/
│   │       │       └── ProfilClient.module.css
│   │       │
│   │       ├── profil-correspondant/                 ← ✅ NOUVEAU — Profil public d'un correspondant
│   │       │   │                                       Route : /correspondants/:id
│   │       │   │
│   │       │   ├── pages/
│   │       │   │   └── ProfilCorrespondantPage.tsx   ← Page autonome (lit :id via useParams)
│   │       │   │
│   │       │   ├── components/
│   │       │   │   ├── ProfilHeader.tsx              ← En-tête (avatar, nom, note, bouton Suivre)
│   │       │   │   ├── ProfilSidebar.tsx             ← Menu latéral des onglets
│   │       │   │   └── ProfilTabs.tsx                ← Gestion des onglets
│   │       │   │
│   │       │   ├── sections/                         ← Une section par onglet
│   │       │   │   ├── TabInfo.tsx                   ← Informations générales
│   │       │   │   ├── TabServices.tsx               ← Services proposés (dépôt, retrait colis...)
│   │       │   │   ├── TabZones.tsx                  ← Zones couvertes
│   │       │   │   ├── TabTarifs.tsx                 ← Grille tarifaire
│   │       │   │   ├── TabGalerie.tsx                ← Galerie photos
│   │       │   │   └── TabAvis.tsx                   ← Avis clients
│   │       │   │
│   │       │   ├── data/
│   │       │   │   ├── types.ts                      ← Types du profil correspondant
│   │       │   │   └── correspondantMock.ts          ← Données mock
│   │       │   │
│   │       │   ├── services/
│   │       │   │   └── correspondantProfil.api.ts    ← Appels API du profil (≠ correspondants.api.ts
│   │       │   │                                       qui gère la liste/annuaire)
│   │       │   │
│   │       │   ├── hooks/
│   │       │   │   └── useCorrespondantProfil.ts     ← Charge les données du profil affiché
│   │       │   │
│   │       │   └── styles/
│   │       │       └── ProfilCorrespondant.module.css
│   │       │
│   │       └── profil-livreur/                       ← ✅ NOUVEAU — Profil public d'un livreur
│   │           │                                       Route : /livreurs/:id
│   │           │
│   │           ├── ProfilLivreurPage.tsx             ← Page autonome (lit :id via useParams)
│   │           ├── types.ts                          ← Types du profil livreur
│   │           │
│   │           ├── components/
│   │           │   ├── ProfilHeader.tsx              ← En-tête (avatar, nom, note, bouton Suivre)
│   │           │   ├── ProfilSidebar.tsx             ← Menu latéral des onglets
│   │           │   ├── ProfilTabs.tsx                ← Gestion des onglets
│   │           │   ├── TabInfo.tsx                   ← Informations générales
│   │           │   ├── TabVehicule.tsx               ← Informations véhicule
│   │           │   ├── TabZones.tsx                  ← Zones de livraison couvertes
│   │           │   ├── TabTarifs.tsx                 ← Grille tarifaire (vitesses de livraison)
│   │           │   └── TabPlaceholder.tsx            ← Onglet "à venir" générique
│   │           │
│   │           ├── hooks/
│   │           │   └── useLivreurProfile.ts          ← Charge les données du profil affiché
│   │           │
│   │           └── styles/
│   │               └── ProfilLivreur.module.css
│   │
│   │   (➕ Le dossier components/ ci-dessus contient aussi :
│   │       components/settings/  ← ✅ NOUVEAU — Paramètres du compte client
│   │       Route : /parametres (protégée)
│   │
│   │       components/settings/
│   │       ├── api/
│   │       │   └── settings.api.ts                   ← Appels API paramètres compte
│   │       └── pages/
│   │           ├── SettingsPage.tsx                  ← Page racine (reçoit onToast en prop
│   │           │                                       depuis router.tsx)
│   │           ├── components/
│   │           │   ├── SettingsSidebar.tsx           ← Menu latéral des sections de réglages
│   │           │   ├── SecurityScoreBanner.tsx       ← Bandeau "score de sécurité du compte"
│   │           │   └── Toggle.tsx                    ← Interrupteur on/off générique
│   │           ├── sections/
│   │           │   ├── ProfilSection.tsx             ← Informations personnelles
│   │           │   ├── SecuriteSection.tsx           ← Mot de passe, 2FA, sessions actives
│   │           │   ├── PaiementSection.tsx           ← Moyens de paiement enregistrés
│   │           │   ├── AdressesSection.tsx           ← Carnet d'adresses de livraison
│   │           │   ├── ActiviteSection.tsx           ← Historique d'activité du compte
│   │           │   ├── ApprobationsSection.tsx       ← Demandes/approbations en attente
│   │           │   ├── SessionsSection.tsx           ← Liste des sessions/appareils connectés
│   │           │   ├── PointsSection.tsx             ← Points de fidélité / récompenses
│   │           │   └── OtherSections.tsx             ← Sections diverses regroupées (notifications...)
│   │           └── styles/
│   │               ├── SettingsPage.module.css
│   │               ├── SettingsSidebar.module.css
│   │               └── SettingsCard.module.css
│   │   )
│   │
│   ├── commandes/                                    ← Module métier "Commandes" (back-office,
│   │   │                                               distinct de panier/CommandePage qui est le
│   │   │                                               tunnel d'achat côté client)
│   │   ├── pages/
│   │   │   └── CommandesPage.tsx                     ← Liste/suivi des commandes
│   │   ├── services/
│   │   │   └── commandesService.ts                   ← Appels API commandes
│   │   └── types.ts                                  ← interface Commande { id, reference, client,
│   │                                                    statut, montant, createdAt, updatedAt }
│   │
│   ├── utilisateurs/                                 ← 📦 Vide — réservé (gestion utilisateurs)
│   ├── livraisons/                                   ← 📦 Vide — réservé (gestion livraisons)
│   ├── messagerie/                                   ← 📦 Vide — réservé
│   │                                                   (la messagerie réelle vit dans
│   │                                                   shared/messagerie/ et
│   │                                                   modules/home/components/messagerie/)
│   ├── abonnements/                                  ← 📦 Vide — réservé (gestion abonnements)
│   │
│   └── commandes/                                    ← Module "suivi de commande" (page de validation
│       │                                               multi-acteurs : entreprise → livreur → correspondant → client)
│       │                                               Route : /commande/:id/suivi
│       │
│       ├── pages/
│       │   └── CommandePage.tsx                      ← Page unique partagée par les 4 rôles
│       │                                               Prop `role` détermine quel acteur voit quoi
│       │                                               Prop `useApi` : true = données réelles, false = démo
│       │                                               Affiche le code de validation de l'acteur courant
│       │                                               Sections : ProgressBar + ValidationChain (gauche)
│       │                                                         OrderSummary + ActorsList + CommissionsCard (droite)
│       │
│       ├── components/
│       │   ├── ActeurStep.tsx                        ← Carte d'un acteur dans la chaîne de validation
│       │   │                                           Affiche : avatar, nom, rôle, statut (wait/now/done)
│       │   │                                           Si c'est le tour de l'acteur → champ saisie code
│       │   ├── CodeInput.tsx                         ← Saisie d'un code de validation à N chiffres
│       │   │                                           (cases séparées, auto-focus, paste supporté)
│       │   ├── Facture.tsx                           ← Modale facture imprimable (PDF via window.print())
│       │   │                                           Affiche : en-tête Shopi, parties, tableau articles,
│       │   │                                           totaux, chaîne de validation, tampon "Validé Shopi"
│       │   └── ProgressBar.tsx                       ← Barre de progression de la chaîne (étapes 1→4)
│       │
│       ├── sections/
│       │   ├── ValidationChain.tsx                   ← Liste des ActeurStep dans l'ordre de la chaîne
│       │   ├── OrderSummary.tsx                      ← Récapitulatif articles + montants (colonne droite)
│       │   ├── ActorsList.tsx                        ← Liste des acteurs + statut validation + étoiles de notation
│       │   │                                           Reçoit `notations` prop → affiche les étoiles données
│       │   ├── CommissionsCard.tsx                   ← Commissions versées à chaque acteur (visible après livraison)
│       │   ├── DoneBanner.tsx                        ← Bannière "Commande livrée !" avec boutons Noter / Litige
│       │   ├── RatingModal.tsx                       ← Modale de notation des acteurs (étoiles 1-5 + commentaire)
│       │   │                                           + section pourboire livreur (chips 5K/10K/20K/Aucun)
│       │   └── IssueModal.tsx                        ← Modale de signalement de litige (type + description)
│       │
│       ├── hooks/
│       │   └── useCommande.ts                        ← Hook central de la page commande
│       │                                               - Charge les données via GET /commandes/:uuid
│       │                                               - Gère la progression (currentStep)
│       │                                               - valider(idx, code) → POST /commandes/:id/valider
│       │                                               - noter(role, note, commentaire) → stocke dans notations
│       │                                               - envoyerNotes() → POST /commandes/:id/notes
│       │                                               - signaler(type, desc) → POST /commandes/:id/litige
│       │                                               - Persiste les notations dans sessionStorage (survie aux re-renders)
│       │
│       ├── services/
│       │   └── commande.api.ts                       ← Appels API :
│       │                                               GET  /commandes/:uuid      → détail commande
│       │                                               POST /commandes/:id/valider → valider une étape
│       │                                               POST /commandes/:id/notes   → envoyer les notations
│       │                                               POST /commandes/:id/litige  → signaler un problème
│       │
│       ├── data/
│       │   ├── types.ts                              ← Types : Commande, Acteur, ArticleCommande,
│       │   │                                           CommandeMontant, Commission, Notation,
│       │   │                                           ActeurRole, EtapeStatut, TypeProbleme
│       │   └── commandeMock.ts                       ← Données mock pour mode démo (useApi=false)
│       │
│       └── styles/                                   ← Un .module.css par composant/section
│           ├── CommandePage.module.css
│           ├── ActeurStep.module.css
│           ├── ActorsList.module.css
│           ├── CodeInput.module.css
│           ├── CommissionsCard.module.css
│           ├── DoneBanner.module.css
│           ├── Facture.module.css
│           ├── IssueModal.module.css
│           ├── OrderSummary.module.css
│           ├── ProgressBar.module.css
│           ├── RatingModal.module.css
│           └── ValidationChain.module.css
│
│
│ ─────────────────────────────────────────────────────────────────────────────
│  DASHBOARDS — Interfaces spécifiques par rôle
│  Toutes utilisent le pattern "activePage + PageRenderer" (pas de sous-routes
│  imbriquées : un seul composant <Role>App.tsx affiche la bonne page selon
│  un état local activePage, changé via la Sidebar)
│ ─────────────────────────────────────────────────────────────────────────────
│
├── dashboards/
│   ├── super-admin/                                  ← Route : /dashboard/super-admin/*
│   │   ├── SuperAdminApp.tsx
│   │   ├── components/
│   │   │   ├── CodeModal.tsx                         ← Génération/gestion des codes d'invitation
│   │   │   ├── NewMessageModal.tsx
│   │   │   ├── ToastStock.tsx
│   │   │   └── UserModal.tsx
│   │   ├── data/
│   │   │   └── mockDB.ts
│   │   ├── hooks/
│   │   │   └── useSuperAdminState.ts                 ← État global du dashboard (activePage...)
│   │   ├── sections/
│   │   │   ├── AlertsSection.tsx
│   │   │   ├── AnalyticsSection.tsx
│   │   │   ├── AuditSection.tsx
│   │   │   ├── FinancesSection.tsx
│   │   │   ├── InvitationsSection.tsx
│   │   │   ├── MessagingSection.tsx
│   │   │   ├── OverviewSection.tsx
│   │   │   ├── PermissionsSection.tsx
│   │   │   ├── SettingsSection.tsx
│   │   │   ├── SystemSection.tsx
│   │   │   └── UsersSection.tsx
│   │   ├── styles/
│   │   │   └── super-admin.css
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       └── Topbar.tsx
│   │
│   ├── administrateur/                               ← Route : /dashboard/admin/*
│   │   └── AdministrateurApp.tsx                     ← ⚠️ Placeholder minimal — pas encore développé
│   │
│   ├── entreprise/                                   ← Route : /dashboard/entreprise/*
│   │   ├── EntrepriseApp.tsx                         ← App principale (activePage + PageRenderer)
│   │   │                                               Charge le profil boutique (logo, nom, statut)
│   │   │                                               et passe ces infos à Sidebar + Topbar
│   │   ├── EntrepriseApp.css
│   │   ├── hooks/
│   │   │   ├── useEntrepriseState.ts                 ← État global du dashboard
│   │   │   └── useParametres.ts                      ← Hook central des paramètres boutique
│   │   │                                               (sections multiples + bandeau "non enregistré")
│   │   ├── data/
│   │   │   └── mockData.ts
│   │   ├── services/
│   │   │   ├── commandesApi.ts                       ← GET /entreprise/commandes → liste des commandes boutique
│   │   │   └── avisApi.ts                            ← GET /dashboard/entreprise/avis → avis clients réels
│   │   │                                               POST /dashboard/entreprise/avis/:id/reponse → répondre
│   │   │
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx / Sidebar.css             ← Menu latéral (logo boutique, toutes les pages)
│   │   │   ├── Topbar.tsx / Topbar.css               ← Barre supérieure avec :
│   │   │   │                                           - Dropdown avatar → "Mon profil" (→ 'profil'),
│   │   │   │                                             "Voir ma boutique" (→ 'boutique-preview'),
│   │   │   │                                             "Basculer vers l'accueil" (→ /home),
│   │   │   │                                             "Se déconnecter" (→ /login)
│   │   │   │                                           - Statut boutique dynamique (active/en pause/privée)
│   │   │   │                                           - Bottom nav mobile
│   │   │   └── ReseauBottomNav.tsx                   ← Bottom nav spécifique au réseau
│   │   │                                               (Correspondants · Livreurs · Mon espace)
│   │   ├── components/
│   │   │   └── parametres/                           ← Composants réutilisés par toutes les
│   │   │       │                                       sections de la page Paramètres
│   │   │       ├── FormCard.tsx                      ← Carte de formulaire générique
│   │   │       ├── ParamNav.tsx                      ← Navigation entre sections de paramètres
│   │   │       ├── SaveFloat.tsx                     ← Barre flottante "Enregistrer / Annuler"
│   │   │       └── ToggleRow.tsx                     ← Ligne avec interrupteur on/off
│   │   ├── sections/
│   │   │   └── parametres/                           ← Une section par thème de paramètres
│   │   │       ├── BoutiqueSection.tsx               ← Infos générales de la boutique
│   │   │       ├── CatalogueSection.tsx              ← Réglages du catalogue produits
│   │   │       ├── CommissionsSection.tsx            ← Commissions / frais
│   │   │       ├── ConfidentialiteSection.tsx        ← Confidentialité des données
│   │   │       ├── ContactSection.tsx                ← Coordonnées de contact
│   │   │       ├── DangerSection.tsx                 ← Zone "danger" (suppression compte...)
│   │   │       ├── DocumentsSection.tsx              ← Documents légaux/justificatifs
│   │   │       ├── HorairesSection.tsx               ← Horaires d'ouverture
│   │   │       ├── LivraisonSection.tsx              ← Réglages livraison
│   │   │       ├── NotifsSection.tsx                 ← Préférences de notifications
│   │   │       ├── PaiementSection.tsx               ← Moyens de paiement acceptés
│   │   │       ├── PrivacySection.tsx                ← Réglages de confidentialité (vie privée)
│   │   │       └── SecuriteSection.tsx               ← Sécurité du compte (mot de passe, 2FA)
│   │   ├── pages/
│   │   │   ├── OverviewPage.tsx / .css               ← Vue d'ensemble (KPIs : commandes, revenus, stock, note)
│   │   │   ├── AnalyticsPage.tsx                     ← Statistiques détaillées (graphiques, tendances)
│   │   │   ├── AvisPage.tsx                          ← Avis clients RÉELS (API /dashboard/entreprise/avis)
│   │   │   │                                           Distribution étoiles dynamique, répondre aux avis
│   │   │   ├── AjouterPage.tsx                       ← Formulaire d'ajout/modification de produit
│   │   │   ├── BoutiquePreviewPage.tsx               ← Aperçu de la boutique publique dans un iframe
│   │   │   │                                           Charge /boutique/:id?preview=1 → masque le Header home
│   │   │   │                                           Bouton "Ouvrir dans un onglet" → window.open()
│   │   │   ├── ClientsPage.tsx                       ← Liste des clients de la boutique
│   │   │   ├── CommandesPage.tsx                     ← Commandes de la boutique (≠ modules/commandes)
│   │   │   ├── CorrespondantsPage.tsx + .module.css  ← Correspondants liés à la boutique
│   │   │   ├── FinancesPage.tsx / .css               ← Finances / revenus
│   │   │   ├── InventairePage.tsx + .module.css      ← Inventaire / stock
│   │   │   ├── LivreursPage.tsx + .module.css        ← Livreurs liés à la boutique
│   │   │   ├── MessagesPage.tsx                      ← Messagerie (wrapper de shared/messagerie/MessagerieCore)
│   │   │   ├── ParametresPage.tsx                    ← Page Paramètres (assemble sections/parametres)
│   │   │   ├── ProduitsPage.tsx + .module.css        ← Gestion des produits
│   │   │   ├── PromotionsPage.tsx + .module.css      ← Gestion des promotions
│   │   │   ├── ReseauCorrespondantsPage.tsx          ← Réseau Shopi : suivre des correspondants
│   │   │   ├── ReseauLivreursPage.tsx                ← Réseau Shopi : suivre des livreurs
│   │   │   ├── ProfilCorrespondantReseauPage.tsx     ← Profil détaillé d'un correspondant du réseau
│   │   │   ├── ProfilLivreurReseauPage.tsx           ← Profil détaillé d'un livreur du réseau
│   │   │   ├── PortefeuillePage.tsx                  ← Portefeuille / retraits
│   │   │   ├── RetoursPage.tsx                       ← Retours produits / SAV
│   │   │   ├── SEOPage.tsx / .css                    ← Réglages SEO de la boutique
│   │   │   └── parametres/
│   │   │       └── types.ts                          ← Types du formulaire Paramètres
│   │   ├── styles/
│   │   │   ├── entreprise.css
│   │   │   └── parametres/                           ← Styles des composants de la page Paramètres
│   │   │       ├── ParametresPage.module.css
│   │   │       ├── FormCard.module.css
│   │   │       ├── ParamNav.module.css
│   │   │       ├── SaveFloat.module.css
│   │   │       ├── ToggleRow.module.css
│   │   │       └── UnsavedBar.module.css             ← Bandeau "modifications non enregistrées"
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── partenaire/                                   ← Route : /dashboard/partenaire/*
│   │   └── PartenaireApp.tsx                         ← ⚠️ Placeholder minimal — pas encore développé
│   │
│   ├── livreur/                                      ← Route : /dashboard/livreur/*
│   │   ├── LivreurApp.tsx                            ← App principale (activePage + PageRenderer)
│   │   ├── components/
│   │   │   ├── Sidebar.tsx                           ← Menu latéral (Vue d'ensemble, Missions,
│   │   │   │                                           En cours, Historique, Boutiques, Zone,
│   │   │   │                                           Revenus, Wallet, Évaluation, Abonnements,
│   │   │   │                                           Paramètres...)
│   │   │   ├── Topbar.tsx                            ← Barre supérieure (notifications, profil)
│   │   │   ├── NotifPanel.tsx                        ← Panneau latéral de notifications
│   │   │   ├── MissionCard.tsx                       ← Carte d'une mission de livraison
│   │   │   ├── ParamNav.tsx                          ← Navigation entre sections de paramètres
│   │   │   ├── SaveFloat.tsx                         ← Barre flottante "Enregistrer / Annuler"
│   │   │   └── Toast.tsx                             ← Toast local au dashboard livreur
│   │   ├── data/
│   │   │   ├── livreurData.ts                        ← Données mock (missions, revenus, zones...)
│   │   │   └── parametresData.ts                     ← Données mock des paramètres livreur
│   │   ├── hooks/
│   │   │   └── useLivreurParametres.ts               ← État du formulaire "Paramètres" livreur
│   │   ├── pages/
│   │   │   ├── OverviewPage.tsx                      ← Vue d'ensemble (KPIs du livreur)
│   │   │   ├── MissionsPage.tsx                      ← Missions disponibles / proposées
│   │   │   ├── EnCoursPage.tsx                       ← Missions en cours de livraison
│   │   │   ├── HistoriquePage.tsx                    ← Historique des livraisons effectuées
│   │   │   ├── BoutiquesPage.tsx                     ← Boutiques avec lesquelles le livreur travaille
│   │   │   ├── ZonePage.tsx                          ← Zones de couverture géographique
│   │   │   ├── RevenusPage.tsx                       ← Revenus / statistiques de gains
│   │   │   ├── WalletPage.tsx                        ← Portefeuille / retraits
│   │   │   ├── EvaluationPage.tsx                    ← Avis et évaluations reçus
│   │   │   ├── AbonnerPage.tsx                       ← Gestion des abonnés (clients qui suivent le livreur)
│   │   │   ├── LivreurParametresPage.tsx             ← Page Paramètres (assemble pages/params/*)
│   │   │   ├── PlaceholderPage.tsx                   ← Page générique "à venir"
│   │   │   └── params/                               ← Sections de la page Paramètres livreur
│   │   │       ├── SecProfil.tsx                     ← Informations personnelles
│   │   │       ├── SecVehicule.tsx                   ← Informations véhicule
│   │   │       ├── SecZone.tsx                       ← Zones de livraison
│   │   │       ├── SecVitesses.tsx                   ← Tarifs par vitesse de livraison
│   │   │       ├── SecDocuments.tsx                  ← Documents/justificatifs
│   │   │       ├── SecPaiement.tsx                   ← Moyens de paiement / virement
│   │   │       ├── SecNotifications.tsx              ← Préférences de notifications
│   │   │       ├── SecConfidentialite.tsx            ← Confidentialité
│   │   │       ├── SecSecurite.tsx                   ← Sécurité du compte
│   │   │       └── SecDanger.tsx                     ← Zone "danger" (suppression compte...)
│   │   └── styles/                                   ← Un .module.css par composant/page ci-dessus
│   │       ├── LivreurApp.module.css
│   │       ├── Sidebar.module.css
│   │       ├── Topbar.module.css
│   │       ├── NotifPanel.module.css
│   │       ├── MissionCard.module.css
│   │       ├── OverviewPage.module.css
│   │       ├── EnCoursPage.module.css
│   │       ├── ParamNav.module.css
│   │       ├── ParametresPage.module.css
│   │       ├── ParamsShared.module.css               ← Styles partagés entre les sections SecXxx
│   │       ├── Shared.module.css                     ← Styles partagés entre les pages du dashboard
│   │       ├── SaveFloat.module.css
│   │       └── Toast.module.css
│   │
│   ├── correspondant/                                ← Route : /dashboard/correspondant/*
│   │   ├── CorrespondantApp.tsx                      ← App principale (activePage + PageRenderer)
│   │   ├── components/
│   │   │   ├── Sidebar.tsx                           ← Menu latéral (Vue d'ensemble, Colis,
│   │   │   │                                           Clients, Boutiques, Livreurs, Retours,
│   │   │   │                                           Transferts, Zone, Revenus, Évaluation,
│   │   │   │                                           Paramètres...)
│   │   │   ├── Topbar.tsx
│   │   │   ├── NotifPanel.tsx
│   │   │   ├── ParamNav.tsx
│   │   │   ├── SaveFloat.tsx
│   │   │   └── Toast.tsx
│   │   ├── data/
│   │   │   ├── correspondantData.ts                  ← Données mock (colis, transferts, zones...)
│   │   │   └── parametresData.ts                     ← Données mock des paramètres correspondant
│   │   ├── hooks/
│   │   │   ├── useCorrespondantParametres.ts         ← État du formulaire "Paramètres" correspondant
│   │   │   └── useDirty.ts                           ← Détecte les modifications non enregistrées
│   │   │                                               (active la SaveFloat / UnsavedBar)
│   │   ├── pages/
│   │   │   ├── OverviewPage.tsx                      ← Vue d'ensemble (KPIs)
│   │   │   ├── ColisPage.tsx                         ← Gestion des colis en transit
│   │   │   ├── ClientsPage.tsx                       ← Clients du correspondant
│   │   │   ├── BoutiquesPage.tsx                     ← Boutiques partenaires
│   │   │   ├── LivreursPage.tsx                      ← Livreurs travaillant avec le correspondant
│   │   │   ├── RetoursPage.tsx                       ← Retours de colis
│   │   │   ├── TransfertsPage.tsx                    ← Transferts entre correspondants
│   │   │   ├── ZonePage.tsx                          ← Zone de couverture géographique
│   │   │   ├── RevenusPage.tsx                       ← Revenus / commissions
│   │   │   ├── EvaluationPage.tsx                    ← Avis et évaluations reçus
│   │   │   └── ParametresPage.tsx                    ← Page Paramètres (assemble sections/params/*)
│   │   ├── sections/
│   │   │   └── params/                               ← Sections de la page Paramètres correspondant
│   │   │       ├── SecProfil.tsx                     ← Informations personnelles / entité
│   │   │       ├── SecEntites.tsx                    ← Entités liées (entreprises/livreurs associés)
│   │   │       ├── SecZone.tsx                       ← Zone de couverture
│   │   │       ├── SecDepot.tsx                      ← Réglages du point de dépôt
│   │   │       ├── SecColis.tsx                      ← Réglages de gestion des colis
│   │   │       ├── SecDocuments.tsx                  ← Documents/justificatifs
│   │   │       ├── SecPaiement.tsx                   ← Moyens de paiement
│   │   │       ├── SecNotifications.tsx              ← Préférences de notifications
│   │   │       ├── SecConfidentialite.tsx            ← Confidentialité
│   │   │       ├── SecSecurite.tsx                   ← Sécurité du compte
│   │   │       ├── SecDanger.tsx                     ← Zone "danger" (suppression compte...)
│   │   │       ├── ToggleRow.tsx                     ← Ligne avec interrupteur on/off
│   │   │       └── RadioOption.tsx                   ← Option radio réutilisable
│   │   └── styles/                                   ← Un .module.css par composant/page ci-dessus
│   │       ├── CorrespondantApp.module.css
│   │       ├── Sidebar.module.css
│   │       ├── Topbar.module.css
│   │       ├── NotifPanel.module.css
│   │       ├── OverviewPage.module.css
│   │       ├── ParamNav.module.css
│   │       ├── ParametresPage.module.css
│   │       ├── ParamsShared.module.css
│   │       ├── Shared.module.css
│   │       ├── SaveFloat.module.css
│   │       └── Toast.module.css
│   │
│   └── client/                                       ← Route : /dashboard/client/*
│       └── ClientApp.tsx                             ← ⚠️ Placeholder minimal — l'espace "client"
│                                                        réel est en fait /home + /mon-profil +
│                                                        /parametres + /messagerie (modules/home),
│                                                        ce dashboard n'est utilisé qu'en fallback
│
│
│ ─────────────────────────────────────────────────────────────────────────────
│  SHARED — Code réutilisable entre tous les modules et dashboards
│ ─────────────────────────────────────────────────────────────────────────────
│
├── shared/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── FieldInput.tsx                        ← Champ de formulaire générique
│   │   │   │                                           (label, icône, erreur) — utilisé par
│   │   │   │                                           LoginForm / RegisterForm
│   │   │   ├── Toast.tsx                             ← Toast générique (utilisé par Login.tsx)
│   │   │   ├── Toast.home.tsx                        ← ⚠️ Variante de Toast pour le module home
│   │   │   │                                           (vérifier si toujours utilisé vs
│   │   │   │                                           modules/home/components/ui/Toast.tsx)
│   │   │   ├── ToastContainer.tsx                    ← Conteneur empilant plusieurs Toasts
│   │   │   └── ToastContainer_correspondant.tsx      ← ⚠️ Variante pour l'espace correspondant
│   │   │                                               (vérifier doublon avec ToastContainer.tsx)
│   │   └── layout/
│   │       └── NotFound.tsx                          ← Page 404 (route "*")
│   │
│   ├── hooks/
│   │   ├── useFollowToggle.ts                        ← Suivre/Ne plus suivre une boutique/un
│   │   │                                               livreur/un correspondant (toggle + appel API)
│   │   ├── useHomeState.ts                           ← ⚠️ Version partagée de modules/home/hooks/
│   │   │                                               useHomeState.ts — vérifier laquelle est
│   │   │                                               réellement importée par HomePage.tsx
│   │   ├── useReveal.ts                              ← Anime l'apparition des éléments au scroll
│   │   │                                               (classe .rv + IntersectionObserver, comme
│   │   │                                               dans Login.tsx)
│   │   └── useToast_correspondant.ts                 ← ⚠️ Variante de hook toast pour l'espace
│   │                                                     correspondant (vérifier doublon)
│   │
│   ├── services/
│   │   ├── apiFetch.ts                               ← Client HTTP central (fetch + Bearer JWT)
│   │   │                                               Exporte tokenStorage, ApiError, apiFetch()
│   │   │                                               Gère : Content-Type JSON, FormData auto-detect,
│   │   │                                               401 → redirect /login, messages d'erreur NestJS
│   │   ├── authUtils.ts                              ← Utilitaires JWT : isTokenValid(),
│   │   │                                               getRoleFromToken(), getDashboardPath()
│   │   │                                               (décode le payload JWT via atob)
│   │   ├── favoris.api.ts                            ← GET /client/favoris → liste des favoris
│   │   │                                               POST /client/favoris/:productId/toggle → toggle
│   │   │                                               Retourne { productId, nom, imageUrl, prix, emoji }
│   │   ├── follow.ts                                 ← POST /suivis/livreurs/:id → toggle follow livreur
│   │   │                                               Retourne { isSuivi: boolean }
│   │   └── api/                                      ← Appels API par domaine (back-office)
│   │       ├── correspondants.api.ts                 ← Profil public correspondant + toggle suivi
│   │       │                                           GET /public/correspondants/:id
│   │       │                                           POST /suivis/correspondants/:id → { isSuivi }
│   │       │                                           ≠ modules/home/components/correspondants/
│   │       │                                           services/correspondants.api.ts (annuaire public)
│   │       ├── livreurs.api.ts                       ← Profil public livreur
│   │       │                                           GET /public/livreurs/:id
│   │       └── promotions.api.ts                     ← CRUD promotions (entreprise dashboard)
│   │
│   ├── context/
│   │   ├── AppContext.tsx                            ← AppProvider / useAppContext
│   │   │                                               { user, isAuthenticated, isLoading,
│   │   │                                               setUser, logout }
│   │   │                                               Restaure la session via authService.getMe()
│   │   │                                               si un token existe au montage
│   │   ├── AppContext_correspondant.tsx              ← ⚠️ Variante d'AppContext pour l'espace
│   │   │                                               correspondant (vérifier si toujours utilisé
│   │   │                                               ou remplacé par AppContext.tsx)
│   │   ├── CartContext.tsx                           ← Contexte du panier (articles, quantités)
│   │   │                                               utilisé par panier/ et Header
│   │   └── ToastContext.tsx                          ← ToastProvider / useToast — utilisé par
│   │                                                    shared/messagerie/MessagerieCore
│   │
│   ├── types/
│   │   └── index_correspondant.ts                    ← ⚠️ Types spécifiques à l'espace
│   │                                                     correspondant (vérifier doublon avec
│   │                                                     modules/home/components/correspondants/data/types.ts
│   │                                                     et profil-correspondant/data/types.ts)
│   │
│   ├── profils/                                      ← ✅ PROFILS PUBLICS — déplacés depuis modules/home/components/
│   │   │                                               Chaque sous-dossier = page de profil public d'un acteur
│   │   │                                               (accessible sans authentification)
│   │   │
│   │   ├── profil-client/                            ← Route : /mon-profil (client connecté)
│   │   │   ├── ProfilClientPage.tsx                  ← Page autonome (Header + ProfilHeaderClient + onglets + sidebar)
│   │   │   ├── types.ts                              ← ClientTab ('orders'|'subs'|'favs'|'reviews'|'activity')
│   │   │   ├── components/
│   │   │   │   ├── ProfilHeaderClient.tsx            ← Cover + avatar (photo de profil réelle) + badges + KPIs
│   │   │   │   │                                       Charge la photo depuis GET /client/parametres/profil
│   │   │   │   │                                       Écoute l'event 'avatar-updated' pour sync temps réel
│   │   │   │   ├── ProfilSidebarClient.tsx           ← Sidebar droite (paiements, infos personnelles, points/wallet)
│   │   │   │   └── ProfilTabsClient.tsx              ← Onglets horizontaux (Commandes / Suivis / Favoris / Avis / Activité)
│   │   │   ├── sections/
│   │   │   │   ├── SectionOrders.tsx                 ← Commandes RÉELLES depuis GET /client/commandes
│   │   │   │   │                                       Résumé (Total/En cours/Livrées/Annulées)
│   │   │   │   │                                       Filtres, image snapshot, bouton Suivre/Détails/Voir
│   │   │   │   │                                       Navigation → /commande/:uuid/suivi
│   │   │   │   ├── SectionSubs.tsx                   ← Abonnements RÉELS depuis GET /suivis/mes-abonnements
│   │   │   │   │                                       Toggle suivre/ne plus suivre avec appel API
│   │   │   │   │                                       POST /suivis/boutiques/:id | /livreurs/:id | /correspondants/:id
│   │   │   │   ├── SectionFavs.tsx                   ← Favoris réels
│   │   │   │   ├── SectionReviews.tsx                ← Avis publiés par le client
│   │   │   │   └── SectionActivity.tsx               ← Journal d'activité récente
│   │   │   ├── data/
│   │   │   │   └── profilClientData.ts               ← Types : ClientProfil, ClientKpi, Commande,
│   │   │   │                                           Abonnement, Favori, Avis, AvisScore, etc.
│   │   │   │                                           + données mock (fallback)
│   │   │   │                                           + fmtGnf() : formater les montants GNF
│   │   │   ├── hooks/
│   │   │   │   └── useProfilClient.ts                ← ⭐ Hook central — charge TOUT en parallèle :
│   │   │   │                                           GET /client/profil (identité, KPIs)
│   │   │   │                                           GET /suivis/mes-abonnements (abonnements)
│   │   │   │                                           GET /client/favoris (favoris)
│   │   │   │                                           GET /client/commandes (commandes)
│   │   │   │                                           Enrichit les commandes avec images produits
│   │   │   │                                           (GET /public/produits?q=nom via fetchProductImage)
│   │   │   ├── services/
│   │   │   │   └── profilClient.api.ts               ← Types API + fonctions :
│   │   │   │                                           fetchMonProfil() → GET /client/profil
│   │   │   │                                           fetchMesAbonnements() → GET /suivis/mes-abonnements
│   │   │   │                                           fetchMesCommandes() → GET /client/commandes
│   │   │   │                                           CommandeClientApi : id (ref), uuid, items[]
│   │   │   │                                           CommandeItemApi : nomProduit, imageProduit (snapshot!)
│   │   │   └── styles/
│   │   │       └── ProfilClient.module.css
│   │   │
│   │   ├── profil-correspondant/                     ← Route : /correspondants/:id (public)
│   │   │   ├── pages/
│   │   │   │   └── ProfilCorrespondantPage.tsx       ← Layout : Header + ProfilHeader + Tabs + Sidebar
│   │   │   ├── components/
│   │   │   │   ├── ProfilHeader.tsx                  ← Avatar, nom, note, badges, bouton Suivre
│   │   │   │   ├── ProfilSidebar.tsx                 ← Infos contact, vérifications, similaires
│   │   │   │   └── ProfilTabs.tsx                    ← Onglets (Info / Services / Zones / Tarifs / Galerie / Avis)
│   │   │   ├── sections/
│   │   │   │   ├── TabInfo.tsx    ← Informations pratiques + horaires
│   │   │   │   ├── TabServices.tsx ← Services proposés (dépôt, stockage, dédouanement...)
│   │   │   │   ├── TabZones.tsx   ← Zones couvertes + pays partenaires
│   │   │   │   ├── TabTarifs.tsx  ← Grille tarifaire
│   │   │   │   ├── TabGalerie.tsx ← Galerie photos du point relais
│   │   │   │   └── TabAvis.tsx    ← Avis clients (note globale + liste)
│   │   │   ├── data/
│   │   │   │   ├── types.ts          ← CorrProfil, InfoPratique, ScheduleRow, ContactRow, etc.
│   │   │   │   └── correspondantMock.ts ← Données mock du profil correspondant
│   │   │   ├── hooks/
│   │   │   │   └── useCorrespondantProfil.ts ← GET /public/correspondants/:id + toggle suivi
│   │   │   ├── services/
│   │   │   │   └── correspondantProfil.api.ts ← fetchCorrespondantProfil() + toggleSuiviCorrespondant()
│   │   │   └── styles/
│   │   │       └── ProfilCorrespondant.module.css
│   │   │
│   │   ├── profil-livreur/                           ← Route : /livreurs/:id (public)
│   │   │   ├── ProfilLivreurPage.tsx                 ← Layout : Header + ProfilHeader + Tabs + Sidebar
│   │   │   ├── types.ts                              ← LivreurProfile, ProfilTab
│   │   │   ├── components/
│   │   │   │   ├── ProfilHeader.tsx   ← Avatar, nom, note, zone, bouton Suivre
│   │   │   │   ├── ProfilSidebar.tsx  ← Infos contact, véhicule, zones
│   │   │   │   ├── ProfilTabs.tsx     ← Onglets (Info / Véhicule / Zones / Tarifs)
│   │   │   │   ├── TabInfo.tsx        ← Informations générales + statistiques
│   │   │   │   ├── TabVehicule.tsx    ← Type de véhicule + capacité
│   │   │   │   ├── TabZones.tsx       ← Zones de livraison couvertes
│   │   │   │   ├── TabTarifs.tsx      ← Grille tarifaire par vitesse (🐢/🚴/🚀/⚡)
│   │   │   │   └── TabPlaceholder.tsx ← Onglet "à venir" (Avis, Historique...)
│   │   │   ├── hooks/
│   │   │   │   └── useLivreurProfile.ts ← GET /public/livreurs/:id + toggle suivi
│   │   │   └── styles/
│   │   │       └── ProfilLivreur.module.css
│   │   │
│   │   └── profil-entreprise/                        ← Profil boutique VU PAR L'ENTREPRISE elle-même
│   │       │                                           (activePage = 'profil' dans le dashboard entreprise)
│   │       │                                           ≠ /boutique/:id (vue publique client)
│   │       │
│   │       └── ProfilEntreprisePage.tsx              ← Page "Mon profil" dans le dashboard entreprise
│   │                                                   Utilise useParametres() → GET /dashboard/entreprise/parametres
│   │                                                   Affiche : cover (cliquable → upload), logo (cliquable → upload),
│   │                                                   nom, statut, slogan, contact, horaires, livraison, tags
│   │                                                   Bouton "Voir ma boutique" → activePage = 'boutique-preview'
│   │                                                   Bouton "Paramètres" → activePage = 'parametres'
│   │
│   └── messagerie/                                   ← ✅ NOUVEAU — Cœur de messagerie partagé
│       │                                               Intégré dans chaque dashboard via une page
│       │                                               wrapper minimaliste, ex. :
│       │                                                 // dashboards/entreprise/pages/MessagesPage.tsx
│       │                                                 import MessagerieCore from
│       │                                                   '../../../shared/messagerie/MessagerieCore';
│       │                                                 export default () => <MessagerieCore />;
│       │
│       ├── MessagerieCore.tsx                        ← Composant principal :
│       │                                               useMessagerie() (état) + ConvList (gauche)
│       │                                               + ChatWindow (centre) + InfoPanel (droite)
│       │                                               + NewConvModal (modale nouvelle conversation)
│       ├── hooks/
│       │   └── useMessagerie.ts                      ← Hook central d'état (conversations,
│       │                                               usersMap, conversation active, envoi...)
│       ├── data/
│       │   ├── messagerieTypes.ts                    ← Types Conversation, Message, User...
│       │   └── messagerieMockData.ts                 ← Données mock
│       ├── components/
│       │   ├── ConvList.tsx                          ← Colonne gauche : liste des conversations
│       │   └── NewConvModal.tsx                      ← Modale "Nouvelle conversation"
│       ├── sections/
│       │   ├── ChatWindow.tsx                        ← Colonne centrale : fil de discussion
│       │   └── InfoPanel.tsx                         ← Colonne droite : informations du contact
│       └── styles/
│           ├── MessagerieLayout.module.css
│           ├── ConvList.module.css
│           ├── ChatWindow.module.css
│           ├── InfoPanel.module.css
│           └── NewConvModal.module.css
│
│
│ ─────────────────────────────────────────────────────────────────────────────
│  STYLES — Variables et styles globaux
│ ─────────────────────────────────────────────────────────────────────────────
│
└── styles/
    ├── global.css                                    ← Reset + body + scrollbar + liens + boutons
    │                                                   Importé dans main.tsx après variables.css
    ├── variables.css                                 ← Toutes les variables CSS (--navy, --blue…)
    │                                                   Importé EN PREMIER dans main.tsx
    │
    ├── global.home.css                               ← ⚠️ Variante de global.css pour le module home
    ├── variables.home.css                            ← ⚠️ Variante de variables.css pour le module home
    ├── global_correspondant.css                      ← ⚠️ Variante de global.css pour l'espace correspondant
    └── variables_correspondant.css                   ← ⚠️ Variante de variables.css pour l'espace correspondant
                                                          Ces 4 fichiers sont probablement issus
                                                          d'anciennes versions où chaque "espace"
                                                          avait son propre jeu de variables/reset.
                                                          Vérifier dans chaque page concernée
                                                          (home/, correspondant/) quel fichier est
                                                          réellement importé avant de les fusionner
                                                          ou de les supprimer.
```

---

---

## Pages du Dashboard Entreprise (`activePage`)

> Le dashboard entreprise n'utilise pas React Router pour les sous-pages.
> `EntrepriseApp.tsx` maintient un état `activePage` et un `PageRenderer` (switch) mappe chaque valeur au bon composant.

| `activePage`              | Composant rendu                         | Description |
|---------------------------|-----------------------------------------|-------------|
| `'overview'`              | `OverviewPage.tsx`                      | Vue d'ensemble (KPIs) |
| `'commandes'`             | `CommandesPage.tsx`                     | Commandes de la boutique |
| `'retours'`               | `RetoursPage.tsx`                       | Retours & SAV |
| `'produits'`              | `ProduitsPage.tsx`                      | Catalogue produits |
| `'ajouter'`               | `AjouterPage.tsx`                       | Ajouter / modifier un produit |
| `'inventaire'`            | `InventairePage.tsx`                    | Stock et inventaire |
| `'promotions'`            | `PromotionsPage.tsx`                    | Codes promo |
| `'analytics'`             | `AnalyticsPage.tsx`                     | Statistiques avancées |
| `'messages'`              | `MessagesPage.tsx`                      | Messagerie (MessagerieCore) |
| `'seo'`                   | `SEOPage.tsx`                           | SEO & Marketing |
| `'livreurs'`              | `LivreursPage.tsx`                      | Livreurs de la boutique |
| `'correspondants'`        | `CorrespondantsPage.tsx`                | Correspondants de la boutique |
| `'finances'`              | `FinancesPage.tsx`                      | Revenus et finances |
| `'portefeuille'`          | `PortefeuillePage.tsx`                  | Portefeuille / retraits |
| `'clients'`               | `ClientsPage.tsx`                       | Base clients |
| `'avis'`                  | `AvisPage.tsx`                          | Avis clients réels (API) |
| `'parametres'`            | `ParametresPage.tsx`                    | Paramètres de la boutique |
| `'profil'`                | `shared/profils/profil-entreprise/ProfilEntreprisePage.tsx` | Profil boutique de l'entreprise |
| `'boutique-preview'`      | `BoutiquePreviewPage.tsx`               | Aperçu boutique (iframe /boutique/:id?preview=1) |
| `'reseauLivreurs'`        | `ReseauLivreursPage.tsx`                | Suivre des livreurs du réseau |
| `'reseauCorrespondants'`  | `ReseauCorrespondantsPage.tsx`          | Suivre des correspondants |
| `'profilLivreurReseau'`   | `ProfilLivreurReseauPage.tsx`           | Profil d'un livreur suivi |
| `'profilCorrespondantReseau'` | `ProfilCorrespondantReseauPage.tsx` | Profil d'un correspondant suivi |

---

## Flux de l'image de profil client (avatar-updated)

```
SettingsSidebar.tsx (paramètres)
  │  upload → POST /upload/avatar → { url }
  │  PATCH → settingsApi.updateAvatar(url)
  └─ window.dispatchEvent(new CustomEvent('avatar-updated', { detail: url }))
        │
        ├─→ Header.tsx (topbar)          → setAvatarUrl(url) → affiche la photo
        ├─→ ProfilHeaderClient.tsx       → setAvatarUrl(url) → affiche la photo
        └─→ ProfilSection.tsx (settings) → setAvatarUrl(url) → affiche la photo
```

## Flux des commandes client

```
/commande (panier)
  └─ POST /client/commandes → { id: uuid }
       └─ navigate('/commande/:uuid/suivi')

/mon-profil (onglet Commandes)
  └─ GET /client/commandes → [{ id: "CMD-...", uuid: "...", items:[{imageProduit}] }]
       └─ click sur une commande → navigate('/commande/:uuid/suivi')

/commande/:uuid/suivi
  └─ GET /commandes/:uuid → { acteurs, articles, codes, currentStep }
       ├─ valider → POST /commandes/:uuid/valider { role, code }
       ├─ noter   → POST /commandes/:uuid/notes   { notes[], pourboire }
       └─ litige  → POST /commandes/:uuid/litige  { type, description }
```

---

## Règles de nommage

| Type de fichier      | Convention             | Exemple                       |
|----------------------|------------------------|-------------------------------|
| Composant React      | PascalCase             | `CardProduit.tsx`             |
| CSS Module           | PascalCase + .module   | `CardProduit.module.css`      |
| Hook                  | camelCase + use        | `useAuth.tsx`                 |
| Service              | camelCase + Service / .api | `authService.ts`, `correspondants.api.ts` |
| Types / données mock | camelCase              | `panierData.ts`               |
| Page                  | PascalCase + Page      | `CommandePage.tsx`            |
| Section               | PascalCase + Section / Tab | `ArticlesSection.tsx`, `TabInfo.tsx` |
| Dossier styles        | toujours `styles/`     | `panier/styles/`               |
| Sections "Paramètres"| préfixe `Sec`          | `SecProfil.tsx`, `SecSecurite.tsx` |

---

## Correspondance Routes ↔ Fichiers

| Route                          | Fichier                                                                          | Accès |
|---------------------------------|-----------------------------------------------------------------------------------|-------|
| `/`                              | `SmartRedirect` (router.tsx) → redirige selon le rôle/token                       | tous |
| `/login`, `/register`           | `modules/auth/pages/Login.tsx`                                                    | non connecté (PublicOnlyRoute) |
| `/home`                          | `modules/home/pages/HomePage.tsx`                                                 | tous (HomeRoute) |
| `/boutique/:id`                  | `modules/home/components/boutique/pages/BoutiquePage.tsx`                        | public |
| `/produit/:id`                   | `modules/home/components/produit/pages/ProduitPage.tsx`                          | public |
| `/livreurs`                      | `modules/home/components/livreurs/pages/LivreursPage.tsx`                        | public |
| `/livreurs/:id`                  | `shared/profils/profil-livreur/ProfilLivreurPage.tsx`                             | public |
| `/correspondants`                | `modules/home/components/correspondants/pages/CorrespondantsPage.tsx`            | public |
| `/correspondants/:id`            | `shared/profils/profil-correspondant/pages/ProfilCorrespondantPage.tsx`           | public |
| `/mon-profil`                    | `shared/profils/profil-client/ProfilClientPage.tsx`                               | client connecté (PrivateRoute) |
| `/commande`                      | `modules/home/components/panier/pages/CommandePage.tsx`                          | client connecté (PrivateRoute) |
| `/commande/:id/suivi`            | `modules/commandes/pages/CommandePage.tsx`                                        | connecté (PrivateRoute) |
| `/messagerie`                    | `modules/home/components/messagerie/pages/MessageriePage.tsx`                    | connecté (PrivateRoute) |
| `/parametres`                    | `modules/home/components/settings/pages/SettingsPage.tsx`                        | connecté (PrivateRoute) |
| `/dashboard/super-admin/*`       | `dashboards/super-admin/SuperAdminApp.tsx`                                        | rôle super_admin |
| `/dashboard/admin/*`             | `dashboards/administrateur/AdministrateurApp.tsx`                                | rôle admin |
| `/dashboard/entreprise/*`        | `dashboards/entreprise/EntrepriseApp.tsx`                                         | rôle company |
| `/dashboard/partenaire/*`        | `dashboards/partenaire/PartenaireApp.tsx`                                         | rôle partner |
| `/dashboard/livreur/*`           | `dashboards/livreur/LivreurApp.tsx`                                               | rôle delivery |
| `/dashboard/correspondant/*`     | `dashboards/correspondant/CorrespondantApp.tsx`                                   | rôle correspondent |
| `/dashboard/client/*`            | `dashboards/client/ClientApp.tsx`                                                 | rôle client (fallback, peu utilisé) |
| `/super-admin/*`, `/admin/*`, `/partenaire/*`, `/livreur/*`, `/entreprise/*`, `/correspondant/*`, `/client/*` | redirigent (legacy) vers `/dashboard/<role>/*` | — |
| `*`                              | `SmartRedirect` (router.tsx)                                                      | tous |

> Note : `shared/components/layout/NotFound.tsx` existe mais la route `*`
> est en réalité gérée par `SmartRedirect` (redirection selon rôle), pas par
> NotFound. NotFound.tsx semble donc actuellement inutilisé — vérifier ses
> imports avant de le considérer comme mort.

---

## Connexions inter-composants (navigate)

| Depuis                          | Vers                    | Déclencheur                                      |
|---------------------------------|-------------------------|----------------------------------------------------|
| `Header.tsx`                    | `CommandePage.tsx`      | Clic bouton panier → `navigate('/commande')`        |
| `Header.tsx`                    | `LivreursPage.tsx`      | Lien "Livreurs" → `navigate('/livreurs')`           |
| `Header.tsx`                    | `CorrespondantsPage.tsx`| Lien "Correspondants" → `navigate('/correspondants')` |
| `Header.tsx`                    | `MessageriePage.tsx`    | Icône messagerie → `navigate('/messagerie')`        |
| `Header.tsx`                    | `ProfilClientPage.tsx`  | Menu profil → `navigate('/mon-profil')`             |
| `Header.tsx`                    | `SettingsPage.tsx`      | Menu profil → `navigate('/parametres')`             |
| `CardEntreprise.tsx`            | `BoutiquePage.tsx`      | Bouton "Voir boutique" → `navigate('/boutique/:id')`|
| `CardProduit.tsx` (ModalVoir)   | `ProduitPage.tsx`       | Bouton "Voir détail" → `navigate('/produit/:id')`   |
| `CardLivreurGrid/List.tsx`      | `ProfilLivreurPage.tsx` | Clic carte → `navigate('/livreurs/:id')`            |
| `CardCorrespondant.tsx`         | `ProfilCorrespondantPage.tsx` | Clic carte → `navigate('/correspondants/:id')` |
| `PanierPanel.tsx`               | `CommandePage.tsx`      | Bouton "Acheter maintenant"                          |
| `BoutiqueIdentity.tsx`          | `ModalPartage.tsx`      | `setPartageOpen(true)`                              |
| `ProduitGallerie.tsx`           | `ModalPartage.tsx`      | `onPartage()`                                        |
| `HomePage.tsx`                  | `RandomBloc.tsx`        | Blocs pondérés Fisher-Yates (produits×5)             |
| `useLoginPage.ts` (handleLogin/Register) | `dashboards/<role>/...App.tsx` | Succès auth → `navigate(ROLE_ROUTES[role])` après 1.5s |
| `Login.tsx` (lien d'invitation) | onglet Register pré-rempli | `?role=...&code=...&email=...` → `setRegisterRole`, `setRegisterData` |

---

## Imports CSS — Rappel chemin relatif

```
boutique/pages/      → import '../styles/BoutiquePage.module.css'
boutique/sections/   → import '../styles/NomSection.module.css'
boutique/components/ → import '../styles/NomComposant.module.css'

produit/pages/       → import '../styles/ProduitPage.module.css'
produit/sections/    → import '../styles/NomSection.module.css'
produit/components/  → import '../styles/NomComposant.module.css'

panier/pages/        → import '../styles/CommandePage.module.css'
panier/sections/     → import '../styles/NomSection.module.css'
panier/components/   → import '../styles/NomComposant.module.css'

livreurs/pages/        → import '../styles/LivreursPage.module.css'
livreurs/sections/     → import '../styles/NomSection.module.css'
livreurs/cards/        → import '../styles/CardLivreurGrid.module.css' (ou List)

correspondants/pages/    → import '../styles/Correspondants.module.css'
correspondants/sections/ → import '../styles/Correspondants.module.css'

messagerie/pages/    → import '../styles/MessageriePage.module.css'
messagerie/sections/ → import '../styles/NomSection.module.css'
messagerie/components/ → import '../styles/NomComposant.module.css'

profil-client/        → import './styles/ProfilClient.module.css'
profil-correspondant/ → import '../styles/ProfilCorrespondant.module.css'
profil-livreur/       → import './styles/ProfilLivreur.module.css'

settings/pages/       → import './styles/SettingsPage.module.css'
settings/pages/components/ → import '../styles/SettingsSidebar.module.css' (ou SettingsCard)
settings/pages/sections/   → import '../styles/SettingsCard.module.css'

home/sections/       → import './NomSection.module.css'
home/cards/          → import './Cards.module.css'
home/layout/         → import './Header.module.css'

dashboards/livreur/pages/        → import '../styles/NomPage.module.css'
dashboards/livreur/pages/params/ → import '../../styles/ParamsShared.module.css'
dashboards/correspondant/pages/        → import '../styles/NomPage.module.css'
dashboards/correspondant/sections/params/ → import '../../styles/ParamsShared.module.css'

dashboards/entreprise/sections/parametres/ → import '../../styles/parametres/FormCard.module.css'
dashboards/entreprise/components/parametres/ → import '../../styles/parametres/NomComposant.module.css'

shared/messagerie/MessagerieCore.tsx → import './styles/MessagerieLayout.module.css'
shared/messagerie/components/        → import '../styles/NomComposant.module.css'
shared/messagerie/sections/          → import '../styles/NomSection.module.css'
```

---

## Variables CSS globales (`styles/variables.css`)

```css
/* Couleurs principales */
--navy:#0B1F3A; --navy-2:#112648; --blue:#1A4FC4; --blue-2:#2560DC; --blue-lt:#5B8EF4;

/* Bleus clairs */
--sky:#EEF3FD; --sky-2:#E2EAFB; --sky-3:#C8D9F8;

/* Couleurs sémantiques */
--emerald:#047857; --violet:#6D28D9; --rose:#BE185D;
--amber:#B45309; --teal:#0E7490; --indigo:#4338CA; --green:#16A34A; --red:#DC2626;

/* Fonds de teintes (badges) */
--em-bg:rgba(4,120,87,.08); --vl-bg:rgba(109,40,217,.08); --rs-bg:rgba(190,24,93,.08);
--am-bg:rgba(180,83,9,.08); --tl-bg:rgba(14,116,144,.08); --in-bg:rgba(67,56,202,.08);

/* Texte */
--t1:#0B1F3A; --t2:#4B5563; --t3:#9CA3AF; --t4:#C5CAD3;

/* Fonds neutres */
--white:#FFFFFF; --g50:#F8F9FA; --g100:#F1F3F5; --g200:#E8EAED; --g300:#D1D5DB;

/* Bordures */
--bdr:rgba(11,31,58,.08); --bdr2:rgba(11,31,58,.13); --bdrb:rgba(26,79,196,.25);

/* Ombres */
--sh-xs:0 1px 3px rgba(11,31,58,.06); --sh-sm:0 2px 8px rgba(11,31,58,.08);
--sh-md:0 6px 24px rgba(11,31,58,.1); --sh-lg:0 16px 48px rgba(11,31,58,.13);
--sh-xl:0 24px 64px rgba(11,31,58,.16); --sh-b:0 6px 24px rgba(26,79,196,.28);

/* Typographie */
--fd:'Fraunces',Georgia,serif;   /* Titres — chargé via Google Fonts dans index.html */
--fb:'DM Sans',sans-serif;       /* Corps  — chargé via Google Fonts dans index.html */

/* Rayons */
--r-sm:6px; --r-md:12px; --r-lg:18px; --r-xl:26px; --pill:999px;

/* Layout */
--hdr:66px;

/* Transitions */
--ease:cubic-bezier(.4,0,.2,1); --spring:cubic-bezier(.34,1.56,.64,1);
```

> ⚠️ `styles/variables.home.css` et `styles/variables_correspondant.css`
> redéfinissent probablement un sous-ensemble de ces variables pour leurs
> espaces respectifs. En cas d'incohérence visuelle entre la HomePage /
> l'espace correspondant et le reste de l'app, comparer ces fichiers à
> `variables.css` ci-dessus.
