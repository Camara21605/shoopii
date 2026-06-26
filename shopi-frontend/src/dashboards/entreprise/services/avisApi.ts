import { apiFetch } from '../../../shared/services/apiFetch';

export interface AvisApi {
  id:               string;
  clientNom:        string;
  clientInitiales?: string;
  clientAvatar?:    string | null;
  produitNom:       string;
  note:             number;
  commentaire:      string;
  date:             string;
  reponse?:         string | null;
  commandeId?:      string;
}

export interface AvisStatsApi {
  moyenne:      number;
  total:        number;
  distribution: Record<string, number>; /* { '5': 72, '4': 18, ... } */
  tauxReponse?: number;
}

export interface AvisResponse {
  avis:  AvisApi[];
  stats: AvisStatsApi;
}

export async function fetchEntrepriseAvis(): Promise<AvisResponse> {
  const raw = await apiFetch<any>('/dashboard/entreprise/avis');

  /* Le backend peut renvoyer { avis, stats } OU un tableau direct */
  if (Array.isArray(raw)) {
    const avis: AvisApi[] = raw;
    const total  = avis.length;
    const moyenne = total > 0 ? avis.reduce((s, a) => s + (a.note ?? 0), 0) / total : 0;
    const dist: Record<string, number> = { '5':0, '4':0, '3':0, '2':0, '1':0 };
    avis.forEach(a => { const k = String(Math.round(a.note)); if (k in dist) dist[k]++; });
    const pct: Record<string, number> = {};
    Object.entries(dist).forEach(([k, v]) => { pct[k] = total > 0 ? Math.round(v / total * 100) : 0; });
    return { avis, stats: { moyenne, total, distribution: pct } };
  }

  return {
    avis:  raw?.avis  ?? raw?.reviews ?? raw?.data ?? [],
    stats: raw?.stats ?? raw?.statistiques ?? {
      moyenne:      raw?.moyenneNote ?? raw?.averageRating ?? 0,
      total:        raw?.totalAvis   ?? raw?.total         ?? 0,
      distribution: raw?.distribution ?? {},
    },
  };
}

export async function repondreAvis(avisId: string, reponse: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/dashboard/entreprise/avis/${avisId}/reponse`, {
    method: 'POST',
    body:   { reponse },
  });
}
