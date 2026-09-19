/* ================================================================
 * FICHIER : src/shared/location/components/ActorLocation.tsx
 *
 * Où se trouve l'acteur (entreprise, livreur, correspondant) ?
 * Rend « **Quartier** · Ville » : le quartier en évidence — c'est lui que le
 * client cherche pour savoir si l'acteur est près de chez lui — puis la ville.
 * Sans quartier connu, on affiche seulement la ville (jamais de valeur
 * inventée) ; sans rien, aucun rendu.
 *
 * À placer DANS un conteneur existant (ligne de carte, ligne de profil) :
 * le composant ne rend que du texte, il n'impose aucune mise en page.
 * ================================================================ */

import { locationParts, type LocationLike } from '../utils/locationLabel';

interface Props {
  value: LocationLike | null | undefined;
  /** Texte de repli quand ni quartier ni ville ne sont connus (défaut : rien). */
  fallback?: string;
}

export default function ActorLocation({ value, fallback = '' }: Props) {
  const { ville, quartier } = locationParts(value);

  /* Anciens champs (zone / region) : on les montre tels quels s'ils sont seuls */
  if (!ville && !quartier) {
    const legacy = (value?.localisation || value?.zone || value?.region || '').trim();
    return <>{legacy || fallback}</>;
  }

  /* Quartier et ville identiques (« Kindia » / « Kindia ») : un seul nom */
  const sameName = quartier && ville && quartier.toLowerCase() === ville.toLowerCase();

  return (
    <>
      {quartier && <strong style={{ fontWeight: 700, color: 'var(--t1)' }}>{quartier}</strong>}
      {quartier && ville && !sameName && ' · '}
      {ville && !sameName && ville}
    </>
  );
}
