/*
 * FICHIER : src/dashboards/livreur/hooks/useLivreurParametres.ts
 *
 * Hook central des paramètres livreur.
 * 1 seul appel GET au montage → distribue les données à toutes les sections.
 * Chaque section dispose de sa propre fonction de sauvegarde.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';

const BASE = '/dashboard/livreur/parametres';

export interface HoraireJour {
  id: string; jour: string;
  ouverture: string | null; fermeture: string | null; actif: boolean;
}

export interface LivreurData {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
  bio: string | null;
  langues: string | null;
  ville: string | null;
  deliveryEmoji: string;
  status: string;
  availability: string;
  verificationStatus: string;
  documentCni: string | null;
  documentPermis: string | null;
  documentAssurance: string | null;
  documentCasier: string | null;
  zone: string | null;
  communesActives: string[] | null;
  distanceMax: number;
  autoDispoSettings: Record<string, boolean> | null;
  horaires: HoraireJour[];
  vitessesActives: Record<string, boolean> | null;
  tarifBase: number;
  tarifParKm: number;
  supplementLourd: number;
  majorationNocturne: number;
  // ✅ CORRIGÉ : VehicleType (pas vehicleType), vehiculePlaque (pas vehiclePlate)
  VehicleType: string;
  vehiculePlaque: string | null;
  vehiculeMarque: string | null;
  vehiculeModele: string | null;
  vehiculeAnnee: number | null;
  vehiculeCouleur: string | null;
  vehiculeCapacite: string;
  colisAcceptes: string[] | null;
  methodesRetrait: Record<string, unknown>[] | null;
  virementFrequence: string;
  virementSeuil: number;
  totalEarnings: number;
  twoFaEnabled: boolean;
  twoFaMethod: string | null;
  notifSettings: Record<string, boolean> | null;
  privacySettings: Record<string, boolean> | null;
  totalDeliveries: number;
  averageRating: number;
}

export function useLivreurParametres() {
  const [data,   setData]   = useState<LivreurData | null>(null);
  const [loading,setLoading]= useState(true);
  const [error,  setError]  = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<LivreurData>(BASE)
      .then(d  => { setData(d); setError(null); })
      .catch(() => setError('Impossible de charger les paramètres.'))
      .finally(() => setLoading(false));
  }, []);

  const patch = useCallback(async (endpoint: string, body: unknown): Promise<void> => {
    setSaving(true);
    try {
      const updated = await apiFetch<LivreurData>(`${BASE}/${endpoint}`, { method:'PATCH', body });
      setData(updated);
    } finally { setSaving(false); }
  }, []);

  const postFile = useCallback(async (endpoint: string, file: File): Promise<unknown> => {
    setSaving(true);
    try {
      const form = new FormData();
      form.append('file', file);
      return await apiFetch(`${BASE}/${endpoint}`, { method:'POST', body: form });
    } finally { setSaving(false); }
  }, []);

  const saveProfil    = useCallback((b: Partial<LivreurData>) => patch('profil', b), [patch]);
  const uploadPhoto   = useCallback(async (file: File) => {
    const res = await postFile('photo', file) as { photoUrl: string };
    setData(prev => prev ? { ...prev, photoUrl: res.photoUrl } : prev);
  }, [postFile]);

  const uploadDocument = useCallback(async (type: string, file: File) => {
    const res = await postFile(`documents/${type}`, file) as { url: string };
    const map: Record<string, keyof LivreurData> = {
      cni:'documentCni', permis:'documentPermis',
      assurance:'documentAssurance', casier:'documentCasier',
    };
    const f = map[type];
    if (f) setData(prev => prev ? { ...prev, [f]: res.url } : prev);
  }, [postFile]);

  const deleteDocument = useCallback(async (type: string) => {
    setSaving(true);
    try {
      await apiFetch(`${BASE}/documents/${type}`, { method:'DELETE' });
      const map: Record<string, keyof LivreurData> = {
        cni:'documentCni', permis:'documentPermis',
        assurance:'documentAssurance', casier:'documentCasier',
      };
      const f = map[type];
      if (f) setData(prev => prev ? { ...prev, [f]: null } : prev);
    } finally { setSaving(false); }
  }, []);

  const saveZones     = useCallback((b: Partial<LivreurData>) => patch('zone', b), [patch]);
  const saveHoraires  = useCallback((h: HoraireJour[]) => patch('horaires', { horaires: h }), [patch]);
  const saveVitesses  = useCallback((b: Partial<LivreurData>) => patch('vitesses', b), [patch]);
  const saveVehicule  = useCallback((b: Partial<LivreurData>) => patch('vehicule', b), [patch]);
  const savePaiement  = useCallback((b: Partial<LivreurData>) => patch('paiement', b), [patch]);
  const savePassword  = useCallback((b: { currentPassword: string; newPassword: string; confirmPassword: string }) => patch('securite/password', b), [patch]);
  const saveTwoFa     = useCallback((b: { twoFaEnabled: boolean; twoFaMethod?: string }) => patch('securite/2fa', b), [patch]);
  const saveNotifs    = useCallback((b: Record<string, boolean>) => patch('notifications', b), [patch]);
  const savePrivacy   = useCallback((b: Record<string, boolean>) => patch('confidentialite', b), [patch]);

  const pauseCompte       = useCallback(async (password: string) => { setSaving(true); try { await apiFetch(`${BASE}/danger/pause`,      { method:'PATCH',  body:{ password } }); } finally { setSaving(false); } }, []);
  const desactiverCompte  = useCallback(async (password: string) => { setSaving(true); try { await apiFetch(`${BASE}/danger/desactiver`, { method:'PATCH',  body:{ password } }); } finally { setSaving(false); } }, []);
  const supprimerCompte   = useCallback(async (password: string) => { setSaving(true); try { await apiFetch(`${BASE}/danger/supprimer`,  { method:'DELETE', body:{ password } }); } finally { setSaving(false); } }, []);

  return {
    data, loading, error, saving,
    saveProfil, uploadPhoto,
    uploadDocument, deleteDocument,
    saveZones, saveHoraires,
    saveVitesses, saveVehicule, savePaiement,
    savePassword, saveTwoFa,
    saveNotifs, savePrivacy,
    pauseCompte, desactiverCompte, supprimerCompte,
  };
}