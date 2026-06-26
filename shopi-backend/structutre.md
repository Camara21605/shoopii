# STRUCTURE BACKEND SHOPI — NestJS + TypeORM + MySQL
> Chaque fichier est expliqué : ce qu'il fait et quand aller le modifier.

---

## POINT D'ENTRÉE

```
src/main.ts                     # Lance l'app NestJS (port, CORS, pipes de validation globaux)
src/app.module.ts               # Module racine : importe TOUS les modules du projet
src/app.controller.ts           # Route GET / (health check basique)
src/app.service.ts              # Service basique lié à app.controller
```

---

## CONFIG — Variables d'environnement et connexions

```
src/config/
├── env.config.ts               # Lecture du .env (DATABASE_URL, JWT_SECRET, etc.)
├── jwt.config.ts               # Durée du token, clé secrète JWT
├── database.config.ts          # Connexion MySQL via TypeORM (host, port, user, password)
├── cloudinary.config.ts        # Clés API Cloudinary pour l'upload d'images/documents
└── redis.config.ts             # Connexion Redis (utilisé pour les queues BullMQ)
```
> **Quand modifier** : tu changes les identifiants de BDD, le fournisseur d'images, ou la durée du JWT.

---

## COMMON — Outils réutilisables dans tout le projet

```
src/common/
├── decorators/
│   ├── public.decorator.ts     # @Public() → désactive le guard JWT sur une route
│   └── roles.decorator.ts      # @Roles('client','company') → limite l'accès par rôle
├── guards/
│   ├── auth.guard.ts           # Vérifie le token JWT (Bearer) sur chaque requête
│   ├── optional-jwt.guard.ts   # JWT optionnel : route accessible même sans token
│   └── roles.guard.ts          # Vérifie que le rôle du token correspond à @Roles()
└── enums/
    └── user-role.enum.ts       # Enum : client | company | delivery | correspondent | partner | admin | super_admin
```
> **Quand modifier** : tu ajoutes un nouveau rôle ou une nouvelle logique de protection.

---

## DATABASE — Entités (tables) et migrations

### Tables principales

```
src/database/
├── database.module.ts              # Configure TypeORM avec toutes les entités
├── desable-fk.subscriber.ts        # Désactive temporairement les FK (pour les seeds/migrations)
├── transformers/
│   └── column-numeric.transformer.ts  # Convertit DECIMAL MySQL → number JS
├── migrations/
│   ├── 1700000000000-add-client-settings-fields.ts   # Ajoute les champs settings au profil client
│   └── 1700000000001-add-follow-isSubscribed.ts       # Ajoute le champ isSubscribed aux follows
```

### Entités — Chaque fichier = une table MySQL

```
src/database/entities/
│
├── user.entity.ts                  # TABLE users — compte commun à tous les rôles
│                                   # Champs : id (UUID), email, password (hashé), role (enum),
│                                   #          isActive, emailVerified, createdAt
│                                   # → Un user a UN seul profil selon son rôle
│
├── code-creation.entity.ts         # TABLE code_creations — codes d'activation pour créer un compte
│                                   # Champs : code, role, usedAt, expiresAt
│                                   # → Un code = un seul usage pour s'inscrire comme entreprise/livreur/etc.
│
├── audit-log.entity.ts             # TABLE audit_logs — historique des actions admin
│                                   # Champs : action, userId, details, createdAt
│
├── localisation.entity.ts          # TABLE localisations — coordonnées GPS des acteurs
│
├── panier-item.entity.ts           # TABLE panier_items — articles dans le panier d'un client
│                                   # Champs : clientId, productId, quantite, prixUnitaire
│
├── wallet.entity.ts                # TABLE wallets — portefeuille GNF d'un utilisateur
│                                   # Champs : userId, solde, totalEntrees, totalSorties
│
├── wallet-transaction.entity.ts    # TABLE wallet_transactions — historique des mouvements wallet
│                                   # Champs : walletId, montant, type (in/out), libelle, createdAt
│
└── report.entity.ts                # TABLE reports — signalements (avis, contenu, utilisateur)
                                    # Champs : reporterId, targetId, type, description, status
```

