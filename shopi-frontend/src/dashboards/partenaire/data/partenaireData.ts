/* ================================================================
 * FICHIER : src/dashboards/partenaire/data/partenaireData.ts
 *
 * Données mock du dashboard partenaire.
 * En production → remplacer par les appels API correspondants
 * (voir hooks/usePartenaireState.ts).
 * ================================================================ */

import type {
  CreationCode, ActeurRecrute, Signalement, CommissionLigne, Kpi,
} from './types';

/* Libellés des types d'acteur */
export const TYPE_LABEL: Record<string, string> = {
  ent: 'Entreprise', lvr: 'Livreur', cor: 'Correspondant', cli: 'Client VIP',
};
export const TYPE_ICON: Record<string, string> = {
  ent: 'fa-store', lvr: 'fa-motorcycle', cor: 'fa-map-pin', cli: 'fa-user',
};

/* Formatage GNF */
export const fmtGnf = (n: number) => n.toLocaleString('fr-FR') + ' GNF';

/* ── KPI de la vue d'ensemble ── */
export const KPIS: Kpi[] = [
  { cle: 'recrues',     valeur: '42',  label: 'Acteurs recrutés (total)', delta: '+6',  trend: 'up' },
  { cle: 'codes',       valeur: '11',  label: 'Codes actifs',             delta: '+3',  trend: 'up' },
  { cle: 'conversion',  valeur: '68',  unite: '%', label: 'Taux de conversion', delta: '12%', trend: 'up' },
  { cle: 'commissions', valeur: '4,2', unite: 'M GNF', label: 'Commissions ce mois', delta: '+18%', trend: 'up' },
];

/* ── Données du graphe recrutements (entreprises vs livreurs) ── */
export const CHART_DATA = {
  semaine: [ {e:2,l:1,x:'Lun'},{e:1,l:2,x:'Mar'},{e:3,l:1,x:'Mer'},{e:2,l:3,x:'Jeu'},{e:4,l:2,x:'Ven'},{e:1,l:1,x:'Sam'},{e:0,l:0,x:'Dim'} ],
  mois:    [ {e:3,l:4,x:'S1'},{e:5,l:6,x:'S2'},{e:4,l:5,x:'S3'},{e:6,l:8,x:'S4'} ],
  annee:   [ {e:8,l:10,x:'T1'},{e:12,l:14,x:'T2'},{e:9,l:11,x:'T3'},{e:13,l:15,x:'T4'} ],
};

/* ── Codes de création ── */
export const CODES: CreationCode[] = [
  { id:'c1', code:'SHOPI-ENT-7K2M9', type:'ent', destinataire:'TechCorp Guinée', statut:'used', creeLe:'14 jan. 2025' },
  { id:'c2', code:'SHOPI-LVR-9K2M4', type:'lvr', destinataire:'Ibrahima Keita',  statut:'sent', creeLe:'13 jan. 2025' },
  { id:'c3', code:'SHOPI-COR-3X8P1', type:'cor', destinataire:'Relais Madina',   statut:'used', creeLe:'11 jan. 2025' },
  { id:'c4', code:'SHOPI-LVR-5R7T2', type:'lvr', destinataire:'Sékou Condé',     statut:'sent', creeLe:'10 jan. 2025' },
  { id:'c5', code:'SHOPI-ENT-1A4B8', type:'ent', destinataire:null,              statut:'expired', creeLe:'2 jan. 2025' },
];

