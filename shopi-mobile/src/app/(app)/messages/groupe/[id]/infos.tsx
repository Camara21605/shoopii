/**
 * Messagerie › Infos du groupe — mêmes règles que le serveur (delivery-group.service.ts) :
 *   - photo : administrateur seulement (POST /upload/avatar puis PATCH /delivery-groups/:id) ;
 *   - description : tout membre ;
 *   - droits de tous les membres (écrire / vocal / appeler) : admin d'un groupe libre ;
 *   - par membre : nommer/retirer admin, droits individuels (admin d'un groupe libre),
 *     « Envoyer un message » (discussion privée) pour tout le monde ;
 *   - « Ajouter des membres » : admin d'un groupe libre.
 * Un administrateur a toujours tous les droits. Les groupes de commande n'ont pas d'admins.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { openConversationWith, type ActorType } from '@/features/messagerie/api';
import {
  fetchGroupMembers, fetchGroups, groupTitle, isGroupClosed, setGroupPermissions, setMemberAdmin, setMemberPermissions, updateGroup,
  type GroupMember, type GroupPermissions,
} from '@/features/messagerie/groups-api';
import { Avatar } from '@/features/messagerie/MemberPicker';
import { uploadAttachment } from '@/features/messagerie/upload';
import { useTheme } from '@/hooks/use-theme';

const TYPE_LABEL: Record<string, string> = {
  client: 'Client', company: 'Entreprise', delivery: 'Livreur', correspondent: 'Correspondant', partner: 'Partenaire',
};
const PERM_ROWS: { key: keyof GroupPermissions; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'canSendMessages', label: 'Envoyer des messages', icon: 'chatbubble-outline' },
  { key: 'canSendVoice', label: 'Envoyer des vocaux', icon: 'mic-outline' },
  { key: 'canCall', label: 'Lancer un appel', icon: 'call-outline' },
];

function lastSeenLabel(m: GroupMember): string {
  if (m.online) return 'En ligne';
  if (!m.lastSeen) return '';
  const d = new Date(m.lastSeen);
  const sameDay = d.toDateString() === new Date().toDateString();
  return `Vu ${sameDay ? `à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}`;
}

export default function GroupInfoScreen() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const qc = useQueryClient();
  const myId = useSession((s) => s.user?.id);

  const groups = useQuery({ queryKey: ['groups'], queryFn: fetchGroups });
  const group = groups.data?.find((g) => g.id === groupId);
  const members = useQuery({ queryKey: ['group-members', groupId], queryFn: () => fetchGroupMembers(groupId), enabled: !!groupId, refetchInterval: 30_000 });

  const isCustom = group?.kind !== 'order';
  const iAmAdmin = !!group?.myPermissions?.isAdmin;
  const manage = isCustom && iAmAdmin && !(group && isGroupClosed(group));

  const [photoBusy, setPhotoBusy] = useState(false);
  const [descDraft, setDescDraft] = useState<string | null>(null);
  const [descBusy, setDescBusy] = useState(false);
  const [selected, setSelected] = useState<GroupMember | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['groups'] });
    void qc.invalidateQueries({ queryKey: ['group-members', groupId] });
  };

  async function changePhoto() {
    if (!manage) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission refusée', 'Autorisez l’accès à vos photos pour choisir une image.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setPhotoBusy(true);
    try {
      const url = await uploadAttachment('avatar', { uri: a.uri, name: a.fileName ?? 'groupe.jpg', mimeType: a.mimeType ?? 'image/jpeg' });
      await updateGroup(groupId, { photoUrl: url });
      qc.setQueryData(['groups'], (old: typeof groups.data) => old?.map((g) => (g.id === groupId ? { ...g, photoUrl: url } : g)));
    } catch (err) {
      Alert.alert('Photo non enregistrée', err instanceof Error ? err.message : 'Réessayez.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function saveDescription() {
    if (descDraft === null) return;
    setDescBusy(true);
    try {
      await updateGroup(groupId, { description: descDraft.trim() });
      qc.setQueryData(['groups'], (old: typeof groups.data) => old?.map((g) => (g.id === groupId ? { ...g, description: descDraft.trim() || null } : g)));
      setDescDraft(null);
    } catch (err) {
      Alert.alert('Description non enregistrée', err instanceof Error ? err.message : 'Réessayez.');
    } finally {
      setDescBusy(false);
    }
  }

  async function toggleGroupPerm(key: keyof GroupPermissions, value: boolean) {
    setBusy(`all:${key}`);
    try {
      await setGroupPermissions(groupId, { [key]: value });
      refresh();
    } catch (err) {
      Alert.alert('Modification impossible', err instanceof Error ? err.message : 'Réessayez.');
    } finally {
      setBusy(null);
    }
  }

  async function toggleAdmin(m: GroupMember) {
    setBusy(`admin:${m.id}`);
    try {
      await setMemberAdmin(groupId, m.id, !m.isAdmin);
      setSelected({ ...m, isAdmin: !m.isAdmin, canSendMessages: true, canSendVoice: true, canCall: true });
      refresh();
    } catch (err) {
      Alert.alert('Modification impossible', err instanceof Error ? err.message : 'Réessayez.');
    } finally {
      setBusy(null);
    }
  }

  async function toggleMemberPerm(m: GroupMember, key: keyof GroupPermissions, value: boolean) {
    setBusy(`${m.id}:${key}`);
    setSelected({ ...m, [key]: value });
    try {
      await setMemberPermissions(groupId, m.id, { [key]: value });
      refresh();
    } catch (err) {
      setSelected(m);
      Alert.alert('Modification impossible', err instanceof Error ? err.message : 'Réessayez.');
    } finally {
      setBusy(null);
    }
  }

  async function messageMember(m: GroupMember) {
    setBusy(`dm:${m.id}`);
    try {
      const conv = await openConversationWith(m.actorType as ActorType, m.actorId);
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ['conversations'] });
      router.push({
        pathname: '/messages/[id]',
        params: { id: conv.id, name: conv.contactName, logo: conv.contactLogo ?? '', online: conv.contactOnline ? '1' : '0', userId: conv.contactUserId ?? '' },
      });
    } catch (err) {
      Alert.alert('Impossible d’ouvrir la discussion', err instanceof Error ? err.message : 'Réessayez.');
    } finally {
      setBusy(null);
    }
  }

  if (!group) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <ScreenHeader title="Infos du groupe" />
        {groups.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : (
          <ThemedText themeColor="textSecondary" style={styles.missing}>Ce groupe n’est plus disponible.</ThemedText>
        )}
      </SafeAreaView>
    );
  }

  const list = (members.data ?? []).slice().sort((a, b) =>
    Number(b.userId === myId) - Number(a.userId === myId) || Number(b.isAdmin) - Number(a.isAdmin) || Number(b.online) - Number(a.online) || a.displayName.localeCompare(b.displayName));
  const onlineCount = list.filter((m) => m.online).length;
  const defaults = group.defaultPermissions ?? { canSendMessages: true, canSendVoice: true, canCall: true };
  const photo = group.photoUrl;
  const description = descDraft ?? group.description ?? '';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Infos du groupe" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* ── Identité ── */}
        <View style={styles.hero}>
          <Pressable onPress={() => void changePhoto()} disabled={!manage || photoBusy} accessibilityRole="button" accessibilityLabel={manage ? 'Changer la photo du groupe' : 'Photo du groupe'}
            style={[styles.bigPhoto, { backgroundColor: group.kind === 'order' ? '#FFF4E5' : theme.backgroundSelected }]}>
            {photo ? <Image source={{ uri: photo }} style={styles.fill} contentFit="cover" /> : <Ionicons name={group.kind === 'order' ? 'cube' : 'people'} size={44} color={group.kind === 'order' ? '#D97706' : Brand.primary} />}
            {photoBusy ? <View style={styles.photoBusy}><ActivityIndicator color="#fff" /></View> : null}
            {manage && !photoBusy ? <View style={styles.photoEdit}><Ionicons name="camera" size={14} color="#fff" /></View> : null}
          </Pressable>
          <ThemedText style={styles.groupName}>{groupTitle(group)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {group.kind === 'order' ? 'Groupe de commande' : 'Groupe'} · {group.memberCount} membres{onlineCount ? ` · ${onlineCount} en ligne` : ''}
          </ThemedText>
          {isGroupClosed(group) ? (
            <View style={styles.closedPill}><ThemedText style={styles.closedText}>{group.status === 'cancelled' ? 'Commande annulée — lecture seule' : 'Groupe expiré — lecture seule'}</ThemedText></View>
          ) : null}
        </View>

        {/* ── Description (tout membre) ── */}
        <Section title="DESCRIPTION">
          <View style={styles.descBox}>
            <TextInput
              value={description}
              onChangeText={setDescDraft}
              placeholder="Ajoutez une description au groupe…"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={500}
              style={[styles.descInput, { color: theme.text }]}
              accessibilityLabel="Description du groupe"
            />
            {descDraft !== null && descDraft !== (group.description ?? '') ? (
              <View style={styles.descActions}>
                <Pressable onPress={() => setDescDraft(null)} accessibilityRole="button" style={styles.descCancel}>
                  <ThemedText themeColor="textSecondary" style={styles.bold}>Annuler</ThemedText>
                </Pressable>
                <Pressable onPress={() => void saveDescription()} disabled={descBusy} accessibilityRole="button" style={styles.descSave}>
                  {descBusy ? <ActivityIndicator size="small" color="#fff" /> : <ThemedText style={styles.descSaveText}>Enregistrer</ThemedText>}
                </Pressable>
              </View>
            ) : null}
          </View>
        </Section>

        {/* ── Droits de tous les membres (admin, groupe libre) ── */}
        {manage ? (
          <Section title="DROITS DES MEMBRES" note="S’applique à tous les membres sauf les administrateurs, qui gardent tous les droits.">
            {PERM_ROWS.map((r, i) => (
              <ToggleRow key={r.key} icon={r.icon} label={r.label} value={defaults[r.key]} busy={busy === `all:${r.key}`}
                last={i === PERM_ROWS.length - 1} onChange={(v) => void toggleGroupPerm(r.key, v)} />
            ))}
          </Section>
        ) : null}

        {/* ── Membres ── */}
        <Section title={`${group.memberCount} MEMBRES`}>
          {manage ? (
            <Pressable onPress={() => router.push({ pathname: '/messages/groupe/[id]/ajouter', params: { id: groupId } })} accessibilityRole="button"
              style={({ pressed }) => [styles.memberRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.addIcon}><Ionicons name="person-add" size={20} color="#fff" /></View>
              <ThemedText style={[styles.memberName, { color: Brand.primary }]}>Ajouter des membres</ThemedText>
            </Pressable>
          ) : null}
          {members.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
          {list.map((m, i) => {
            const me = m.userId === myId;
            const restricted = !m.isAdmin && (!m.canSendMessages || !m.canSendVoice || !m.canCall);
            return (
              <Pressable key={m.id} onPress={() => !me && setSelected(m)} disabled={me} accessibilityRole="button"
                style={({ pressed }) => [styles.memberRow, i < list.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
                <Avatar u={{ name: m.displayName, online: m.online }} size={44} />
                <View style={styles.flex}>
                  <ThemedText numberOfLines={1} style={styles.memberName}>{me ? 'Vous' : m.displayName}</ThemedText>
                  <ThemedText numberOfLines={1} type="small" style={m.online ? { color: Brand.success } : undefined} themeColor={m.online ? undefined : 'textSecondary'}>
                    {[TYPE_LABEL[m.actorType] ?? m.actorType, lastSeenLabel(m), restricted ? (!m.canSendMessages && !m.canSendVoice ? 'Lecture seule' : 'Droits limités') : null].filter(Boolean).join(' · ')}
                  </ThemedText>
                </View>
                {m.isAdmin ? <View style={styles.adminPill}><ThemedText style={styles.adminText}>Admin</ThemedText></View> : null}
              </Pressable>
            );
          })}
        </Section>
      </ScrollView>

      {/* ── Fiche d'un membre ── */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            {selected ? (
              <>
                <View style={styles.sheetHead}>
                  <Avatar u={{ name: selected.displayName, online: selected.online }} size={52} />
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={1} style={styles.groupNameSm}>{selected.displayName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {[TYPE_LABEL[selected.actorType] ?? selected.actorType, selected.isAdmin ? 'Administrateur' : null, lastSeenLabel(selected)].filter(Boolean).join(' · ')}
                    </ThemedText>
                  </View>
                </View>
                <SheetAction icon="chatbubble-ellipses" label={`Écrire à ${selected.displayName.split(' ')[0]}`} color={Brand.primary}
                  busy={busy === `dm:${selected.id}`} onPress={() => void messageMember(selected)} />
                {manage ? (
                  <>
                    <SheetAction icon={selected.isAdmin ? 'shield-outline' : 'shield-checkmark'} color="#D97706"
                      label={selected.isAdmin ? 'Retirer le rôle d’administrateur' : 'Nommer administrateur'}
                      busy={busy === `admin:${selected.id}`} onPress={() => void toggleAdmin(selected)} />
                    {!selected.isAdmin ? (
                      <View style={[styles.permBox, { borderColor: theme.border }]}>
                        <ThemedText style={styles.permTitle}>DROITS DE CE MEMBRE</ThemedText>
                        {PERM_ROWS.map((r, i) => (
                          <ToggleRow key={r.key} icon={r.icon} label={r.label} value={selected[r.key]} busy={busy === `${selected.id}:${r.key}`}
                            last={i === PERM_ROWS.length - 1} onChange={(v) => void toggleMemberPerm(selected, r.key, v)} />
                        ))}
                      </View>
                    ) : (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.permNote}>Un administrateur a toujours tous les droits.</ThemedText>
                    )}
                  </>
                ) : null}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {note ? <ThemedText type="small" themeColor="textSecondary" style={styles.sectionNote}>{note}</ThemedText> : null}
      <View style={[styles.card, { borderColor: theme.border }]}>{children}</View>
    </View>
  );
}

function ToggleRow({ icon, label, value, busy, last, onChange }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: boolean; busy: boolean; last: boolean; onChange: (v: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.toggleRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      <Ionicons name={icon} size={19} color={Brand.primary} />
      <ThemedText style={[styles.flex, styles.toggleLabel]}>{label}</ThemedText>
      {busy ? <ActivityIndicator size="small" color={Brand.primary} /> : null}
      <Switch value={value} onValueChange={onChange} disabled={busy} trackColor={{ true: Brand.primary, false: '#D0D5DD' }} thumbColor="#fff" accessibilityLabel={label} />
    </View>
  );
}

function SheetAction({ icon, label, color, busy, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; color: string; busy: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.sheetRow, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.sheetIco, { backgroundColor: `${color}1F` }]}>
        {busy ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={20} color={color} />}
      </View>
      <ThemedText style={styles.toggleLabel}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  bold: { fontWeight: '700' },
  loader: { marginVertical: Spacing.three },
  missing: { textAlign: 'center', marginTop: 60 },
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  hero: { alignItems: 'center', gap: 4, paddingVertical: Spacing.two },
  bigPhoto: { width: 110, height: 110, borderRadius: 55, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  photoBusy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.35)', alignItems: 'center', justifyContent: 'center' },
  photoEdit: { position: 'absolute', right: 6, bottom: 6, width: 30, height: 30, borderRadius: 15, backgroundColor: Brand.primary, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  groupName: { fontSize: 22, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
  groupNameSm: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  closedPill: { marginTop: 6, backgroundColor: '#FEF3F2', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  closedText: { color: Brand.danger, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  section: { gap: 6 },
  sectionTitle: { fontSize: 11.5, lineHeight: 16, fontWeight: '800', letterSpacing: 1.3, color: Brand.primary, paddingHorizontal: 4 },
  sectionNote: { paddingHorizontal: 4 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  descBox: { padding: 12 },
  descInput: { fontSize: 15, lineHeight: 20, minHeight: 44, textAlignVertical: 'top' },
  descActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  descCancel: { paddingHorizontal: 12, paddingVertical: 8 },
  descSave: { backgroundColor: Brand.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, minWidth: 110, alignItems: 'center' },
  descSaveText: { color: '#fff', fontWeight: '800' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
  toggleLabel: { fontSize: 15, lineHeight: 20 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  memberName: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  addIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  adminPill: { backgroundColor: `${Brand.success}1A`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  adminText: { color: Brand.success, fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: Spacing.three, paddingBottom: Spacing.five },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.four, paddingVertical: 12 },
  sheetIco: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  permBox: { marginHorizontal: Spacing.three, marginTop: 6, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  permTitle: { fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 1.2, color: Brand.primary, paddingHorizontal: 14, paddingTop: 10 },
  permNote: { paddingHorizontal: Spacing.four, paddingTop: 4 },
});
