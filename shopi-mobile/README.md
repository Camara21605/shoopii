# Shoneya — application mobile

Application Android (et iOS) de la place de marché Shoneya : catalogue, boutiques, fiche produit, panier, Explorer, messagerie, notifications et profils. Elle utilise la même API que le site (`shopi-backend`).

## Démarrer

```bash
npm install
npm run preview      # aperçu dans le navigateur, branché sur le vrai serveur
npx expo start       # serveur de développement pour Expo Go / build de dev
```

Avant chaque commit, lancez `npm run check` (vérification des types et lint).

## Où trouver quoi

L'organisation du code, les règles et les bonnes pratiques de performance sont décrites dans **[ARCHITECTURE.md](./ARCHITECTURE.md)**. En bref :

- `src/app/` contient les routes, une ligne par écran ;
- `src/features/<domaine>/` contient les écrans, les composants et les appels d'API de chaque domaine ;
- `src/components/` contient les composants partagés ;
- `src/lib/` contient l'infrastructure : client HTTP, cache, clés de cache, temps réel, stockage sécurisé.

## Construire un APK

```bash
eas build -p android --profile preview
```

Il faut un compte Expo gratuit. Le profil `preview` produit un APK installable, branché sur le serveur de production.