### Profils utilisateurs — Une table par rôle

```
src/database/entities/profiles/
│
├── client-profile.entity.ts        # TABLE clients — profil client connecté
│                                   # Champs : userId, shopiPoints, walletSolde, totalOrders,
│                                   #          totalSpent, totalFavorites, activityLog (JSON),
│                                   #          langue, bio, genre, dateNaissance, telephone,
│                                   #          adresse, twoFaEnabled, paymentMethods (JSON)
│
├── entreprise-profile.entity.ts    # TABLE entreprises — boutique complète
│                                   # Champs : companyName, description, logo, coverImage,
│                                   #          status (pending/active/suspended), slogan, tags,
│                                   #          businessPhone, businessEmail, whatsapp, website,
│                                   #          adresse, commune, ville, pays, repere,
│                                   #          averageRating, totalOrders, totalRevenue,
│                                   #          verificationStatus, plan (standard/pro/premium),
│                                   #          livraisonStandard, livraisonShopi, livraisonCorresp,
│                                   #          clickCollect, livraisonExpress, zonesLivraison,
│                                   #          paymentMethods, nif, rccm, twoFaEnabled,
│                                   #          notifSettings (JSON), privacySettings (JSON)
│
├── livreur-profile.entity.ts       # TABLE livreurs — profil livreur
│                                   # Champs : fullName, phone, zone, vehicule, rating,
│                                   #          totalTrips, isOnline, companyId (FK optionnel)
│
├── correspondant-profile.entity.ts # TABLE correspondants — point relais
│                                   # Champs : nom, phone, adresse, ville, zone, rating,
│                                   #          totalMissions, companyId (FK optionnel)
│
├── admin-profile.entity.ts         # TABLE admins — administrateur Shopi
│
├── partenaire-profile.entity.ts    # TABLE partenaires — partenaire commercial
│
├── correspondant-horaire.entity.ts # TABLE correspondant_horaires — horaires du correspondant
│                                   # Champs : correspondantId, jour, ouverture, fermeture, actif
│
└── super-admin-profile.entity.ts   # TABLE super_admins — super admin unique
```

### Tables métier boutique

```
src/database/entities/entreprise.table/
│
├── product.entity.ts               # TABLE products — produit en vente
│                                   # Champs : companyId, nom, description, prix, prixAncien,
│                                   #          stock, isActive, marque, urlSlug, categoryId
│
├── product-media.entity.ts         # TABLE product_media — images/vidéos d'un produit
│                                   # Champs : productId, url, type (image/video), ordre, alt
│
├── product-spec.entity.ts          # TABLE product_specs — caractéristiques techniques
│                                   # Champs : productId, cle (ex: "Couleur"), valeur (ex: "Rouge")
│
├── product-variant.entity.ts       # TABLE product_variants — variantes (taille, couleur)
│                                   # Champs : productId, type, vals (JSON), prixDiff
│
├── product-story.entity.ts         # TABLE product_stories — stories visuelles façon Instagram
│                                   # Champs : companyId, productId, mediaUrl, duration
│
├── product-like.entity.ts          # TABLE product_likes — favoris produits (client ↔ produit)
│                                   # Champs : clientId, productId (unique pair)
│
├── category.entity.ts              # TABLE categories — catégories publiques (Électronique, Mode…)
│
├── sub-category.entity.ts          # TABLE sub_categories — sous-catégories
│
├── company-type.entity.ts          # TABLE company_types — types de boutique (Restaurant, Pharmacie…)
│                                   # Champs : nom, icone (emoji), description
│
├── company-horaire.entity.ts       # TABLE company_horaires — horaires d'ouverture par jour
│                                   # Champs : companyId, jour (lundi..dimanche),
│                                   #          ouverture (TIME), fermeture (TIME), actif
│                                   # Contrainte UNIQUE : (companyId, jour)
│
├── promotion.entity.ts             # TABLE promotions — codes promo et réductions
│                                   # Champs : companyId, code, type (pct/fixe), valeur,
│                                   #          minAchat, maxUses, usesCount, startsAt, endsAt
│
├── promotion-product.entity.ts     # TABLE promotion_products — produits liés à une promo
│
└── promotion-usage.entity.ts       # TABLE promotion_usages — historique d'utilisation des promos
                                    # Champs : promotionId, clientId, commandeId, usedAt
```

