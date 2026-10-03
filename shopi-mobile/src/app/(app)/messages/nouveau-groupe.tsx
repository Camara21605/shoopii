/**
 * Messagerie › Créer un groupe — même règle que le site (POST /delivery-groups) :
 * un nom (1 à 100 caractères) et au moins 1 autre membre (49 au plus, vous
 * compris = 50). Photo facultative : envoyée juste après la création (le
 * créateur est administrateur, seul un admin peut changer la photo).
 * Une fois créé, le groupe s'ouvre directement.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import type { SearchUser } from '@/features/messagerie/api';
import { createGroup, updateGroup } from '@/features/messagerie/groups-api';
import { memberKey, MemberPicker } from '@/features/messagerie/MemberPicker';
import { uploadAttachment } from '@/features/messagerie/upload';
import { useTheme } from '@/hooks/use-theme';

const MAX_MEMBERS = 49;

export default function NewGroupScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [selected, setSelected] = useState<SearchUser[]>([]);
  const [saving, setSaving] = useState(false);

  const canCreate = name.trim().length > 0 && selected.length > 0 && !saving;

  function toggle(u: SearchUser) {
    const k = memberKey(u);
    setSelected((prev) => {
      if (prev.some((x) => memberKey(x) === k)) return prev.filter((x) => memberKey(x) !== k);
      if (prev.length >= MAX_MEMBERS) {
        Alert.alert('Groupe complet', `Un groupe compte au plus ${MAX_MEMBERS + 1} membres, vous compris.`);
        return prev;
      }
      return [...prev, u];
    });
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission refusée', 'Autorisez l’accès à vos photos pour choisir une image.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0]);
  }

  async function handleCreate() {
    if (!canCreate) return;
    setSaving(true);
    try {
      const group = await createGroup(name.trim(), selected.map((u) => ({ type: u.type, id: u.id })));
      let photoUrl = '';
      if (photo) {
        try {
          photoUrl = await uploadAttachment('avatar', { uri: photo.uri, name: photo.fileName ?? 'groupe.jpg', mimeType: photo.mimeType ?? 'image/jpeg' });
          await updateGroup(group.id, { photoUrl });
        } catch {
          photoUrl = '';
          Alert.alert('Photo non enregistrée', 'Le groupe est créé, mais la photo n’a pas pu être envoyée. Vous pourrez la changer dans les infos du groupe.');
        }
      }
      void qc.invalidateQueries({ queryKey: ['groups'] });
      router.replace({ pathname: '/messages/groupe/[id]', params: { id: group.id, name: group.name ?? name.trim(), photo: photoUrl } });
    } catch (err) {
      Alert.alert('Création impossible', err instanceof Error ? err.message : 'Réessayez dans un instant.');
      setSaving(false);
    }
  }

  const header = (
    <View style={styles.top}>
      <Pressable onPress={() => void pickPhoto()} accessibilityRole="button" accessibilityLabel="Choisir la photo du groupe" style={[styles.photo, { backgroundColor: theme.backgroundSelected }]}>
        {photo ? <Image source={{ uri: photo.uri }} style={styles.fill} contentFit="cover" /> : <Ionicons name="camera" size={26} color={Brand.primary} />}
        <View style={styles.photoEdit}><Ionicons name="pencil" size={11} color="#fff" /></View>
      </Pressable>
      <View style={styles.flex}>
        <ThemedText style={styles.label}>Nom du groupe</ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ex. Famille, Équipe livraison…"
          placeholderTextColor={theme.textSecondary}
          maxLength={100}
          style={[styles.nameInput, { color: theme.text, borderBottomColor: name.trim() ? Brand.primary : theme.border }]}
          accessibilityLabel="Nom du groupe"
        />
        <ThemedText type="small" themeColor="textSecondary">
          {selected.length ? `${selected.length + 1} membres (vous compris)` : 'Choisissez au moins une personne ci-dessous'}
        </ThemedText>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Nouveau groupe" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <MemberPicker selected={selected} onToggle={toggle} header={header} />

        <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          <Pressable
            onPress={() => void handleCreate()}
            disabled={!canCreate}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canCreate }}
            style={[styles.createBtn, !canCreate && styles.createOff]}>
            {saving ? <ActivityIndicator color={Brand.primaryInk} /> : <Ionicons name="checkmark" size={20} color={Brand.primaryInk} />}
            <ThemedText style={styles.createText}>{saving ? 'Création…' : 'Créer le groupe'}</ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  photo: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photoEdit: { position: 'absolute', right: 2, bottom: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: Brand.primary, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: Brand.primary },
  nameInput: { fontSize: 17, fontWeight: '700', paddingVertical: 6, borderBottomWidth: 2, marginBottom: 4 },
  footer: { paddingHorizontal: Spacing.three, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, minHeight: 50 },
  createOff: { opacity: 0.4 },
  createText: { color: Brand.primaryInk, fontSize: 16, fontWeight: '800' },
});
