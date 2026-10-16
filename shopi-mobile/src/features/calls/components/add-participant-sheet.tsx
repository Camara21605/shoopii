/**
 * « Ajouter une personne » pendant un appel : vos conversations récentes,
 * filtrables par nom. Le serveur vérifie de toute façon que vous avez le droit
 * d'appeler la personne choisie (mêmes règles qu'un appel normal).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { fetchConversationPage } from '@/features/messagerie/api';
import { qk } from '@/lib/query-keys';

export function AddParticipantSheet({ visible, excludeUserIds, onPick, onClose }: {
  visible: boolean; excludeUserIds: string[]; onPick: (userId: string) => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const list = useQuery({
    queryKey: qk.calls.inviteCandidates,
    queryFn: () => fetchConversationPage({}),
    enabled: visible,
    staleTime: 60_000,
  });

  const needle = q.trim().toLowerCase();
  const contacts = (list.data?.data ?? [])
    .filter(c => !!c.contactUserId && !excludeUserIds.includes(c.contactUserId))
    .filter(c => !needle || c.contactName.toLowerCase().includes(needle));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.handle} />
        <View style={styles.head}>
          <ThemedText style={styles.title}>Ajouter à l’appel</ThemedText>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
            <Ionicons name="close" size={24} color="#1F1F1F" />
          </Pressable>
        </View>
        <ThemedText style={styles.sub}>4 personnes maximum, vous compris.</ThemedText>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color="#8A93A3" />
          <TextInput value={q} onChangeText={setQ} placeholder="Rechercher un contact" placeholderTextColor="#8A93A3" style={styles.input} />
        </View>
        {list.isLoading ? (
          <ActivityIndicator color={Brand.primary} style={styles.loading} />
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={c => c.id}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<ThemedText style={styles.empty}>Aucun contact disponible.</ThemedText>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { onPick(item.contactUserId!); onClose(); }}
                accessibilityRole="button" accessibilityLabel={`Ajouter ${item.contactName}`}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <View style={styles.avatar}>
                  {item.contactLogo ? <Image source={{ uri: item.contactLogo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : (
                    <ThemedText style={styles.initial}>{item.contactName.trim()[0]?.toUpperCase() ?? '?'}</ThemedText>
                  )}
                </View>
                <View style={styles.flex}>
                  <ThemedText numberOfLines={1} style={styles.name}>{item.contactName}</ThemedText>
                  {item.contactSubtitle ? <ThemedText numberOfLines={1} style={styles.subtitle}>{item.contactSubtitle}</ThemedText> : null}
                </View>
                <View style={styles.addBtn}><Ionicons name="call" size={16} color="#fff" /></View>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, maxHeight: '75%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D9DCE1', marginTop: 8, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: '#1F1F1F' },
  sub: { fontSize: 13, lineHeight: 18, color: '#6B7280', marginTop: 2, marginBottom: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F2F3F5', borderRadius: 14, paddingHorizontal: 12, height: 44 },
  input: { flex: 1, fontSize: 15, color: '#1F1F1F' },
  loading: { marginVertical: 30 },
  list: { marginTop: 8 },
  empty: { textAlign: 'center', color: '#6B7280', marginVertical: 30 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderRadius: 12 },
  rowPressed: { backgroundColor: '#F2F3F5' },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 18, fontWeight: '800', color: '#1F1F1F' },
  flex: { flex: 1 },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: '#1F1F1F' },
  subtitle: { fontSize: 12, lineHeight: 16, color: '#6B7280' },
  addBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Brand.success, alignItems: 'center', justifyContent: 'center' },
});
