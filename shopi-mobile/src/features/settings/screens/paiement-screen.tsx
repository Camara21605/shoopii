/**
 * Paramètres › Paiement — les moyens de paiement du PORTEFEUILLE (mêmes données
 * que l'écran Portefeuille et que la rubrique « Paiement » du site) :
 *   liste (Orange Money, MTN, Kulu, carte, PayCard, virement), « Par défaut »,
 *   ajouter (formulaire propre à chaque moyen, contrôles du site), définir par
 *   défaut, supprimer (avec confirmation). 10 moyens au plus (règle du serveur).
 * Jamais de numéro complet de carte ni de CVV : le serveur ne garde que les
 * 4 derniers chiffres. Routes : /wallet/payment-methods (features/wallet/api).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { Card, LoadState, OutlineButton, Pill, Section, useToast } from '@/features/settings/ui';
import {
  ADDABLE, fetchWallet, MAX_METHODS, METHODS, removeMethod, setDefaultMethod,
  type PaymentMethod, type WalletSummary,
} from '@/features/wallet/api';
import { AddMethodSheet, MethodLogo } from '@/features/wallet/components';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

export default function PaiementScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const summary = useQuery({ queryKey: qk.walletPage.summary, queryFn: fetchWallet });
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const methods = summary.data?.paymentMethods ?? [];

  /** Le serveur renvoie la liste à jour : on la pose directement dans le cache du portefeuille. */
  function applyList(list: PaymentMethod[]) {
    qc.setQueryData<WalletSummary>(qk.walletPage.summary, (old) => (old ? { ...old, paymentMethods: list } : old));
  }

  async function makeDefault(m: PaymentMethod) {
    setBusyId(m.id);
    try {
      applyList(await setDefaultMethod(m.id));
      toast.show(`${METHODS[m.type].label} est maintenant votre moyen par défaut`);
    } catch (err) {
      toast.show(toUserMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  function askRemove(m: PaymentMethod) {
    Alert.alert('Supprimer ce moyen de paiement ?', `${m.label || METHODS[m.type].label}${m.number ? ` · ${m.number}` : ''}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: () => {
          setBusyId(m.id);
          removeMethod(m.id)
            .then((list) => { applyList(list); toast.show('Moyen de paiement supprimé'); })
            .catch((err: unknown) => toast.show(toUserMessage(err)))
            .finally(() => setBusyId(null));
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Paiement" />
      {summary.isPending || (summary.error && !summary.data) ? (
        <LoadState loading={summary.isPending} error={summary.error ? toUserMessage(summary.error) : null} onRetry={() => void summary.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={summary.isRefetching} onRefresh={() => void summary.refetch()} colors={[Brand.primary]} />}>
          <Section
            title="Mes moyens de paiement"
            note="Le moyen « par défaut » est proposé en premier pour vos paiements et vos retraits du portefeuille.">
            {methods.length === 0 ? (
              <Card>
                <View style={styles.empty}>
                  <Ionicons name="card-outline" size={34} color={theme.textSecondary} />
                  <ThemedText themeColor="textSecondary" style={styles.center}>
                    Aucun moyen de paiement enregistré. Ajoutez votre numéro Orange Money, MTN ou une carte pour payer plus vite.
                  </ThemedText>
                </View>
              </Card>
            ) : (
              <Card>
                {methods.map((m) => (
                  <View key={m.id} style={styles.method}>
                    <MethodLogo type={m.type} />
                    <View style={styles.flex}>
                      <View style={styles.titleLine}>
                        <ThemedText numberOfLines={1} style={styles.methodTitle}>{m.label || METHODS[m.type].label}</ThemedText>
                        {m.isDefault ? <Pill label="Par défaut" tone="success" /> : null}
                      </View>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {[METHODS[m.type].label, m.number].filter(Boolean).join(' · ')}
                      </ThemedText>
                    </View>
                    {busyId === m.id ? (
                      <ActivityIndicator color={Brand.primary} />
                    ) : (
                      <View style={styles.actions}>
                        {!m.isDefault ? (
                          <Pressable onPress={() => void makeDefault(m)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Définir ${m.label || METHODS[m.type].label} par défaut`} style={styles.iconBtn}>
                            <Ionicons name="star-outline" size={19} color={Brand.primary} />
                          </Pressable>
                        ) : null}
                        <Pressable onPress={() => askRemove(m)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Supprimer ${m.label || METHODS[m.type].label}`} style={styles.iconBtn}>
                          <Ionicons name="trash-outline" size={19} color={Brand.danger} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                ))}
              </Card>
            )}
          </Section>

          {methods.length < MAX_METHODS ? (
            <OutlineButton icon="add" label="Ajouter un moyen de paiement" onPress={() => setAdding(true)} />
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Vous avez atteint le maximum de {MAX_METHODS} moyens de paiement. Supprimez-en un pour en ajouter un autre.
            </ThemedText>
          )}

          <View style={[styles.info, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="lock-closed-outline" size={18} color={Brand.primary} />
            <ThemedText type="small" style={styles.flex}>
              Vos numéros sont protégés : seuls les 4 derniers chiffres d’une carte sont conservés, et Shoneya ne vous demande jamais votre code secret Mobile Money ni le CVV de votre carte.
            </ThemedText>
          </View>
        </ScrollView>
      )}

      {adding ? (
        <AddMethodSheet
          types={ADDABLE}
          onClose={() => setAdding(false)}
          onAdded={(list) => { applyList(list); setAdding(false); toast.show('Moyen de paiement ajouté'); }}
        />
      ) : null}
      {toast.element}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  empty: { alignItems: 'center', gap: 10, padding: Spacing.four },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  methodTitle: { flexShrink: 1, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  info: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 14 },
});
