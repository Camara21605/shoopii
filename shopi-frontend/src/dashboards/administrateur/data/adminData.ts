/* ================================================================
 * FICHIER : src/dashboards/administrateur/data/adminData.ts
 *
 * Données mock du dashboard administrateur de zone.
 * En production → remplacer par les appels API correspondants.
 * ================================================================ */

import type {
  CreationCode, ZoneActeur, PartenaireZone, ValidationItem,
  SignalementRecu, Commande, FluxFinancier, AuditEntry, Kpi,
} from './types';

/* Libellés et icônes des types d'acteur */
export const TYPE_LABEL: Record<string, string> = {
  par: 'Partenaire', ent: 'Entreprise', lvr: 'Livreur', cor: 'Correspondant',
};
export const TYPE_ICON: Record<string, string> = {
  par: 'fa-handshake', ent: 'fa-store', lvr: 'fa-motorcycle', cor: 'fa-map-pin',
};

/* Formatage GNF */
export const fmtGnf = (n: number) => n.toLocaleString('fr-FR') + ' GNF';

/* ── Zone ── */
export const ZONE = {
  nom: 'Zone Conakry',
  communes: ['Kaloum', 'Matam', 'Dixinn', 'Ratoma', 'Matoto'],
  sante: 91,
  admin: 'Aïssatou Condé',
};

/* ── KPI vue d’ensemble ── */
export const KPIS: Kpi[] = [
  { cle: 'acteurs',   valeur: '486',   label: 'Acteurs actifs dans la zone',   delta: '+24',  trend: 'up' },
  { cle: 'commandes', valeur: '1 240', label: 'Commandes cette semaine',       delta: '+12%', trend: 'up' },
  { cle: 'volume',    valeur: '86',    unite: 'M GNF', label: "Volume d’affaires (semaine)", delta: '+18%', trend: 'up' },
  { cle: 'litiges',   valeur: '1,2',   unite: '%', label: 'Taux de litiges',   delta: '−2', trend: 'down' },
];

/* ── File d’attente du jour (cliquable depuis OverviewPage) ── */
export const QUEUE = [
  { v: 7, label: 'Comptes à valider',       icone: 'fa-user-check',     kind: 'warn',  nav: 'validations' },
  { v: 4, label: 'Signalements à traiter',  icone: 'fa-flag',           kind: 'alert', nav: 'signalements' },
  { v: 5, label: 'Codes en attente',              icone: 'fa-qrcode',         kind: 'info',  nav: 'codes' },
  { v: 2, label: 'Litiges ouverts',               icone: 'fa-scale-balanced', kind: 'ok',    nav: 'commandes' },
] as const;

/* ── Graphe croissance (acteurs vs commandes ×100) ── */
export const CHART_DATA = {
  semaine: [ {a:4,c:9,x:'Lun'},{a:6,c:11,x:'Mar'},{a:3,c:8,x:'Mer'},{a:7,c:12,x:'Jeu'},{a:8,c:14,x:'Ven'},{a:5,c:10,x:'Sam'},{a:2,c:6,x:'Dim'} ],
  mois:    [ {a:18,c:28,x:'S1'},{a:24,c:31,x:'S2'},{a:21,c:29,x:'S3'},{a:28,c:36,x:'S4'} ],
  annee:   [ {a:60,c:80,x:'T1'},{a:85,c:102,x:'T2'},{a:74,c:95,x:'T3'},{a:96,c:124,x:'T4'} ],
};

/* ── Graphe finances (volume M GNF / commissions ×0,1M) ── */
export const FIN_CHART = [
  {a:64,c:19,x:'Sept'},{a:71,c:21,x:'Oct'},{a:78,c:23,x:'Nov'},{a:90,c:27,x:'Déc'},{a:86,c:26,x:'Jan'},
];

/* ── Couverture par commune ── */
export const COMMUNES = [
  { nom: 'Matoto', acteurs: 142, pct: 29 },
  { nom: 'Ratoma', acteurs: 128, pct: 26 },
  { nom: 'Matam',  acteurs: 96,  pct: 20 },
  { nom: 'Kaloum', acteurs: 74,  pct: 15 },
  { nom: 'Dixinn', acteurs: 46,  pct: 10 },
];

/* ── Répartition par rôle ── */
export const ROLES_REPARTITION = [
  { type: 'par', n: 12 },
  { type: 'ent', n: 148 },
  { type: 'lvr', n: 262 },
  { type: 'cor', n: 64 },
] as const;

