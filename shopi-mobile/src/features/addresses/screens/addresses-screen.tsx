/**
 * Mes adresses (route /adresses) — version téléphone de la page « Adresses »
 * du site, sans passer par le navigateur :
 *   · bandeau : à quoi sert l'adresse par défaut + compteur (20 max) ;
 *   · cartes d'adresse : type, libellé, rue, quartier · commune, ville,
 *     téléphone, consignes, état GPS ; actions par défaut / modifier / supprimer ;
 *   · état vide illustré ; bouton « Ajouter une adresse » toujours visible.
 * Écritures optimistes (voir ../hooks.ts). Données : ../api.ts.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { confirmAction } from '@/lib/confirm';

import { addressTitle, MAX_ADDRESSES, type Address } from '../api';
import { AddressCard } from '../components';
import { useAddressActions, useAddresses } from '../hooks';

export default function AddressesScreen() {
  const theme = useTheme();
  const q = useAddresses();
  const { makeDefault, remove } = useAddressActions();
  const snack = useSnack();
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const list = q.data ?? [];
  const full = list.length >= MAX_ADDRESSES;
  const pending = (id: string) => (makeDefault.isPending && makeDefault.variables === id) || (remove.isPending && remove.variables === id);

  const add = () => {
    if (full) return snack.show(`Vous avez déjà ${MAX_ADDRESSES} adresses : supprimez-en une pour en ajouter une autre.`, true);
    router.push('/adresses/nouvelle');
  };

  const onDefault = (a: Address) =>
    makeDefault.mutate(a.id, {
      onSuccess: () => snack.show(`« ${addressTitle(a)} » est maintenant votre adresse par défaut`),
      onError: (e) => snack.show(toUserMessage(e), true),
    });

  const onDelete = async (a: Address) => {
    const others = list.length > 1;
    const ok = await confirmAction(
      'Supprimer cette adresse ?',
      a.estDefaut && others
        ? `« ${addressTitle(a)} » est votre adresse par défaut : la plus récente des autres la remplacera.`
        : `« ${addressTitle(a)} » sera retirée de vos adresses.`,
      'Supprimer',
      true,
    );
    if (!ok) return;
    remove.mutate(a.id, {
      onSuccess: () => snack.show('Adresse supprimée'),
      onError: (e) => snack.show(toUserMessage(e), true),
    });
  };

  const refresh = async () => {
    setPullRefreshing(true);
    await q.refetch();
    setPullRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Mes adresses"
        right={
          list.length ? (
            <Pressable onPress={add} accessibilityRole="button" accessibilityLabel="Ajouter une adresse" hitSlop={8} style={[styles.headerAdd, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="add" size={22} color={theme.text} />
            </Pressable>
          ) : undefined
        }
      />

      {q.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(a) => a.id}
          contentContainerStyle={[styles.content, !list.length && styles.contentEmpty]}
          refreshControl={<RefreshControl refreshing={pullRefreshing} onRefresh={() => void refresh()} colors={[Brand.primary]} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={list.length ? <Intro count={list.length} /> : null}
          ListEmptyComponent={<EmptyState onAdd={add} />}
          renderItem={({ item }) => (
            <AddressCard
              address={item}
              busy={pending(item.id)}
              onEdit={() => router.push({ pathname: '/adresses/[id]', params: { id: item.id } })}
              onMakeDefault={() => onDefault(item)}
              onDelete={() => void onDelete(item)}
            />
          )}
        />
      )}

      {list.length ? (
        <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          <Pressable
            onPress={add}
            disabled={full}
            accessibilityRole="button"
            accessibilityState={{ disabled: full }}
            style={({ pressed }) => [styles.addBtn, full && styles.disabled, pressed && styles.pressed]}>
            <Ionicons name="add-circle" size={20} color="#fff" />
            <ThemedText style={styles.addText}>{full ? 'Limite de 20 adresses atteinte' : 'Ajouter une adresse'}</ThemedText>
          </Pressable>
        </View>
      ) : null}

      <Snack msg={snack.msg} bottom={list.length ? 96 : 24} />
    </SafeAreaView>
  );
}

function Intro({ count }: { count: number }) {
  const theme = useTheme();
  return (
    <View style={styles.intro}>
      <View style={[styles.introCard, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.introIco}>
          <Ionicons name="bicycle" size={20} color="#fff" />
        </View>
        <ThemedText style={styles.introText}>
          Votre adresse <ThemedText style={styles.bold}>par défaut</ThemedText> est proposée à chaque commande et sert au calcul des distances avec les boutiques, livreurs et points relais.
        </ThemedText>
      </View>
      <View style={styles.countRow}>
        <ThemedText style={styles.countTitle}>{count === 1 ? '1 adresse enregistrée' : `${count} adresses enregistrées`}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {count} / {MAX_ADDRESSES}
        </ThemedText>
      </View>
    </View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyHalo, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.emptyIco}>
          <Ionicons name="location" size={34} color="#fff" />
        </View>
      </View>
      <ThemedText style={styles.emptyTitle}>Aucune adresse pour l’instant</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.emptyText}>
        Enregistrez votre domicile, votre bureau ou tout autre lieu de livraison : vous n’aurez plus à le saisir à chaque commande.
      </ThemedText>
      <View style={styles.perks}>
        <Perk icon="flash-outline" text="Commande plus rapide" />
        <Perk icon="navigate-outline" text="Livreur guidé jusqu’à vous grâce à l’épingle GPS" />
        <Perk icon="call-outline" text="Un numéro de contact par adresse" />
      </View>
      <Pressable onPress={onAdd} accessibilityRole="button" style={({ pressed }) => [styles.addBtn, styles.emptyBtn, pressed && styles.pressed]}>
        <Ionicons name="add-circle" size={20} color="#fff" />
        <ThemedText style={styles.addText}>Ajouter ma première adresse</ThemedText>
      </Pressable>
    </View>
  );
}

function Perk({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.perk}>
      <Ionicons name={icon} size={16} color={Brand.primary} />
      <ThemedText type="small" style={styles.flex}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  loader: { marginTop: 60 },
  headerAdd: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.three, paddingBottom: 110 },
  contentEmpty: { flexGrow: 1, justifyContent: 'center', paddingBottom: Spacing.five },
  sep: { height: 12 },
  intro: { gap: 14, marginBottom: 14 },
  introCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14 },
  introIco: { width: 40, height: 40, borderRadius: 12, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  introText: { flex: 1, fontSize: 13, lineHeight: 18 },
  countRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  countTitle: { fontSize: 13, lineHeight: 17, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.three, paddingTop: 10, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.primary, borderRadius: 999, minHeight: 52, paddingHorizontal: 20 },
  addText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  empty: { alignItems: 'center', paddingHorizontal: 12, gap: 10 },
  emptyHalo: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyIco: { width: 72, height: 72, borderRadius: 36, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, lineHeight: 26, fontWeight: '900', textAlign: 'center' },
  emptyText: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
  perks: { alignSelf: 'stretch', gap: 10, marginTop: 10, marginBottom: 8 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyBtn: { alignSelf: 'stretch', marginTop: 8 },
});
