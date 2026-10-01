# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Architecture du projet

Lire **ARCHITECTURE.md** avant d'ajouter ou de déplacer un fichier. Règles essentielles :
- `src/app/` = routes d'une ligne (`export { default } from '@/features/<domaine>/screens/...'`) ;
- un écran va dans `src/features/<domaine>/screens/`, ses morceaux dans `components/` (+ `index.ts`) ;
- clés de cache : toujours `qk` de `src/lib/query-keys.ts`, jamais `['...']` à la main ;
- entre domaines, importer seulement `features/<domaine>/api` ou `features/<domaine>/components` ;
- `npm run check` (types + lint) avant chaque commit.