/* ── Activité récente ── */
export const ACTIVITE = [
  { icone: 'fa-flag',           kind: 'alert', texte: 'Signalement <b>grave</b> reçu du partenaire M. Soumah', when: 'Il y a 40 min' },
  { icone: 'fa-circle-check',   kind: 'ok',    texte: '<b>TechCorp Guinée</b> validée — documents conformes',  when: 'Il y a 2 heures' },
  { icone: 'fa-qrcode',         kind: 'code',  texte: 'Code partenaire <b>SHOPI-PAR-8Q4W2</b> envoyé à F. Camara', when: 'Il y a 4 heures' },
  { icone: 'fa-user-plus',      kind: 'new',   texte: '<b>14 nouveaux acteurs</b> ont rejoint la zone aujourd’hui', when: 'Aujourd’hui' },
  { icone: 'fa-scale-balanced', kind: 'warn',  texte: 'Litige ouvert sur la commande <b>#CMD-88412</b>', when: 'Hier · 18:22' },
];

/* ── Codes de création ── */
export const CODES: CreationCode[] = [
  { id:'c1', code:'SHOPI-PAR-8Q4W2', type:'par', destinataire:'Fatoumata Camara', statut:'sent',    creeLe:'15 jan. 2025' },
  { id:'c2', code:'SHOPI-ENT-2N7V5', type:'ent', destinataire:'Pharmacie Nongo',  statut:'used',    creeLe:'14 jan. 2025' },
  { id:'c3', code:'SHOPI-LVR-6T3K8', type:'lvr', destinataire:'Ousmane Bah',      statut:'used',    creeLe:'13 jan. 2025' },
  { id:'c4', code:'SHOPI-COR-9J1F4', type:'cor', destinataire:'Relais Ratoma',    statut:'sent',    creeLe:'12 jan. 2025' },
  { id:'c5', code:'SHOPI-PAR-4D9S1', type:'par', destinataire:null,               statut:'expired', creeLe:'4 jan. 2025' },
];

/* ── Partenaires de la zone ── */
export const PARTENAIRES: PartenaireZone[] = [
  { id:'p1', nom:'Mohamed Soumah',   avatar:'MS', commune:'Matam',  depuis:'mars 2024', tier:'or',  recrues:42, conversion:68, confiance:96, statut:'act' },
  { id:'p2', nom:'Fatoumata Camara', avatar:'FC', commune:'Kaloum', depuis:'nov. 2024', tier:'arg', recrues:21, conversion:54, confiance:88, statut:'act' },
  { id:'p3', nom:'Ibrahima Barry',   avatar:'IB', commune:'Ratoma', depuis:'déc. 2024', tier:'brz', recrues:8,  conversion:41, confiance:79, statut:'pend' },
];

/* Top 3 du classement partenaires */
export const TOP3 = [
  { nom:'Mohamed Soumah',   avatar:'MS', v:42, sub:'recrues · 68% conversion', grad:'linear-gradient(135deg,#0E7490,#22D3EE)' },
  { nom:'Fatoumata Camara', avatar:'FC', v:21, sub:'recrues · 54% conversion', grad:'linear-gradient(135deg,#6D28D9,#9F67E8)' },
  { nom:'Aminata Kaba',     avatar:'AK', v:17, sub:'recrues · 49% conversion', grad:'linear-gradient(135deg,#047857,#34D399)' },
];

/* ── Acteurs de la zone ── */
export const ACTEURS: ZoneActeur[] = [
  { id:'a1', type:'ent', nom:'TechCorp Guinée',  telephone:'+224 622 •• •• 10', commune:'Kaloum', recrutePar:'M. Soumah',    activite:'2,4M GNF/mois', statut:'act',  avatar:'TC' },
  { id:'a2', type:'lvr', nom:'Mamadou Diallo',         telephone:'+224 655 •• •• 33', commune:'Matam',  recrutePar:'M. Soumah',    activite:'1 240 courses', statut:'act',  avatar:'MD' },
  { id:'a3', type:'par', nom:'Fatoumata Camara',        telephone:'+224 620 •• •• 78', commune:'Kaloum', recrutePar:'Admin (vous)', activite:'21 recrues',    statut:'act',  avatar:'FC' },
  { id:'a4', type:'ent', nom:'FastDeal224',             telephone:'+224 611 •• •• 90', commune:'Dixinn', recrutePar:'I. Barry',     activite:'—',        statut:'susp', avatar:'FD' },
  { id:'a5', type:'cor', nom:'Relais Madina',           telephone:'+224 666 •• •• 12', commune:'Matam',  recrutePar:'M. Soumah',    activite:'320 colis',     statut:'act',  avatar:'RM' },
];

