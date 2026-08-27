/*
 * FICHIER : src/shared/messagerie/hooks/useContactSync.ts
 *
 * RÔLE : Synchroniser les contacts téléphoniques avec les utilisateurs Shoneya.
 *
 * PRIVACY : Les numéros ne quittent JAMAIS l'appareil en clair.
 *   → Hachage SHA-256 via Web Crypto API (natif, aucune dépendance).
 *   → Seuls les hash 64-char hexadécimaux sont envoyés au serveur.
 *
 * RATE LIMITS (serveur) :
 *   - 3 sync complètes / heure
 *   - 10 sync incrémentales / heure
 */

import { useState, useCallback } from 'react';
import { apiFetch } from '../../services/apiFetch';

// ── Types ─────────────────────────────────────────────────────

export interface SyncedContact {
  hash:        string;
  userId:      string;
  displayName: string;
  avatar?:     string | null;
  actorType:   string;
  online:      boolean;
}

export interface DiscoveredContact {
  userId:      string;
  displayName: string;
  avatar?:     string | null;
  actorType:   string;
  online:      boolean;
  score:       number;
}

export interface ContactInput {
  phone:        string;
  displayName?: string;
}

// ── Utilitaires ───────────────────────────────────────────────

async function sha256hex(text: string): Promise<string> {
  const data   = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Normalisation en format E.164 :
 *   "00" préfixe  →  "+" puis chiffres
 *   9 chiffres    →  assume Guinée +224 (marché principal Shoneya)
 *   10+ chiffres  →  "+" puis chiffres
 */
function normalizeE164(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('00'))            return '+' + d.slice(2);
  if (d.length === 9)                return '+224' + d;
  if (d.length >= 10)                return '+' + d;
  return '+' + d;
}

async function hashContacts(
  contacts: ContactInput[],
): Promise<{ hash: string; displayName?: string }[]> {
  return Promise.all(
    contacts.map(async c => ({
      hash:        await sha256hex(normalizeE164(c.phone)),
      displayName: c.displayName,
    })),
  );
}

// ── Hook ──────────────────────────────────────────────────────

export function useContactSync() {
  const [syncing,    setSyncing]    = useState(false);
  const [matched,    setMatched]    = useState<SyncedContact[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveredContact[]>([]);
  const [error,      setError]      = useState<string | null>(null);

  /**
   * Synchronise une liste de contacts fournie manuellement.
   * Retourne le résultat directement (voir syncFromDevice ci-dessous pour
   * pourquoi : lire `error`/`matched` juste après l'await donnerait une
   * valeur figée au rendu précédent, pas la valeur à jour).
   */
  const syncContacts = useCallback(async (
    contacts:    ContactInput[],
    incremental = false,
  ): Promise<{ ok: true; matched: SyncedContact[] } | { ok: false; message: string }> => {
    if (!contacts.length) return { ok: true, matched: [] };
    setSyncing(true);
    setError(null);

    try {
      const hashed = await hashContacts(contacts);

      const res = await apiFetch<{
        matched:    SyncedContact[];
        total:      number;
        newMatches: number;
      }>('/contacts/sync', {
        method: 'POST',
        body:   { contacts: hashed, incremental },
      });

      const list = res?.matched ?? [];

      setMatched(prev =>
        incremental
          /* Incrémental → on garde les anciens non-remplacés */
          ? [...prev.filter(p => !list.some(m => m.hash === p.hash)), ...list]
          : list,
      );

      return { ok: true, matched: list };
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Erreur de synchronisation';
      const message = raw.includes('429') || raw.includes('trop')
        ? 'Limite atteinte — réessayez dans 1 heure'
        : raw;
      setError(message);
      return { ok: false, message };
    } finally {
      setSyncing(false);
    }
  }, []);

  /**
   * Synchronise depuis l'API Contacts du navigateur (mobile uniquement).
   * Demande la permission à l'utilisateur avant tout accès.
   *
   * Retourne directement le résultat (au lieu de forcer l'appelant à relire
   * `error`/`matched` juste après l'await, ce qui lirait une valeur figée
   * au moment du rendu précédent — les setState de ce hook ne sont pas
   * synchrones) : { ok: true, matched } en cas de succès, { ok: false,
   * message } sinon (API indisponible, permission refusée, ou 0 contact
   * sélectionné n'est PAS une erreur ici, juste ok avec matched=[]).
   */
  const syncFromDevice = useCallback(async (): Promise<
    { ok: true; matched: SyncedContact[] } | { ok: false; message: string }
  > => {
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
      const message = 'La sélection de contacts n\'est disponible que sur mobile (Android Chrome / Safari iOS).';
      setError(message);
      return { ok: false, message };
    }

    try {
      const raw: Array<{ name?: string[]; tel?: string[] }> =
        await (navigator as any).contacts.select(['name', 'tel'], { multiple: true });

      const inputs: ContactInput[] = raw.flatMap(c =>
        (c.tel ?? []).map(tel => ({
          phone:       tel,
          displayName: c.name?.[0] ?? undefined,
        })),
      );

      if (inputs.length === 0) return { ok: true, matched: [] };
      return await syncContacts(inputs, true);
    } catch {
      const message = 'Accès aux contacts refusé ou annulé.';
      setError(message);
      return { ok: false, message };
    }
  }, [syncContacts]);

  /** Récupère les suggestions de contacts Shoneya (recommandations). */
  const fetchDiscoveries = useCallback(async (): Promise<void> => {
    try {
      const res = await apiFetch<DiscoveredContact[]>('/contacts/discover');
      if (Array.isArray(res)) setDiscovered(res);
    } catch { /* silencieux */ }
  }, []);

  /** Invalide le cache des recommandations côté serveur. */
  const invalidateDiscoveryCache = useCallback(async (): Promise<void> => {
    try {
      await apiFetch('/contacts/discover/cache', { method: 'DELETE' });
      setDiscovered([]);
    } catch { /* silencieux */ }
  }, []);

  return {
    syncing,
    matched,
    discovered,
    error,
    syncContacts,
    syncFromDevice,
    fetchDiscoveries,
    invalidateDiscoveryCache,
  };
}
