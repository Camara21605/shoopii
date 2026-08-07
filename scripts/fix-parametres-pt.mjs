// Script de réparation du fichier de traduction portugais `pt/parametres.json`.
// Ce fichier a été corrompu : il contient plusieurs fragments JSON concaténés :
//   {"parametres":{...}} , "equipe":{...} , "boutiquePreview":{...} avec des
//   accolades excédentaires à la fin.
// Ce script fusionne ces fragments en un objet JSON unique et valide.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'shopi-frontend', 'src', 'shared', 'i18n', 'locales', 'pt', 'parametres.json');

const c = fs.readFileSync(file, 'utf8');

// ---------------------------------------------------------------------------
// findValidEnd : recherche la fin de la première valeur JSON valide du fichier.
// On parcourt le texte en suivant la profondeur des accolades, en ignorant les
// accolades présentes à l'intérieur des chaînes de caractères.
// ---------------------------------------------------------------------------
function findValidEnd(text) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const prefix = text.slice(0, i + 1);
        try { JSON.parse(prefix); return i + 1; } catch { /* continue */ }
      }
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// extractKeyValuePairs : extrait une série de paires `"clé":{objet}` à partir
// d'un fragment texte. Gère les virgules, les espaces et les accolades
// parasites en fin de fragment.
// ---------------------------------------------------------------------------
function extractKeyValuePairs(text) {
  let i = 0;
  const pairs = {};
  while (i < text.length) {
    // Ignorer les virgules et espaces éventuels
    while (i < text.length && (text[i] === ',' || /\s/.test(text[i]))) i++;
    if (i >= text.length) break;

    // Lecture de la clé (chaîne entre guillemets)
    if (text[i] !== '"') {
      console.error(`Caractère inattendu à la position ${i} (attendu une clé).`);
      break;
    }
    i++;
    let key = '';
    let escaped = false;
    while (i < text.length) {
      const ch = text[i];
      if (escaped) { key += ch; escaped = false; }
      else if (ch === '\\') escaped = true;
      else if (ch === '"') { i++; break; }
      else key += ch;
      i++;
    }

    // Ignorer les espaces et les deux-points avant la valeur
    while (i < text.length && (text[i] === ':' || /\s/.test(text[i]))) i++;

    // La valeur doit être un objet `{...}` : on cherche l'accolade fermante
    // correspondante en tenant compte des chaînes imbriquées.
    if (text[i] !== '{') {
      console.error(`Valeur non-objet attendue pour la clé "${key}" à la position ${i}.`);
      break;
    }
    const valueStart = i;
    let depth = 0;
    let inStr = false;
    let esc = false;
    while (i < text.length) {
      const ch = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
      } else {
        if (ch === '"') inStr = true;
        else if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) { i++; break; }
        }
      }
      i++;
    }

    const rawValue = text.slice(valueStart, i);
    pairs[key] = JSON.parse(rawValue);
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Réparation proprement dite
// ---------------------------------------------------------------------------
const end = findValidEnd(c);
if (end <= 0) {
  console.error('Impossible de trouver la fin de la première valeur JSON valide.');
  process.exit(1);
}

// 1) Récupérer le premier objet JSON valide : {"parametres":{...}}
const firstObj = JSON.parse(c.slice(0, end));
console.log('Clés de la première partie :', Object.keys(firstObj));

// 2) Extraire les objets suivants depuis le reste du fichier : "equipe", "boutiquePreview"
const tail = c.slice(end).trim();
const tailObj = extractKeyValuePairs(tail);
console.log('Clés extraites du fragment :', Object.keys(tailObj));

// 3) Fusionner le tout en un seul objet
const merged = { ...firstObj, ...tailObj };
console.log('Clés fusionnées :', Object.keys(merged));

// 4) Écrire le fichier réparé (indentation 2 espaces + saut de ligne final)
const output = JSON.stringify(merged, null, 2) + '\n';
fs.writeFileSync(file, output, 'utf8');

// 5) Vérification finale
const check = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log('RÉPARÉ & VÉRIFIÉ. Nouvelle taille :', fs.statSync(file).size);
console.log('Clés de niveau supérieur :', Object.keys(check));

