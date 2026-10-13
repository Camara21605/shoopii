/**
 * Barre du bas — même organisation que la barre mobile du site
 * (Header.tsx, bottomNav) : Accueil · Boutiques · Livreurs · Points relais ·
 * Catalogue, en icônes seules avec un trait sur l'onglet actif.
 * Messages, panier, notifications et compte sont dans l'en-tête (AppHeader).
 * Un compte ENTREPRISE arrive directement sur son espace (/entreprise), comme
 * sur le site (/dashboard/entreprise) : ces onglets sont ceux des clients.
 * La barre se cache quand on fait défiler vers le bas et revient en remontant
 * (lib/scroll-chrome) : elle flotte au-dessus du contenu (position absolue).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { useTheme } from '@/hooks/use-theme';
import { chromeTranslate, showChrome } from '@/lib/scroll-chrome';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Icône d'onglet : pleine + trait au-dessus quand l'onglet est actif. */
function icon(on: IconName, off: IconName) {
  function TabIcon({ focused, color }: { focused: boolean; color: ColorValue; size: number }) {
    return (
      <View style={styles.iconWrap}>
        {focused ? <View style={styles.activeBar} /> : null}
        <Ionicons name={focused ? on : off} size={25} color={color} />
      </View>
    );
  }
  return TabIcon;
}

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const role = useSession((s) => s.user?.role);

  if (role === 'company') return <Redirect href="/entreprise" />;
  if (role === 'delivery') return <Redirect href="/livreur" />;
  if (role === 'correspondent') return <Redirect href="/correspondant" />;

  return (
    <Tabs
      screenListeners={{ focus: () => showChrome() }}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          ...chromeTranslate(60 + insets.bottom + 8),
        },
        tabBarItemStyle: { height: 60 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarAccessibilityLabel: 'Accueil', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="boutiques" options={{ title: 'Boutiques', tabBarAccessibilityLabel: 'Boutiques', tabBarIcon: icon('storefront', 'storefront-outline') }} />
      <Tabs.Screen name="livreurs" options={{ title: 'Livreurs', tabBarAccessibilityLabel: 'Livreurs', tabBarIcon: icon('bicycle', 'bicycle-outline') }} />
      <Tabs.Screen
        name="correspondants"
        options={{ title: 'Points relais', tabBarAccessibilityLabel: 'Points relais', tabBarIcon: icon('location', 'location-outline') }}
      />
      <Tabs.Screen name="catalogue" options={{ title: 'Catalogue', tabBarAccessibilityLabel: 'Catalogue', tabBarIcon: icon('grid', 'grid-outline') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', width: 60, height: 44 },
  activeBar: { position: 'absolute', top: -8, width: 34, height: 3, borderRadius: 2, backgroundColor: Brand.primary },
});
