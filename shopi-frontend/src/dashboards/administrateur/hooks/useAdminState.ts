/* ================================================================
 * FICHIER : src/dashboards/administrateur/hooks/useAdminState.ts
 *
 * État global du dashboard administrateur (pattern activePage).
 * - activePage + navigate
 * - sidebar mobile (ouverte/fermée)
 * - modale de génération de code (l'admin peut créer des
 *   partenaires : préfixe PAR en plus de ENT/LVR/COR)
 * - modale de sanction (suspension d'un compte)
 * ================================================================ */

import { useState, useCallback, useEffect } from 'react';
import type { AdminPage } from '../data/types';
import { apiFetch } from '../../../shared/services/apiFetch';
import { useNotificationSocket } from '../../../shared/notifications/useNotificationSocket';

export function useAdminState() {
  /* Page active */
  const [activePage, setActivePage] = useState<AdminPage>('overview');

  /* Sidebar mobile : ouverte/fermée */
  const [sbOpen, setSbOpen] = useState(false);

  /* Modale génération de code */
  const [genOpen, setGenOpen] = useState(false);

  /* Modale sanction (suspension d'un compte) */
  const [sanctionTarget, setSanctionTarget] = useState<{ id: string; nom: string } | null>(null);

  /* Permissions de cet admin — modules généraux + géo (inclut
   * _paysAssigne: string | null). Nom historique "geoPerms" conservé
   * (déjà utilisé dans plusieurs fichiers) même si ça couvre maintenant
   * aussi les permissions non-géo. */
  const [geoPerms, setGeoPerms] = useState<Record<string, boolean | string | null>>({});
  /* Distingue "pas encore chargé" de "chargé, tout est false" — sans ça,
   * un effet de garde basé sur geoPerms redirigerait à tort un admin qui
   * A la permission, le temps que le fetch initial se termine. */
  const [permsLoaded, setPermsLoaded] = useState(false);

  const loadPerms = useCallback(() => {
    apiFetch<Record<string, boolean | string | null>>('/dashboard/super-admin/my-permissions')
      .then(data => { if (data) setGeoPerms(data); })
      .catch(() => {/* silencieux — section géo masquée si erreur */})
      .finally(() => setPermsLoaded(true));
  }, []);

  useEffect(() => { loadPerms(); }, [loadPerms]);

  /* Recharge les permissions en temps réel dès que le super-admin en
   * modifie une : setPermission() (admins.service.ts) crée déjà une
   * notification 'admin_permission'/'geo_permission' à chaque
   * changement — sans ce hook, la sidebar/topbar restaient figées sur
   * les permissions chargées au montage jusqu'au prochain rechargement
   * manuel de la page. Écoute passive : useNotificationSocket réutilise
   * le socket singleton déjà ouvert par useNotifications(), donc aucune
   * connexion supplémentaire n'est créée ici. */
  useNotificationSocket({
    onNew: ({ notification }) => {
      if (notification.resourceType === 'admin_permission' || notification.resourceType === 'geo_permission') {
        loadPerms();
      }
    },
  });

  /* Navigation entre pages + fermeture de la sidebar mobile */
  const navigate = useCallback((page: AdminPage) => {
    setActivePage(page);
    setSbOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /* Sanction — ouvre/ferme la modale de suspension.
     PATCH /dashboard/admin/acteurs/:id/suspend { motif } */
  const ouvrirSanction  = useCallback((id: string, nom: string) => setSanctionTarget({ id, nom }), []);
  const fermerSanction  = useCallback(() => setSanctionTarget(null), []);

  return {
    activePage, navigate,
    sbOpen, setSbOpen,
    genOpen, setGenOpen,
    sanctionTarget, ouvrirSanction, fermerSanction,
    geoPerms, permsLoaded,
  };
}
