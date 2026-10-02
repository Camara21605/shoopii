/**
 * Espace entreprise (compte « company », propriétaire ou collaborateur) :
 * pile d'écrans + menu ☰ latéral (glisse depuis la gauche, monté une seule
 * fois ici pour être disponible sur toutes les pages entreprise).
 */
import { Stack } from 'expo-router';

import { CompanyDrawer } from '@/features/company/components';

export default function CompanyLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="recherche" options={{ animation: 'fade' }} />
      </Stack>
      <CompanyDrawer />
    </>
  );
}