### Commandes

```
src/database/entities/commande/
│
├── commande.entity.ts              # TABLE commandes — commande principale
│                                   # Champs : id (UUID), numero (CMD-2026-00010),
│                                   #          clientId, companyId, livreurId, correspondantId,
│                                   #          status (pending/paid/in_progress/awaiting_client/
│                                   #                  delivered/cancelled/refunded/disputed/auto_delivered),
│                                   #          modeLivraison, total, sousTotal, fraisLivraison,
│                                   #          adresseLivraison, villeLivraison, datePaiement,
│                                   #          autoValidationDelayDays, autoValidationAt
│
├── commande-item.entity.ts         # TABLE commande_items — produit dans une commande (snapshot)
│                                   # Champs : commandeId, productId, nomProduit, imageProduit,
│                                   #          varianteChoisie, quantite, prixUnitaire, sousTotal
│                                   # ⚠️ C'est ici que l'image du produit commandé est stockée
│
└── commande-code.entity.ts         # TABLE commande_codes — codes de validation par acteur
                                    # Champs : commandeId, acteurType (entreprise/livreur/correspondant/client),
                                    #          code (hashé), status (pending/validated/awaiting_unlock),
                                    #          validatedAt
```

### Suivi / Follow

```
src/database/entities/follow/
├── follow.entity.ts                # TABLE follows — abonnement client → boutique/livreur/correspondant
│                                   # Champs : followerId, followedId, followedType, isSubscribed
├── follow-request.entity.ts        # TABLE follow_requests — demandes d'abonnement en attente
└── follow-block.entity.ts          # TABLE follow_blocks — blocages entre utilisateurs
```

### Messagerie

```
src/database/entities/messaging/
├── conversation.entity.ts          # TABLE conversations — canal de discussion entre 2 acteurs
│                                   # Champs : participantIds (JSON), lastMessage, unreadCounts
├── message.entity.ts               # TABLE messages — message individuel
│                                   # Champs : conversationId, senderId, content, type, readAt
├── message-read-receipt.entity.ts  # TABLE message_read_receipts — accusés de lecture
└── conversation-permission.entity.ts  # TABLE conversation_permissions — qui peut écrire à qui
```

### Notifications

```
src/database/entities/notification/
├── notification.entitiy.ts         # TABLE notifications — notification push/système
│                                   # Champs : userId, type, title, body, data (JSON), readAt
├── notification-preference.entity.ts  # TABLE notification_preferences — préfs par type
└── notification-delivery-log.entity.ts # TABLE notification_delivery_logs — logs d'envoi
```

---

## MODULES — Cœur logique

### AUTH — Authentification et inscription

```
src/modules/auth/
├── auth.controller.ts              # ROUTES :
│                                   #   POST /auth/login          → connexion (retourne JWT)
│                                   #   POST /auth/register       → inscription
│                                   #   POST /auth/verify-otp     → vérification code OTP
│                                   #   POST /auth/resend-otp     → renvoyer le code OTP
│                                   #   POST /auth/forgot-password → demander reset mot de passe
│                                   #   POST /auth/reset-password  → changer le mot de passe
├── auth.service.ts                 # Logique : hash password (bcrypt), création user + profil,
│                                   #           génération JWT, vérification OTP email
├── auth.module.ts                  # Importe : JwtModule, UsersModule, DatabaseModule
├── strategies/
│   └── jwt.strategy.ts             # Décode le JWT, charge l'user depuis la BDD (userId + role)
├── guards/
│   └── guards.ts                   # Re-exporte AuthGuard et RolesGuard
└── dto/
    ├── login.dto.ts                # { email, password }
    ├── register.dto.ts             # { email, password, role, nom, activationCode? }
    └── password.dto.ts             # { oldPassword, newPassword }
```

