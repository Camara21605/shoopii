/**
 * Rapport PDF des segments (GET /dashboard/entreprise/clients/rapport/pdf).
 * apiFetch ne sait pas lire un fichier binaire : sur téléphone, le PDF est
 * téléchargé dans le cache de l'app puis proposé au partage (WhatsApp, e-mail,
 * « Enregistrer dans Fichiers »…) ; dans l'aperçu web, il est téléchargé.
 * Un petit appel apiFetch passe avant : il renouvelle la session si le jeton
 * a expiré (le téléchargement direct, lui, ne sait pas le faire).
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { env } from '@/config/env';
import { apiFetch } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { tokenStore } from '@/lib/api/token-store';

const PATH = '/dashboard/entreprise/clients/rapport/pdf';

export async function shareSegmentsReport() {
  await apiFetch('/dashboard/entreprise/clients', { query: { limit: 1 } });
  const token = tokenStore.getAccessToken();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const url = `${env.apiUrl}${PATH}`;
  const name = `rapport-clients-${new Date().toISOString().slice(0, 10)}.pdf`;

  if (Platform.OS === 'web') {
    const res = await fetch(url, { headers, credentials: 'omit' });
    if (!res.ok) throw new ApiError(res.status, `Impossible de générer le rapport PDF (${res.status}).`);
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) return;
    const href = URL.createObjectURL(await res.blob());
    const a = doc.createElement('a');
    a.href = href;
    a.download = name;
    a.click();
    URL.revokeObjectURL(href);
    return;
  }

  const target = new File(Paths.cache, name);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(url, target, { headers, idempotent: true });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Rapport des segments clients', UTI: 'com.adobe.pdf' });
}
