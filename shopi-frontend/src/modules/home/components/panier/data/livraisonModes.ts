/* ============================================================
 * FICHIER : src/modules/home/components/panier/data/livraisonModes.ts
 *
 * RÔLE : À partir des réglages Paramètres > Livraison de CHAQUE boutique du
 * panier (GET /public/boutiques/:id → livraison), dit quels modes le client
 * peut choisir à la commande — mêmes règles que le serveur
 * (commande-creation.service) :
 *   • « Par la boutique » : livraison standard OU retrait (Click & Collect)
 *     proposé par toutes les boutiques ; la livraison standard seule n'est
 *     possible que si la commune du client est dans les zones desservies
 *     (quand la boutique en a choisi).
 *   • « Livreur Shoneya » : toutes les boutiques acceptent les livreurs Shoneya.
 * ============================================================ */

export interface ShopLivraison {
  nom: string;
  livraison: {
    standard: boolean; livreursShopi: boolean; correspondants: boolean;
    clickCollect: boolean; express: boolean; zones: string[];
  };
}

export interface ModeDispo {
  ok: boolean;
  /** Boutiques qui empêchent ce mode (pour l'expliquer au client). */
  bloquees: string[];
}

export interface ModesLivraison {
  std: ModeDispo & {
    /** 'livraison' | 'retrait' | 'les-deux' — libellé adapté à ce que proposent les boutiques */
    genre: 'livraison' | 'retrait' | 'les-deux';
    /** Boutiques qui ne livrent pas la commune saisie (retrait seulement pour le client). */
    horsZone: string[];
  };
  lvr: ModeDispo;
}

/** Nom de commune comparable : minuscules, sans accents ni espaces superflus. */
export const normCommune = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

/** La boutique livre-t-elle elle-même cette commune ? (aucune zone choisie = partout) */
export function livreCommune(l: ShopLivraison['livraison'], commune: string | null): boolean {
  if (!l.standard) return false;
  if (!commune || !l.zones?.length) return true;
  const c = normCommune(commune);
  return l.zones.some(z => normCommune(z) === c);
}

export function resolveModes(shops: ShopLivraison[], commune: string | null): ModesLivraison {
  const stdBloquees: string[] = [];
  const horsZone:    string[] = [];
  let livraison = 0, retrait = 0;

  for (const s of shops) {
    const livre = livreCommune(s.livraison, commune);
    if (!livre && !s.livraison.clickCollect) {
      stdBloquees.push(s.nom);
    } else {
      if (livre) livraison++;
      if (s.livraison.clickCollect) retrait++;
      if (s.livraison.standard && !livre) horsZone.push(s.nom);
    }
  }

  const genre: ModesLivraison['std']['genre'] =
    shops.length === 0 || (livraison === shops.length && retrait === shops.length) ? 'les-deux'
    : livraison === shops.length ? 'livraison'
    : retrait === shops.length ? 'retrait'
    : 'les-deux';

  const lvrBloquees = shops.filter(s => !s.livraison.livreursShopi).map(s => s.nom);

  return {
    std: { ok: stdBloquees.length === 0, bloquees: stdBloquees, genre, horsZone },
    lvr: { ok: lvrBloquees.length === 0, bloquees: lvrBloquees },
  };
}
