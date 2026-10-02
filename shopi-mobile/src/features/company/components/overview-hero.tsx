/**
 * Bandeau d'accueil de la Vue d'ensemble (« hero » du site) : boutique active ·
 * abonnés, « Bonjour, <boutique> 👋 », résumé (tendance du CA, commandes à
 * traiter, retours en attente) et actions rapides, puis les 4 chiffres clés.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

import type { Overview } from '../api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type Trend = { type: 'up' | 'dn' | 'neu'; label: string };

export function trendOf(pct: number): Trend {
  if (pct > 0) return { type: 'up', label: `↑ +${pct}%` };
  if (pct < 0) return { type: 'dn', label: `↓ ${pct}%` };
  return { type: 'neu', label: 'Stable' };
}

const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
/** 4 850 000 → « 4,9 » ; 12 500 000 → « 13 » (millions, une décimale sous 10 M). */
const millions = (n: number) => (n / 1_000_000 < 10 ? (Math.round(n / 100_000) / 10).toString().replace('.', ',') : fmt(n / 1_000_000));
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function OverviewHero({
  data,
  loading,
  canAnalytics,
  onOrders,
  onAnalytics,
  onPromotions,
}: {
  data: Overview;
  loading: boolean;
  canAnalytics: boolean;
  onOrders: () => void;
  onAnalytics: () => void;
  onPromotions: () => void;
}) {
  const k = data.kpis;
  const ca = trendOf(k.croissanceCA);
  const cmd = trendOf(k.commandesCroissance);
  return (
    <View style={styles.wrap}>
      <LinearGradient colors={['#0B1F3A', '#1652F0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={[styles.bubble, styles.b1]} />
        <View style={[styles.bubble, styles.b2]} />
        <View style={styles.badge}>
          <View style={styles.pulse} />
          <ThemedText style={styles.badgeText}>Boutique active · {plural(k.abonnes, 'abonné', 'abonnés')}</ThemedText>
        </View>
        <ThemedText style={styles.title}>
          Bonjour, <ThemedText style={[styles.title, styles.em]}>{data.zoneNom}</ThemedText> 👋
        </ThemedText>
        <ThemedText style={styles.ready}>{loading ? 'Chargement de vos données…' : 'Voici votre activité récente.'}</ThemedText>
        <ThemedText style={styles.sub}>
          {ca.label} de chiffre d’affaires · {plural(k.enAttente, 'commande à traiter', 'commandes à traiter')} · {plural(k.retoursEnTraitement, 'retour en attente', 'retours en attente')}
        </ThemedText>
        <View style={styles.btns}>
          <HeroBtn icon="cube" label="Traiter les commandes" primary onPress={onOrders} />
          {canAnalytics ? <HeroBtn icon="trending-up" label="Analytics" onPress={onAnalytics} /> : null}
          <HeroBtn icon="pricetags" label="Promotions" onPress={onPromotions} />
        </View>
      </LinearGradient>

      <View style={styles.stats}>
        <Stat value={millions(k.caCeMois)} unit="M GNF" label="CA ce mois" trend={ca} />
        <Stat value={String(k.commandesCeMois)} unit="cmds" label="Commandes" trend={cmd} />
        <Stat value={k.noteMoyenne.toFixed(1)} unit="⭐" label="Note moy." trend={{ type: 'neu', label: `${k.totalAvis} avis` }} />
        <Stat value={String(k.abonnes)} unit="" label="Abonnés" trend={{ type: 'neu', label: 'Total' }} />
      </View>
    </View>
  );
}

function HeroBtn({ icon, label, primary, onPress }: { icon: IconName; label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, primary ? styles.btnPrimary : styles.btnGhost, pressed && styles.pressed]} accessibilityRole="button">
      <Ionicons name={icon} size={15} color={primary ? '#0B1F3A' : '#fff'} />
      <ThemedText style={[styles.btnText, { color: primary ? '#0B1F3A' : '#fff' }]}>{label}</ThemedText>
    </Pressable>
  );
}

function Stat({ value, unit, label, trend }: { value: string; unit: string; label: string; trend: Trend }) {
  const color = trend.type === 'dn' ? '#DC2626' : trend.type === 'up' ? '#059669' : '#5A6B85';
  return (
    <View style={styles.stat}>
      <View style={styles.statTop}>
        <ThemedText style={styles.statV}>{value}</ThemedText>
        {unit ? <ThemedText style={styles.statU}>{unit}</ThemedText> : null}
      </View>
      <ThemedText style={styles.statL}>{label}</ThemedText>
      <View style={styles.trendRow}>
        <Ionicons name={trend.type === 'dn' ? 'trending-down' : trend.type === 'up' ? 'trending-up' : 'remove'} size={12} color={color} />
        <ThemedText style={[styles.trend, { color }]}>{trend.label.replace(/^[↑↓] /, '')}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  hero: { borderRadius: 22, padding: 18, gap: 8, overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  b1: { width: 200, height: 200, top: -80, right: -60 },
  b2: { width: 120, height: 120, bottom: -50, left: -30 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' },
  badgeText: { color: '#E0E7FF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  title: { color: '#fff', fontSize: 22, lineHeight: 29, fontWeight: '900' },
  em: { color: '#93C5FD' },
  ready: { color: '#E0E7FF', fontSize: 15, lineHeight: 20, fontWeight: '700', marginTop: -4 },
  sub: { color: '#C7D2FE', fontSize: 12.5, lineHeight: 18 },
  btns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, minHeight: 38 },
  btnPrimary: { backgroundColor: '#fff' },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  btnText: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#F4F6FA', borderRadius: 16, padding: 14, gap: 2 },
  statTop: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statV: { fontSize: 24, lineHeight: 30, fontWeight: '900' },
  statU: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#5A6B85' },
  statL: { fontSize: 12.5, lineHeight: 16, fontWeight: '700', color: '#5A6B85' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  trend: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
});
