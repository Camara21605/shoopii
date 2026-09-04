/*
 * FICHIER : src/dashboards/entreprise/hooks/useTeamPermissions.ts
 * ROLE    : Hook React pour la vérification des permissions d'équipe côté frontend.
 *
 * USAGE :
 *   const { can, isOwner, loading } = useTeamPermissions();
 *   if (can('products', 'create')) { ... }
 *
 * STRATÉGIE "stale-while-revalidate" :
 *   Les permissions sont persistées dans localStorage (CACHE_KEY).
 *   Au refresh, les données en cache sont utilisées immédiatement —
 *   plus de clignotement. L'API est ensuite appelée en arrière-plan
 *   pour mettre à jour le cache.
 *
 * MISE À JOUR INSTANTANÉE :
 *   Le backend émet 'team:permissions_changed' (socket, room privée de
 *   l'utilisateur) dès que le propriétaire modifie les permissions de ce
 *   collaborateur — ce hook recharge alors immédiatement, sans attendre
 *   le polling ni un refresh de page (voir CompanyTeamPermissionService.
 *   notifyPermissionChange côté backend). Le polling 30s ci-dessous n'est
 *   plus qu'un filet de sécurité (socket manqué, onglet en arrière-plan…).
 *
 * SÉCURITÉ :
 *   - Ce hook sert uniquement à afficher/masquer des éléments UI.
 *   - Le BACKEND reste la source de vérité : chaque API vérifie les permissions
 *     indépendamment de ce hook.
 *   - Si isOwner === true, can() retourne toujours true.
 *   - En cas d'erreur réseau, les permissions en cache sont conservées.
 *   - loading = true UNIQUEMENT s'il n'y a aucune donnée (ni cache ni réseau).
 *
 * AUTEUR  : Shopi03
 * DATE    : 2026-07-19
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';
import { useNotificationSocket } from '../../../shared/notifications/useNotificationSocket';

interface MyPermissionsResponse {
  isOwner:     boolean;
  permissions: Record<string, Record<string, boolean>> | null;
}

interface UseTeamPermissionsReturn {
  /** Vérifie si le user courant a une permission spécifique */
  can:     (group: string, action: string) => boolean;
  /** true si le user est le propriétaire de l'entreprise */
  isOwner: boolean;
  /** true UNIQUEMENT si aucune donnée n'est disponible (ni cache ni réseau) */
  loading: boolean;
  /** Rechargement manuel (après changement de permissions) */
  reload:  () => void;
}

const CACHE_KEY        = 'shopi_team_permissions_v1';
const POLL_INTERVAL_MS = 30_000;

function readCache(): MyPermissionsResponse | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as MyPermissionsResponse) : null;
  } catch {
    return null;
  }
}

function writeCache(data: MyPermissionsResponse): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

export function useTeamPermissions(): UseTeamPermissionsReturn {
  /* Initialisation depuis le cache : données disponibles immédiatement au refresh */
  const [data,       setData]       = useState<MyPermissionsResponse | null>(() => readCache());
  const [fetching,   setFetching]   = useState(true);
  const [tick,       setTick]       = useState(0);
  const dataRef = useRef<MyPermissionsResponse | null>(data);

  useEffect(() => {
    let cancelled = false;
    setFetching(true);

    apiFetch<MyPermissionsResponse>('/company-team/my-permissions')
      .then(res => {
        if (!cancelled) {
          setData(res);
          dataRef.current = res;
          writeCache(res);
        }
      })
      .catch(() => {
        /* En cas d'erreur réseau, on conserve le cache — pas de mise à null */
      })
      .finally(() => { if (!cancelled) setFetching(false); });

    return () => { cancelled = true; };
  }, [tick]);

  /* Polling automatique — filet de sécurité si le socket ci-dessous a raté
     l'event (onglet en arrière-plan, reconnexion en cours…) ; le membre
     voit quand même les changements sans refresh manuel, au pire après
     POLL_INTERVAL_MS. */
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  /* Rechargement INSTANTANÉ — le backend émet 'team:permissions_changed' sur
     la room privée notif:user:{userId} du collaborateur concerné dès que le
     propriétaire modifie ses permissions (voir CompanyTeamPermissionService.
     notifyPermissionChange). Réutilise le socket singleton /notifications
     déjà connecté ailleurs dans l'app — pas de connexion supplémentaire. */
  useNotificationSocket({
    onTeamPermissionsChanged: () => setTick(t => t + 1),
  });

  const can = useCallback(
    (group: string, action: string): boolean => {
      /* Aucune donnée disponible (ni cache ni réseau) → refus safe */
      if (!data) return false;
      /* Le propriétaire a tous les droits */
      if (data.isOwner) return true;
      /* Vérifier la permission spécifique */
      return data.permissions?.[group]?.[action] ?? false;
    },
    [data],
  );

  const reload = useCallback(() => setTick(t => t + 1), []);

  return {
    can,
    isOwner: data?.isOwner ?? false,
    /* loading = true seulement si aucune donnée (première visite sans cache) */
    loading: fetching && !data,
    reload,
  };
}
