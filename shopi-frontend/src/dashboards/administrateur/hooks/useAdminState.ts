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
import type { AdminPage, ActeurType } from '../data/types';
import { apiFetch } from '../../../shared/services/apiFetch';

const TYPE_PREFIX: Record<ActeurType, string> = {
  par: 'PAR', ent: 'ENT', lvr: 'LVR', cor: 'COR',
};

/* Génère un suffixe aléatoire sans les caractères ambigus 0/O/1/I */
function randCode(len = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function useAdminState() {
  /* Page active */
  const [activePage, setActivePage] = useState<AdminPage>('overview');

  /* Sidebar mobile : ouverte/fermée */
  const [sbOpen, setSbOpen] = useState(false);

  /* Modale génération de code */
  const [genOpen, setGenOpen]   = useState(false);
  const [lastCode, setLastCode] = useState('');

  /* Modale sanction (suspension d'un compte) */
  const [sanctionTarget, setSanctionTarget] = useState<string | null>(null);

  /* Permissions géographiques de cet admin (inclut _paysAssigne: string | null) */
  const [geoPerms, setGeoPerms] = useState<Record<string, boolean | string | null>>({});

  useEffect(() => {
    apiFetch<Record<string, boolean | string | null>>('/dashboard/super-admin/my-permissions')
      .then(data => { if (data) setGeoPerms(data); })
      .catch(() => {/* silencieux — section géo masquée si erreur */});
  }, []);

  /* Navigation entre pages + fermeture de la sidebar mobile */
  const navigate = useCallback((page: AdminPage) => {
    setActivePage(page);
    setSbOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /* Génère un code de création.
     En prod : POST /admin/codes { type, destinataire } → { code } */
  const genererCode = useCallback((type: ActeurType): string => {
    const code = `SHOPI-${TYPE_PREFIX[type]}-${randCode()}`;
    setLastCode(code);
    return code;
  }, []);

  /* Sanction — ouvre/ferme la modale de suspension.
     En prod : POST /admin/acteurs/:id/suspendre { motif } */
  const ouvrirSanction  = useCallback((cible: string) => setSanctionTarget(cible), []);
  const fermerSanction  = useCallback(() => setSanctionTarget(null), []);

  return {
    activePage, navigate,
    sbOpen, setSbOpen,
    genOpen, setGenOpen, lastCode, genererCode,
    sanctionTarget, ouvrirSanction, fermerSanction,
    geoPerms,
  };
}
