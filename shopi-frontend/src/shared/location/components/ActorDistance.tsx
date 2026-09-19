/* ================================================================
 * FICHIER : src/shared/location/components/ActorDistance.tsx
 *
 * « · 2,3 km » : distance entre le client connecté et l'acteur (entreprise,
 * livreur, correspondant), calculée par le système de localisation.
 * À placer juste après <ActorLocation /> ; ne rend rien pour un visiteur ou
 * tant que la position du client / de l'acteur est inconnue.
 * « ≈ » signale une position d'acteur approximative (déduite de son quartier).
 * ================================================================ */

import { useActorDistance } from '../hooks/useActorDistance';
import { formatDistance } from '../utils/geoUtils';
import type { MapActorRole } from '../services/mapSearchApi';

interface Props { role: MapActorRole; id: string | null | undefined }

export default function ActorDistance({ role, id }: Props) {
  const d = useActorDistance(role, id);
  if (!d) return null;

  const txt = formatDistance(d.km).replace('.', ',');
  const title = `Distance à vol d'oiseau depuis ${d.from === 'gps' ? 'votre position' : 'votre adresse par défaut'}`
    + (d.approx ? ' — position approximative (déduite du quartier)' : '');

  return (
    <span title={title} style={{ whiteSpace: 'nowrap' }}>
      {' · '}
      <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{d.approx ? '≈ ' : ''}{txt}</span>
    </span>
  );
}
