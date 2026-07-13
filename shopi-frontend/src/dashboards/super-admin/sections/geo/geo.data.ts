/* ================================================================
 * FICHIER : sections/geo/geo.data.ts
 * Données mock du référentiel géographique Guinée / Shopi.
 * En production : remplacer par appels API /geo/…
 * ================================================================ */

import type {
  Pays, Region, Prefecture, Commune, Quartier, ZoneLivraison, GeoAuditEntry,
} from './geo.types';

/* ── PAYS ── */
export const MOCK_PAYS: Pays[] = [
  {
    id: 'GN', code: 'GN', nom: 'Guinée', description: 'République de Guinée',
    iso2: 'GN', iso3: 'GIN', indicatif: '+224', devise: 'GNF',
    statut: 'actif', parentId: null,
    createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 8,
  },
  {
    id: 'SN', code: 'SN', nom: 'Sénégal', description: 'République du Sénégal',
    iso2: 'SN', iso3: 'SEN', indicatif: '+221', devise: 'XOF',
    statut: 'inactif', parentId: null,
    createdAt: '2024-06-01', updatedAt: '2024-06-01', auteur: 'Super Admin', enfants: 0,
  },
  {
    id: 'CI', code: 'CI', nom: "Côte d'Ivoire", description: "République de Côte d'Ivoire",
    iso2: 'CI', iso3: 'CIV', indicatif: '+225', devise: 'XOF',
    statut: 'inactif', parentId: null,
    createdAt: '2024-06-01', updatedAt: '2024-06-01', auteur: 'Super Admin', enfants: 0,
  },
];

/* ── RÉGIONS ── */
export const MOCK_REGIONS: Region[] = [
  { id: 'GN-C',  code: 'GN-C',  nom: 'Conakry',   description: 'Capitale et région administrative spéciale', paysId: 'GN', chef_lieu: 'Conakry',  statut: 'actif',   parentId: 'GN', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 5 },
  { id: 'GN-KD', code: 'GN-KD', nom: 'Kindia',     description: 'Région de Kindia',                           paysId: 'GN', chef_lieu: 'Kindia',   statut: 'actif',   parentId: 'GN', createdAt: '2024-02-01', updatedAt: '2024-02-01', auteur: 'Super Admin', enfants: 8 },
  { id: 'GN-MM', code: 'GN-MM', nom: 'Mamou',      description: 'Région de Mamou',                            paysId: 'GN', chef_lieu: 'Mamou',    statut: 'actif',   parentId: 'GN', createdAt: '2024-02-01', updatedAt: '2024-02-01', auteur: 'Super Admin', enfants: 5 },
  { id: 'GN-KK', code: 'GN-KK', nom: 'Kankan',     description: 'Région de Kankan — haute Guinée',            paysId: 'GN', chef_lieu: 'Kankan',   statut: 'actif',   parentId: 'GN', createdAt: '2024-02-01', updatedAt: '2024-02-01', auteur: 'Super Admin', enfants: 11 },
  { id: 'GN-LB', code: 'GN-LB', nom: 'Labé',       description: 'Région de Labé — Fouta Djalon',              paysId: 'GN', chef_lieu: 'Labé',     statut: 'actif',   parentId: 'GN', createdAt: '2024-02-01', updatedAt: '2024-02-01', auteur: 'Super Admin', enfants: 6 },
  { id: 'GN-BK', code: 'GN-BK', nom: 'Boké',       description: 'Région de Boké — Basse Guinée',              paysId: 'GN', chef_lieu: 'Boké',     statut: 'actif',   parentId: 'GN', createdAt: '2024-03-01', updatedAt: '2024-03-01', auteur: 'Super Admin', enfants: 6 },
  { id: 'GN-NZ', code: 'GN-NZ', nom: 'Nzérékoré',  description: 'Région de Nzérékoré — Guinée forestière',    paysId: 'GN', chef_lieu: 'Nzérékoré',statut: 'actif',   parentId: 'GN', createdAt: '2024-03-01', updatedAt: '2024-03-01', auteur: 'Super Admin', enfants: 8 },
  { id: 'GN-FR', code: 'GN-FR', nom: 'Faranah',    description: 'Région de Faranah — Guinée centrale',        paysId: 'GN', chef_lieu: 'Faranah',  statut: 'inactif', parentId: 'GN', createdAt: '2024-03-01', updatedAt: '2024-03-01', auteur: 'Super Admin', enfants: 5 },
];

