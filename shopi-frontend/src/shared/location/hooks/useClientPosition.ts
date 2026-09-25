/* ================================================================
 * FICHIER : src/shared/location/hooks/useClientPosition.ts
 *
 * Position du CLIENT connecté, partagée par toute l'application (une seule
 * résolution, quel que soit le nombre de cartes affichées) :
 *   1. GPS du navigateur — seulement si l'autorisation est DÉJÀ accordée
 *      (aucune fenêtre de permission ne s'ouvre à l'improviste) ;
 *   2. à défaut, l'adresse par défaut enregistrée dans son profil.
 * Le GPS l'emporte dès qu'il répond. Mémorisée pour la session.
 * `publishClientPosition` permet à la carte de partager la position qu'elle vient d'obtenir.
 * ================================================================ */

import { useSyncExternalStore } from 'react';
import { apiFetch } from '../../services/apiFetch';
import { getRoleFromToken } from '../../services/authUtils';

export interface ClientPosition { lat: number; lng: number; source: 'gps' | 'adresse' }

const STORAGE_KEY = 'shoneya.client.pos';
const listeners = new Set<() => void>();
let current: ClientPosition | null = readStored();
let started = false;
/** Réglage Paramètres → Confidentialité → « localisation » : désactivé = aucune distance calculée. */
let allowed = true;

function readStored(): ClientPosition | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const p = raw ? JSON.parse(raw) as ClientPosition : null;
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lng) ? p : null;
  } catch { return null; }
}

function set(p: ClientPosition): void {
  /* Ne notifie que si la position a réellement changé (≈ 100 m) — évite des recalculs inutiles */
  if (current && current.source === p.source
      && Math.abs(current.lat - p.lat) < 0.001 && Math.abs(current.lng - p.lng) < 0.001) return;
  current = p;
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* stockage indisponible */ }
  listeners.forEach(l => l());
}

export function publishClientPosition(lat: number, lng: number): void {
  if (Number.isFinite(lat) && Number.isFinite(lng)) set({ lat, lng, source: 'gps' });
}

async function bootstrap(): Promise<void> {
  if (started || getRoleFromToken() !== 'client') return;
  started = true;

  window.addEventListener('privacy-updated', e => {
    allowed = (e as CustomEvent<{ localisation?: boolean }>).detail?.localisation !== false;
    listeners.forEach(l => l());
  });
  void apiFetch<{ privacySettings?: { localisation?: boolean } }>('/client/parametres/privacy')
    .then(r => { allowed = r.privacySettings?.localisation !== false; listeners.forEach(l => l()); })
    .catch(() => { /* réglage inconnu : on garde le comportement par défaut */ });

  /* Adresse enregistrée : rapide, sert de position tant que le GPS n'a pas répondu */
  void apiFetch<{ latitude?: number | string | null; longitude?: number | string | null } | null>('/location/addresses/default')
    .then(a => {
      const lat = a?.latitude != null ? Number(a.latitude) : NaN;
      const lng = a?.longitude != null ? Number(a.longitude) : NaN;
      if (Number.isFinite(lat) && Number.isFinite(lng) && (!current || current.source !== 'gps')) set({ lat, lng, source: 'adresse' });
    })
    .catch(() => { /* pas d'adresse par défaut : sans conséquence */ });

  /* GPS : uniquement si déjà autorisé */
  try {
    const perm = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    if (perm?.state === 'granted') {
      /* Haute précision : en basse précision, un téléphone répond avec la position des antennes
       * réseau — souvent fausse de plusieurs km, d'où des distances client → boutique erronées. */
      navigator.geolocation.getCurrentPosition(
        p => set({ lat: p.coords.latitude, lng: p.coords.longitude, source: 'gps' }),
        () => { /* GPS indisponible : on garde l'adresse */ },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
      );
    }
  } catch { /* API Permissions absente : on garde l'adresse */ }
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot  = () => (allowed ? current : null);   // le réglage « localisation » fait aussi changer le snapshot → re-rendu

/** Position du client (null : visiteur, autre rôle, ou aucune position connue). */
export function useClientPosition(): ClientPosition | null {
  void bootstrap();
  const pos = useSyncExternalStore(subscribe, snapshot, snapshot);
  return getRoleFromToken() === 'client' && allowed ? pos : null;
}
