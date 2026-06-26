import React, {
  createContext, useContext, useState,
  useEffect, useCallback,
} from 'react';
import { apiFetch } from '../services/apiFetch';
import { getRoleFromToken } from '../services/authUtils';

export interface CartItemApi {
  id:       string;
  produitId:string;
  nom:      string;
  prix:     number;
  prixAncien: number | null;
  qty:      number;
  variante: string | null;
  imageUrl: string | null;
  emoji:    string | null;
  shopNom:  string;
  shopId:   string;
  stock:    number;
}

interface CartContextValue {
  items:      CartItemApi[];
  count:      number;
  loading:    boolean;
  /* ✅ Retourne l'item si le produit est déjà dans le panier, null sinon */
  isInCart:   (produitId: string) => CartItemApi | null;
  addToCart:  (produitId: string, qty?: number, variante?: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  updateQty:  (itemId: string, qty: number) => Promise<void>;
  clearCart:  () => Promise<void>;
  refresh:    () => Promise<void>;
}

const CartContext = createContext<CartContextValue>({
  items: [], count: 0, loading: false,
  isInCart:   () => null,
  addToCart:  async () => {},
  removeItem: async () => {},
  updateQty:  async () => {},
  clearCart:  async () => {},
  refresh:    async () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items,   setItems]   = useState<CartItemApi[]>([]);
  const [loading, setLoading] = useState(false);
  const isClient = getRoleFromToken() === 'client';

  const refresh = useCallback(async () => {
    if (!isClient) return;
    try {
      const data = await apiFetch<CartItemApi[]>('/client/panier');
      setItems(data ?? []);
    } catch { /* silencieux */ }
  }, [isClient]);

  useEffect(() => { refresh(); }, [refresh]);

  /* ✅ Vérifie si un produit est déjà dans le panier */
  const isInCart = useCallback((produitId: string): CartItemApi | null => {
    return items.find(i => i.produitId === produitId) ?? null;
  }, [items]);

  const addToCart = useCallback(async (produitId: string, qty = 1, variante?: string) => {
    if (!isClient) return;
    if (!produitId) return;
    setLoading(true);
    try {
      const data = await apiFetch<CartItemApi[]>('/client/panier', {
        method: 'POST',
        body: { produitId, qty, variante },
      });
      setItems(data ?? []);
    } finally { setLoading(false); }
  }, [isClient]);

  const updateQty = useCallback(async (itemId: string, qty: number) => {
    if (!isClient) return;
    setLoading(true);
    try {
      const data = await apiFetch<CartItemApi[]>(`/client/panier/${itemId}`, {
        method: 'PATCH',
        body: { qty },
      });
      setItems(data ?? []);
    } finally { setLoading(false); }
  }, [isClient]);

  const removeItem = useCallback(async (itemId: string) => {
    if (!isClient) return;
    setItems(prev => prev.filter(i => i.id !== itemId));
    try {
      const data = await apiFetch<CartItemApi[]>(`/client/panier/${itemId}`, { method: 'DELETE' });
      setItems(data ?? []);
    } catch { refresh(); }
  }, [isClient, refresh]);

  const clearCart = useCallback(async () => {
    if (!isClient) return;
    setLoading(true);
    try {
      await apiFetch('/client/panier', { method: 'DELETE' });
      setItems([]);
    } finally { setLoading(false); }
  }, [isClient]);

  const count = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider value={{
      items, count, loading,
      isInCart, addToCart, removeItem, updateQty, clearCart, refresh,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);