/* ── PRÉFECTURES (Conakry seulement — les communes sont les arrondissements) ── */
export const MOCK_PREFECTURES: Prefecture[] = [
  { id: 'GN-C-KA', code: 'KA', nom: 'Kaloum',  description: 'Arrondissement de Kaloum',  regionId: 'GN-C', chef_lieu: 'Kaloum',  statut: 'actif', parentId: 'GN-C', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 1 },
  { id: 'GN-C-MA', code: 'MA', nom: 'Matam',   description: 'Arrondissement de Matam',   regionId: 'GN-C', chef_lieu: 'Matam',   statut: 'actif', parentId: 'GN-C', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 1 },
  { id: 'GN-C-DI', code: 'DI', nom: 'Dixinn',  description: 'Arrondissement de Dixinn',  regionId: 'GN-C', chef_lieu: 'Dixinn',  statut: 'actif', parentId: 'GN-C', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 1 },
  { id: 'GN-C-RA', code: 'RA', nom: 'Ratoma',  description: 'Arrondissement de Ratoma',  regionId: 'GN-C', chef_lieu: 'Ratoma',  statut: 'actif', parentId: 'GN-C', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 1 },
  { id: 'GN-C-MT', code: 'MT', nom: 'Matoto',  description: 'Arrondissement de Matoto',  regionId: 'GN-C', chef_lieu: 'Matoto',  statut: 'actif', parentId: 'GN-C', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 1 },
  { id: 'GN-KD-01', code: 'KD-KI', nom: 'Kindia Pref.', description: 'Préfecture de Kindia', regionId: 'GN-KD', chef_lieu: 'Kindia', statut: 'inactif', parentId: 'GN-KD', createdAt: '2024-02-01', updatedAt: '2024-02-01', auteur: 'Super Admin', enfants: 0 },
];

/* ── COMMUNES ── */
export const MOCK_COMMUNES: Commune[] = [
  { id: 'COM-KA', code: 'CKA', nom: 'Commune de Kaloum',  description: 'Centre des affaires',    prefectureId: 'GN-C-KA', type: 'urbaine',      statut: 'actif', parentId: 'GN-C-KA', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 8 },
  { id: 'COM-MA', code: 'CMA', nom: 'Commune de Matam',   description: 'Commune centrale',        prefectureId: 'GN-C-MA', type: 'urbaine',      statut: 'actif', parentId: 'GN-C-MA', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 12 },
  { id: 'COM-DI', code: 'CDI', nom: 'Commune de Dixinn',  description: 'Université, ambassades',  prefectureId: 'GN-C-DI', type: 'urbaine',      statut: 'actif', parentId: 'GN-C-DI', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 10 },
  { id: 'COM-RA', code: 'CRA', nom: 'Commune de Ratoma',  description: 'La plus peuplée',         prefectureId: 'GN-C-RA', type: 'urbaine',      statut: 'actif', parentId: 'GN-C-RA', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 18 },
  { id: 'COM-MT', code: 'CMT', nom: 'Commune de Matoto',  description: 'Entrée de Conakry',       prefectureId: 'GN-C-MT', type: 'semi-urbaine', statut: 'actif', parentId: 'GN-C-MT', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 15 },
];

