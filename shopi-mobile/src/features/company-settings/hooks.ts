/**
 * Hooks des paramètres de la boutique :
 *   · useSettings()        données de toutes les sections (cache qk.company.settings) ;
 *   · useSettingsAccess()  même règle que le site — voir les paramètres exige
 *                          settings.view (ou propriétaire), les modifier settings.edit ;
 *   · useSectionSave()     enregistre une section : une requête à la fois, dans
 *                          l'ordre des touches ; seule la DERNIÈRE réponse est
 *                          fusionnée (plus de « je coche, ça se décoche ») ; en cas
 *                          d'échec, les vraies valeurs du serveur sont relues.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { usePermissions } from '@/features/company/hooks';
import { qk } from '@/lib/query-keys';

import { fetchSettings, patchSection, type Settings } from './api';

export function useSettings() {
  return useQuery({ queryKey: qk.company.settings, queryFn: fetchSettings, staleTime: 60_000 });
}

export function useSettingsAccess() {
  const perms = usePermissions();
  return {
    canView: perms.isOwner || perms.can('settings', 'view'),
    canEdit: perms.isOwner || perms.can('settings', 'edit'),
    isOwner: perms.isOwner,
    loading: perms.loading,
  };
}

/** Fusionne une portion de paramètres dans le cache (et rafraîchit l'en-tête entreprise). */
export function useMergeSettings() {
  const qc = useQueryClient();
  return useCallback(
    (patch: Partial<Settings> | Record<string, unknown>) => {
      qc.setQueryData<Settings>(qk.company.settings, (prev) => (prev ? ({ ...prev, ...patch } as Settings) : prev));
      if ('companyName' in patch || 'logo' in patch || 'status' in patch) void qc.invalidateQueries({ queryKey: qk.company.identity });
    },
    [qc],
  );
}

export function useSectionSave() {
  const qc = useQueryClient();
  const merge = useMergeSettings();
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const seq = useRef(0);

  /**
   * @param optimistic valeurs affichées tout de suite (interrupteurs).
   * @returns la réponse du serveur ; l'erreur est relancée pour le message.
   */
  return useCallback(
    (path: string, body: Record<string, unknown>, optimistic?: Partial<Settings>) => {
      if (optimistic) merge(optimistic);
      const mine = ++seq.current;
      const job = chain.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const res = await patchSection(path, body);
            if (mine === seq.current && res && typeof res === 'object' && !Array.isArray(res)) merge(res);
            return res;
          } catch (e) {
            if (mine === seq.current) void qc.invalidateQueries({ queryKey: qk.company.settings });
            throw e;
          }
        });
      chain.current = job;
      return job;
    },
    [merge, qc],
  );
}
