/**
 * Données de « Mes adresses » : lecture + écritures OPTIMISTES (règle 5) —
 * « par défaut » et « supprimer » changent l'écran tout de suite, la réponse du
 * serveur fait foi, un échec remet la liste d'avant.
 * Après chaque écriture, on rafraîchit aussi ce qui dépend de l'adresse par
 * défaut : le passage de commande, la ville du profil, les distances (Explorer,
 * fiche produit).
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { createAddress, deleteAddress, fetchAddresses, setDefaultAddress, updateAddress, type Address, type AddressInput } from './api';

export const useAddresses = () => useQuery({ queryKey: qk.addresses, queryFn: fetchAddresses });

function refreshDependents(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: qk.addresses });
  void qc.invalidateQueries({ queryKey: qk.checkout.addresses });
  void qc.invalidateQueries({ queryKey: qk.profile.city });
  void qc.invalidateQueries({ queryKey: qk.defaultCity });
}

/** Le serveur trie : par défaut d'abord, puis la plus récente. */
const sortDefaultFirst = (list: Address[]) => [...list].sort((a, b) => Number(b.estDefaut) - Number(a.estDefaut));

export function useAddressActions() {
  const qc = useQueryClient();

  const snapshot = async () => {
    await qc.cancelQueries({ queryKey: qk.addresses });
    return { prev: qc.getQueryData<Address[]>(qk.addresses) };
  };
  const rollback = (_e: unknown, _v: unknown, ctx?: { prev?: Address[] }) => {
    if (ctx?.prev) qc.setQueryData(qk.addresses, ctx.prev);
  };

  const makeDefault = useMutation({
    mutationFn: setDefaultAddress,
    onMutate: async (id: string) => {
      const ctx = await snapshot();
      qc.setQueryData<Address[]>(qk.addresses, (old) => (old ? sortDefaultFirst(old.map((a) => ({ ...a, estDefaut: a.id === id }))) : old));
      return ctx;
    },
    onSuccess: (list) => qc.setQueryData(qk.addresses, list),
    onError: rollback,
    onSettled: () => refreshDependents(qc),
  });

  const remove = useMutation({
    mutationFn: deleteAddress,
    onMutate: async (id: string) => {
      const ctx = await snapshot();
      qc.setQueryData<Address[]>(qk.addresses, (old) => {
        if (!old) return old;
        const gone = old.find((a) => a.id === id);
        const rest = old.filter((a) => a.id !== id);
        /* Même règle que le serveur : le « par défaut » passe à la plus récente des autres (déjà en tête après tri). */
        if (gone?.estDefaut && rest.length) rest[0] = { ...rest[0], estDefaut: true };
        return rest;
      });
      return ctx;
    },
    onError: rollback,
    onSettled: () => refreshDependents(qc),
  });

  const save = useMutation({
    mutationFn: ({ id, body }: { id?: string; body: AddressInput }) => (id ? updateAddress(id, body) : createAddress(body)),
    onSettled: () => refreshDependents(qc),
  });

  return { makeDefault, remove, save };
}
