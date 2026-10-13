/**
 * Hooks des paramètres du correspondant :
 *   · useCorrespondantSettings()  la fiche complète (cache qk.correspondant.settings) ;
 *   · useMergeSettings()          fusionne une réponse dans le cache (un champ absent garde sa valeur)
 *                                 et rafraîchit l'identité de l'en-tête / du menu ☰ (nom, photo) ;
 *   · useSectionSave()            enregistrements EN SÉRIE par route (une requête à la fois, dans
 *                                 l'ordre des touches) : seule la DERNIÈRE réponse est fusionnée, et un
 *                                 échec de la dernière relit les vraies valeurs du serveur.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { qk } from '@/lib/query-keys';

import { fetchSettings, saveSection, settingsSchema, withFlags, type CorrespondantSettings, type Nested } from './api';

export function useCorrespondantSettings() {
  return useQuery({ queryKey: qk.correspondant.settings, queryFn: fetchSettings, staleTime: 60_000 });
}

export function useMergeSettings() {
  const qc = useQueryClient();
  return useCallback(
    (patch: Partial<CorrespondantSettings>) => {
      qc.setQueryData<CorrespondantSettings>(qk.correspondant.settings, (prev) => (prev ? { ...prev, ...patch } : prev));
      /* Nom, photo, type, zones et délai sont aussi affichés ailleurs dans l'espace correspondant */
      void qc.invalidateQueries({ queryKey: qk.correspondant.me });
      void qc.invalidateQueries({ queryKey: qk.correspondant.zone });
    },
    [qc],
  );
}

/** Champs de la réponse serveur gardés dans le cache — validés par le MÊME schéma que le chargement
 *  (le serveur renvoie par ex. la latitude en texte « 9.512340 ») ; la session actuelle n'est pas renvoyée par les PATCH. */
const partialSchema = settingsSchema.partial();
function pickKnown(res: unknown): Partial<CorrespondantSettings> {
  if (!res || typeof res !== 'object' || Array.isArray(res)) return {};
  const { currentSession: _s, horaires: _h, ...rest } = res as Record<string, unknown>;
  const parsed = partialSchema.safeParse(rest);
  return parsed.success ? (parsed.data as Partial<CorrespondantSettings>) : {};
}

export function useSectionSave() {
  const qc = useQueryClient();
  const merge = useMergeSettings();
  const chains = useRef<Record<string, Promise<unknown>>>({});
  const seqs = useRef<Record<string, number>>({});

  return useCallback(
    (path: string, body: unknown, method: 'PATCH' | 'PUT' = 'PATCH') => {
      const mine = (seqs.current[path] = (seqs.current[path] ?? 0) + 1);
      const job = (chains.current[path] ?? Promise.resolve())
        .catch(() => undefined)
        .then(async () => {
          try {
            const res = await saveSection(path, body, method);
            if (mine === seqs.current[path]) {
              /* PUT zone/horaires renvoie la liste des jours, les autres la fiche */
              if (Array.isArray(res)) merge({ horaires: settingsSchema.shape.horaires.parse(res) });
              else merge(pickKnown(res));
            }
            return res;
          } catch (e) {
            if (mine === seqs.current[path]) void qc.invalidateQueries({ queryKey: qk.correspondant.settings });
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
 * Interrupteurs enregistrés immédiatement (notifications, confidentialité) : la
 * valeur s'affiche tout de suite, le JSON complet (clés du site comprises) part
 * en série, et un échec de la dernière requête relit les vraies valeurs.
 */
export function useInstantFlags(path: 'notifications' | 'confidentialite', field: 'notifSettings' | 'privacySettings') {
  const save = useSectionSave();
  const merge = useMergeSettings();
  return useCallback(
    (current: Nested | null | undefined, changes: Record<string, boolean>) => {
      const next = withFlags(current, changes);
      merge({ [field]: next });
      return save(path, { [field]: next });
    },
    [save, merge, path, field],
  );
}
