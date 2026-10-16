/**
 * Pastille d'état sur un profil public (boutique, livreur, point relais,
 * client) : en ligne · joignable (appli fermée, internet actif) · hors ligne.
 * À l'ouverture du profil, le téléphone du propriétaire est vérifié en
 * silence (compte connecté) : l'état se corrige en direct en quelques secondes.
 * Rien sur son propre profil.
 */
import type { ActorKind } from '../api';
import { useActorPresence } from '../hooks';
import { PresenceChip } from './presence-ui';

export function ActorPresenceChip({ type, id, hidden, align = 'center' }: { type: ActorKind; id: string; hidden?: boolean; align?: 'center' | 'flex-start' }) {
  const p = useActorPresence(hidden ? null : type, hidden ? null : id);
  if (hidden || (!p.known && !p.checking)) return null;
  return <PresenceChip status={p.status} lastSeen={p.lastSeen} checking={p.checking} align={align} />;
}
