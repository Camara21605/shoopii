/**
 * Briques communes du Centre d'aide : barre de recherche, titre de section,
 * pastille de statut d'un ticket, ligne d'article, carte de type (contact /
 * nouveau ticket), invitation à se connecter, choix d'une pièce jointe.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { ALLOWED_MIME, fmtBytes, MAX_FILE, STATUS, type LocalFile } from '../api';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function SearchBar({ value, onChangeText, onSubmit, placeholder, autoFocus, dark }: { value: string; onChangeText: (v: string) => void; onSubmit?: () => void; placeholder: string; autoFocus?: boolean; dark?: boolean } & Pick<TextInputProps, 'returnKeyType'>) {
  const theme = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: dark ? '#fff' : theme.backgroundElement }]}>
      <Ionicons name="search" size={18} color={theme.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        autoFocus={autoFocus}
        returnKeyType="search"
        style={[styles.searchInput, { color: theme.text }]}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Effacer">
          <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Section({ title, children, action, onAction }: { title: string; children: React.ReactNode; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.dash} />
        <ThemedText style={styles.sectionTitle}>{title.toUpperCase()}</ThemedText>
        {action && onAction ? (
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
            <ThemedText style={styles.action}>{action}</ThemedText>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.open;
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <ThemedText style={[styles.pillText, { color: s.color }]}>{s.label}</ThemedText>
    </View>
  );
}

export function ArticleRow({ title, meta, onPress, first }: { title: string; meta?: string; onPress: () => void; first?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.rowIco, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="document-text-outline" size={18} color={theme.text} />
      </View>
      <View style={styles.flex}>
        <ThemedText style={styles.rowTitle} numberOfLines={2}>
          {title}
        </ThemedText>
        {meta ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={17} color={theme.textSecondary} />
    </Pressable>
  );
}

export function TypeCard({ icon, label, desc, selected, onPress }: { icon: string; label: string; desc: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.type, { borderColor: selected ? theme.text : theme.border, backgroundColor: selected ? 'rgba(0,0,0,0.05)' : theme.background }]}>
      <Ionicons name={icon as IconName} size={22} color={theme.text} />
      <ThemedText style={styles.typeLabel} numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
        {desc}
      </ThemedText>
      {selected ? (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      ) : null}
    </Pressable>
  );
}

export function SignInPrompt({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.signIn}>
      <View style={[styles.signInIco, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="lock-closed-outline" size={28} color={theme.text} />
      </View>
      <ThemedText style={styles.signInTitle}>Connectez-vous pour continuer</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {text}
      </ThemedText>
      <Pressable onPress={() => router.push('/login')} accessibilityRole="button" style={styles.primary}>
        <ThemedText style={styles.primaryText}>Se connecter</ThemedText>
      </Pressable>
      <Pressable onPress={() => router.push('/aide/contact')} accessibilityRole="button" hitSlop={8}>
        <ThemedText style={styles.link}>Ou écrire au support sans compte</ThemedText>
      </Pressable>
    </View>
  );
}

/** Pièce jointe : PDF, JPG, PNG, WebP, MP4, WebM — 10 Mo maximum. */
export async function pickAttachment(): Promise<{ file?: LocalFile; error?: string }> {
  const res = await DocumentPicker.getDocumentAsync({ type: ALLOWED_MIME, copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets[0]) return {};
  const a = res.assets[0];
  const mimeType = a.mimeType ?? '';
  if (!ALLOWED_MIME.includes(mimeType)) return { error: 'Format non accepté : PDF, JPG, PNG, WebP, MP4 ou WebM uniquement.' };
  if (a.size && a.size > MAX_FILE) return { error: `Fichier trop lourd (${fmtBytes(a.size)}). Taille maximale : 10 Mo.` };
  return { file: { uri: a.uri, name: a.name, mimeType, size: a.size } };
}

export function FileChip({ file, onRemove }: { file: LocalFile; onRemove: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={file.mimeType.startsWith('image/') ? 'image-outline' : file.mimeType.startsWith('video/') ? 'videocam-outline' : 'document-outline'} size={16} color={theme.text} />
      <ThemedText style={styles.chipText} numberOfLines={1}>
        {file.name}
        {file.size ? ` · ${fmtBytes(file.size)}` : ''}
      </ThemedText>
      <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retirer la pièce jointe">
        <Ionicons name="close" size={16} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dash: { width: 18, height: 3, borderRadius: 2, backgroundColor: '#1F1F1F' },
  sectionTitle: { flex: 1, fontSize: 12.5, lineHeight: 17, fontWeight: '800', letterSpacing: 1.5 },
  action: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
  pillText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12 },
  rowIco: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '700' },
  type: { flexBasis: '47%', flexGrow: 1, borderWidth: 1.5, borderRadius: 16, padding: 12, gap: 4 },
  typeLabel: { fontSize: 14, lineHeight: 18, fontWeight: '800', marginTop: 4 },
  check: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  signIn: { alignItems: 'center', gap: 10, padding: 28 },
  signInIco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  signInTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  primary: { backgroundColor: '#1F1F1F', borderRadius: 999, paddingHorizontal: 22, minHeight: 48, justifyContent: 'center', marginTop: 6 },
  primaryText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  link: { fontSize: 13.5, lineHeight: 18, fontWeight: '700', textDecorationLine: 'underline' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  chipText: { flex: 1, fontSize: 13, lineHeight: 17, fontWeight: '600' },
});