/* ── Acteurs recrutés ── */
export const ACTEURS: ActeurRecrute[] = [
  { id:'a1', type:'ent', nom:'TechCorp Guinée', meta:'Entreprise · Kaloum', avatar:'TC', statut:'act', stat1:{valeur:'124',  label:'Produits'},     stat2:{valeur:'2,4M', label:'Ventes/mois'}, commission:'285K GNF/mois' },
  { id:'a2', type:'lvr', nom:'Mamadou Diallo',  meta:'Livreur · Conakry',   avatar:'MD', statut:'act', stat1:{valeur:'1 240',label:'Courses'},      stat2:{valeur:'4.9',  label:'Note'},        commission:'42K GNF/mois' },
  { id:'a3', type:'cor', nom:'Relais Madina',   meta:'Correspondant · Madina', avatar:'RM', statut:'act', stat1:{valeur:'320', label:'Colis'},     stat2:{valeur:'4.8',  label:'Note'},        commission:'68K GNF/mois' },
  { id:'a4', type:'ent', nom:'ElectroPlus',     meta:'Entreprise · Matam',  avatar:'EP', statut:'act', stat1:{valeur:'86',   label:'Produits'},    stat2:{valeur:'1,8M', label:'Ventes/mois'}, commission:'178K GNF/mois' },
  { id:'a5', type:'lvr', nom:'Ibrahima Keita',  meta:'Livreur · Conakry',   avatar:'IK', statut:'pend', stat1:{valeur:'—',   label:'Courses'},     stat2:{valeur:'—',    label:'Note'},        commission:'En attente' },
  { id:'a6', type:'lvr', nom:'Sékou Condé',     meta:'Livreur · Ratoma',    avatar:'SC', statut:'pend', stat1:{valeur:'—',   label:'Courses'},     stat2:{valeur:'—',    label:'Note'},        commission:'En attente' },
  { id:'a7', type:'cor', nom:'Relais Kaloum',   meta:'Correspondant · Kaloum', avatar:'RK', statut:'act', stat1:{valeur:'410', label:'Colis'},     stat2:{valeur:'4.7',  label:'Note'},        commission:'72K GNF/mois' },
  { id:'a8', type:'ent', nom:'Boutique Sila',   meta:'Entreprise · Dixinn', avatar:'BS', statut:'act', stat1:{valeur:'52',   label:'Produits'},    stat2:{valeur:'920K', label:'Ventes/mois'}, commission:'92K GNF/mois' },
  { id:'a9', type:'lvr', nom:'Alpha Barry',     meta:'Livreur · Conakry',   avatar:'AB', statut:'act', stat1:{valeur:'680',  label:'Courses'},     stat2:{valeur:'4.6',  label:'Note'},        commission:'31K GNF/mois' },
];

/* ── Signalements ── */
export const SIGNALEMENTS: Signalement[] = [
  { id:'RPT-00412', cible:'Compte « FastDeal224 »', type:'ent', motif:'fraude', motifLabel:'Arnaque / Fraude', gravite:'high', raison:"Vend des produits contrefaits et ne livre jamais après paiement. Plusieurs clients se sont plaints.", statut:'invest', date:'13 jan. 2025' },
  { id:'RPT-00398', cible:'Livreur « M. Touré »', type:'lvr', motif:'abus', motifLabel:'Comportement abusif', gravite:'med', raison:"Demande des paiements supplémentaires en espèces aux clients en dehors de l'application.", statut:'review', date:'11 jan. 2025' },
  { id:'RPT-00355', cible:'Compte « GuineeTech_Pro »', type:'ent', motif:'faux', motifLabel:'Faux compte / Usurpation', gravite:'high', raison:"Faux compte usurpant l'identité d'une vraie boutique pour tromper les clients.", statut:'resolved', date:'6 jan. 2025' },
  { id:'RPT-00301', cible:'Livreur « A. Camara »', type:'lvr', motif:'abus', motifLabel:'Comportement abusif', gravite:'low', raison:"Retards répétés et injoignable pendant les livraisons.", statut:'rejected', date:'28 déc. 2024' },
];

/* ── Commissions récentes ── */
export const COMMISSIONS: CommissionLigne[] = [
  { source:'TechCorp Guinée', type:'ent', detail:'Commission sur ventes (5%)', date:"Aujourd'hui", montant:285000 },
  { source:'Mamadou Diallo',  type:'lvr', detail:'Commission courses (2%)',    date:'Hier',         montant:42000 },
  { source:'Relais Madina',   type:'cor', detail:"Prime d'activation",         date:'11 jan.',      montant:150000 },
  { source:'ElectroPlus',     type:'ent', detail:'Commission sur ventes (5%)', date:'10 jan.',      montant:178500 },
];

/* ── Activité récente ── */
export const ACTIVITE = [
  { icone:'fa-circle-check', kind:'ok',   texte:'<b>TechCorp Guinée</b> a créé son compte avec votre code', when:'Il y a 2 heures' },
  { icone:'fa-coins',        kind:'cash', texte:'Commission de <b>85 000 GNF</b> créditée',                  when:'Il y a 5 heures' },
  { icone:'fa-qrcode',       kind:'code', texte:'Code <b>SHOPI-LVR-9K2M</b> envoyé à Ibrahima K.',           when:'Hier · 16:40' },
  { icone:'fa-user-plus',    kind:'new',  texte:'<b>Mamadou Diallo</b> (livreur) est devenu actif',         when:'Hier · 11:20' },
  { icone:'fa-circle-check', kind:'ok',   texte:'<b>Relais Madina</b> a complété sa vérification',          when:'12 jan. · 09:15' },
];
