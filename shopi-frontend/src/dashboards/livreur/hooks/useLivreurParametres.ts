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

export interface CurrentSessionInfo {
  device:         string;
  browser:        string;
  ipAddress:      string | null;
  connectedSince: string;
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
  deliveryType: string | null;
  deliveryTypeSetAt: string | null;
  communesActives: string[] | null;
  zonesDisponibles: string[] | null;
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
  /** Session réellement active (device/navigateur/IP/date) — null si
   *  indisponible. Une seule session peut être active à la fois sur
   *  Shoneya (voir SessionService), voir SecSecurite.tsx. */
  currentSession: CurrentSessionInfo | null;
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

  /* BUG CORRIGÉ — remplaçait tout `data` par la réponse PATCH brute. Les
   * endpoints zone/vehicule/paiement renvoient l'entité Delivery presque
   * complète mais SANS currentSession (attaché uniquement par
   * ProfilLivreurService.getParametres()/updateProfil(), voir plus bas) :
   * après avoir sauvegardé un véhicule par exemple, la session affichée
   * dans Sécurité aurait disparu jusqu'au prochain rechargement complet.
   * Fusionner au lieu de remplacer : un champ absent de la réponse garde
   * sa valeur déjà en mémoire. */
  const patch = useCallback(async (endpoint: string, body: unknown): Promise<void> => {
    setSaving(true);
    try {
      const updated = await apiFetch<LivreurData>(`${BASE}/${endpoint}`, { method:'PATCH', body });
      setData(prev => prev ? { ...prev, ...updated } : updated);
    } finally { setSaving(false); }
  }, []);

  /* BUG CORRIGÉ — plusieurs endpoints ne renvoient PAS un LivreurData
   * complet (juste un blob partiel, ou même un tableau) : saveHoraires
   * (PATCH .../horaires → LivreurHoraire[]), saveNotifs/savePrivacy
   * (→ le blob JSON seul) utilisaient patch() ci-dessus, qui remplaçait
   * ALORS tout `data` par cette réponse partielle — après avoir
   * sauvegardé les horaires par exemple, `data` devenait un TABLEAU :
   * data.fullName, data.photoUrl etc. redevenaient tous undefined sur
   * TOUTE la page jusqu'au prochain rechargement complet. Même correctif
   * que ParametresPage (entreprise) : ranger la réponse dans la bonne
   * clé imbriquée plutôt que remplacer tout `data`. */
  const patchNested = useCallback(async <T,>(
    endpoint: string, body: unknown, dataKey: keyof LivreurData,
  ): Promise<T> => {
    setSaving(true);
    try {
      const updated = await apiFetch<T>(`${BASE}/${endpoint}`, { method:'PATCH', body });
      setData(prev => prev ? { ...prev, [dataKey]: updated } : prev);
      return updated;
    } finally { setSaving(false); }
  }, []);

  /* Endpoints dont la réponse ne concerne AUCUN champ de `data` (juste un
   * message de confirmation) — ne doit jamais toucher `data`. */
  const patchNoData = useCallback(async (endpoint: string, body: unknown): Promise<void> => {
    setSaving(true);
    try {
      await apiFetch(`${BASE}/${endpoint}`, { method:'PATCH', body });
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

  /* SÉCURITÉ (backend) — l'API ne renvoie plus l'URL de ces documents
   * sensibles (CNI, permis, assurance, casier judiciaire) après upload,
   * seulement `{present:true}` : l'UI ne s'est jamais servie que de la
   * présence/absence (SecDocuments.tsx). Valeur locale factice, juste
   * pour marquer le champ comme présent. */
  const uploadDocument = useCallback(async (type: string, file: File) => {
    const res = await postFile(`documents/${type}`, file) as { present: boolean };
    const map: Record<string, keyof LivreurData> = {
      cni:'documentCni', permis:'documentPermis',
      assurance:'documentAssurance', casier:'documentCasier',
    };
    const f = map[type];
    if (f && res.present) setData(prev => prev ? { ...prev, [f]: 'uploaded' } : prev);
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
  const saveHoraires  = useCallback((h: HoraireJour[]) =>
    patchNested<HoraireJour[]>('horaires', { horaires: h }, 'horaires').then(() => {}), [patchNested]);
  /* BUG CORRIGÉ — saveVitesses() (PATCH .../parametres/vitesses) retiré :
   * un livreur ne fixe pas son propre tarif de livraison, voir
   * LivreurParametresPage.tsx / ParamNav.tsx (section "Vitesses &
   * Tarification" supprimée). Le tarif vient désormais de la zone de
   * livraison (GeoZone, gérée par un administrateur). L'endpoint backend
   * reste en place (pas de migration de schéma ici) mais n'est plus
   * appelé par aucune UI. */
  const saveVehicule  = useCallback((b: Partial<LivreurData>) => patch('vehicule', b), [patch]);
  const savePaiement  = useCallback((b: Partial<LivreurData>) => patch('paiement', b), [patch]);
  /* BUG CORRIGÉ — updatePassword() ne renvoie que { message } (aucun
   * champ de `data` n'a changé) : ne doit jamais appeler setData(). */
  const savePassword  = useCallback((b: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    patchNoData('securite/password', b), [patchNoData]);

  /* BUG CORRIGÉ — updateTwoFa() ne renvoie que { twoFaEnabled, message },
   * jamais un LivreurData complet — merge ciblé sur les 2 seuls champs
   * concernés plutôt que de remplacer tout `data`. */
  const saveTwoFa = useCallback(async (b: { twoFaEnabled: boolean; twoFaMethod?: string }): Promise<void> => {
    setSaving(true);
    try {
      const res = await apiFetch<{ twoFaEnabled: boolean; twoFaMethod?: string }>(`${BASE}/securite/2fa`, { method:'PATCH', body:b });
      setData(prev => prev ? { ...prev, twoFaEnabled: res.twoFaEnabled, twoFaMethod: res.twoFaMethod ?? prev.twoFaMethod } : prev);
    } finally { setSaving(false); }
  }, []);

  const saveNotifs    = useCallback((b: Record<string, boolean>) =>
    patchNested<Record<string, boolean>>('notifications', b, 'notifSettings').then(() => {}), [patchNested]);
  const savePrivacy   = useCallback((b: Record<string, boolean>) =>
    patchNested<Record<string, boolean>>('confidentialite', b, 'privacySettings').then(() => {}), [patchNested]);

  const pauseCompte       = useCallback(async (password: string) => { setSaving(true); try { await apiFetch(`${BASE}/danger/pause`,      { method:'PATCH',  body:{ password } }); } finally { setSaving(false); } }, []);
  const desactiverCompte  = useCallback(async (password: string) => { setSaving(true); try { await apiFetch(`${BASE}/danger/desactiver`, { method:'PATCH',  body:{ password } }); } finally { setSaving(false); } }, []);
  const supprimerCompte   = useCallback(async (password: string) => { setSaving(true); try { await apiFetch(`${BASE}/danger/supprimer`,  { method:'DELETE', body:{ password } }); } finally { setSaving(false); } }, []);

  return {
    data, loading, error, saving,
    saveProfil, uploadPhoto,
    uploadDocument, deleteDocument,
    saveZones, saveHoraires,
    saveVehicule, savePaiement,
    savePassword, saveTwoFa,
    saveNotifs, savePrivacy,
    pauseCompte, desactiverCompte, supprimerCompte,
  };
}