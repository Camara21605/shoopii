/* ================================================================
 * FICHIER : src/modules/home/components/profil-client/hooks/useProfilClient.ts
 *
 * RÔLE : Source UNIQUE de données de la page profil client.
 *
 * STRATÉGIE HYBRIDE (transition mock → API) :
 *   ✅ DYNAMIQUE (API) :
 *      - identité, KPI, points, paiement, infos, activité  (/client/profil)
 *      - ABONNEMENTS : boutiques + livreurs + correspondants
 *                      (/suivis/mes-abonnements)
 *   🟡 MOCK pour l'instant (pas encore d'endpoint dédié) :
 *      commandes, favoris, avis + score
 *
 * Les deux appels API tournent EN PARALLÈLE (Promise.all).
 * Les composants d'affichage ne changent jamais (tout en props).
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchMonProfil, fetchMesAbonnements, fetchMesCommandes,
} from '../services/profilClient.api';
import type {
  ClientProfilApi, MesAbonnementsApi, CommandeClientApi,
} from '../services/profilClient.api';
import { fetchMesFavoris } from '../../../services/favoris.api';
import type { FavoriApi } from '../../../services/favoris.api';
import { apiFetch } from '../../../services/apiFetch';
import type {
  ClientProfil, ClientKpi, PayMethod, InfoRow,
  Commande, Abonnement, Favori, Avis, AvisScore,
  ActiviteJour, ActiviteItem,
} from '../data/profilClientData';

const AVIS_VIDE: AvisScore = {
  moyenne: 0,
  total: 0,
  repartition: [5,4,3,2,1].map(e => ({ etoiles: e, count: 0, pct: 0 })),
};

/* Helper format GNF compact (42 000 000 → "42 M") */
function compactGnf(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)} M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)} K`;
  return String(n);
}

/* Mapping activityLog (API) → ActiviteJour[] (affichage) */
function mapActivityLog(log: any[]): ActiviteJour[] {
  if (!Array.isArray(log) || log.length === 0) return [];
  const STYLE: Record<string, { icone: string; couleur: ActiviteItem['couleur'] }> = {
    order:    { icone: 'fa-box',              couleur: 'bl' },
    commande: { icone: 'fa-box',              couleur: 'bl' },
    follow:   { icone: 'fa-user-plus',        couleur: 'gr' },
    payment:  { icone: 'fa-credit-card',      couleur: 're' },
    paiement: { icone: 'fa-credit-card',      couleur: 're' },
    review:   { icone: 'fa-star',             couleur: 'ye' },
    avis:     { icone: 'fa-star',             couleur: 'ye' },
    login:    { icone: 'fa-right-to-bracket', couleur: 'pu' },
    connexion:{ icone: 'fa-right-to-bracket', couleur: 'pu' },
    points:   { icone: 'fa-gift',             couleur: 'gr' },
    wallet:   { icone: 'fa-wallet',           couleur: 'tl' },
  };
  const items: ActiviteItem[] = log.map((e: any, i: number) => {
    const style = STYLE[e.type] ?? { icone: 'fa-circle-info', couleur: 'bl' as const };
    return {
      id:      e.id ?? String(i),
      icone:   style.icone,
      couleur: style.couleur,
      titre:   e.title ?? e.titre ?? 'Activité',
      detail:  Array.isArray(e.meta) ? e.meta.join(' · ') : (e.detail ?? ''),
      heure:   e.time ?? e.heure ?? '',
    };
  });
  return [{ jour: 'Activité récente', items }];
}

/* Récupère l'image du produit via la recherche publique (résultat mis en cache) */
const _imgCache: Record<string, string | null> = {};
async function fetchProductImage(nom: string): Promise<string | null> {
  if (nom in _imgCache) return _imgCache[nom];
  try {
    const res = await apiFetch<{ data: { images: { url: string; ordre: number }[] }[] }>(
      '/public/produits',
      { public: true, params: { q: nom, limit: 1 } },
    );
    const img = res?.data?.[0]?.images?.sort((a, b) => a.ordre - b.ordre)[0]?.url ?? null;
    _imgCache[nom] = img;
    return img;
  } catch {
    _imgCache[nom] = null;
    return null;
  }
}

/* Enrichit chaque commande avec l'image de son produit (en arrière-plan) */
async function enrichImages(orders: Commande[]): Promise<Commande[]> {
  const results = await Promise.allSettled(
    orders.map(async o => {
      const url = await fetchProductImage(o.produit);
      return url ? { ...o, imageUrl: url } : o;
    })
  );
  return results.map((r, i) => (r.status === 'fulfilled' ? r.value : orders[i]));
}

/* Mapping statut → statut affichage
 * Statuts entité : pending|paid|in_progress|awaiting_client|delivered|auto_delivered|cancelled|refunded|disputed
 * Statuts abrégés enterprise : new|prep|ship|del|can */
function mapStatut(s: string): Commande['statut'] {
  switch ((s ?? '').toLowerCase()) {
    case 'delivered':
    case 'auto_delivered':
    case 'del':
    case 'livre':        return 'livre';

    case 'in_progress':
    case 'awaiting_client':
    case 'paid':
    case 'ship':
    case 'transit':      return 'transit';

    case 'cancelled':
    case 'canceled':
    case 'refunded':
    case 'disputed':
    case 'can':
    case 'annule':       return 'annule';

    default:             return 'preparation'; /* pending, new, prep... */
  }
}

/* Mapping commandes API → Commande[]
 *
 * Le backend renvoie soit le format abrégé (enterprise Order):
 *   { id: "CMD-...", uuid, em, nm, vt, price, status, date, livreur, zone }
 * Soit le format complet (commande entity):
 *   { id: UUID, numero: "CMD-...", total, items:[{nomProduit, imageProduit}], status, createdAt, ... }
 */
function mapCommandes(list: CommandeClientApi[]): Commande[] {
  return list.map(c => {
    const raw = c as any;

    /* Détecter le format : abrégé (champ em/nm) ou complet (champ items) */
    const isComplet = Array.isArray(raw.items) && raw.items.length > 0;

    /* Référence affichée */
    const reference = raw.numero ?? (typeof raw.id === 'string' && raw.id.startsWith('CMD') ? raw.id : null) ?? raw.id;
    /* UUID pour navigation */
    const uuid = raw.uuid ?? (typeof raw.id === 'string' && !raw.id.startsWith('CMD') ? raw.id : undefined);

    /* Image et nom du produit */
    let imageUrl: string | undefined;
    let produit = '—';

    if (isComplet) {
      const firstItem = raw.items[0];
      imageUrl = firstItem?.imageProduit ?? undefined;
      produit  = firstItem?.nomProduit ?? 'Commande';
      if (raw.items.length > 1) produit += ` +${raw.items.length - 1}`;
    } else {
      produit  = raw.nm ?? raw.nomProduit ?? 'Commande';
      imageUrl = undefined; /* sera enrichi après par fetchProductImage */
    }

    /* Boutique */
    const boutique   = raw.vt ?? raw.company?.companyName ?? raw.boutique ?? '—';
    const boutiqueId = raw.company?.id ?? undefined;

    /* Montant */
    const montant = raw.total ?? raw.price ?? raw.sousTotal ?? 0;

    /* Date */
    const dateBrut = raw.createdAt ?? raw.date ?? '';
    const date = dateBrut
      ? (dateBrut.includes('-') && dateBrut.length > 10
          ? new Date(dateBrut).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' })
          : dateBrut)
      : '—';

    /* Livreur */
    const livreurNom = typeof raw.livreur === 'string' && raw.livreur
      ? raw.livreur
      : raw.livreur?.fullName || undefined;

    /* Correspondant */
    const hasCorrespondant = !!(raw.correspondant?.id ?? raw.correspondantId);

    return {
      id:           reference ?? '—',
      uuid,
      emoji:        raw.em ?? '📦',
      imageUrl,
      produit,
      boutique,
      boutiqueId,
      date,
      livreur:      livreurNom,
      correspondant: hasCorrespondant,
      montant,
      statut:       mapStatut(raw.status ?? 'prep'),
    };
  });
}

/* Mapping favoris API → type d'affichage Favori[] */
function mapFavoris(api: FavoriApi[]): Favori[] {
  return api.map(f => ({
    id:         f.productId,
    emoji:      f.emoji,
    nom:        f.nom,
    prix:       f.prix,
    prixAncien: f.prixAncien != null ? compactGnf(f.prixAncien) : undefined,
    imageUrl:   f.imageUrl,
  }));
}

/* Mapping abonnements API → type d'affichage Abonnement[] */
function mapAbonnements(api: MesAbonnementsApi | null): Abonnement[] {
  if (!api) return [];
  const toAbo = (type: Abonnement['type']) => (a: any): Abonnement => ({
    id:          a.id,
    emoji:       a.emoji    ?? '🏪',
    nom:         a.nom      ?? a.companyName ?? a.fullName ?? '—',
    categorie:   a.categorie ?? a.domaine ?? a.zone ?? '—',
    abonnes:     typeof a.abonnes === 'number'
                   ? (a.abonnes >= 1000 ? `${(a.abonnes / 1000).toFixed(1)} k` : String(a.abonnes))
                   : (a.abonnes ?? '—'),
    note:        a.note != null ? Number(a.note).toFixed(1) : '—',
    type,                          /* injecté depuis le tableau parent */
    suivi:       a.suivi ?? true,
    international: a.international ?? false,
  });
  return [
    ...(api.boutiques      ?? []).map(toAbo('boutiques')),
    ...(api.livreurs       ?? []).map(toAbo('livreurs')),
    ...(api.correspondants ?? []).map(toAbo('correspondants')),
  ];
}

interface PointsLite { solde: number; gagnesMois: number; utilises: number; expiration: string | null; }
interface WalletLite { solde: number; }

interface UseProfilClientReturn {
  profile: ClientProfil | null;
  kpis:    ClientKpi[];
  pays:    PayMethod[];
  infos:   InfoRow[];
  points:  PointsLite;
  wallet:  WalletLite;
  commandes:   Commande[];
  abonnements: Abonnement[];
  favoris:     Favori[];
  avis:        Avis[];
  avisScore:   AvisScore;
  activites:   ActiviteJour[];
  loading: boolean;
  error:   string | null;
  reload:  () => void;
}

export function useProfilClient(): UseProfilClientReturn {
  const [api,       setApi]       = useState<ClientProfilApi | null>(null);
  const [abos,      setAbos]      = useState<MesAbonnementsApi | null>(null);
  const [favoris,   setFavoris]   = useState<Favori[]>([]);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  /* ── Chargement des commandes + enrichissement images ── */
  const loadCommandes = useCallback(async () => {
    try {
      const raw = await fetchMesCommandes() as any;

      const list: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)      ? raw.data
        : Array.isArray(raw?.items)     ? raw.items
        : Array.isArray(raw?.commandes) ? raw.commandes
        : [];

      /* Affichage immédiat avec les données de base (emojis) */
      const base = mapCommandes(list);
      setCommandes(base);

      /* Enrichissement en arrière-plan : vraies images des produits */
      if (base.length > 0) {
        enrichImages(base).then(enriched => setCommandes(enriched));
      }
    } catch (err: any) {
      console.error('[commandes] erreur:', err?.message ?? err);
    }
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchMonProfil(),
      fetchMesAbonnements(),
      fetchMesFavoris().catch(() => [] as import('../../../services/favoris.api').FavoriApi[]),
    ])
      .then(([profilData, abosData, favorisData]) => {
        setApi(profilData);
        setAbos(abosData);
        setFavoris(mapFavoris(favorisData));
      })
      .catch(e => setError(e?.message ?? 'Impossible de charger le profil'))
      .finally(() => setLoading(false));

    /* commandes en parallèle, indépendant */
    loadCommandes();
  }, [loadCommandes]);

  useEffect(() => { load(); }, [load]);

  /* ════════ Adaptation API → affichage ════════ */

  const profile: ClientProfil | null = api ? {
    initiales:      api.initiales,
    nomComplet:     api.nomComplet,
    localisation:   api.localisation,
    membreDepuis:   api.membreDepuis,
    enLigne:        api.enLigne,
    profilePicture: api.profilePicture ?? null,
    badges: [
      ...(api.emailVerifie        ? [{ label: 'Vérifié',      type: 'verif'  as const }] : []),
      ...(api.shopiPoints >= 2000 ? [{ label: 'VIP Gold',     type: 'vip'    as const }] : []),
      ...(api.twoFaEnabled        ? [{ label: '2FA actif',    type: 'fa'     as const }] : []),
      ...(api.totalOrders >= 40   ? [{ label: 'Top Acheteur', type: 'top'    as const }] : []),
      { label: 'Client fidèle', type: 'fidele' as const },
    ],
  } : null;

  /* Nombre total d'abonnements (pour le KPI) */
  const nbAbos = abos
    ? abos.boutiques.length + abos.livreurs.length + abos.correspondants.length
    : 0;

  /* Compte réel des commandes : liste chargée en priorité, sinon valeur API */
  const nbCommandes = commandes.length > 0 ? commandes.length : (api?.totalOrders ?? 0);

  const kpis: ClientKpi[] = api ? [
    { valeur: String(nbCommandes),        label: 'Commandes'    },
    { valeur: String(nbAbos),             label: 'Abonnements'  },  /* ✅ réel */
    { valeur: String(api.totalFavorites), label: 'Favoris'      },
    { valeur: api.shopiPoints.toLocaleString('fr-FR'), label: 'Pts Shopi', tag: 'y' },
    { valeur: '—',                        label: 'Note'         },
    { valeur: compactGnf(api.totalSpent), label: 'Dépensé GNF'  },
    { valeur: compactGnf(api.walletSolde),label: 'Wallet GNF'   },
    { valeur: '—',                        label: 'Avis publiés' },
  ] : [];

  const pays: PayMethod[] = api?.paymentMethods?.map((m: any, i: number) => ({
    id:     m.id ?? String(i),
    emoji:  m.emoji ?? '💳',
    nom:    m.nom ?? m.type ?? 'Moyen de paiement',
    detail: m.detail ?? m.numero ?? '',
    tag:    m.isDefault ? 'Défaut' : (m.tag ?? 'Secondaire'),
    defaut: !!m.isDefault,
  })) ?? [];

  const infos: InfoRow[] = api ? [
    { icone: 'fa-envelope',     label: 'Email',             valeur: api.email,                       verifie: api.emailVerifie },
    { icone: 'fa-phone',        label: 'Téléphone',         valeur: api.telephone ?? 'Non renseigné' },
    { icone: 'fa-cake-candles', label: 'Date de naissance', valeur: api.dateNaissance ?? 'Non renseignée' },
    { icone: 'fa-venus-mars',   label: 'Genre',             valeur: api.genre ?? 'Non précisé'       },
    { icone: 'fa-language',     label: 'Langue',            valeur: api.langue                       },
    { icone: 'fa-pen',          label: 'Bio',               valeur: api.bio ?? 'Aucune bio'          },
  ] : [];

  const points: PointsLite = {
    solde:      api?.shopiPoints      ?? 0,
    gagnesMois: api?.pointsGagnesMois ?? 0,
    utilises:   api?.pointsUtilises   ?? 0,
    expiration: api?.pointsExpiration ?? null,
  };

  const wallet: WalletLite = { solde: api?.walletSolde ?? 0 };

  /* ── Datasets des onglets ── */
  const activites:   ActiviteJour[] = api ? mapActivityLog(api.activityLog) : [];
  const abonnements: Abonnement[]   = mapAbonnements(abos);   /* ✅ API réelle */

  return {
    profile, kpis, pays, infos, points, wallet,
    commandes,                 // ✅ API réelle (/client/commandes)
    abonnements,               // ✅ API réelle (/suivis/mes-abonnements)
    favoris,                   // ✅ API réelle (/client/favoris)
    avis:        [],            /* endpoint /client/avis non encore implémenté backend */
    avisScore:   AVIS_VIDE,    /* idem — pas de table avis en base pour l'instant */
    activites,                 // ✅ API réelle
    loading, error, reload: load,
  };
}