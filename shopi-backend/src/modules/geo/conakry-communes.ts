/* ============================================================
 * FICHIER : src/modules/geo/conakry-communes.ts
 *
 * Les 13 communes de Conakry (redécoupage territorial — communales du
 * 31 mai 2026) : les 5 historiques + Sonfonia, Lambanyi, Gbessia, Tombolia,
 * Kassa, Manéah, Kagbélen, Sanoyah. Ajoutées au référentiel au démarrage du
 * serveur si elles y manquent (GeoService.ensureConakryCommunes) — jamais
 * de doublon, jamais de modification de ce que l'administrateur a saisi.
 * Coordonnées : centre approximatif de la commune (OpenStreetMap).
 *
 * Quartiers de chaque commune, ajoutés de la même façon :
 *   · Ratoma, Lambanyi, Sonfonia, Gbessia, Matoto, Tombolia : arrêté du
 *     redécoupage (MATD, avril 2024) ;
 *   · Kaloum, Dixinn, Matam : découpage administratif de Conakry (2023) — Kassa
 *     et Fotoba, autrefois rattachés à Kaloum, vont à la commune de Kassa ;
 *   · Manéah, Kagbélen, Sanoyah (issues de Dubréka/Coyah) : l'arrêté fixant leurs
 *     quartiers n'est pas encore publié — seuls ceux cités par la loi du 18/01/2024
 *     (chef-lieu, limites) figurent ici ; le reste s'ajoute par l'administration
 *     (Référentiel géographique › Import).
 * ============================================================ */

export interface BuiltinCommune { nom: string; code: string; lat: number; lng: number; quartiers: string[] }

export const CONAKRY_COMMUNES: BuiltinCommune[] = [
  { nom: 'Kaloum',   code: 'GN-CKY-KALOUM',   lat: 9.51496, lng: -13.70844,
    quartiers: ['Almamya', 'Boulbinet', 'Coronthie', 'Kouléwondy', 'Manquepas', 'Sandervalia', 'Sans-Fil', 'Témitaye', 'Tombo'] },
  { nom: 'Dixinn',   code: 'GN-CKY-DIXINN',   lat: 9.54688, lng: -13.67331,
    quartiers: ['Belle-Vue École', 'Belle-Vue Marché', 'Camayenne', 'Cameroun', 'Dixinn Cité 1', 'Dixinn Cité 2', 'Dixinn Gare', 'Dixinn Gare Rails', 'Dixinn Mosquée', 'Dixinn Port', 'Hafia 1', 'Hafia 2', 'Hafia Minière', 'Hafia Mosquée', 'Kénien', 'Landréah', 'Minière Cité'] },
  { nom: 'Matam',    code: 'GN-CKY-MATAM',    lat: 9.55206, lng: -13.64958,
    quartiers: ['Bonfi', 'Bonfi Marché', 'Boussoura', 'Carrière', 'Coléah Centre', 'Coléah Cité', 'Domino', 'Hermakönon', 'Imprimerie', 'Lanséboudji', 'Madina Centre', 'Madina Cité', 'Madina École', 'Madina Marché', 'Madina Mosquée', 'Mafanco', 'Mafanco Centre', 'Matam', 'Matam Lido', 'Touguiwondy'] },
  { nom: 'Ratoma',   code: 'GN-CKY-RATOMA',   lat: 9.58917, lng: -13.65571,
    quartiers: ['Taouyah', 'Ratoma Dispensaire', 'Ratoma Centre', 'Kaporo Rails', 'Hamdallaye 1', 'Hamdallaye 2', 'Koloma Soloprimo', 'Kipé', 'Kaporo Centre'] },
  { nom: 'Matoto',   code: 'GN-CKY-MATOTO',   lat: 9.60908, lng: -13.59375,
    quartiers: ['Matoto Centre', 'Simbaya 2', 'Simbaya École', 'Matoto Marché', 'Matoto Khabitaya', 'Sangoyah Mosquée', 'Sangoyah Marché', 'Kissosso', 'Kissosso Plateau', 'Marché Enco 5', 'Wanindara Dispensaire', 'Wanindara Marché'] },
  { nom: 'Sonfonia', code: 'GN-CKY-SONFONIA', lat: 9.66957, lng: -13.55861,
    quartiers: ['Kobayah', 'Yattaya Fossidet', 'Yattaya Centre', 'Sonfonia Gare 1', 'Sonfonia Gare 2', 'Sonfonia Centre 1', 'Sonfonia Centre 2'] },
  { nom: 'Lambanyi', code: 'GN-CKY-LAMBANYI', lat: 9.64455, lng: -13.61361,
    quartiers: ['Nongo Centre', 'Nongo Taady', 'Lambanyi', 'Yembeya', 'Waréah', 'Simbaya Gare', 'Yattaya Centre', 'Nassouroulaye', 'Bantounka 1', 'Bantounka 2', 'Soumambossia', 'Wanindara', 'Wanindara Rails', 'Kinifi'] },
  { nom: 'Gbessia',  code: 'GN-CKY-GBESSIA',  lat: 9.56928, lng: -13.63397,
    quartiers: ['Dabondy 1', 'Dabondy 2', 'Dabondy 3', 'Dabondy École', 'Dabondy Rails', 'Gbessia Cité 1', 'Gbessia Cité 2', 'Gbessia Cité 3', 'Gbessia École', 'Gbessia Centre', 'Gbessia Port 1', 'Gbessia Port 2', 'Dar-Es-Salam', 'Cité de l\'Air', 'Béhanzin', 'Tanènè Marché', 'Tanènè Mosquée', 'Yimbaya École', 'Yimbaya Permanence', 'Yimbaya Port', 'Hamdallaye Mosquée', 'Yimbaya Tannerie', 'Simbaya 1', 'Koloma 1', 'Koloma 2', 'Nassouroulaye'] },
  { nom: 'Tombolia', code: 'GN-CKY-TOMBOLIA', lat: 9.63500, lng: -13.57000,
    quartiers: ['Enta Marché', 'Enta Fassa', 'Tombolia', 'Tombolia Plateau', 'Dabompa Village', 'Dabompa Plateau', 'Lansanayah'] },
  { nom: 'Kassa',    code: 'GN-CKY-KASSA',    lat: 9.47681, lng: -13.74898,
    quartiers: ['Kassa', 'Fotoba'] },
  { nom: 'Manéah',   code: 'GN-CKY-MANEAH',   lat: 9.74000, lng: -13.42000,
    quartiers: ['Tanènè 1', 'Gomboyah'] },
  { nom: 'Kagbélen', code: 'GN-CKY-KAGBELEN', lat: 9.78000, lng: -13.53000,
    quartiers: ['Kagbélen Plateau', 'Bondabon'] },
  { nom: 'Sanoyah',  code: 'GN-CKY-SANOYAH',  lat: 9.72280, lng: -13.48280,
    quartiers: ['Sanoyah Km36'] },
];

/** Comparaison de noms sans accents, casse ni espaces superflus (« Manéah » = « MANEAH »). */
export const foldGeo = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