/* ── QUARTIERS (Kaloum) ── */
export const MOCK_QUARTIERS: Quartier[] = [
  { id: 'Q-KA-01', code: 'KA-001', nom: 'Sandervalia',   description: 'Centre commercial de Kaloum',  communeId: 'COM-KA', population: 12500, statut: 'actif', parentId: 'COM-KA', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 2 },
  { id: 'Q-KA-02', code: 'KA-002', nom: 'Tombo',         description: 'Port de Conakry',               communeId: 'COM-KA', population: 8200,  statut: 'actif', parentId: 'COM-KA', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 1 },
  { id: 'Q-KA-03', code: 'KA-003', nom: 'Boulbinet',     description: 'Marché de Boulbinet',          communeId: 'COM-KA', population: 9800,  statut: 'actif', parentId: 'COM-KA', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 1 },
  { id: 'Q-MA-01', code: 'MA-001', nom: 'Matam Centre',  description: 'Marché central de Matam',      communeId: 'COM-MA', population: 18000, statut: 'actif', parentId: 'COM-MA', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 3 },
  { id: 'Q-MA-02', code: 'MA-002', nom: 'Cosa',          description: 'Quartier Cosa',                communeId: 'COM-MA', population: 15600, statut: 'actif', parentId: 'COM-MA', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 2 },
  { id: 'Q-RA-01', code: 'RA-001', nom: 'Nongo',         description: 'Nongo — nord de Ratoma',       communeId: 'COM-RA', population: 42000, statut: 'actif', parentId: 'COM-RA', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 4 },
  { id: 'Q-RA-02', code: 'RA-002', nom: 'Kipé',          description: 'Kipé — résidentiel',           communeId: 'COM-RA', population: 38000, statut: 'actif', parentId: 'COM-RA', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 3 },
  { id: 'Q-DI-01', code: 'DI-001', nom: 'Dixinn Centre', description: 'Cité universitaire',           communeId: 'COM-DI', population: 22000, statut: 'actif', parentId: 'COM-DI', createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 2 },
];

