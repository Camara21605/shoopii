/**
 * Profil public d'un point relais (correspondant) — même source que la page
 * /correspondants/:id du site (ProfilCorrespondantPage) :
 *   GET /client/correspondants/:id   public (connexion facultative → `suivi`)
 * Le contenu (schéma, vue) est partagé avec le profil du réseau livreur :
 * voir features/livreur-network (fetchRelayProfile, RelayProfileView).
 *
 * « Mon propre profil » : un compte correspondant reconnaît le sien grâce à
 *   GET /correspondant/parametres → { id }
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

export { fetchRelayProfile, type RelayProfile } from '@/features/livreur-network/api';

export const fetchMyRelayId = () =>
  apiFetch('/correspondant/parametres', { schema: z.object({ id: z.string().catch('') }).passthrough() }).then((r) => r.id);