### CODE-CREATION — Codes d'activation pour créer des comptes professionnels

```
src/modules/auth/code-creation/
├── code-creation.controller.ts     # ROUTES (super-admin uniquement) :
│                                   #   POST   /auth/codes          → générer un code
│                                   #   GET    /auth/codes          → liste des codes
│                                   #   DELETE /auth/codes/:id      → supprimer un code
├── code-creation.service.ts        # Génère un code unique, l'envoie par email, marque comme utilisé
└── dto/
    ├── create-code-creation.dto.ts # { role, email? }
    ├── generate-and-send.dto.ts    # { role, email, expiresInDays }
    └── filter-codes.dto.ts         # Filtres de liste (role, status, page)
```

### UPLOAD — Images et documents vers Cloudinary

```
src/modules/upload/
├── upload.controller.ts            # ROUTES :
│                                   #   POST /upload/avatar         → photo de profil client
│                                   #   POST /upload/logo           → logo boutique
│                                   #   POST /upload/cover          → image de couverture boutique
│                                   #   POST /upload/document/:type → document vérification
│                                   #   POST /upload/product-media  → image/vidéo produit
├── upload.service.ts               # Upload vers Cloudinary, retourne l'URL publique
└── product-media-upload.service.ts # Upload spécifique aux médias produits (ordre, alt text)
```

### COMMANDE — Cycle de vie d'une commande

```
src/modules/commande/
├── commande.controller.ts          # ROUTES :
│                                   #   POST /client/commandes          → créer une commande
│                                   #   GET  /client/commandes          → mes commandes (client)
│                                   #   GET  /commandes/:id             → détail d'une commande (par UUID)
│                                   #   POST /commandes/:id/valider     → valider son étape avec un code
│                                   #   POST /commandes/:id/notes       → noter les acteurs après livraison
│                                   #   POST /commandes/:id/litige      → signaler un problème
├── commande.module.ts
└── services/
    ├── commande-creation.service.ts    # Crée la commande, génère les codes, calcule les montants
    ├── commande-validation.service.ts  # Valide une étape (vérifie le code, passe au suivant)
    ├── commande-query.service.ts       # Récupère les commandes (filtres, pagination, relations)
    ├── commande-feedback.service.ts    # Gère les notations et litiges post-livraison
    └── commande.helpers.ts             # Fonctions utilitaires (calcul total, génération codes)
```
> DTOs : `create-commande.dto.ts` (items, modeLivraison, livreurId, adresse…), `notation.dto.ts`, `valider-etape.dto.ts`

### PUBLIC — API publique sans authentification

```
src/modules/public/
├── public.controller.ts            # ROUTES (accès libre) :
│                                   #   GET /public/produits                → liste produits publiés
│                                   #   GET /public/produits/:id            → détail produit
│                                   #   GET /public/produits/:id/similaires → produits similaires
│                                   #   GET /public/boutiques/:id           → infos boutique publique
│                                   #   GET /public/boutiques/:id/produits  → produits d'une boutique
│                                   #   GET /public/boutiques/:id/livreurs  → livreurs d'une boutique
│                                   #   GET /public/livreurs                → liste livreurs
│                                   #   GET /public/livreurs/:id            → profil public livreur
│                                   #   GET /public/correspondants          → liste correspondants
│                                   #   GET /public/correspondants/:id      → profil public correspondant
├── public.service.ts               # Requêtes BDD : jointures Company+Products+Media, filtres stock/actif
└── public.module.ts
```

### SUIVIS — Abonnements (follow boutiques, livreurs, correspondants)

