/**
 * Page introuvable : plutôt que l'écran technique « Unmatched Route » (en
 * anglais, sur fond noir), on revient simplement à l'accueil — qui montre la
 * connexion si personne n'est connecté.
 */
import { Redirect } from 'expo-router';

export default function NotFound() {
  return <Redirect href="/" />;
}
