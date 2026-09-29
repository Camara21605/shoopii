/**
 * Panier du client — GET /client/panier (même panier que sur le site :
 * un article ajouté sur l'un apparaît sur l'autre). Réservé au rôle client.
 */
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { useSession } from '@/features/auth/session-store';
import { apiFetch } from '@/lib/api/client';

export const cartItemSchema = z
  .object({
    id: z.string(),
    produitId: z.string(),
    nom: z.string(),
    prix: z.coerce.number(),
    prixAncien: z.coerce.number().nullable().optional(),
    qty: z.coerce.number(),
    variante: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    emoji: z.string().nullable().optional(),
    shopNom: z.string().optional(),
    shopId: z.string().optional(),
    stock: z.coerce.number().optional(),
  })
  .passthrough();
export type CartItem = z.infer<typeof cartItemSchema>;

export function fetchCart() {
  return apiFetch('/client/panier', { schema: z.array(cartItemSchema) });
}

/** Panier du client connecté (désactivé pour les autres rôles). */
export function useCart() {
  const role = useSession((s) => s.user?.role);
  return useQuery({ queryKey: ['cart'], queryFn: fetchCart, enabled: role === 'client', staleTime: 30_000 });
}

export const cartCount = (items: CartItem[] | undefined) => (items ?? []).reduce((n, i) => n + i.qty, 0);