```
src/modules/suivis/
├── controllers/
│   ├── suivis-entreprise.controller.ts   # POST /suivis/boutiques/:id    → toggle follow boutique
│   ├── suivis-livreur.controller.ts      # POST /suivis/livreurs/:id     → toggle follow livreur
│   ├── suivis-correspondant.controller.ts # POST /suivis/correspondants/:id → toggle follow correspondant
│   └── mes-abonnements.controller.ts     # GET /suivis/mes-abonnements   → { boutiques, livreurs, correspondants }
├── services/
│   ├── suivis-base.service.ts            # Logique commune (toggle, compteurs)
│   ├── suivis-entreprise.service.ts      # Gère les follows boutique
│   ├── suivis-livreur.service.ts         # Gère les follows livreur
│   ├── suivis-correspondant.service.ts   # Gère les follows correspondant
│   └── mes-abonnements.service.ts        # Agrège les 3 types en une réponse unifiée
├── gateways/
│   └── suivis.gateway.ts                 # WebSocket : notifie en temps réel les nouveaux followers
├── processors/
│   └── suivis.processor.ts               # Worker BullMQ : traite les suivis en queue asynchrone
├── suivis.queue.ts                        # Définition de la queue BullMQ
└── suivis.module.ts
```

### CATALOGUE — Catégories et types (publics)

```
src/modules/catalogue/
├── catalogue.controller.ts         # ROUTES :
│                                   #   GET /catalogue/categories       → liste des catégories
│                                   #   GET /catalogue/company-types    → types de boutique
└── catalogue.module.ts
```

### PROMOTIONS — Codes promo

```
src/modules/promotions/
├── promotions.controller.ts        # ROUTES :
│                                   #   POST /promotions/validate  → valider un code promo au panier
│                                   #   GET  /promotions/:code     → infos d'un code promo
├── services/
│   ├── promotions.service.ts       # CRUD promotions (entreprise)
│   └── promo-code.service.ts       # Validation code : vérifie validité, calcule remise
└── dto/
    └── promotion.dto.ts            # { code, montantPanier, companyId }
```

### WALLET — Portefeuille client

```
src/modules/wallet/
├── wallet.controller.ts            # ROUTES :
│                                   #   GET  /wallet              → solde + historique
│                                   #   POST /wallet/recharge     → recharger le wallet
│                                   #   POST /wallet/retrait      → demander un retrait
├── wallet.service.ts               # Gère les transactions, met à jour le solde
└── dto/
    └── wallet.dto.ts               # { montant, methode }
```

### EMAIL — Envoi d'emails transactionnels

```
src/modules/email/
├── email.controller.ts             # ROUTES internes (admin seulement)
├── email.service.ts                # Envoie des emails (OTP, confirmation commande, reset password)
│                                   # Utilise Nodemailer ou un service tiers (Mailgun, SendGrid)
└── entities/
    └── email.entity.ts             # TABLE emails — log des emails envoyés
```

---

## DASHBOARD — Logique par acteur connecté

### CLIENT

```
src/modules/dashboard/client/
├── client-profil.controller.ts     # GET /client/profil → profil complet du client connecté
│                                   #   (totalOrders, shopiPoints, favoris, activityLog…)
├── client-profil.service.ts        # Agréger : profil + stats + activité récente
├── client-parametres.controller.ts # PATCH /client/parametres/* → modifier les settings client
│                                   #   /profil, /securite, /notifications, /confidentialite,
│                                   #   /donnees (export RGPD), /danger (suppression compte)
├── favoris.controller.ts           # GET  /client/favoris              → mes favoris
│                                   # POST /client/favoris/:productId/toggle → ajouter/retirer
├── panier.controller.ts            # GET  /client/panier               → contenu du panier
│                                   # POST /client/panier               → ajouter un article
│                                   # PATCH /client/panier/:id          → modifier quantité
│                                   # DELETE /client/panier/:id         → retirer du panier
│                                   # DELETE /client/panier             → vider le panier
├── correspondant-profil.controller.ts  # GET /client/correspondants/:id → profil public correspondant
│                                       # (vu par le client : services, zones, avis)
├── livreurs/
│   └── livreurs-client.controller.ts  # GET /client/livreurs → livreurs disponibles pour le client
└── services/
    ├── profil.service.ts               # Charge les données du profil
    ├── favoris.service.ts              # Toggle favoris, liste favoris avec images
    ├── panier.service.ts               # Gestion du panier (ajouter, modifier, vider)
    ├── paiement.service.ts             # Méthodes de paiement du client
    ├── adresses.service.ts             # Adresses de livraison sauvegardées
    ├── points.service.ts               # Shopi Points : solde, historique, utilisation
    ├── activite.service.ts             # Journal d'activité (commandes, avis, connexions)
    ├── securite.service.ts             # Changer mot de passe, activer 2FA
    ├── sessions.service.ts             # Sessions actives, révocation
    └── preferences.service.ts         # Langue, notifications, confidentialité
```

