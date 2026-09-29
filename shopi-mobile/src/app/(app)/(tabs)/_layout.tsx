/**
 * Barre d'onglets du client : Accueil · Messages · Panier · Compte.
 * Le nombre d'articles du panier s'affiche en pastille sur l'onglet.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { cartCount, useCart } from '@/features/cart/api';
import { useTheme } from '@/hooks/use-theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Icône d'onglet : pleine quand l'onglet est actif, contour sinon. */
function icon(on: IconName, off: IconName) {
  function TabIcon({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) {
    return <Ionicons name={focused ? on : off} size={size} color={color} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const count = cartCount(cart.data);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        /* Hauteur explicite + barre de navigation du téléphone : les libellés
         * (« Accueil », « Compte »…) n'étaient plus coupés en bas. */
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          height: 66 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 6 + insets.bottom,
        },
        tabBarItemStyle: { height: 54 },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: '600', marginTop: 2 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen
        name="messages"
        options={{ title: 'Messages', tabBarIcon: icon('chatbubbles', 'chatbubbles-outline') }}
      />
      <Tabs.Screen
        name="panier"
        options={{
          title: 'Panier',
          tabBarIcon: icon('cart', 'cart-outline'),
          tabBarBadge: count > 0 ? (count > 99 ? '99+' : count) : undefined,
          tabBarBadgeStyle: { backgroundColor: Brand.danger, fontSize: 10 },
        }}
      />
      <Tabs.Screen name="compte" options={{ title: 'Compte', tabBarIcon: icon('person', 'person-outline') }} />
    </Tabs>
  );
}
