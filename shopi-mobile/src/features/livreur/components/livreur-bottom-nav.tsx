/**
 * Barre du bas de l'espace livreur : Accueil · Missions (nouvelles à accepter)
 * · En cours (missions actives) · Gains. Se cache en descendant et revient en
 * remontant (lib/scroll-chrome), comme les autres espaces.
 * (La barre mobile du site ne montre que « Correspondants · Livreurs » ; ces
 * deux rubriques restent dans le menu ☰, rubrique Réseau.)
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { chromeTranslate, useShowChromeOnFocus } from '@/lib/scroll-chrome';

import { useLivreurBadges } from '../hooks';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type LivreurTab = 'overview' | 'missions' | 'encours' | 'revenus';

export function LivreurBottomNav({ active }: { active?: LivreurTab | string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const badges = useLivreurBadges();
  useShowChromeOnFocus();
  const barH = 62 + Math.max(insets.bottom, 8);

  const tabs: { key: LivreurTab; label: string; icon: IconName; iconOn: IconName; go: () => void; badge?: number }[] = [
    { key: 'overview', label: 'Accueil', icon: 'pie-chart-outline', iconOn: 'pie-chart', go: () => router.dismissTo('/livreur') },
    { key: 'missions', label: 'Missions', icon: 'bicycle-outline', iconOn: 'bicycle', go: () => router.navigate('/livreur/missions'), badge: badges.missions },
    { key: 'encours', label: 'En cours', icon: 'navigate-outline', iconOn: 'navigate', go: () => router.navigate('/livreur/encours'), badge: badges.encours },
    { key: 'revenus', label: 'Gains', icon: 'cash-outline', iconOn: 'cash', go: () => router.navigate('/livreur/revenus') },
  ];

  return (
    <Animated.View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8), borderTopColor: theme.border, backgroundColor: theme.background }, chromeTranslate(barH + 8)]} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.key === active;
        const color = on ? Brand.primary : theme.textSecondary;
        return (
          <Pressable key={t.key} onPress={on ? undefined : t.go} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.badge ? `${t.label}, ${t.badge}` : t.label} style={styles.tab}>
            <View>
              <Ionicons name={on ? t.iconOn : t.icon} size={23} color={color} />
              {t.badge ? (
                <View style={[styles.badge, { borderColor: theme.background }]}>
                  <ThemedText style={styles.badgeText}>{t.badge > 99 ? '99+' : t.badge}</ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText style={[styles.label, { color, fontWeight: on ? '800' : '600' }]}>{t.label}</ThemedText>
            {on ? <View style={styles.indicator} /> : null}
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 56 },
  label: { fontSize: 12, lineHeight: 16 },
  indicator: { position: 'absolute', top: -6, width: 28, height: 3, borderRadius: 2, backgroundColor: Brand.primary },
  badge: { position: 'absolute', top: -5, right: -11, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9.5, lineHeight: 12, fontWeight: '900' },
});
