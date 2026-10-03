/**
 * Carte d'accueil de la Vue d'ensemble (« hero » du site sur téléphone) :
 *   · pastille « BOUTIQUE ACTIVE · N ABONNÉS » ;
 *   · « Bonjour, <boutique> 👋 / Voici votre activité récente. » ;
 *   · résumé (tendance du CA, commandes à traiter, retours en attente) ;
 *   · actions : Traiter les commandes · Voir analytics (si permission) · Promotions ;
 *   · les 4 chiffres clés en ligne : CA du mois, commandes, note, abonnés.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
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

const STATUS: Record<string, { label: string; color: string }> = {
  active: { label: 'Boutique active', color: '#0F9D58' },
  pending: { label: 'En validation', color: '#D97706' },
  suspended: { label: 'Boutique en pause', color: '#D97706' },
};

export function OverviewHero({
  data,
  loading,
  status,
  canAnalytics,
  canOrders = true,
  onOrders,
  onAnalytics,
  onPromotions,
}: {
  data: Overview;
  loading: boolean;
  status?: string | null;
  canAnalytics: boolean;
  canOrders?: boolean;
  onOrders: () => void;
  onAnalytics: () => void;
  onPromotions: () => void;
}) {
  const k = data.kpis;
  const ca = trendOf(k.croissanceCA);
  const cmd = trendOf(k.commandesCroissance);
  const st = STATUS[status ?? 'active'] ?? STATUS.active;
  const caLabel = ca.type === 'neu' ? 'Stable' : ca.label;

  return (
    <View style={styles.hero}>
      <View style={styles.badge}>
        <View style={[styles.pulse, { backgroundColor: st.color }]} />
        <ThemedText style={styles.badgeText}>
          {st.label} · {plural(k.abonnes, 'abonné', 'abonnés')}
        </ThemedText>
      </View>

      <ThemedText style={styles.title}>
        Bonjour, <ThemedText style={[styles.title, styles.em]}>{data.zoneNom}</ThemedText> 👋{'\n'}
        {loading ? 'Chargement de vos données…' : 'Voici votre activité récente.'}
      </ThemedText>
      <ThemedText style={styles.sub}>
        {caLabel} de chiffre d’affaires · {plural(k.enAttente, 'commande à traiter', 'commandes à traiter')} · {plural(k.retoursEnTraitement, 'retour en attente', 'retours en attente')}
      </ThemedText>

      <View style={styles.btns}>
        {canOrders ? <HeroBtn icon="cube" label="Traiter les commandes" primary onPress={onOrders} count={k.enAttente} /> : null}
        {canAnalytics ? <HeroBtn icon="analytics-outline" label="Voir analytics" onPress={onAnalytics} /> : null}
        <HeroBtn icon="pricetags-outline" label="Promotions" onPress={onPromotions} />
      </View>

      <View style={styles.stats}>
        <Stat value={millions(k.caCeMois)} unit="M GNF" label="CA ce mois" trend={ca} />
        <Stat value={String(k.commandesCeMois)} unit="cmds" label="Commandes" trend={cmd} />
        <Stat value={k.noteMoyenne.toFixed(1)} unit="⭐" label="Note moy." trend={{ type: 'neu', label: `${k.totalAvis} avis` }} />
        <Stat value={String(k.abonnes)} unit="" label="Abonnés" trend={{ type: 'neu', label: 'Total' }} />
      </View>
    </View>
  );
}

function HeroBtn({ icon, label, primary, onPress, count }: { icon: IconName; label: string; primary?: boolean; onPress: () => void; count?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count} en attente` : label}
      style={({ pressed }) => [styles.btn, primary ? styles.btnPrimary : styles.btnGhost, pressed && styles.pressed]}>
      <Ionicons name={icon} size={16} color={primary ? '#fff' : '#111111'} />
      <ThemedText style={[styles.btnText, { color: primary ? '#fff' : '#111111' }]}>{label}</ThemedText>
      {count ? (
        <View style={styles.count}>
          <ThemedText style={styles.countText}>{count}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

function Stat({ value, unit, label, trend }: { value: string; unit: string; label: string; trend: Trend }) {
  const color = trend.type === 'dn' ? '#DC2626' : trend.type === 'up' ? '#0F9D58' : '#6B6B6B';
  return (
    <View style={styles.stat} accessibilityLabel={`${label} : ${value} ${unit}, ${trend.label}`}>
      <ThemedText style={styles.statV} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      <ThemedText style={styles.statU} numberOfLines={1}>
        {unit || ' '}
      </ThemedText>
      <ThemedText style={styles.statL} numberOfLines={1} adjustsFontSizeToFit>
        {label.toUpperCase()}
      </ThemedText>
      <View style={styles.trendRow}>
        <Ionicons name={trend.type === 'dn' ? 'trending-down' : 'trending-up'} size={11} color={color} />
        <ThemedText style={[styles.trend, { color }]} numberOfLines={1}>
          {trend.label.replace(/^[↑↓] /, '')}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#E5E5E5', padding: 18, gap: 12, overflow: 'hidden' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#F5F5F5', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pulse: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { color: '#404040', fontSize: 11.5, lineHeight: 15, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: '#111111', fontSize: 23, lineHeight: 30, fontWeight: '900' },
  em: { fontStyle: 'italic', color: '#111111' },
  sub: { color: '#6B6B6B', fontSize: 13.5, lineHeight: 20 },
  btns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 16, minHeight: 44 },
  btnPrimary: { backgroundColor: '#111111' },
  btnGhost: { borderWidth: 1, borderColor: '#D4D4D4', backgroundColor: '#FFFFFF' },
  btnText: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  count: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  countText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '900' },
  pressed: { opacity: 0.8 },
  stats: { flexDirection: 'row', gap: 7, marginTop: 4 },
  stat: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#EDEDED', backgroundColor: '#F7F7F7', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 4, gap: 1 },
  statV: { color: '#111111', fontSize: 18, lineHeight: 23, fontWeight: '900' },
  statU: { color: '#404040', fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  statL: { color: '#8A8A8A', fontSize: 8.5, lineHeight: 12, fontWeight: '800' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  trend: { fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
});
