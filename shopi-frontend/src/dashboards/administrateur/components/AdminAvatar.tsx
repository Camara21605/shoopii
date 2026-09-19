/* ================================================================
 * FICHIER : src/dashboards/administrateur/components/AdminAvatar.tsx
 *
 * Avatar de l'administrateur connecté : photo de profil si elle existe
 * (et se charge), sinon ses initiales. La classe passée fixe la taille
 * et la forme — même composant dans la sidebar et la topbar.
 * ================================================================ */

import { useEffect, useState } from 'react';
import { adminInitials, useAdminProfile } from '../hooks/useAdminProfile';

export default function AdminAvatar({ className }: { className?: string }) {
  const { profile } = useAdminProfile();
  const [broken, setBroken] = useState(false);
  const src = profile?.profilePicture ?? null;

  /* Nouvelle photo → on retente le chargement */
  useEffect(() => { setBroken(false); }, [src]);

  if (src && !broken) {
    return <img src={src} alt="" className={className} style={{ objectFit: 'cover' }} onError={() => setBroken(true)} />;
  }
  return <div className={className}>{adminInitials(profile)}</div>;
}
