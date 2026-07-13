/* ================================================================
 * FICHIER : profil-client/data/profilClientData.ts
 *
 * Types du profil client. Toutes les données viennent de l'API.
 * ================================================================ */

/* ── Identité du client ── */
export interface ClientProfil {
  initiales:      string;
  nomComplet:     string;
  localisation:   string;
  membreDepuis:   string;
  enLigne:        boolean;
  profilePicture: string | null;
  badges:         { label: string; type: 'verif' | 'vip' | 'fa' | 'top' | 'fidele' }[];
}

/* ── KPI affichés sous l'identité ── */
export interface ClientKpi { valeur: string; label: string; sub?: string; tag?: 'g' | 'y'; }

/* ── Portefeuille ── */
export interface WalletData { solde: number; entreesMois: number; sortiesMois: number; }

/* ── Transaction wallet ── */
export interface Transaction {
  id: string; label: string; date: string; montant: number;
  type: 'in' | 'out' | 'pending';      // entrée / sortie / en attente
  icone: string;                        // classe FontAwesome
}

/* ── Points fidélité ── */
export interface PointsData {
  solde: number; gagnesMois: number; utilisesMois: number; valeurEstimee: number;
  enAttente: number; expirationProche: string; expireLe: string;
  niveau: string; prochainNiveau: string; prochainSeuil: number; progressionPct: number;
}

/* ── Méthode de paiement ── */
export interface PayMethod { id: string; emoji: string; nom: string; detail: string; tag: string; defaut: boolean; }

/* ── Infos personnelles (ligne par ligne, avec icône) ── */
export interface InfoRow { icone: string; label: string; valeur: string; verifie?: boolean; }

/* ── Commande ── */
export interface Commande {
  id:        string;   /* référence affichée ex: CMD-2026-00010 */
  uuid?:     string;   /* UUID interne pour GET /commandes/:uuid */
  emoji: string; imageUrl?: string; produit: string; boutique: string;
  boutiqueId?: string; international?: boolean;
  date: string; livreur?: string; correspondant?: boolean; montant: number;
  statut: 'livre' | 'transit' | 'preparation' | 'annule';
}

/* ── Abonnement (avec catégorie pour les sous-onglets) ── */
export interface Abonnement {
  id: string; emoji: string; nom: string; categorie: string; international?: boolean;
  abonnes: string; note: string;
  type: 'boutiques' | 'livreurs' | 'correspondants';
  suivi: boolean;
}

/* ── Produit favori ── */
export interface Favori { id: string; emoji: string; nom: string; prix: number; prixAncien?: string; imageUrl?: string | null; }

/* ── Avis publié ── */
export interface Avis {
  id: string; emoji: string; produit: string; boutique: string; international?: boolean;
  note: number; texte: string; date: string; utile: number;
  statut: 'verifie' | 'attente';
}

/* ── Score global des avis ── */
export interface AvisScore {
  moyenne: number; total: number;
  repartition: { etoiles: number; count: number; pct: number }[];
}

/* ── Activité (groupée par jour) ── */
export interface ActiviteItem {
  id: string; icone: string; couleur: 'bl' | 'gr' | 'ye' | 'pu' | 're' | 'tl';
  titre: string; detail: string; heure: string;
}
export interface ActiviteJour { jour: string; items: ActiviteItem[]; }

