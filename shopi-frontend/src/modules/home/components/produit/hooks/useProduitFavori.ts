/* ================================================================
 * FICHIER : src/modules/home/components/produit/hooks/useProduitFavori.ts
 *
 * Logique du ❤️ de la fiche produit, partagée par le cœur de la
 * galerie (ProduitGallerie) et le bouton "Favoris" sous le stock
 * (ProduitInfoSection) : les deux lisent le même FavorisContext, donc
 * restent toujours synchronisés, et l'état est persisté côté serveur
 * (/client/favoris/:id/toggle — onglet Favoris du profil client), au
 * lieu d'un simple useState perdu au rechargement.
 *
 * Réservé aux clients : non connecté / autre rôle → AuthPromptModal
 * (via useAuthGate — l'appelant doit rendre `authModal`).
 * ================================================================ */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFavoris } from '../../../../../shared/context/FavorisContext';
import { useAuthGate } from '../../../../../shared/hooks/useAuthGate';

export function useProduitFavori(productId: string | undefined, onToast: (m: string) => void) {
  const { t } = useTranslation();
  const { isLiked, toggle } = useFavoris();
  const { requireClient, authModal } = useAuthGate();
  const [pending, setPending] = useState(false);

  const liked = productId ? isLiked(productId) : false;

  function toggleFavori() {
    if (!productId || pending) return;
    requireClient(async () => {
      setPending(true);
      try {
        const nowLiked = await toggle(productId);
        onToast(nowLiked
          ? t('produitDetail.infoSection.favorisToast')
          : t('produitDetail.infoSection.retireFavorisToast'));
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        onToast(t('produitDetail.infoSection.favorisErreurToast', { msg }));
      } finally {
        setPending(false);
      }
    });
  }

  return { liked, pending, toggleFavori, authModal };
}
