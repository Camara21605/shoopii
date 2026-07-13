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

  const refresh = useCallback(async () => {
    if (getRoleFromToken() !== 'client') return;
    try {
      const data = await apiFetch<CartItemApi[]>('/client/panier');
      setItems(data ?? []);
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /* Recharge le panier quand l'utilisateur se connecte dans le même onglet */
  useEffect(() => {
    const handleAuth = () => { void refresh(); };
    window.addEventListener('auth:login', handleAuth);
    return () => window.removeEventListener('auth:login', handleAuth);
  }, [refresh]);

  /* ✅ Vérifie si un produit est déjà dans le panier */
  const isInCart = useCallback((produitId: string): CartItemApi | null => {
    return items.find(i => i.produitId === produitId) ?? null;
  }, [items]);

  const addToCart = useCallback(async (produitId: string, qty = 1, variante?: string) => {
    if (getRoleFromToken() !== 'client') return;
    if (!produitId) return;
    const data = await apiFetch<CartItemApi[]>('/client/panier', {
      method: 'POST',
      body: { produitId, qty, variante },
    });
    setItems(data ?? []);
  }, []);

  const updateQty = useCallback(async (itemId: string, qty: number) => {
    if (getRoleFromToken() !== 'client') return;
    /* Mise à jour optimiste — l'UI réagit immédiatement sans attendre l'API */
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, qty } : i));
    try {
      const data = await apiFetch<CartItemApi[]>(`/client/panier/${itemId}`, {
        method: 'PATCH',
        body: { qty },
      });
      setItems(data ?? []);
    } catch {
      /* Rollback : resynchronise depuis le serveur */
      void refresh();
    }
  }, [refresh]);

  const removeItem = useCallback(async (itemId: string) => {
    if (getRoleFromToken() !== 'client') return;
    setItems(prev => prev.filter(i => i.id !== itemId));
    try {
      const data = await apiFetch<CartItemApi[]>(`/client/panier/${itemId}`, { method: 'DELETE' });
      setItems(data ?? []);
    } catch { void refresh(); }
  }, [refresh]);

  const clearCart = useCallback(async () => {
    if (getRoleFromToken() !== 'client') return;
    setLoading(true);
    try {
      await apiFetch('/client/panier', { method: 'DELETE' });
      setItems([]);
    } finally { setLoading(false); }
  }, []);

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