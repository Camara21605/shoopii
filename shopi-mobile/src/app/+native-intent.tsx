/**
 * Liens entrants (ouverture de l'app par une adresse) — traduits AVANT la
 * navigation. Une adresse Expo de test ressemble à
 * « exp://<hôte>/--/register » : seul ce qui suit « /--/ » est une page de
 * l'app. Sans ce traitement, l'adresse complète était prise pour une page
 * et l'écran « Unmatched Route » s'affichait. Adresse inconnue → accueil
 * (la connexion s'affiche d'elle-même si personne n'est connecté).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const marker = path.indexOf('/--/');
    /* exp:// / http(s):// : l'hôte est un serveur, on l'enlève ; schéma de
     * l'app (shoneya://register) : ce qui suit « :// » est déjà la page. */
    const route =
      marker >= 0
        ? path.slice(marker + 3)
        : /^(exps?|https?):\/\//i.test(path)
          ? path.replace(/^[a-z]+:\/\/[^/]*/i, '')
          : path.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    const clean = `/${route.replace(/^\/+/, '').split(/[?#]/)[0]}`;
    return ['/', '/login', '/register'].includes(clean) ? clean : '/';
  } catch {
    return '/';
  }
}
