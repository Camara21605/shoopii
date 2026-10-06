/**
 * Espace livreur (compte « delivery ») : pile d'écrans + menu ☰ latéral
 * (monté une seule fois ici pour être disponible sur toutes les pages livreur)
 * + partage de position automatique pendant une livraison (une seule
 * connexion /location pour tout l'espace, comme sur le site).
 */
import { Stack } from 'expo-router';

import { AutoSharing, LivreurDrawer } from '@/features/livreur/components';

export default function LivreurLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
      <LivreurDrawer />
      <AutoSharing />
    </>
  );
}
