/**
 * Espace entreprise (compte « company », propriétaire ou collaborateur) :
 * Vue d'ensemble + menu ☰ des rubriques (glisse depuis le bas).
 */
import { Stack } from 'expo-router';

export default function CompanyLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="menu" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
