# Architecture de l'application mobile Shoneya

Ce document est la référence pour toute personne qui travaille sur `shopi-mobile`.
Il décrit où va chaque fichier, les règles à respecter et pourquoi.
Si une règle doit changer, on modifie ce document dans le même commit.

## 1. Pile technique

| Besoin | Outil |
|---|---|
| Application | Expo SDK 57, React Native 0.86, TypeScript strict |
| Navigation | expo-router (routes = fichiers dans `src/app`) |
| Données serveur | @tanstack/react-query (cache, réessais, rafraîchissement) |
| Validation des réponses | zod (chaque réponse d'API est vérifiée) |
| État local partagé | zustand (session uniquement) |
| Temps réel | socket.io-client (`src/lib/realtime`) |
| Images | expo-image (cache disque + mémoire) |
| Compilation | Hermes + React Compiler (mémoïsation automatique) |

Le serveur est l'API NestJS (`shopi-backend`). L'application utilise les mêmes adresses que le site.

### Code natif : `modules/`

Modules Expo locaux (Kotlin), reliés automatiquement à la compilation :

| Module | Rôle |
|---|---|
| `modules/shopi-calls` | appel entrant application fermée (Android) : push FCM → écran d'appel plein écran avec la sonnerie du téléphone, Répondre / Refuser, au-dessus de l'écran verrouillé. Nécessite `google-services.json` (voir `app.config.js`) et `FIREBASE_SERVICE_ACCOUNT` côté serveur. |

Le JavaScript n'importe un module natif que par son `index.ts` (sans effet sur iOS / web / Expo Go).

### Partage de l'application (Xender, Bluetooth…)

`plugins/with-shareable-apk.js` : le Play Store installe l'application en **un seul APK complet** (pas de découpage par processeur / écran / langue), sinon une appli de partage ne copie que `base.apk` et l'autre téléphone refuse l'installation. Architectures compilées : `armeabi-v7a` et `arm64-v8a`. Bouton « Partager Shoneya » (`components/share-app-button.tsx`) dans les menus. Profil EAS `partage` = APK signé comme la version de production.

## 2. Organisation des dossiers

```
src/
├── app/                    ROUTES UNIQUEMENT (expo-router)
│   ├── _layout.tsx         fournisseurs globaux : cache, session, temps réel, appels
│   ├── (auth)/             écrans hors connexion
│   └── (app)/              écrans connectés ; (tabs)/ = barre du bas
│
├── features/               UN DOSSIER PAR DOMAINE MÉTIER
│   └── <domaine>/
│       ├── api.ts          appels HTTP + schémas zod + types (point d'entrée public)
│       ├── screens/        écrans complets (un fichier par écran)
│       ├── components/     composants propres au domaine + index.ts
│       └── *.ts            logique du domaine (hooks, calculs, constantes)
│
├── components/             COMPOSANTS PARTAGÉS (utilisés par plusieurs domaines)
│   ├── catalog/            titres de section, tuiles, cartes boutique / produit, états
│   ├── product-tile.tsx    carte produit complète de l'accueil
│   ├── form.tsx            champs, boutons
│   └── screen-header.tsx, themed-text.tsx, app-header.tsx…
│
├── lib/                    INFRASTRUCTURE, sans écran
│   ├── api/                client HTTP (jeton, rafraîchissement, erreurs)
│   ├── query-client.ts     réglages du cache react-query
│   ├── query-keys.ts       TOUTES les clés de cache (voir règle 4)
│   ├── realtime/           connexion socket
│   └── storage/            stockage sécurisé des jetons
│
├── config/env.ts           variables d'environnement validées
├── constants/theme.ts      couleurs, espacements, polices
└── hooks/                  hooks génériques (thème)
```

### Domaines (`src/features`)

| Domaine | Contenu |
|---|---|
| `auth` | connexion, inscription par étapes, mot de passe oublié, session |
| `home` | écran d'accueil |
| `catalog` | catalogue public, liste des boutiques, abonnements, ouverture des fiches, actions produit (❤ 🔖 🛒) |
| `shop` | profil public d'une entreprise (onglets, horaires) |
| `product` | fiche produit |
| `explore` | Explorer |
| `compare` | comparateur de produits : liste locale (4 max, une seule catégorie, `store.ts`), écran Comparer (avis Shoneya, tableau, différences, ajout, suggestions), bouton ⚖️ de la fiche produit — calcul du meilleur choix aligné sur `compareInsights.ts` du site |
| `cart` | panier |
| `company` | espace entreprise (propriétaire ou collaborateur) : Vue d’ensemble, menu des rubriques selon les permissions — les comptes « company » y arrivent directement |
| `company-settings` | paramètres de la boutique (12 sections du site : boutique, horaires, catalogue, livraison, paiement, commissions, documents, sécurité, notifications, confidentialité, langue, zone sensible) — lecture seule sans `settings.edit`, enregistrements en série |
| `company-orders` | commandes de la boutique : liste (filtres, recherche, résumé), détail (confirmation par code, livreur, chaîne de validation, articles, montants, signalement) |
| `company-products` | catalogue de la boutique : grille (stats, recherche, filtres de visibilité), fiche (galerie, prix + commission réelle, stock, détails), modification rapide, archivage, suppression, stories (publier, visionneuse, qui a vu) |
| `company-inventory` | inventaire & stock : chiffres, alertes critiques, actions rapides (réappro groupé, seuils, export CSV partagé), filtres, modifier le stock — même cache que les produits |
| `help` | Centre d’aide & support : accueil (recherche, catégories, populaires, FAQ, guides), catégorie, article (Markdown, avis), recherche, contact (public), mes demandes, nouvelle demande (3 étapes, suggestions, pièce jointe), détail (fil, réponse, note) |
| `account-switch` | Bascule compte professionnel ↔ compte client lié : carte « compte » des menus ☰ (flèches = basculer, chevron = vos comptes + notifications), code 2FA, création / liaison de l’espace client |
| `checkout` | passage de commande : adresse, livraison (boutique, livreur ou point relais selon les réglages des boutiques), paiement par le portefeuille |
| `profile` | profil du client |
| `notifications` | centre de notifications |
| `messagerie`, `calls` | messagerie, groupes, appels (sonnerie application fermée : voir `modules/shopi-calls`) |
| `location` | carte « Localisation » |
| `settings` | paramètres du compte |

## 3. Règles

**1. Une route ne contient pas d'écran.**
Un fichier de `src/app` fait une ligne :
`export { default } from '@/features/cart/screens/cart-screen';`
Pourquoi : la navigation reste lisible d'un coup d'œil, et un écran se déplace ou se réutilise sans toucher aux URL.
Exceptions : les fichiers `_layout.tsx`, et les écrans de la messagerie, des appels, de la localisation et des paramètres. Ils seront migrés quand leur chantier en cours sera terminé.

**2. On importe un domaine par son entrée publique.**
Depuis un autre domaine, on importe seulement `features/<domaine>/api` ou `features/<domaine>/components` (le fichier `index.ts`). On n'importe jamais un fichier interne comme `components/products-tab`.
Pourquoi : un domaine peut réorganiser ses fichiers sans casser les autres.

**3. Toute réponse d'API passe par un schéma zod.**
Les schémas sont tolérants (`.passthrough()`, `.catch()` sur les champs secondaires). Un champ ajouté par le serveur ne casse pas l'application, et un champ essentiel absent donne une erreur claire au lieu d'un écran vide.

**4. Les clés de cache viennent de `lib/query-keys.ts` (`qk`).**
Exemples : `useQuery({ queryKey: qk.shop.detail(id), … })` ou `invalidateQueries({ queryKey: qk.cart })`.
On n'écrit jamais `['cart']` à la main. Une faute de frappe crée sinon un double téléchargement, ou une liste qui ne se rafraîchit pas.

**5. Les écritures sont optimistes.**
L'écran change tout de suite (`onMutate`), la réponse du serveur fait foi, et en cas d'échec on revient en arrière avec un message (`onError`). Voir `features/cart/api.ts`.

**6. Un composant ne dépasse pas environ 300 lignes.**
Au-delà, on le découpe dans `components/` avec un `index.ts`. C'est ce qui a été fait pour le profil entreprise, la fiche produit et le catalogue.

**7. Pas de secret dans l'application.**
Tout ce qui est dans `EXPO_PUBLIC_*` est visible dans l'application installée. Les jetons sont gardés dans le stockage sécurisé (`lib/storage`), jamais dans AsyncStorage.

**8. Les rôles sont vérifiés côté serveur.**
L'application cache seulement ce qui n'a pas de sens pour un rôle (par exemple le panier pour une entreprise). La vraie protection est faite par l'API.

**9. La barre du bas se cache au défilement (tous les espaces).**
Chaque barre du bas (onglets clients, `CompanyBottomNav`, et celles des futurs tableaux de bord) est en position absolue et suit `chromeHidden` (`lib/scroll-chrome.ts`) : elle glisse hors de l'écran quand on fait défiler vers le bas et revient en remontant. Dans un écran avec barre du bas, étaler `{...hideOnScroll}` sur le ScrollView / FlatList principal et prévoir une marge basse d'environ 100. La barre appelle `useShowChromeOnFocus()` pour réapparaître à chaque arrivée sur un écran.

## 4. Performance

- **Préchargement** : `openProduct` et `openShop` (`features/catalog/open.ts`) chargent la fiche pendant l'animation, donc l'écran s'ouvre déjà rempli. Faire de même pour tout nouvel écran de détail.
- **Cache** : les données sont considérées fraîches 5 minutes et gardées 30 minutes (`lib/query-client.ts`). Le cache se rafraîchit au retour au premier plan et au retour du réseau.
- **Images** :
  - toujours `expo-image` avec une miniature Cloudinary à la bonne taille (`thumb(url, largeur)`) ;
  - `cachePolicy="memory-disk"` dans les listes, pour éviter le clignotement au défilement.
- **Listes** : au-delà de 30 éléments, utiliser `FlatList` avec `numColumns`, `onEndReached` et une pagination serveur (voir Explorer) au lieu de `.map()` dans un `ScrollView`.
- **Rendus** : React Compiler mémoïse automatiquement. On n'ajoute pas de `useMemo` ou `useCallback` « au cas où ». On calcule au rendu, et `useMemo` sert seulement pour des listes longues.
- **Réseau mobile** : pas de nouvel essai sur les erreurs 4xx, au plus 2 nouveaux essais espacés sur réseau ou 5xx, et une limite de 15 s par requête (`lib/api/client.ts`).

## 5. Conventions

- Fichiers en `kebab-case` (`shop-profile-screen.tsx`), composants en `PascalCase`.
- Textes de l'interface en français, avec les apostrophes typographiques (’).
- Les commentaires expliquent le **pourquoi** (règle métier, bug corrigé), pas le quoi.
- Le thème est toujours clair (`hooks/use-theme.ts`). Couleurs et espacements viennent de `constants/theme.ts`.
- Accessibilité :
  - `accessibilityRole` et `accessibilityLabel` sur tout ce qui se touche ;
  - zones de toucher d'au moins 44 px (`hitSlop` sinon).

## 6. Commandes

| Commande | Rôle |
|---|---|
| `npm run check` | vérification des types + lint (avant chaque commit) |
| `npm run preview` | aperçu dans le navigateur, branché sur le vrai serveur |
| `npx expo start` | serveur de développement (Expo Go / build de dev) |
| `eas build -p android --profile preview` | APK installable (voir `eas.json`) |

Les appels audio/vidéo (`react-native-webrtc`) ne fonctionnent pas dans Expo Go. Il faut un build de développement ou l'APK.
