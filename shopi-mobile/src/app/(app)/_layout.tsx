/**
 * Espace connecté : les onglets (Accueil · Boutiques · Livreurs · Points
 * relais · Catalogue) + les écrans ouverts depuis l'en-tête (messages,
 * panier, compte, notifications) et le menu ☰ (glisse depuis le bas).
 */
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="menu" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
