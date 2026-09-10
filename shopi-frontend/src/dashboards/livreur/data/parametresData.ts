// src/dashboards/livreur/data/parametresData.ts
// Toutes les données des sections paramètres livreur

/* BUG CORRIGÉ — retiré : 'vitesses' (section "Vitesses & Tarification").
 * Un livreur ne fixe pas ses propres tarifs — le tarif de livraison est
 * défini PAR ZONE (GeoZone.fraisLivraison), géré par un administrateur
 * avec la permission "geo_zones" accordée par le super-admin. Le livreur
 * garde le choix des modes de vitesse qu'il accepte via 'zone' (voir
 * SecZone.tsx, vitessesActives), mais plus la grille tarifaire. */
export type ParamSectionId =
  | 'profil' | 'docs' | 'zone' | 'vehicule'
  | 'paiement' | 'securite' | 'notifs' | 'confidentialite' | 'langue' | 'danger';

// ── Coordonnées des zones guinéennes (fallback si non renseignées en DB) ──
export const GUINEA_ZONE_COORDS: Record<string, [number, number]> = {
  // Communes de Conakry
  'Kaloum':       [9.5370, -13.6773],
  'Dixinn':       [9.5504, -13.6274],
  'Matam':        [9.5726, -13.6547],
  'Ratoma':       [9.6130, -13.6310],
  'Matoto':       [9.5939, -13.5896],
  // Préfectures / Villes
  'Conakry':      [9.5370, -13.6773],
  'Coyah':        [9.7124, -13.3715],
  'Dubreka':      [9.7905, -13.5215],
  'Forécariah':   [9.4320, -13.0935],
  'Kindia':       [10.0549, -12.8663],
  'Télimélé':     [10.9038, -13.0332],
  'Mamou':        [10.3764, -12.0972],
  'Dalaba':       [10.6918, -12.2487],
  'Pita':         [11.0667, -12.3924],
  'Labé':         [11.3200, -12.2900],
  'Lélouma':      [11.3500, -12.5500],
  'Tougué':       [11.4500, -11.6700],
  'Mali':         [12.0800, -12.2900],
  'Kankan':       [10.3800, -9.3030],
  'Kouroussa':    [10.6500, -9.8830],
  'Mandiana':     [10.6170, -8.7000],
  'Siguiri':      [11.4170, -9.1670],
  'Kissidougou':  [9.1864, -10.1094],
  'Guékédou':     [8.5667, -10.1333],
  'Faranah':      [10.0374, -10.7474],
  'Dabola':       [10.7500, -11.1167],
  'Dinguiraye':   [11.3000, -10.7167],
  'Nzérékoré':    [7.7490, -8.8190],
  'Lola':         [7.8000, -8.5333],
  'Macenta':      [8.5430, -9.4681],
  'Yomou':        [7.5666, -9.2569],
  'Beyla':        [8.6896, -8.6451],
  'Boké':         [10.9358, -14.2960],
  'Fria':         [10.3700, -13.5700],
  'Gaoual':       [11.7500, -13.2000],
  'Koundara':     [12.4835, -13.3028],
  'Boffa':        [10.1820, -14.0384],
  // Régions
  'Boké (Région)':       [10.9358, -14.2960],
  'Kindia (Région)':     [10.0549, -12.8663],
  'Mamou (Région)':      [10.3764, -12.0972],
  'Labé (Région)':       [11.3200, -12.2900],
  'Kankan (Région)':     [10.3800, -9.3030],
  'Faranah (Région)':    [10.0374, -10.7474],
  'Nzérékoré (Région)':  [7.7490, -8.8190],
  'Conakry (Région)':    [9.5370, -13.6773],
};

// ── Type de livraison ──────────────────────────────────────
export interface DeliveryTypeConfig {
  key:    string;
  em:     string;
  label:  string;
  sub:    string;
  niveau: 'pays' | 'region' | 'prefecture' | 'commune' | 'quartier';
}
/** Traduit via `livreurLayout.deliveryTypes.<key>.*` — voir
 *  locales/{fr,en}/livreur/layout.json. Appelé avec le `t` du composant
 *  consommateur (ZonePage.tsx, params/SecZone.tsx), même raisonnement que
 *  buildPageMeta()/buildSpeedLabel() dans livreurData.ts. */
