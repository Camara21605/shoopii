/**
 * Demander un retour (commande livrée) — comme la fenêtre du site :
 * article (seulement ceux encore en vente : le serveur l'exige), quantité,
 * motif, description (10 caractères minimum). POST /client/returns — la
 * boutique examine la demande depuis « Retours & SAV ».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

import { createReturn, RETURN_REASONS, type OrderDetail, type ReturnReason } from '../api';

export function ReturnSheet({ uuid, articles, onClose, onDone }: {
  uuid: string;
  articles: OrderDetail['articles'];
  onClose: () => void;
  onDone: () => void;
}) {
  const theme = useTheme();
  const eligible = articles.filter((a) => !!a.productId);
  const [index, setIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState<ReturnReason>('damaged');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = eligible[index];
  const maxQty = Math.max(1, item?.qty ?? 1);

  async function send() {
    if (!item?.productId) return;
    if (text.trim().length < 10) { setError('Décrivez le problème en quelques mots (10 caractères minimum).'); return; }
    setSending(true);
    setError(null);
    try {
      await createReturn({ commandeId: uuid, productId: item.productId, quantity: Math.min(qty, maxQty), reason, description: text.trim().slice(0, 2000) });
      onDone();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <BottomSheet title="Demander un retour" onClose={onClose} height={0.88}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!eligible.length ? (
          <ThemedText type="small" themeColor="textSecondary">
            Aucun article de cette commande n’est éligible à un retour (produit retiré de la boutique). Contactez la boutique depuis la messagerie.
          </ThemedText>
        ) : (
          <>
            <ThemedText style={styles.label}>Article</ThemedText>
            {eligible.map((a, i) => {
              const on = i === index;
              return (
                <Pressable key={`${a.productId}${i}`} onPress={() => { setIndex(i); setQty(1); }} accessibilityRole="radio" accessibilityState={{ checked: on }}
                  style={[styles.item, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                  <View style={[styles.img, { backgroundColor: theme.backgroundElement }]}>
                    {a.imageUrl ? <Image source={{ uri: thumb(a.imageUrl, 120) ?? a.imageUrl }} style={styles.fill} contentFit="cover" /> : <Ionicons name="cube-outline" size={18} color={theme.textSecondary} />}
                  </View>
                  <ThemedText numberOfLines={2} style={[styles.flex, styles.itemName]}>{a.nom}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">× {a.qty}</ThemedText>
                </Pressable>
              );
            })}

            {maxQty > 1 ? (
              <View style={styles.qtyRow}>
                <ThemedText style={styles.label}>Quantité</ThemedText>
                <View style={styles.qty}>
                  <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} accessibilityRole="button" accessibilityLabel="Moins" style={[styles.qtyBtn, { borderColor: theme.border }]}>
                    <Ionicons name="remove" size={18} color={theme.text} />
                  </Pressable>
                  <ThemedText style={styles.qtyV}>{qty}</ThemedText>
                  <Pressable onPress={() => setQty((q) => Math.min(maxQty, q + 1))} accessibilityRole="button" accessibilityLabel="Plus" style={[styles.qtyBtn, { borderColor: theme.border }]}>
                    <Ionicons name="add" size={18} color={theme.text} />
                  </Pressable>
                </View>
              </View>
            ) : null}

            <ThemedText style={styles.label}>Motif</ThemedText>
            <View style={styles.chips}>
              {RETURN_REASONS.map((r) => {
                const on = r.value === reason;
                return (
                  <Pressable key={r.value} onPress={() => setReason(r.value)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                    style={[styles.chip, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                    <ThemedText type="smallBold">{r.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText style={styles.label}>Description</ThemedText>
            <TextInput
              value={text}
              onChangeText={(t) => { setText(t.slice(0, 2000)); setError(null); }}
              placeholder="Expliquez le problème (10 caractères minimum)"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={2000}
              style={[styles.input, { borderColor: theme.border, color: theme.text }]}
            />
            {error ? <ThemedText style={styles.err}>{error}</ThemedText> : null}
            <PrimaryButton title="Envoyer la demande" onPress={() => void send()} loading={sending} pill />
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              La boutique examine votre demande ; suivez-la dans Mon compte.
            </ThemedText>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  center: { textAlign: 'center' },
  body: { gap: 10, paddingBottom: 24 },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '800', marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, padding: 8 },
  img: { width: 42, height: 42, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyV: { fontSize: 16, lineHeight: 21, fontWeight: '900', minWidth: 20, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 14, padding: 12, minHeight: 96, textAlignVertical: 'top', fontSize: 15 },
  err: { color: Brand.danger, fontSize: 13.5, lineHeight: 18, fontWeight: '700' },
});
