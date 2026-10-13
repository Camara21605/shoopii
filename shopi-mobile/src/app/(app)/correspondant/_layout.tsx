/**
 * Espace correspondant (compte « correspondent », point relais) : pile
 * d'écrans + menu ☰ latéral, monté une seule fois ici pour être disponible
 * sur toutes les pages correspondant.
 */
import { Stack } from 'expo-router';

import { CorrespondantDrawer } from '@/features/correspondant/components';

export default function CorrespondantLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
      <CorrespondantDrawer />
    </>
  );
}