/* ── Validations en attente ── */
export const VALIDATIONS: ValidationItem[] = [
  { id:'v1', nom:'Pharmacie Nongo', avatar:'PN', type:'ent', description:'Inscription via code SHOPI-ENT-2N7V5 · Documents : registre de commerce + CNI du gérant', commune:'Ratoma', quand:'Il y a 3 heures', recrutePar:'Admin (vous)' },
  { id:'v2', nom:'Sékou Condé',     avatar:'SC', type:'lvr', description:'Inscription via code d’un partenaire · Documents : CNI + permis de conduire',        commune:'Ratoma', quand:'Il y a 6 heures', recrutePar:'M. Soumah' },
  { id:'v3', nom:'Abdoulaye Koné',  avatar:'AK', type:'par', description:'Candidature partenaire via code SHOPI-PAR-8Q4W2 · Documents : CNI + justificatif de domicile', commune:'Matoto', quand:'Hier', recrutePar:'Admin (vous)' },
];

/* ── Signalements reçus ── */
export const SIGNALEMENTS: SignalementRecu[] = [
  { id:'RPT-00412', cible:'FastDeal224', avatar:'FD', type:'ent', gravite:'high', motifLabel:'Arnaque / Fraude', raison:'« Vend des produits contrefaits et ne livre jamais après paiement. Plusieurs clients se sont plaints. » — 2 preuves jointes', signalePar:'M. Soumah (partenaire)', statut:'review', quand:'Il y a 40 min' },
  { id:'RPT-00398', cible:'Livreur « M. Touré »', avatar:'MT', type:'lvr', gravite:'med', motifLabel:'Comportement abusif', raison:'« Demande des paiements supplémentaires en espèces aux clients en dehors de l’application. »', signalePar:'M. Soumah (partenaire)', statut:'review', quand:'Il y a 5 heures' },
  { id:'RPT-00355', cible:'GuineeTech_Pro', avatar:'GT', type:'ent', gravite:'high', motifLabel:'Usurpation d’identité', raison:'« Faux compte usurpant l’identité d’une vraie boutique pour tromper les clients. » — Vérification d’identité en cours.', signalePar:'3 utilisateurs', statut:'invest', quand:'6 jan. 2025' },
];

/* ── Commandes de la zone ── */
export const COMMANDES: Commande[] = [
  { id:'#CMD-88412', quand:'Hier · 18:22',    client:'A. Baldé',  entreprise:'FastDeal224',     montant:1250000,  progression:2, statut:'dispute' },
  { id:'#CMD-88409', quand:'Hier · 16:05',    client:'F. Sylla',  entreprise:'TechCorp Guinée', montant:4200000,  progression:3, statut:'relay' },
  { id:'#CMD-88401', quand:'Hier · 11:40',    client:'M. Camara', entreprise:'Boutique Sila',   montant:380000,   progression:2, statut:'ship' },
  { id:'#CMD-88396', quand:'Hier · 09:12',    client:'O. Diallo', entreprise:'ElectroPlus',     montant:920000,   progression:1, statut:'prep' },
  { id:'#CMD-88388', quand:'14 jan. · 19:55', client:'K. Touré',  entreprise:'TechCorp Guinée', montant:12500000, progression:4, statut:'done' },
];

/* ── Flux financiers ── */
export const FLUX: FluxFinancier[] = [
  { id:'f1', sens:'in',     libelle:'Commission Shopi sur <b>#CMD-88388</b>',      quand:'Hier · 20:10',    montant:375000 },
  { id:'f2', sens:'out',    libelle:'Reversement partenaire <b>M. Soumah</b>',     quand:'Hier · 18:00',    montant:-285000 },
  { id:'f3', sens:'in',     libelle:'Commission Shopi sur <b>#CMD-88371</b>',      quand:'14 jan. · 17:42', montant:126000 },
  { id:'f4', sens:'refund', libelle:'Remboursement litige <b>#CMD-88320</b>',      quand:'13 jan. · 10:15', montant:-540000 },
];

/* ── Journal d’audit ── */
export const AUDIT: AuditEntry[] = [
  { id:'AUD-10248', kind:'ban',  texte:'Suspension du compte <b>FastDeal224</b> (entreprise) — motif : fraude signalée RPT-00412', auteur:'Aïssatou Condé', quand:'Aujourd’hui · 10:42' },
  { id:'AUD-10247', kind:'ok',   texte:'Validation du compte <b>TechCorp Guinée</b> — documents conformes',                        auteur:'Aïssatou Condé', quand:'Aujourd’hui · 09:15' },
  { id:'AUD-10244', kind:'code', texte:'Génération du code <b>SHOPI-PAR-8Q4W2</b> (partenaire) pour F. Camara',                    auteur:'Aïssatou Condé', quand:'Hier · 15:30' },
  { id:'AUD-10241', kind:'warn', texte:'Avertissement envoyé au livreur <b>M. Touré</b> — paiements hors application',        auteur:'Aïssatou Condé', quand:'Hier · 11:08' },
  { id:'AUD-10236', kind:'ok',   texte:'Réactivation du compte <b>Kiosque Ratoma</b> après régularisation',                    auteur:'Aïssatou Condé', quand:'13 jan. · 16:50' },
];
