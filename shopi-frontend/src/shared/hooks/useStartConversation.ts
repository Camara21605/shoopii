/*
 * Hook partagé : démarre (ou reprend) une conversation avec un acteur.
 *
 * Usage :
 *   const { start, loading } = useStartConversation();
 *   await start('company', companyId, onError);
 *
 * - Vérifie que l'utilisateur est connecté (sinon → /login)
 * - Appelle POST /api/messagerie/conversations
 * - Navigue vers LA messagerie de l'espace courant (voir resolveMessagerieRoute
 *   ci-dessous) en passant l'ID de la conversation via location.state pour
 *   que useMessagerie puisse la pré-sélectionner.
 *
 * ✅ BUG CORRIGÉ — naviguait toujours en dur vers /messagerie (route
 * publique/cliente). Les dashboards entreprise et livreur ont leur PROPRE
 * page messagerie, montée sur une autre URL (/dashboard/entreprise/messages,
 * /dashboard/livreur/messages) mais avec le MÊME composant MessagerieCore.
 * Depuis ces dashboards, naviguer vers /messagerie faisait donc sortir du
 * dashboard vers une autre instance de la messagerie — d'où l'impression
 * que le bouton "Message" n'ouvrait "que la messagerie" au lieu de LA
 * conversation : on atterrissait bien sur une messagerie, mais pas celle
 * qui allait être rouverte ensuite depuis le dashboard.
 */
import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch, tokenStorage } from '../services/apiFetch';

type ActorType = 'company' | 'delivery' | 'correspondent' | 'partner' | 'client';

interface ConversationLookup {
  id:            string;
  contactUserId: string | null;
  contactOnline: boolean;
}

/** Route de la messagerie propre à l'espace (dashboard) où l'on se trouve
 *  actuellement — chacune monte le même MessagerieCore, mais sur une URL
 *  différente. Par défaut (home public, dashboards sans messagerie
 *  intégrée) : la messagerie partagée /messagerie. */
function resolveMessagerieRoute(pathname: string): string {
  if (pathname.startsWith('/dashboard/entreprise')) return '/dashboard/entreprise/messages';
  if (pathname.startsWith('/dashboard/livreur'))    return '/dashboard/livreur/messages';
  return '/messagerie';
}

export function useStartConversation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const start = useCallback(async (
    targetType: ActorType,
    targetId:   string,
    onError?:   (msg: string) => void,
  ) => {
    if (!tokenStorage.get()) {
      navigate('/login');
      return;
    }
    if (!targetId) return;

    setLoading(true);
    try {
      const conv = await apiFetch<{ id: string }>(
        '/messagerie/conversations',
        { method: 'POST', body: { targetType, targetId } },
      );
      if (conv?.id) {
        navigate(resolveMessagerieRoute(location.pathname), { state: { activeConvId: conv.id } });
      }
    } catch (err: any) {
      onError?.(err?.message ?? 'Impossible d\'ouvrir la conversation.');
    } finally {
      setLoading(false);
    }
  }, [navigate, location.pathname]);

  /**
   * Résout conversationId/contactUserId/contactOnline sans naviguer —
   * utilisé par les boutons "Appeler" (même endpoint, donc mêmes
   * vérifications de permission que "Contacter", mais on reste sur
   * la page courante pour démarrer un appel plutôt que d'ouvrir la messagerie).
   */
  const resolveContact = useCallback(async (
    targetType: ActorType,
    targetId:   string,
    onError?:   (msg: string) => void,
  ): Promise<ConversationLookup | null> => {
    if (!tokenStorage.get()) {
      navigate('/login');
      return null;
    }
    if (!targetId) return null;

    try {
      return await apiFetch<ConversationLookup>(
        '/messagerie/conversations',
        { method: 'POST', body: { targetType, targetId } },
      );
    } catch (err: any) {
      onError?.(err?.message ?? 'Impossible de contacter cette personne.');
      return null;
    }
  }, [navigate]);

  return { start, resolveContact, loading };
}
