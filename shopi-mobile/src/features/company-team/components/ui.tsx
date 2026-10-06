/**
 * Briques communes de la gestion d'équipe : feuille du bas (Sheet), avatar
 * avec pastille de statut, pastille de statut, message bref (Snack).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { initials, STATUS, type MemberStatus } from '../api';

const TALL = Math.round(Dimensions.get('window').height * 0.82);

export function Sheet({
  title,
  subtitle,
  icon,
  onClose,
  children,
  tall,
  busy,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  onClose: () => void;
  children: React.ReactNode;
  tall?: boolean;
  busy?: boolean;
}) {
  const theme = useTheme();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" accessibilityRole="button" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['bottom']} style={[styles.sheet, tall && { height: TALL }, { backgroundColor: theme.background }]} accessibilityViewIsModal>
            <View style={[styles.grip, { backgroundColor: theme.border }]} />
            <View style={styles.head}>
              {icon ? (
                <View style={styles.headIco}>
                  <Ionicons name={icon} size={18} color={Brand.primaryInk} />
                </View>
              ) : null}
              <View style={styles.flex}>
                <ThemedText style={styles.title} numberOfLines={1} accessibilityRole="header">
                  {title}
                </ThemedText>
                {subtitle ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {subtitle}
                    {busy ? ' · enregistrement…' : ''}
                  </ThemedText>
                ) : null}
              </View>
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

export function Avatar({ m, size = 48, status }: { m: { firstName?: string | null; lastName?: string | null; email?: string | null; profilePicture?: string | null }; size?: number; status?: MemberStatus }) {
  const theme = useTheme();
  const dot = status ? STATUS[status].color : null;
  return (
    <View style={{ width: size, height: size }}>
      {m.profilePicture ? (
        <Image source={{ uri: m.profilePicture }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2 }]}>
          <ThemedText style={[styles.initialsText, { fontSize: size * 0.36, lineHeight: size * 0.46 }]}>{initials(m)}</ThemedText>
        </View>
      )}
      {dot ? <View style={[styles.dot, { backgroundColor: dot, borderColor: theme.background }]} /> : null}
    </View>
  );
}

export function StatusPill({ status }: { status: MemberStatus }) {
  const s = STATUS[status];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <ThemedText style={[styles.pillText, { color: s.color }]}>{s.label}</ThemedText>
    </View>
  );
}

export type SnackMsg = { text: string; error?: boolean; id: number } | null;

export function useSnack() {
  const [msg, setMsg] = useState<SnackMsg>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);
  return { msg, show: (text: string, error = false) => setMsg({ text, error, id: Date.now() }) };
}

export function Snack({ msg, bottom = 24 }: { msg: SnackMsg; bottom?: number }) {
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={[styles.snackWrap, { bottom }]}>
      <View style={styles.snack} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Ionicons name={msg.error ? 'alert-circle' : 'checkmark-circle'} size={18} color={msg.error ? '#FCA5A5' : '#86EFAC'} />
        <ThemedText style={styles.snackText}>{msg.text}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, maxHeight: TALL },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  headIco: { width: 36, height: 36, borderRadius: 12, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  initials: { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: Brand.primaryInk, fontWeight: '800' },
  dot: { position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  pillText: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  snackWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 20 },
  snack: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2A2A2A', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, maxWidth: 480 },
  snackText: { color: '#fff', fontSize: 13.5, lineHeight: 18, fontWeight: '700', flexShrink: 1 },
});
