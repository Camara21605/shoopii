/**
 * Export CSV de l'inventaire (même contenu que le site : séparateur « ; »,
 * BOM UTF-8 pour qu'Excel affiche les accents). Sur téléphone, le fichier est
 * enregistré puis proposé au partage (WhatsApp, e-mail, Drive…) ; dans
 * l'aperçu web, il est téléchargé.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { LEVEL, levelOf, type Product } from './api';

export function buildCsv(list: Product[]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Nom', 'Référence', 'Marque', 'Catégorie', 'Prix unitaire (GNF)', 'Stock', "Seuil d'alerte", 'Statut'];
  const rows = list.map((p) => [p.nom, p.reference ?? '', p.marque ?? '', p.category?.nom ?? '', p.prix, p.stock, p.seuil ?? '', LEVEL[levelOf(p.stock, p.seuil)].label].map(esc).join(';'));
  return [header.map(esc).join(';'), ...rows].join('\n');
}

export async function shareCsv(list: Product[]) {
  const name = `inventaire-shoneya-${new Date().toISOString().slice(0, 10)}.csv`;
  const content = `﻿${buildCsv(list)}`;
  if (Platform.OS === 'web') {
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) return;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const a = doc.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(content);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Exporter l’inventaire', UTI: 'public.comma-separated-values-text' });
}