### ENTREPRISE — Dashboard boutique

```
src/modules/dashboard/entreprise/
│
├── entreprise-dashboard.controller.ts  # GET /dashboard/entreprise → stats générales boutique
│                                       #   (totalOrders, revenue, produits actifs, note…)
├── entreprise-dashboard.service.ts     # Calcul des stats depuis la BDD
│
├── parametres.controller.ts            # Routes PATCH paramètres boutique :
│                                       #   GET  /dashboard/entreprise/parametres      → tout lire
│                                       #   PATCH /dashboard/entreprise/parametres/boutique   → nom, logo, slogan
│                                       #   PATCH /dashboard/entreprise/parametres/contact    → phone, email, adresse
│                                       #   PATCH /dashboard/entreprise/parametres/horaires   → heures ouverture
│                                       #   PATCH /dashboard/entreprise/parametres/catalogue  → règles publication
│                                       #   PATCH /dashboard/entreprise/parametres/livraison  → modes de livraison
│                                       #   PATCH /dashboard/entreprise/parametres/paiement   → méthodes paiement
│                                       #   PATCH /dashboard/entreprise/parametres/commissions → plan tarifaire
│                                       #   PATCH /dashboard/entreprise/parametres/documents   → upload docs
│                                       #   PATCH /dashboard/entreprise/parametres/securite    → 2FA, password
│                                       #   PATCH /dashboard/entreprise/parametres/notifs      → toggles notifs
│                                       #   PATCH /dashboard/entreprise/parametres/confidentialite → privacy
│                                       #   POST  /dashboard/entreprise/parametres/logo        → upload logo
│                                       #   POST  /dashboard/entreprise/parametres/cover       → upload cover
│                                       #   DELETE /dashboard/entreprise/parametres/logo       → supprimer logo
│
├── services/                           # UN service par section paramètres :
│   ├── boutique-parametres.service.ts      # companyName, description, logo, slogan, tags
│   ├── catalogue-parametres.service.ts     # showOutOfStock, autoPublish, devise, returnPolicy
│   ├── commissions-parametres.service.ts   # plan (standard/pro/premium)
│   ├── danger-parametres.service.ts        # Suppression compte, export données
│   ├── documents-parametres.service.ts     # Upload documents vérification (RCCM, NIF…)
│   ├── horaires-parametres.service.ts      # CRUD table company_horaires (7 jours)
│   ├── livraison-parametres.service.ts     # livraisonStandard, livraisonShopi, clickCollect…
│   ├── notifs-parametres.service.ts        # notifSettings JSON (14 toggles)
│   ├── paiement-parametres.service.ts      # paymentMethods, receptionMethod, NIF, RCCM
│   ├── privacy-parametres.service.ts       # privacySettings JSON (7 toggles)
│   └── securite-parametres.service.ts      # twoFaEnabled, twoFaMethod, changement password
│
├── produits/
│   ├── produits.controller.ts          # GET  /dashboard/entreprise/produits       → mes produits
│   │                                   # POST /dashboard/entreprise/produits       → créer produit
│   │                                   # PATCH /dashboard/entreprise/produits/:id  → modifier produit
│   │                                   # DELETE /dashboard/entreprise/produits/:id → supprimer produit
│   ├── produits.service.ts             # CRUD produits + médias + specs + variantes
│   └── dto/
│       └── create-product.dto.ts       # Validation : nom, prix, stock, categoryId, images…
│
├── livreurs/
│   ├── livreurs.controller.ts          # GET  /dashboard/entreprise/livreurs       → mes livreurs
│   │                                   # POST /dashboard/entreprise/livreurs/inviter → inviter livreur
│   ├── services/
│   │   ├── livreurs.service.ts             # Liste livreurs liés à la boutique
│   │   └── invitation-livreur.service.ts   # Envoyer invitation par code/email
│   └── dto/
│       └── livreur.dto.ts
│
├── correspondants/
│   ├── correspondants.controller.ts    # GET  /dashboard/entreprise/correspondants
│   │                                   # POST /dashboard/entreprise/correspondants/inviter
│   ├── services/
│   │   ├── correspondants.service.ts       # Liste correspondants liés à la boutique
│   │   └── invitation.service.ts           # Invitation correspondant
│   └── dto/
│       └── correspondant.dto.ts
│
└── dto/                                # Validation des PATCH paramètres :
    ├── update-boutique.dto.ts          # companyName, description, slogan, tags, website
    ├── update-catalogue.dto.ts         # showOutOfStock, autoPublish, devise, returnPolicy
    ├── update-documents.dto.ts         # URLs documents (RCCM, NIF, bancaire, photo)
    ├── update-horaires.dto.ts          # [{ jour, ouverture, fermeture, actif }]
    ├── update-livraison.dto.ts         # booleans livraison + zonesLivraison
    ├── update-notifs.dto.ts            # notifSettings (Partial<Record<string, boolean>>)
    ├── update-paiement.dto.ts          # paymentMethods, receptionMethod, NIF, RCCM
    ├── update-privacy.dto.ts           # privacySettings (Partial<Record<string, boolean>>)
    └── update-securite.dto.ts          # twoFaEnabled, twoFaMethod, oldPassword, newPassword
```

