/**
 * Script de découpage des fichiers common.json (fr, en, ar) en fichiers
 * spécialisés par domaine, en préservant l'encodage UTF-8.
 *
 * Utilisation (depuis la racine du repo) :
 *   node scripts/split-i18n.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = join(__dirname, '..', 'shopi-frontend', 'src', 'shared', 'i18n', 'locales');

// Mapping : fichier cible -> clés top-level à y extraire
const map = {
  layout: ['sidebar', 'topbar', 'reseauBottomNav'],
  overview: ['overview'],
  commandes: ['commandes', 'retours'],
  produits: ['produits', 'ajouter', 'inventaire', 'promotions', 'analytics'],
  reseau: ['livreurs', 'correspondants', 'profilCorrespondant', 'profilLivreur'],
  finances: ['finances', 'wallet'],
  clients: ['clients', 'clientProfil', 'avis'],
  parametres: ['parametres', 'equipe', 'boutiquePreview'],
  messagerie: ['messagerie', 'seo'],
  public: [
    'home', 'publicHeader', 'publicFooter', 'boutiquesPage', 'boutiqueDetail',
    'produitDetail', 'panierCommande', 'followToggle', 'livreursPage',
    'correspondantsPage', 'offresPage', 'settingsPage',
  ],
};

for (const lang of ['fr', 'en', 'ar', 'zh', 'pt']) {
  const srcPath = join(base, lang, 'common.json');
  if (!existsSync(srcPath)) {
    console.warn(`INTROUVABLE: ${srcPath}`);
    continue;
  }

  // Lecture en UTF-8 strict
  const raw = readFileSync(srcPath, 'utf8');
  const json = JSON.parse(raw);

  for (const [fileName, keys] of Object.entries(map)) {
    const out = {};
    for (const k of keys) {
      if (k in json) {
        out[k] = json[k];
      } else {
        console.warn(`WARN: clé '${k}' absente dans ${lang}`);
      }
    }
    const outPath = join(base, lang, `${fileName}.json`);
    // Écriture en UTF-8 sans BOM, avec indentation de 2 espaces
    writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log(`OK ${lang}/${fileName}.json`);
  }
}

console.log('Terminé.');