export function buildDeliveryTypes(t: (key: string) => string): DeliveryTypeConfig[] {
  return [
    { key: 'entre_pays',        em: '🌍', label: t('livreurLayout.deliveryTypes.entre_pays.label'),        sub: t('livreurLayout.deliveryTypes.entre_pays.sub'),        niveau: 'pays'       },
    { key: 'entre_regions',     em: '🗺️', label: t('livreurLayout.deliveryTypes.entre_regions.label'),     sub: t('livreurLayout.deliveryTypes.entre_regions.sub'),     niveau: 'region'     },
    { key: 'entre_prefectures', em: '🏛️', label: t('livreurLayout.deliveryTypes.entre_prefectures.label'), sub: t('livreurLayout.deliveryTypes.entre_prefectures.sub'), niveau: 'prefecture' },
    { key: 'entre_villes',      em: '🏙️', label: t('livreurLayout.deliveryTypes.entre_villes.label'),      sub: t('livreurLayout.deliveryTypes.entre_villes.sub'),      niveau: 'prefecture' },
    { key: 'entre_communes',    em: '🏘️', label: t('livreurLayout.deliveryTypes.entre_communes.label'),    sub: t('livreurLayout.deliveryTypes.entre_communes.sub'),    niveau: 'commune'    },
    { key: 'entre_quartiers',   em: '📍', label: t('livreurLayout.deliveryTypes.entre_quartiers.label'),   sub: t('livreurLayout.deliveryTypes.entre_quartiers.sub'),   niveau: 'quartier'   },
  ];
}

/** Traduit via `livreurSecZone.jours.<key>` — voir locales/{fr,en}/livreur/secZone.json. */
export function buildJours(t: (key: string) => string): string[] {
  return [
    t('livreurSecZone.jours.lun'), t('livreurSecZone.jours.mar'), t('livreurSecZone.jours.mer'),
    t('livreurSecZone.jours.jeu'), t('livreurSecZone.jours.ven'), t('livreurSecZone.jours.sam'),
    t('livreurSecZone.jours.dim'),
  ];
}

// ── Véhicule ───────────────────────────────────────────────
// VEHICLE_TYPES et COLIS_TYPES traduits — voir buildVehicleTypes()/
// buildColisTypes() dans params/SecVehicule.tsx (seul consommateur).
export const EMOJIS = ['🛵','🚴','🚗','🛺','🏍️','📦','⚡','🌟'];

// VIREMENT_FREQ traduit — voir buildVirementFreq() dans params/SecPaiement.tsx
// (seul consommateur). Méthodes de paiement réelles : Company.methodesRetrait
// (voir SecPaiement.tsx), plus de liste mock.

// ── Sécurité ───────────────────────────────────────────────
// Session réellement active : data.currentSession (voir SecSecurite.tsx
// et ProfilLivreurService.attachCurrentSession côté backend).

// ── Documents ──────────────────────────────────────────────
// Statut réel : data.documentCni/documentPermis/documentAssurance/
// documentCasier (voir SecDocuments.tsx), plus de liste mock.

// ── Notifications ──────────────────────────────────────────
// NOTIFS_MISSIONS/NOTIFS_FINANCES/NOTIFS_CANAUX traduites — voir
// buildNotifsMissions()/buildNotifsFinances()/buildNotifsCanaux() dans
// params/SecNotifications.tsx (seul consommateur).

// ── Confidentialité ────────────────────────────────────────
// PRIVACY_ITEMS traduite — voir buildPrivacyItems() dans
// params/SecConfidentialite.tsx (seul consommateur).

// ── Disponibilité auto ─────────────────────────────────────
/** Traduit via `livreurSecZone.autoDispo.<key>.*` — voir locales/{fr,en}/livreur/secZone.json. */
export function buildAutoDispo(t: (key: string) => string) {
  return [
    { l: t('livreurSecZone.autoDispo.pauseAuto.l'),    sub: t('livreurSecZone.autoDispo.pauseAuto.sub'),    on:true,  badge:'rec' },
    { l: t('livreurSecZone.autoDispo.modeNuit.l'),     sub: t('livreurSecZone.autoDispo.modeNuit.sub'),     on:false, badge:'new' },
    { l: t('livreurSecZone.autoDispo.repriseAuto.l'),  sub: t('livreurSecZone.autoDispo.repriseAuto.sub'),  on:true,  badge:'rec' },
    { l: t('livreurSecZone.autoDispo.pauseWeekend.l'), sub: t('livreurSecZone.autoDispo.pauseWeekend.sub'), on:false, badge:''    },
  ];
}

// ── Danger ─────────────────────────────────────────────────
// Textes réels et traduits directement dans SecDanger.tsx — plus de
// liste mock ici (seul consommateur, déjà branché sur l'API).

// ── Utilitaires ────────────────────────────────────────────
export const fmtGNF = (n: number) => n.toLocaleString('fr') + ' GNF';