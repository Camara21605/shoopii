/**
 * Le livreur a refusé : le client en choisit un autre, sans quitter l'appli
 * (avant : page du site). Proposés : les livreurs de la boutique (disponibles
 * d'abord), puis ceux que le client suit. PATCH /client/commandes/:uuid/livreur —
 * le serveur refuse un livreur suspendu, en pause ou dont le compte est fermé.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AvatarPhoto } from '@/components/avatar-photo';
import { BottomSheet } from '@/components/bottom-sheet';
import { initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { fetchFollowedTeam } from '@/features/checkout/api';
import { fetchShopDrivers } from '@/features/shop/api';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

import { chooseDriver } from '../api';

type Option = { id: string; name: string; photo: string | null; note: number; place: string | null; available: boolean; source: string };

export function DriverChoiceSheet({ uuid, companyId, shopName, excludeId, onClose, onDone }: {
  uuid: string;
  companyId: string | null;
  shopName: string | null;
  excludeId?: string | null;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shop = useQuery({ queryKey: ['shop-drivers', companyId], queryFn: () => fetchShopDrivers(companyId as string), enabled: !!companyId });
  const followed = useQuery({ queryKey: ['followed-team'], queryFn: fetchFollowedTeam });

  const options = useMemo<Option[]>(() => {
    const m = new Map<string, Option>();
    for (const d of shop.data ?? []) {
      m.set(d.id, { id: d.id, name: d.fullName, photo: d.photo ?? null, note: d.note, place: d.localisation ?? d.zone ?? null, available: d.availability === 'available', source: `Livreur de ${shopName ?? 'la boutique'}` });
    }
    for (const f of followed.data?.livreurs ?? []) {
      if (!m.has(f.id)) m.set(f.id, { id: f.id, name: f.nom, photo: f.photo ?? null, note: f.note, place: f.categorie || null, available: false, source: 'Vous le suivez' });
    }
    return [...m.values()].filter((o) => o.id !== excludeId).sort((a, b) => Number(b.available) - Number(a.available) || b.note - a.note);
  }, [shop.data, followed.data, shopName, excludeId]);

  async function pick(o: Option) {
    setBusy(o.id);
    setError(null);
    try {
      await chooseDriver(uuid, o.id);
      onDone(o.name);
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const loading = (shop.isPending && !!companyId) || followed.isPending;
  return (
    <BottomSheet title="Choisir un autre livreur" onClose={onClose} height={0.8}>
      <ScrollView contentContainerStyle={styles.body}>
        <ThemedText type="small" themeColor="textSecondary">
          Le livreur choisi reçoit la mission et doit l’accepter. Vous êtes prévenu dès qu’il répond.
        </ThemedText>
        {error ? <ThemedText style={styles.err}>{error}</ThemedText> : null}
        {loading ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
        {!loading && !options.length ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            Aucun autre livreur disponible pour cette boutique. Contactez la boutique depuis la messagerie.
          </ThemedText>
        ) : null}
        {options.map((o) => (
          <Pressable key={o.id} onPress={() => void pick(o)} disabled={!!busy} accessibilityRole="button"
            accessibilityLabel={`Choisir ${o.name}${o.available ? ', disponible' : ''}`}
            style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.ava, { backgroundColor: theme.backgroundElement }]}>
              {o.photo ? <AvatarPhoto uri={o.photo} size={46} /> : <ThemedText style={styles.init}>{initials(o.name)}</ThemedText>}
              {o.available ? <View style={[styles.dot, { borderColor: theme.background }]} /> : null}
            </View>
            <View style={styles.flex}>
              <ThemedText numberOfLines={1} style={styles.name}>{o.name}</ThemedText>
              <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                {[o.available ? 'Disponible' : null, o.note ? `★ ${o.note.toFixed(1)}` : null, o.place].filter(Boolean).join(' · ')}
              </ThemedText>
              <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">{o.source}</ThemedText>
            </View>
            {busy === o.id ? <ActivityIndicator color={Brand.primary} /> : <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />}
          </Pressable>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: 10, paddingBottom: 24 },
  loader: { marginVertical: 20 },
  empty: { textAlign: 'center', paddingVertical: 20 },
  err: { color: Brand.danger, fontSize: 13.5, lineHeight: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 10 },
  ava: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  init: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  dot: { position: 'absolute', right: 0, bottom: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: '#16A34A', borderWidth: 2 },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
});
