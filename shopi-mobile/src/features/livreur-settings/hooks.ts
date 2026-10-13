/**
 * Hooks des paramètres du livreur :
 *   · useLivreurSettings()  toutes les données (cache qk.livreur.settings) ;
 *   · useMergeSettings()    fusionne une réponse dans le cache — les PATCH
 *                           zone / véhicule ne renvoient pas la session
 *                           actuelle : un champ absent garde sa valeur ;
 *   · useSectionSave()      enregistrements EN SÉRIE par route (même correctif
 *                           que le site, « je coche, ça se décoche ») : une
 *                           requête à la fois dans l'ordre des touches, seule
 *                           la DERNIÈRE réponse est fusionnée, et un échec de
 *                           la dernière relit les vraies valeurs du serveur.
 * Toute modification rafraîchit aussi l'identité affichée dans l'en-tête et
 * le menu ☰ (qk.livreur.me : nom, photo).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { qk } from '@/lib/query-keys';

import { fetchSettings, patchSection, type Horaire, type LivreurSettings } from './api';

export function useLivreurSettings(enabled = true) {
  return useQuery({
    queryKey: qk.livreur.settings,
    queryFn: fetchSettings,
    staleTime: 60_000,
    enabled,
  });
}

export function useMergeSettings() {
  const qc = useQueryClient();
  return useCallback(
    (patch: Partial<LivreurSettings>) => {
      qc.setQueryData<LivreurSettings>(qk.livreur.settings, (prev) => (prev ? { ...prev, ...patch } : prev));
      if ('fullName' in patch || 'photoUrl' in patch || 'firstName' in patch || 'deliveryEmoji' in patch) {
        void qc.invalidateQueries({ queryKey: qk.livreur.me });
      }
    },
    [qc],
  );
}

/** Champs de la réponse serveur gardés dans le cache (on ignore les relations brutes). */
function pickKnown(res: unknown): Partial<LivreurSettings> {
  if (!res || typeof res !== 'object' || Array.isArray(res)) return {};
  const { horaires: _h, ...rest } = res as Record<string, unknown>;
  return rest as Partial<LivreurSettings>;
}

export function useSectionSave() {
  const qc = useQueryClient();
  const merge = useMergeSettings();
  const chains = useRef<Record<string, Promise<unknown>>>({});
  const seqs = useRef<Record<string, number>>({});

  return useCallback(
    (path: string, body: unknown) => {
      const mine = (seqs.current[path] = (seqs.current[path] ?? 0) + 1);
      const job = (chains.current[path] ?? Promise.resolve())
        .catch(() => undefined)
        .then(async () => {
          try {
            const res = await patchSection(path, body);
            if (mine === seqs.current[path]) {
              /* PATCH …/horaires renvoie la liste des jours, les autres la fiche livreur */
              if (path === 'horaires' && Array.isArray(res)) merge({ horaires: res as Horaire[] });
              else merge(pickKnown(res));
            }
            return res;
          } catch (e) {
            if (mine === seqs.current[path]) void qc.invalidateQueries({ queryKey: qk.livreur.settings });
            throw e;
          }
        });
      chains.current[path] = job;
      return job;
    },
    [merge, qc],
  );
}

/**
 * Réglages à enregistrement immédiat (notifications, confidentialité) : la
 * valeur s'affiche tout de suite, les requêtes partent une à la fois dans
 * l'ordre des touches, seule la DERNIÈRE réponse remplace le cache et un
 * échec de la dernière relit les vraies valeurs du serveur.
 */
export function useInstantSave<T>(queryKey: readonly unknown[]) {
  const qc = useQueryClient();
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const seq = useRef(0);
  return useCallback(
    (optimistic: (prev: T) => T, run: () => Promise<T>) => {
      qc.setQueryData<T>(queryKey, (prev) => (prev === undefined ? prev : optimistic(prev)));
      const mine = ++seq.current;
      const job = chain.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const res = await run();
            if (mine === seq.current) qc.setQueryData<T>(queryKey, res);
            return res;
          } catch (e) {
            if (mine === seq.current) void qc.invalidateQueries({ queryKey });
            throw e;
          }
        });
      chain.current = job;
      return job;
    },
    /* queryKey : constante de qk (référence stable) */
    [qc, queryKey],
  );
}