/* ── ZONES DE LIVRAISON ── */
export const MOCK_ZONES: ZoneLivraison[] = [
  /* Zones couvrant des quartiers spécifiques */
  { id: 'Z-01', code: 'Z-KA-CENTRE', nom: 'Kaloum Centre',         description: 'Sandervalia + Tombo',            couvertureType: 'quartier', couvertureIds: ['Q-KA-01','Q-KA-02'],                          rayonKm: 3,  fraisLivraison: 5000,  tempsEstime: 20, acteursCover: 8,  statut: 'actif',   parentId: 'Q-KA-01',  createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 0 },
  { id: 'Z-02', code: 'Z-KA-PORT',   nom: 'Kaloum Port',            description: 'Boulbinet et port',              couvertureType: 'quartier', couvertureIds: ['Q-KA-03'],                                    rayonKm: 2,  fraisLivraison: 5000,  tempsEstime: 15, acteursCover: 4,  statut: 'actif',   parentId: 'Q-KA-03',  createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 0 },

  /* Zone couvrant deux communes (Kaloum + Matam) — exemple multi-entités */
  { id: 'Z-03', code: 'Z-KA-MA',     nom: 'Centre-Ville Élargi',    description: 'Kaloum + Matam réunis',          couvertureType: 'commune',  couvertureIds: ['COM-KA','COM-MA'],                             rayonKm: 6,  fraisLivraison: 6000,  tempsEstime: 25, acteursCover: 18, statut: 'actif',   parentId: 'COM-KA',   createdAt: '2024-02-01', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 0 },

  /* Zone couvrant deux quartiers sur deux communes différentes */
  { id: 'Z-04', code: 'Z-NORD-CONK', nom: 'Nord Conakry',           description: 'Nongo (Ratoma) + Kipé (Ratoma)', couvertureType: 'quartier', couvertureIds: ['Q-RA-01','Q-RA-02'],                          rayonKm: 8,  fraisLivraison: 10000, tempsEstime: 35, acteursCover: 15, statut: 'actif',   parentId: 'Q-RA-01',  createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 0 },

  /* Zone couvrant une préfecture entière */
  { id: 'Z-05', code: 'Z-PREF-DI',   nom: 'Préfecture Dixinn',      description: 'Toute la préfecture de Dixinn',  couvertureType: 'prefecture',couvertureIds: ['GN-C-DI'],                                    rayonKm: 5,  fraisLivraison: 8000,  tempsEstime: 28, acteursCover: 7,  statut: 'actif',   parentId: 'GN-C-DI',  createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 0 },

  /* Zone couvrant deux préfectures (Ratoma + Matoto) */
  { id: 'Z-06', code: 'Z-RA-MT',     nom: 'Ratoma–Matoto',          description: 'Ratoma + Matoto combinées',      couvertureType: 'prefecture',couvertureIds: ['GN-C-RA','GN-C-MT'],                          rayonKm: 12, fraisLivraison: 11000, tempsEstime: 40, acteursCover: 20, statut: 'actif',   parentId: 'GN-C-RA',  createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 0 },

  /* Zone couvrant une commune simple */
  { id: 'Z-07', code: 'Z-DI-UNIV',   nom: 'Dixinn Université',      description: 'Cité universitaire',             couvertureType: 'commune',  couvertureIds: ['COM-DI'],                                     rayonKm: 4,  fraisLivraison: 8000,  tempsEstime: 28, acteursCover: 7,  statut: 'actif',   parentId: 'COM-DI',   createdAt: '2024-01-15', updatedAt: '2024-11-02', auteur: 'Super Admin', enfants: 0 },

  /* Zone couvrant toute une région */
  { id: 'Z-08', code: 'Z-CONAKRY',   nom: 'Grand Conakry',          description: 'Toute la région de Conakry',     couvertureType: 'region',   couvertureIds: ['GN-C'],                                       rayonKm: 20, fraisLivraison: 15000, tempsEstime: 60, acteursCover: 50, statut: 'inactif', parentId: 'GN-C',     createdAt: '2024-03-01', updatedAt: '2024-03-01', auteur: 'Super Admin', enfants: 0 },
];

/* ── JOURNAL D'AUDIT GÉO ── */
export const MOCK_GEO_AUDIT: GeoAuditEntry[] = [
  { id: 'A001', action: 'create',     niveau: 'zone',       itemNom: 'Matoto Entrée',    itemCode: 'Z-MT-ENTR', auteur: 'Super Admin', quand: '01/03/2026 09:12', details: 'Nouvelle zone de livraison créée' },
  { id: 'A002', action: 'import',     niveau: 'quartier',   itemNom: '8 quartiers',      itemCode: '—',         auteur: 'Super Admin', quand: '15/01/2026 14:30', details: 'Import CSV — 8 quartiers importés, 0 erreur' },
  { id: 'A003', action: 'activate',   niveau: 'commune',    itemNom: 'Commune de Ratoma',itemCode: 'CRA',       auteur: 'Super Admin', quand: '15/01/2026 10:00', details: 'Commune activée sur la plateforme' },
  { id: 'A004', action: 'deactivate', niveau: 'region',     itemNom: 'Faranah',          itemCode: 'GN-FR',     auteur: 'Super Admin', quand: '01/03/2026 08:55', details: 'Région désactivée — extension à planifier' },
  { id: 'A005', action: 'update',     niveau: 'zone',       itemNom: 'Kaloum Centre',    itemCode: 'Z-KA-CENTRE',auteur: 'Super Admin', quand: '02/07/2026 11:22', details: 'Frais de livraison mis à jour : 4500 → 5000 GNF' },
  { id: 'A006', action: 'create',     niveau: 'pays',       itemNom: "Côte d'Ivoire",    itemCode: 'CI',        auteur: 'Super Admin', quand: '01/06/2026 16:00', details: 'Pays ajouté en préparation du déploiement' },
];
