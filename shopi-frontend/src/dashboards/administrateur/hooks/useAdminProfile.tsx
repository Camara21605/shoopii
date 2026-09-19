/* ================================================================
 * FICHIER : src/dashboards/administrateur/hooks/useAdminProfile.tsx
 *
 * Profil de l'administrateur connecté, partagé par tout le dashboard :
 * sidebar (carte admin), topbar (pastille), page Paramètres → Profil.
 * Un seul chargement (GET /dashboard/super-admin/my-profil + zone via
 * GET /dashboard/admin/me) ; la page Profil appelle patch() après chaque
 * enregistrement / changement de photo, donc nom et avatar se mettent à
 * jour partout immédiatement, sans rechargement de la page.
 * ================================================================ */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';

export interface AdminProfile {
  firstName:      string;
  lastName:       string;
  fullName:       string;
  email:          string;
  phone:          string;
  zone:           string;
  jobTitle:       string;
  bio:            string;
  status:         string;
  profilePicture: string | null;
  memberSince:    string | null;
}

interface AdminMe { zoneName?: string; communesCount?: number }

interface AdminProfileCtx {
  profile:       AdminProfile | null;
  zoneName:      string;
  communesCount: number;
  /** Fusionne des champs dans le profil affiché (après une sauvegarde réussie). */
  patch:         (partial: Partial<AdminProfile>) => void;
  reload:        () => void;
}

const Ctx = createContext<AdminProfileCtx | null>(null);

export function AdminProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [me,      setMe]      = useState<AdminMe>({});

  const reload = useCallback(() => {
    apiFetch<AdminProfile>('/dashboard/super-admin/my-profil').then(setProfile).catch(() => {});
    apiFetch<AdminMe>('/dashboard/admin/me').then(d => setMe(d ?? {})).catch(() => {});
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const patch = useCallback((partial: Partial<AdminProfile>) => {
    setProfile(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      /* Le nom complet suit prénom + nom dès que l'un des deux change */
      if (partial.firstName !== undefined || partial.lastName !== undefined) {
        next.fullName = `${next.firstName} ${next.lastName}`.trim();
      }
      return next;
    });
  }, []);

  const value = useMemo<AdminProfileCtx>(() => ({
    profile,
    zoneName:      me.zoneName ?? '',
    communesCount: me.communesCount ?? 0,
    patch, reload,
  }), [profile, me, patch, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminProfile(): AdminProfileCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAdminProfile doit être utilisé dans <AdminProfileProvider>.');
  return v;
}

/** Initiales (2 lettres max) d'un profil — "AD" tant que le nom est inconnu. */
export function adminInitials(p: Pick<AdminProfile, 'firstName' | 'lastName' | 'fullName'> | null): string {
  if (!p) return 'AD';
  const f = p.firstName?.trim().charAt(0) ?? '';
  const l = p.lastName?.trim().charAt(0) ?? '';
  const init = `${f}${l}` || p.fullName.trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('');
  return init.toUpperCase() || 'AD';
}
