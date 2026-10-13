/**
 * Espace de l'application : les onglets (Accueil · Boutiques · Livreurs · Points
 * relais · Catalogue) + les écrans ouverts depuis l'en-tête et le menu ☰.
 *
 * PUBLIC (visiteur sans compte, comme le site) : onglets, fiche boutique, fiche
 * produit, Explorer, menu ☰.
 * PRIVÉ (compte connecté) : panier, commande, compte, notifications, profil,
 * messagerie, paramètres du compte, espace entreprise, carte Localisation
 * (le serveur exige un compte pour /location/map, et le site la place dans
 * /mes-adresses, page réservée). Un écran privé est
 * inaccessible tant que personne n'est connecté (même par lien profond : retour
 * à l'Accueil) ; les boutons qui y mènent passent par features/auth/auth-gate.tsx,
 * qui propose de se connecter.
 */
import { Stack } from 'expo-router';

import { useSession } from '@/features/auth/session-store';

export default function AppLayout() {
  const signedIn = useSession((s) => s.status === 'signedIn');

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="menu" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="panier" />
        <Stack.Screen name="commande" />
        <Stack.Screen name="compte" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="profil" />
        <Stack.Screen name="localisation" />
        <Stack.Screen name="entreprise" />
        <Stack.Screen name="livreur" />
        <Stack.Screen name="correspondant" />
        <Stack.Screen name="messages/index" />
        <Stack.Screen name="messages/[id]" />
        <Stack.Screen name="messages/parametres" />
        <Stack.Screen name="messages/nouveau-groupe" />
        <Stack.Screen name="messages/groupe/[id]/index" />
        <Stack.Screen name="messages/groupe/[id]/ajouter" />
        <Stack.Screen name="messages/groupe/[id]/infos" />
        <Stack.Screen name="parametres/index" />
        <Stack.Screen name="parametres/profil" />
        <Stack.Screen name="parametres/notifications" />
        <Stack.Screen name="parametres/securite" />
        <Stack.Screen name="parametres/appareils" />
        <Stack.Screen name="parametres/activite" />
        <Stack.Screen name="parametres/points" />
        <Stack.Screen name="parametres/compte" />
      </Stack.Protected>
    </Stack>
  );
}
