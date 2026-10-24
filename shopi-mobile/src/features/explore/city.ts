/**
 * Ville (et commune) choisie dans Explorer — gardée sur le téléphone : on la
 * retrouve à la prochaine ouverture de l'appli. Sans choix, l'écran utilise
 * la ville de l'adresse par défaut.
 */
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

export type ChosenCity = { ville: string; commune?: string } | null;

const KEY = 'explore.city.v1';

export const useChosenCity = create<{ city: ChosenCity; loaded: boolean; set: (c: ChosenCity) => void }>((set) => ({
  city: null,
  loaded: false,
  set: (city) => {
    set({ city });
    void (city ? SecureStore.setItemAsync(KEY, JSON.stringify(city)) : SecureStore.deleteItemAsync(KEY)).catch(() => undefined);
  },
}));

void SecureStore.getItemAsync(KEY)
  .then((raw) => {
    const v = raw ? (JSON.parse(raw) as ChosenCity) : null;
    useChosenCity.setState({ city: v && typeof v.ville === 'string' && v.ville ? v : null, loaded: true });
  })
  .catch(() => useChosenCity.setState({ loaded: true }));

/** « RATOMA » → « Ratoma », « N'ZÉRÉKORÉ » → « N'Zérékoré » (noms du référentiel en majuscules). */
export function prettyPlace(raw?: string | null): string {
  const s = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!s || s !== s.toLocaleUpperCase('fr-FR')) return s;
  return s
    .toLocaleLowerCase('fr-FR')
    .replace(/(^|[\s\-'’])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase('fr-FR'));
}

/** Libellé court : « Ratoma, Conakry » ou « Kindia ». */
export const cityLabel = (c: ChosenCity) => (c ? (c.commune ? `${prettyPlace(c.commune)}, ${prettyPlace(c.ville)}` : prettyPlace(c.ville)) : '');
