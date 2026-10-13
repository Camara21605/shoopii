/**
 * Espace de l'application : les onglets (Accueil · Boutiques · Livreurs · Points
 * relais · Catalogue) + les écrans ouverts depuis l'en-tête et le menu ☰.
 *
 * PUBLIC (visiteur sans compte, comme le site) : onglets, fiche boutique, fiche
 * produit, Explorer, comparateur de produits (/comparer), menu ☰.
 * PRIVÉ (compte connecté) : panier, commande, compte, notifications, profil,
 * messagerie, paramètres du compte, espace entreprise, carte Localisation
 * (le serveur exige un compte pour /location/map, et le site la place dans
 * /mes-adresses, page réservée). Un écran privé est
 * inaccessible tant que personne n'est connecté (même par lien profond : retour
 * à l'Accueil) ; les boutons qui y mènent passent par features/auth/auth-gate.tsx,
 * qui propose de se connecter.
 *
 * ESPACES SÉPARÉS : un compte entreprise, livreur ou point relais n'entre dans
 * l'espace client (menu ☰ client, Explorer, panier, commande, profil, compte,
 * carte Localisation, paramètres du compte client) que par la BASCULE
 * (features/account-switch), qui ouvre une session sur son compte client lié.
 * Inversement, chaque espace pro n'est ouvert qu'au rôle correspondant. Les
 * onglets redirigent déjà vers l'espace pro ((tabs)/_layout.tsx) ; les gardes
 * ci-dessous ferment aussi les autres écrans (lien interne, notification…).
 * Fiches boutique / produit / point relais : ouvertes à tous — c'est l'aperçu
 * « Voir ma boutique » d'une entreprise et le catalogue de ses fournisseurs ;
 * leurs actions d'achat restent réservées aux clients (requireClient).
 */
import { Stack } from 'expo-router';

import { useSession } from '@/features/auth/session-store';

/** Rôles qui ont leur propre espace dans l'application (le reste utilise l'espace client). */
const PRO_SPACE_ROLES = ['company', 'delivery', 'correspondent'];

export default function AppLayout() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  const role = useSession((s) => s.user?.role);
  const clientSide = !(signedIn && !!role && PRO_SPACE_ROLES.includes(role));

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />

      {/* Espace client — visiteurs, clients et comptes sans espace pro dans l'application */}
      <Stack.Protected guard={clientSide}>
        <Stack.Screen name="menu" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="explorer" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && clientSide}>
        <Stack.Screen name="panier" />
        <Stack.Screen name="commande" />
        <Stack.Screen name="compte" />
        <Stack.Screen name="profil" />
        <Stack.Screen name="localisation" />
        <Stack.Screen name="parametres/index" />
        <Stack.Screen name="parametres/profil" />
        <Stack.Screen name="parametres/notifications" />
        <Stack.Screen name="parametres/securite" />
        <Stack.Screen name="parametres/appareils" />
        <Stack.Screen name="parametres/activite" />
        <Stack.Screen name="parametres/points" />
        <Stack.Screen name="parametres/compte" />
      </Stack.Protected>

      {/* Espaces pro — chacun réservé à son rôle */}
      <Stack.Protected guard={signedIn && role === 'company'}>
        <Stack.Screen name="entreprise" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && role === 'delivery'}>
        <Stack.Screen name="livreur" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && role === 'correspondent'}>
        <Stack.Screen name="correspondant" />
      </Stack.Protected>

      {/* Communs à tout compte connecté */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="notifications" />
        <Stack.Screen name="messages/index" />
        <Stack.Screen name="messages/[id]" />
        <Stack.Screen name="messages/parametres" />
        <Stack.Screen name="messages/nouveau-groupe" />
        <Stack.Screen name="messages/groupe/[id]/index" />
        <Stack.Screen name="messages/groupe/[id]/ajouter" />
        <Stack.Screen name="messages/groupe/[id]/infos" />
      </Stack.Protected>
    </Stack>
  );
}
