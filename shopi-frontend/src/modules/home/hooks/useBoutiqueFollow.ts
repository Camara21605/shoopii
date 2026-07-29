import { useCallback, useState } from 'react';
import { getRoleFromToken } from '../../../shared/services/authUtils';
import { toggleFollowEntreprise } from '../../../shared/services/follow';

interface UseBoutiqueFollowOptions {
  boutiqueId:      string;
  companyName:     string;
  initialIsSuivi?: boolean;
  onToast:         (message: string) => void;
  /** Ouvre le modal "connectez-vous / créez un compte client" */
  onRequireAuth:   () => void;
}

export function useBoutiqueFollow({
  boutiqueId,
  companyName,
  initialIsSuivi = false,
  onToast,
  onRequireAuth,
}: UseBoutiqueFollowOptions) {
  const [suiviOverride, setSuiviOverride] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const suivi = suiviOverride ?? initialIsSuivi;

  const isClient = getRoleFromToken() === 'client';

  const toggleFollow = useCallback(async () => {
    if (pending) return;

    if (!isClient) {
      onRequireAuth();
      return;
    }

    const previous = suivi;
    const next = !previous;

    setSuiviOverride(next);
    setPending(true);

    try {
      const confirmed = await toggleFollowEntreprise(boutiqueId);
      setSuiviOverride(confirmed);
      onToast(
        confirmed
          ? `Abonné à ${companyName}`
          : `Désabonné de ${companyName}`,
      );
    } catch {
      setSuiviOverride(previous);
      onToast('Erreur lors du suivi, réessayez');
    } finally {
      setPending(false);
    }
  }, [
    boutiqueId,
    companyName,
    isClient,
    onRequireAuth,
    onToast,
    pending,
    suivi,
  ]);

  return {
    suivi,
    pending,
    isClient,
    toggleFollow,
  };
}
