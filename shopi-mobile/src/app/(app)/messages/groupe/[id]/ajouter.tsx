/**
 * Messagerie › Groupe › Ajouter des membres (administrateur d'un groupe
 * libre, POST /delivery-groups/:id/members). Les membres actuels sont
 * affichés cochés et grisés ; les nouveaux reçoivent les droits par défaut
 * du groupe. 50 membres au plus.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import type { SearchUser } from '@/features/messagerie/api';
import { addGroupMembers, fetchGroupMembers } from '@/features/messagerie/groups-api';
import { memberKey, MemberPicker } from '@/features/messagerie/MemberPicker';
import { useTheme } from '@/hooks/use-theme';

const MAX_TOTAL = 50;

export default function AddMembersScreen() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const qc = useQueryClient();
  const members = useQuery({ queryKey: ['group-members', groupId], queryFn: () => fetchGroupMembers(groupId), enabled: !!groupId });
  const [selected, setSelected] = useState<SearchUser[]>([]);
  const [saving, setSaving] = useState(false);

  const exclude = useMemo(() => new Set((members.data ?? []).map((m) => `${m.actorType}:${m.actorId}`)), [members.data]);
  const room = MAX_TOTAL - (members.data?.length ?? 0);

  function toggle(u: SearchUser) {
    const k = memberKey(u);
    setSelected((prev) => {
      if (prev.some((x) => memberKey(x) === k)) return prev.filter((x) => memberKey(x) !== k);
      if (prev.length >= room) {
        Alert.alert('Groupe complet', `Un groupe compte au plus ${MAX_TOTAL} membres.`);
        return prev;
      }
      return [...prev, u];
    });
  }

  async function handleAdd() {
    if (!selected.length || saving) return;
    setSaving(true);
    try {
      await addGroupMembers(groupId, selected.map((u) => ({ type: u.type, id: u.id })));
      void qc.invalidateQueries({ queryKey: ['group-members', groupId] });
      void qc.invalidateQueries({ queryKey: ['groups'] });
      router.back();
    } catch (err) {
      Alert.alert('Ajout impossible', err instanceof Error ? err.message : 'Réessayez dans un instant.');
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Ajouter des membres" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {members.isPending ? (
          <ActivityIndicator color={Brand.primary} style={styles.loader} />
        ) : (
          <MemberPicker selected={selected} onToggle={toggle} exclude={exclude} />
        )}
        <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          <Pressable onPress={() => void handleAdd()} disabled={!selected.length || saving} accessibilityRole="button"
            style={[styles.btn, (!selected.length || saving) && styles.off]}>
            {saving ? <ActivityIndicator color={Brand.primaryInk} /> : <Ionicons name="person-add" size={18} color={Brand.primaryInk} />}
            <ThemedText style={styles.btnText}>
              {saving ? 'Ajout…' : selected.length ? `Ajouter ${selected.length} membre${selected.length > 1 ? 's' : ''}` : 'Choisissez des personnes'}
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  loader: { marginTop: 60 },
  footer: { paddingHorizontal: Spacing.three, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, minHeight: 50 },
  off: { opacity: 0.4 },
  btnText: { color: Brand.primaryInk, fontSize: 16, fontWeight: '800' },
});
