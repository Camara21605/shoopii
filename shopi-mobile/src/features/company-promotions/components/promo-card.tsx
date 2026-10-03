/**
 * Carte d'une promotion — même contenu que la carte du site : type, statut,
 * nom, valeur, portée (+ produits ciblés), code à copier, échéance,
 * utilisations (barre), CA généré, taux d'usage ; actions Modifier,
 * Activer / Pause et menu « … » (Terminer, Supprimer — refusé si active).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { STATUS, TYPE, valueLabel, type Promo } from '../api';

export function StatusBadge({ s }: { s: Promo['status'] }) {
  const c = STATUS[s];
  return (
    <View style={[styles.badge, { backgroundColor: `${c.color}17` }]}>
      <View style={[styles.dot, { backgroundColor: c.color }]} />
      <ThemedText style={[styles.badgeText, { color: c.color }]}>{c.label}</ThemedText>
    </View>
  );
}

export function PromoCard({ p, productNames, busy, canEdit, onEdit, onActivate, onPause, onMore, onCopied }: {
  p: Promo; productNames: string[]; busy: boolean; canEdit: boolean;
  onEdit: () => void; onActivate: () => void; onPause: () => void; onMore: () => void; onCopied: (code: string) => void;
}) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const t = TYPE[p.type];
  const pct = p.max > 0 ? Math.min((p.uses / p.max) * 100, 100) : 0;
  const ended = p.status === 'ended';

  function copy() {
    void Clipboard.setStringAsync(p.code);
    setCopied(true);
    onCopied(p.code);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.background }, ended && styles.muted]}>
      <View style={[styles.stripe, { backgroundColor: STATUS[p.status].color }]} />
      <View style={styles.head}>
        <View style={[styles.typeIco, { backgroundColor: theme.backgroundElement }]}><ThemedText style={styles.typeEmoji}>{t.icon}</ThemedText></View>
        <View style={styles.flex}>
          <ThemedText type="small" themeColor="textSecondary">{p.typeL || t.label}</ThemedText>
          <ThemedText numberOfLines={2} style={styles.name}>{p.nom}</ThemedText>
        </View>
        <StatusBadge s={p.status} />
      </View>

      <View style={styles.valueRow}>
        <ThemedText style={styles.value}>{valueLabel(p)}</ThemedText>
        {p.montantMinimum ? <ThemedText type="small" themeColor="textSecondary">dès {p.montantMinimum.toLocaleString('fr-FR')} GNF</ThemedText> : null}
        {p.type === 'free-ship' && p.freeShipSeuil ? <ThemedText type="small" themeColor="textSecondary">dès {p.freeShipSeuil.toLocaleString('fr-FR')} GNF</ThemedText> : null}
      </View>

      <View style={styles.scope}>
        <View style={[styles.scopePill, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name={p.scope === 'global' ? 'storefront-outline' : 'cube-outline'} size={13} color={theme.text} />
          <ThemedText type="smallBold">{p.scope === 'global' ? 'Toute la boutique' : `${p.productIds.length} produit${p.productIds.length > 1 ? 's' : ''}`}</ThemedText>
        </View>
        {p.scope === 'products' && productNames.length ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
            {productNames.slice(0, 2).join(', ')}{productNames.length > 2 ? ` +${productNames.length - 2}` : ''}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.codeRow}>
        <Pressable onPress={copy} accessibilityRole="button" accessibilityLabel={`Copier le code ${p.code}`} style={[styles.code, { borderColor: theme.border }]}>
          <Ionicons name="ticket-outline" size={15} color={theme.text} />
          <ThemedText style={styles.codeText} selectable>{p.code}</ThemedText>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={copied ? Brand.success : theme.textSecondary} />
        </Pressable>
        <View style={styles.expire}>
          <Ionicons name="calendar-outline" size={13} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{p.expire || 'Pas de limite'}</ThemedText>
        </View>
      </View>

      {p.max > 0 ? (
        <View style={styles.usage}>
          <View style={styles.usageHead}>
            <ThemedText type="small" themeColor="textSecondary">Utilisations</ThemedText>
            <ThemedText type="smallBold">{p.uses} / {p.max}</ThemedText>
          </View>
          <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.fill, { width: `${pct}%`, backgroundColor: pct > 80 ? '#B45309' : Brand.primary }]} />
          </View>
        </View>
      ) : null}

      <View style={[styles.stats, { borderColor: theme.border }]}>
        <Stat v={String(p.uses)} l="Utilisations" />
        <View style={[styles.sep, { backgroundColor: theme.border }]} />
        <Stat v={`${p.revenue}`} l="CA généré" />
        <View style={[styles.sep, { backgroundColor: theme.border }]} />
        <Stat v={p.max > 0 ? `${Math.round(pct)} %` : '—'} l="Taux d’usage" />
      </View>

      {canEdit ? (
        <View style={styles.actions}>
          {!ended ? (
            <Pressable onPress={onEdit} disabled={busy} accessibilityRole="button" style={[styles.btn, styles.btnMain]}>
              <Ionicons name="create-outline" size={16} color="#fff" />
              <ThemedText type="smallBold" style={styles.white}>Modifier</ThemedText>
            </Pressable>
          ) : null}
          {p.status === 'active' ? (
            <Pressable onPress={onPause} disabled={busy} accessibilityRole="button" style={[styles.btn, { borderColor: theme.border, borderWidth: 1 }]}>
              {busy ? <ActivityIndicator size="small" color={theme.text} /> : <Ionicons name="pause" size={16} color={theme.text} />}
              <ThemedText type="smallBold">Pause</ThemedText>
            </Pressable>
          ) : p.status === 'draft' || p.status === 'paused' || p.status === 'scheduled' ? (
            <Pressable onPress={onActivate} disabled={busy} accessibilityRole="button" style={[styles.btn, { backgroundColor: `${Brand.success}17` }]}>
              {busy ? <ActivityIndicator size="small" color={Brand.success} /> : <Ionicons name="rocket-outline" size={16} color={Brand.success} />}
              <ThemedText type="smallBold" style={{ color: Brand.success }}>Activer</ThemedText>
            </Pressable>
          ) : null}
          <Pressable onPress={onMore} disabled={busy} accessibilityRole="button" accessibilityLabel="Plus d’actions" style={[styles.more, { borderColor: theme.border }]}>
            <Ionicons name="ellipsis-horizontal" size={18} color={theme.text} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={styles.statV} numberOfLines={1}>{v}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{l}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  muted: { opacity: 0.65 },
  white: { color: '#fff' },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, paddingTop: 16, gap: 10, overflow: 'hidden' },
  stripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeIco: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeEmoji: { fontSize: 21, lineHeight: 27 },
  name: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  value: { fontSize: 20, lineHeight: 26, fontWeight: '900' },
  scope: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scopePill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  code: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1.2, borderStyle: 'dashed', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  codeText: { fontSize: 14.5, lineHeight: 19, fontWeight: '900', letterSpacing: 1 },
  expire: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  usage: { gap: 5 },
  usageHead: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  stats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statV: { fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  sep: { width: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, minHeight: 42 },
  btnMain: { backgroundColor: Brand.primary },
  more: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