### LIVREUR — Dashboard livreur

```
src/modules/dashboard/livreur/
├── livreur-dashboard.controller.ts     # GET /dashboard/livreur → stats (missions, revenus, note)
│                                       # GET /dashboard/livreur/missions → missions en cours
│                                       # GET /dashboard/livreur/historique → missions passées
├── livreur-dashboard.service.ts        # Stats livreur : total missions, revenus, note moyenne
├── livreur-parametres.controller.ts    # PATCH /dashboard/livreur/parametres/* → settings livreur
└── services/
    ├── profil-livreur.service.ts       # Modifier nom, photo, zone
    ├── vehicule-livreur.service.ts     # Type de véhicule, plaque, assurance
    ├── zone-livreur.service.ts         # Zones de livraison desservies
    ├── vitesses-livreur.service.ts     # Tarifs et délais par zone
    ├── paiement-livreur.service.ts     # Méthode de réception des paiements
    ├── securite-livreur.service.ts     # Mot de passe, 2FA
    ├── notifs-livreur.service.ts       # Préférences notifications
    └── danger-livreur.service.ts       # Désactiver/supprimer le compte
```

### CORRESPONDANT — Dashboard correspondant

```
src/modules/dashboard/correspondant/
├── correspondant-parametres.controller.ts  # PATCH /dashboard/correspondant/parametres/*
└── services/
    ├── profil.service.ts               # Nom, photo, adresse, zone
    ├── depot.service.ts                # Capacité de stockage, tarifs
    ├── colis.service.ts                # Colis en dépôt actuellement
    ├── zone.service.ts                 # Zones couvertes
    ├── paiement.service.ts             # Réception paiements
    ├── securite.service.ts             # Password, 2FA
    ├── documents.service.ts            # Upload documents vérification
    ├── notifications.service.ts        # Préférences notifications
    ├── confidentialite.service.ts      # Préférences confidentialité
    ├── entites.service.ts              # Relations boutiques partenaires
    ├── base.service.ts                 # Méthodes communes (getProfile, etc.)
    └── danger.service.ts               # Suppression compte
```

