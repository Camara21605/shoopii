/**
 * Feuilles du bas de l'écran pour les commandes :
 *   · DriverSheet  choisir le livreur (livreurs de l'entreprise, recherche,
 *                  note, zone, disponibilité) — le livreur doit ensuite accepter ;
 *   · IssueSheet   signaler un problème (type + description).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form';
import { AvatarPhoto } from '@/components/avatar-photo';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { assignDriver, fetchAssignableDrivers, ISSUE_TYPES, normalize, reportIssue, type IssueType, type Order } from '../api';

/** Hauteur de la feuille « liste » : les trois quarts de l'écran. */
const TALL = Math.round(Dimensions.get('window').height * 0.75);

function Sheet({ title, onClose, children, tall }: { title: string; onClose: () => void; children: React.ReactNode; tall?: boolean }) {
  const theme = useTheme();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['bottom']} style={[styles.sheet, tall && { height: TALL }, { backgroundColor: theme.background }]}>
          <View style={styles.grip} />
          <View style={styles.head}>
            <ThemedText style={styles.title} numberOfLines={1}>
              {title}
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer" style={[styles.close, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="close" size={20} color={theme.text} />
            </Pressable>
          </View>
          {children}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function DriverSheet({ order, onClose, onDone }: { order: Pick<Order, 'uuid' | 'id' | 'livreurId'>; onClose: () => void; onDone: (msg: string) => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const drivers = useQuery({ queryKey: qk.company.drivers, queryFn: fetchAssignableDrivers, staleTime: 5 * 60_000 });
  const assign = useMutation({
    mutationFn: (id: string) => assignDriver(order.uuid, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.company.orders });
      void qc.invalidateQueries({ queryKey: qk.company.order(order.uuid) });
      onDone('Livreur assigné — en attente de sa confirmation');
    },
  });
  const n = normalize(q.trim());
  const list = (drivers.data ?? []).filter((d) => !n || normalize(`${d.fullName} ${d.zone ?? ''}`).includes(n));

  return (
    <Sheet title={`Assigner un livreur — ${order.id}`} onClose={onClose} tall>
      <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={17} color={theme.textSecondary} />
        <TextInput value={q} onChangeText={setQ} placeholder="Rechercher un livreur ou une zone" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text }]} accessibilityLabel="Rechercher un livreur" />
      </View>
      {assign.isError ? <ThemedText style={styles.err}>{toUserMessage(assign.error)}</ThemedText> : null}
      {drivers.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      ) : (
        <FlatList
          style={styles.flex}
          data={list}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              {drivers.data?.length ? 'Aucun livreur ne correspond à votre recherche.' : 'Aucun livreur dans votre entreprise pour le moment. Ajoutez-en depuis « Mes livreurs ».'}
            </ThemedText>
          }
          renderItem={({ item: d }) => {
            const current = d.id === order.livreurId;
            const busy = assign.isPending && assign.variables === d.id;
            return (
              <Pressable
                onPress={() => !current && !assign.isPending && assign.mutate(d.id)}
                disabled={current || assign.isPending}
                accessibilityRole="button"
                accessibilityLabel={`${d.fullName}${current ? ', livreur actuel' : ''}`}
                style={({ pressed }) => [styles.driver, { borderColor: current ? Brand.primaryLine : theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.ava, { backgroundColor: Brand.primarySoft }]}>
                  {d.photo ? <AvatarPhoto uri={d.photo} size={44} /> : <ThemedText style={styles.emoji}>{d.avatarEmoji || '🛵'}</ThemedText>}
                </View>
                <View style={styles.flex}>
                  <ThemedText style={styles.bold} numberOfLines={1}>
                    {d.fullName}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {d.zone || 'Zone non précisée'}
                    {d.averageRating > 0 ? ` · ★ ${d.averageRating.toFixed(1)}` : ''}
                  </ThemedText>
                </View>
                {busy ? <ActivityIndicator color={Brand.primary} /> : current ? <ThemedText style={styles.current}>Actuel</ThemedText> : <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />}
              </Pressable>
            );
          }}
        />
      )}
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        Le livreur reçoit la mission et doit l’accepter ; s’il refuse, vous pourrez en choisir un autre.
      </ThemedText>
    </Sheet>
  );
}

export function IssueSheet({ uuid, onClose, onDone }: { uuid: string; onClose: () => void; onDone: (msg: string) => void }) {
  const theme = useTheme();
  const [type, setType] = useState<IssueType>('autre');
  const [text, setText] = useState('');
  const send = useMutation({ mutationFn: () => reportIssue(uuid, type, text.trim()), onSuccess: () => onDone('Problème signalé à l’équipe Shoneya') });
  const tooShort = text.trim().length < 10;
  return (
    <Sheet title="Signaler un problème" onClose={onClose}>
      <View style={styles.body}>
        <View style={styles.chips}>
          {ISSUE_TYPES.map((t) => {
            const on = t.value === type;
            return (
              <Pressable key={t.value} onPress={() => setType(t.value)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.chip, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                <ThemedText style={[styles.chipText, on && { color: Brand.primaryInk }]}>{t.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          placeholder="Décrivez le problème (10 caractères minimum)…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.area, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          accessibilityLabel="Description du problème"
        />
        {send.isError ? <ThemedText style={styles.err}>{toUserMessage(send.error)}</ThemedText> : null}
        <PrimaryButton title="Envoyer le signalement" onPress={() => send.mutate()} loading={send.isPending} disabled={tooShort} pill />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 8, maxHeight: Math.round(Dimensions.get('window').height * 0.9) },
  grip: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#E0E0E0', marginTop: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12 },
  title: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, marginHorizontal: 16, minHeight: 44 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  loader: { marginTop: 32 },
  list: { padding: 16, gap: 8 },
  empty: { textAlign: 'center', marginTop: 24, paddingHorizontal: 16 },
  driver: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 12 },
  ava: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22, lineHeight: 28 },
  bold: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  current: { color: Brand.primaryInk, fontSize: 12.5, fontWeight: '800' },
  note: { paddingHorizontal: 18, paddingBottom: 6, textAlign: 'center' },
  err: { color: Brand.danger, fontSize: 13, paddingHorizontal: 18, paddingTop: 6, fontWeight: '600' },
  body: { paddingHorizontal: 16, paddingBottom: 12, gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  area: { borderWidth: 1, borderRadius: 14, padding: 12, minHeight: 110, textAlignVertical: 'top', fontSize: 15 },
});
