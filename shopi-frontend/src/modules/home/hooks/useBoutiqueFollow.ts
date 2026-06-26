import { useCallback, useState } from 'react';
import { getRoleFromToken } from '../../../shared/services/authUtils';
import { tokenStorage } from '../../../shared/services/apiFetch';
import { toggleFollowEntreprise } from '../../../shared/services/follow';

interface UseBoutiqueFollowOptions {
  boutiqueId:      string;
  companyName:     string;
  initialIsSuivi?: boolean;
  onToast:         (message: string) => void;
}

export function useBoutiqueFollow({
  boutiqueId,
  companyName,
  initialIsSuivi = false,
  onToast,
}: UseBoutiqueFollowOptions) {
  const [suiviOverride, setSuiviOverride] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const suivi = suiviOverride ?? initialIsSuivi;

  const token = tokenStorage.get();
  const isLoggedIn = !!token;
  const isClient = getRoleFromToken() === 'client';
  const canFollow = isClient;

  const requestFollowLogin = useCallback(() => {
    onToast('Connectez-vous pour suivre cette boutique');
  }, [onToast]);

  const toggleFollow = useCallback(async () => {
    if (pending) return;

    if (!isLoggedIn) {
      requestFollowLogin();
      return;
    }

    if (!isClient) {
      onToast('Seuls les clients peuvent suivre des boutiques');
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
    isLoggedIn,
    onToast,
    pending,
    requestFollowLogin,
    suivi,
  ]);

  return {
    suivi,
    pending,
    isLoggedIn,
    canFollow,
    requestFollowLogin,
    toggleFollow,
  };
}
