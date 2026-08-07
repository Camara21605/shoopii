// Script de validation de tous les fichiers JSON des locales i18n.
// Il parcourt le répertoire `locales` et signale tout fichier JSON invalide,
// avec le fichier concerné, la position, la ligne, la colonne et un extrait du
// contexte autour de l'erreur.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'shopi-frontend', 'src', 'shared', 'i18n', 'locales');

// ---------------------------------------------------------------------------
// Parcours récursif du répertoire pour collecter tous les fichiers .json
// ---------------------------------------------------------------------------
const files = [];
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p); // sous-répertoire : on continue la récursion
    else if (f.endsWith('.json')) files.push(p); // fichier JSON : on le mémorise
  }
}
walk(dir);

let hasError = false;

// ---------------------------------------------------------------------------
// Analyse de chaque fichier JSON
// ---------------------------------------------------------------------------
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  try {
    const parsed = JSON.parse(c);
    // Un fichier de locale doit contenir un objet (et non null)
    if (typeof parsed !== 'object' || parsed === null) {
      console.log('NOT-OBJECT:', f);
      hasError = true;
    }
  } catch (e) {
    hasError = true;
    const rel = path.relative(root, f);
    const lines = c.split(/\r?\n/);

    // Calcul approximatif de la ligne/colonne à partir du message d'erreur
    const m = e.message.match(/position (\d+)/);
    let pos = m ? parseInt(m[1], 10) : -1;
    let lineNo = 1;
    let col = pos;
    if (pos >= 0) {
      let acc = 0;
      for (let i = 0; i < lines.length; i++) {
        const len = lines[i].length + 1; // +1 pour le saut de ligne
        if (acc + len > pos) {
          lineNo = i + 1;
          col = pos - acc;
          break;
        }
        acc += len;
      }
    }

    // Affichage des informations d'erreur
    console.log('=== INVALID JSON ===');
    console.log('FILE:', rel);
    console.log('length:', c.length);
    console.log('error:', e.message);
    console.log('line:', lineNo, 'column:', col);
    if (pos >= 0) {
      console.log('context: ...' + JSON.stringify(c.slice(Math.max(0, pos - 60), pos + 60)) + '...');
    }
    console.log('');
  }
}

// Résultat final
if (!hasError) console.log('All JSON files are valid.');

