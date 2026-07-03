/* ================================================================
 * FICHIER : src/modules/commande/data/types.ts
 *
 * Types partagés de la page commande (chaîne de validation).
 * Utilisés par tous les rôles : entreprise, livreur,
 * correspondant, client.
 * ================================================================ */

/* Les 4 rôles acteurs d'une livraison */
export type ActeurRole = 'entreprise' | 'livreur' | 'correspondant' | 'client';

/* État d'une étape de validation */
export type EtapeStatut = 'wait' | 'now' | 'done';

/* Un acteur de la chaîne de validation */
export interface Acteur {
  role:      ActeurRole;
  nom:       string;
  sousTitre: string;          // ex. "TechCorp Guinée", "Relais Kaloum"
  initiales: string;
  icone:     string;          // classe FontAwesome (ex. "fa-store")
  /* description de l'action attendue de cet acteur */
  action:    string;
  /* heure de validation (remplie quand validé) */
  valideA?:  string;
}

/* Une ligne d'article de la commande */
export interface ArticleCommande {
  emoji:     string;
  /** URL Cloudinary snapshot (null si produit supprimé ou non renseigné) */
  imageUrl?: string | null;
  nom:       string;
  boutique:  string;
  qty:       number;
  prix:      number;           // prix unitaire en GNF
}

/* Détail financier de la commande */
export interface CommandeMontant {
  sousTotal:        number;
  livraison:        number;
  fraisCorrespondant: number;
  total:            number;
}

/* Commission versée à un acteur (après livraison) */
export interface Commission {
  role:    ActeurRole | 'shopi';
  nom:     string;
  libelle: string;
  montant: number;
  icone:   string;
}

/* Note attribuée par le client à un acteur */
export interface Notation {
  role:       ActeurRole;
  note:       number;          // 1 à 5
  commentaire?: string;
}

/* Données complètes d'une commande */
export interface Commande {
  id:           string;        // ex. "SH-4521"
  datePaiement: string;
  destination:  string;
  acteurs:      Acteur[];      // dans l'ordre de la chaîne
  articles:     ArticleCommande[];
  montant:      CommandeMontant;
  commissions:  Commission[];
  /* codes de validation (en prod : jamais tous côté client !) */
  codes:        Record<ActeurRole, string>;
  /* progression de la chaîne — renseignée par le backend (useApi=true) */
  currentStep?: number;
  times?:       (string | undefined)[];
}

/* Types de problème signalable */
export type TypeProbleme = 'endommage' | 'manquant' | 'errone' | 'retard' | 'autre';