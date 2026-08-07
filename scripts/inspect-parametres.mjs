// Script d'inspection du fichier `pt/parametres.json`.
// Il affiche le contenu autour d'une position donnée afin de diagnostiquer
// les caractères parasites responsables de l'erreur Vite « trailing characters ».

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'shopi-frontend', 'src', 'shared', 'i18n', 'locales', 'pt', 'parametres.json');

const c = fs.readFileSync(file, 'utf8');
const pos = 15769; // position où a été détectée la fin du premier JSON valide

console.log('Total length:', c.length);
console.log('--- around position 15769 ---');
console.log('BEFORE:', JSON.stringify(c.slice(15650, pos)));
console.log('AFTER :', JSON.stringify(c.slice(pos, pos + 400)));

// Affichage des derniers caractères de la portion valide pour repérer où
// commence un éventuel second objet de niveau supérieur.
console.log('\n--- Search for "{ " or "{" after position 15700 ---');
const searchStart = Math.max(0, pos - 200);
const tail = c.slice(searchStart);
console.log(JSON.stringify(tail.slice(0, 600)));