### SUPER ADMIN — Administration globale

```
src/modules/dashboard/super-admin/
├── super-admin.controller.ts           # GET /super-admin → stats globales plateforme
├── categories/
│   ├── categories.controller.ts        # CRUD /super-admin/categories → gérer les catégories
│   ├── categories.service.ts           # Créer, modifier, supprimer catégories
│   └── company-types.service.ts        # Gérer les types de boutique (Restaurant, Pharmacie…)
├── controllers/
│   ├── utilisateurs.controller.ts      # GET /super-admin/utilisateurs → liste tous les comptes
│   │                                   # PATCH /super-admin/utilisateurs/:id/status → activer/bloquer
│   ├── moderation.controller.ts        # GET /super-admin/moderation → signalements en attente
│   │                                   # PATCH /super-admin/moderation/:id → traiter un signalement
│   └── reports.controller.ts           # GET /super-admin/reports → rapports et exports
└── services/
    ├── utilisateurs.service.ts          # CRUD utilisateurs, stats par rôle
    ├── admins.service.ts                # Gestion des admins (créer, révoquer)
    ├── audit-log.service.ts             # Journal des actions administratives
    └── reports.service.ts              # Génération de rapports (CSV, stats)
```

---

## JOBS — Tâches automatiques (Cron)

```
src/jobs/
└── expiry-cron.service.ts          # CRON : expire les codes d'activation, valide auto les commandes
                                    # (CommandeStatus.AUTO_DELIVERED après autoValidationDelayDays)
```

---

## SEED — Données initiales

```
src/seed/
└── messaging-permissions.seed.ts  # Initialise les permissions de messagerie par rôle
                                    # (qui peut écrire à qui lors du premier lancement)
```

---

## RÉCAPITULATIF DES ENDPOINTS PAR DOMAINE

| Domaine           | Préfixe URL                          | Authentification |
|-------------------|--------------------------------------|------------------|
| Auth              | `/auth/*`                            | Public           |
| Public            | `/public/*`                          | Public           |
| Catalogue         | `/catalogue/*`                       | Public           |
| Client            | `/client/*`                          | JWT (client)     |
| Commandes         | `/client/commandes`, `/commandes/*`  | JWT              |
| Suivis            | `/suivis/*`                          | JWT (client)     |
| Upload            | `/upload/*`                          | JWT              |
| Wallet            | `/wallet/*`                          | JWT (client)     |
| Entreprise        | `/dashboard/entreprise/*`            | JWT (company)    |
| Livreur           | `/dashboard/livreur/*`               | JWT (delivery)   |
| Correspondant     | `/dashboard/correspondant/*`         | JWT (correspondent) |
| Super Admin       | `/super-admin/*`                     | JWT (super_admin)|

---

## CREDENTIALS SUPER ADMIN

```
Email    : superadmin@shopi.com
Password : Shopi@SuperAdmin2025!
```

---

## CHAMPS IMPORTANTS PAR TABLE

### Table `entreprises` (fichier : entreprise-profile.entity.ts)
- `companyName` → nom boutique affiché
- `logo` / `coverImage` → URLs Cloudinary
- `verificationStatus` → `pending` | `reviewing` | `verified` | `rejected`
- `status` → `pending` | `active` | `suspended`
- `averageRating` → note moyenne calculée (mise à jour après chaque livraison notée)
- `totalOrders` → compteur de commandes
- `companyType` → relation → `company_types` (domaine de la boutique)

### Table `commandes` (fichier : commande.entity.ts)
- `id` → UUID interne (pour `/commandes/:id`)
- `numero` → référence lisible `CMD-2026-00010`
- `status` → `pending` | `paid` | `in_progress` | `awaiting_client` | `delivered` | `auto_delivered` | `cancelled`
- `total` → montant total en GNF

### Table `commande_items` (fichier : commande-item.entity.ts)
- `nomProduit` → snapshot nom au moment de la commande
- `imageProduit` → snapshot URL image (même si le produit est supprimé)
- `prixUnitaire` → prix au moment de la commande
