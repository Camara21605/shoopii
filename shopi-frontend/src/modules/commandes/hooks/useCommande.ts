/* ================================================================
 * FICHIER : src/modules/commande/hooks/useCommande.ts
 *
 * Hook central de la page commande (chaîne de validation).
 *
 * Gère :
 *  - le chargement de la commande (mock + API prête à brancher)
 *  - le rôle courant (celui qui regarde la page) → currentRole
 *  - l'étape active de la chaîne → currentStep
 *  - la validation d'un code (optimiste, avec rollback si erreur)
 *  - la notation des acteurs + le pourboire
 *  - le signalement d'un litige
 *  - les états dérivés (loading, error, terminé, facture, notation faite)
 *
 * "Page unique qui s'adapte au rôle" :
 *  → tous les acteurs voient toute la chaîne, mais seule la carte
 *    dont role === currentRole ET dont c'est le tour est éditable.
 * ================================================================ */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { COMMANDE_MOCK } from '../data/commandeMock';
import {
  fetchCommande, validerEtape, envoyerNotations, signalerProbleme,
} from '../services/commande.api';
import type {
  Commande, ActeurRole, EtapeStatut, Notation, TypeProbleme,
} from '../data/types';

interface UseCommandeArgs {
  id?:          string;        // id de la commande (useParams)
  currentRole?: ActeurRole;    // rôle de l'utilisateur qui regarde
  useApi?:      boolean;       // true = appels réseau ; false = démo locale
}

export function useCommande({ id, currentRole = 'client', useApi = false }: UseCommandeArgs) {
  const [commande, setCommande] = useState<Commande>(COMMANDE_MOCK);
  const [loading,  setLoading]  = useState(useApi);
  const [error,    setError]    = useState<string | null>(null);

  /* index de l'étape active (0=entreprise … 3=client) */
  const [currentStep, setCurrentStep] = useState(0);
  /* heures de validation par index d'étape */
  const [times, setTimes] = useState<string[]>([]);

  /* notation — chargé depuis sessionStorage si disponible */
  const storageKey = id ? `shopi_notations_${id}` : null;
  const [notations, setNotations] = useState<Record<string, Notation>>(() => {
    if (!storageKey) return {};
    try { return JSON.parse(sessionStorage.getItem(storageKey) ?? '{}'); }
    catch { return {}; }
  });
  const [pourboire, setPourboire] = useState<number | null>(null);
  const [ratingDone, setRatingDone] = useState(
    () => Object.keys(notations).length > 0  /* déjà noté si données en session */
  );

  /* ── Chargement ── */
  useEffect(() => {
    if (!useApi || !id) { setCommande(COMMANDE_MOCK); setLoading(false); return; }
    setLoading(true); setError(null);
    fetchCommande(id)
      .then(c => {
        setCommande(c);
        setCurrentStep(c.currentStep ?? 0);
        setTimes((c.times ?? []).map(t => t ?? ''));
        /* Charger les notations depuis l'API si disponibles (champ optionnel) */
        const apiNotations = (c as any).notations ?? (c as any).ratings ?? null;
        if (apiNotations && typeof apiNotations === 'object') {
          setNotations(prev => {
            const merged = { ...apiNotations, ...prev }; /* session prioritaire */
            if (storageKey) {
              try { sessionStorage.setItem(storageKey, JSON.stringify(merged)); } catch {}
            }
            return merged;
          });
        }
      })
      .catch(e => {
        console.error('[useCommande] échec chargement:', id, e);
        setError(e?.message ?? 'Impossible de charger la commande.');
        /* Pas de fallback mock — on affiche l'erreur réelle */
      })
      .finally(() => setLoading(false));
  }, [id, useApi]);

  /* ── État dérivé : statut de chaque étape ── */
  const statuts: EtapeStatut[] = useMemo(
    () => commande.acteurs.map((_, i) =>
      i < currentStep ? 'done' : i === currentStep ? 'now' : 'wait',
    ),
    [commande.acteurs, currentStep],
  );

  const done       = currentStep >= commande.acteurs.length;
  const progression = Math.round((currentStep / commande.acteurs.length) * 100);

  /* ── Valider une étape avec un code ── */
  const valider = useCallback(async (idx: number, code: string): Promise<boolean> => {
    /* Sécurité : on ne valide que l'étape courante */
    if (idx !== currentStep) return false;

    const role = commande.acteurs[idx].role;
    const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    if (useApi && id) {
      /* Validation côté serveur */
      try {
        const res = await validerEtape(id, role, code);
        if (!res.ok) return false;
        setTimes(t => { const n = [...t]; n[idx] = res.valideA || heure; return n; });
        setCurrentStep(s => s + 1);
        return true;
      } catch { return false; }
    }

    /* Mode démo : on compare au code mock */
    if (code !== commande.codes[role]) return false;
    setTimes(t => { const n = [...t]; n[idx] = heure; return n; });
    setCurrentStep(s => s + 1);
    return true;
  }, [currentStep, commande, id, useApi]);

  /* ── Notation ── */
  const noter = useCallback((role: ActeurRole, note: number, commentaire?: string) => {
    setNotations(prev => {
      const next = { ...prev, [role]: { role, note, commentaire } };
      /* Persiste en session pour survivre aux re-renders */
      if (storageKey) {
        try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      }
      return next;
    });
  }, [storageKey]);

  const envoyerNotes = useCallback(async (): Promise<boolean> => {
    const notes = Object.values(notations);
    if (notes.length === 0) return false;
    setRatingDone(true);
    if (useApi && id) {
      try { await envoyerNotations(id, notes, pourboire ?? undefined); }
      catch { /* on garde l'UI optimiste même si l'envoi échoue */ }
    }
    return true;
  }, [notations, pourboire, id, useApi]);

  /* ── Litige ── */
  const signaler = useCallback(async (type: TypeProbleme, description: string): Promise<boolean> => {
    if (useApi && id) {
      try { await signalerProbleme(id, type, description); return true; }
      catch { return false; }
    }
    return true;   // démo : succès simulé
  }, [id, useApi]);

  return {
    /* données */
    commande, loading, error, currentRole,
    /* chaîne */
    statuts, currentStep, times, done, progression, valider,
    /* notation */
    notations, pourboire, ratingDone, setPourboire, noter, envoyerNotes,
    /* litige */
    signaler,
  };
}