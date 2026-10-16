/**
 * Affichage des trois états de présence, partout pareil :
 *   🟢 En ligne — dans l'application ;
 *   🟠 Joignable — application fermée, téléphone connecté à internet ;
 *   ⚪ Hors ligne · vu il y a … — pas de connexion.
 *
 *   PresenceDot     point sur une photo (rien quand hors ligne, par défaut)
 *   PresenceLine    texte d'état (en-tête de conversation, listes)
 *   PresenceChip    pastille du profil public ; toucher = légende des 3 états
 *   PresenceLegend  la légende seule (feuille du bas)
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import type { PresenceStatus } from '../api';
import { PRESENCE_COLOR, PRESENCE_HELP, PRESENCE_TITLE, presenceText } from '../format';

export function PresenceDot({
  status,
  size = 12,
  borderColor,
  showOffline = false,
  style,
}: {
  status: PresenceStatus;
  size?: number;
  borderColor?: string;
  showOffline?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  if (status === 'offline' && !showOffline) return null;
  const ring = Math.max(2, Math.round(size / 6));
  return (
    <View
      accessible
      accessibilityLabel={PRESENCE_TITLE[status]}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring,
          borderColor: borderColor ?? theme.background,
          backgroundColor: PRESENCE_COLOR[status],
        },
        style,
      ]}
    />
  );
}

export function PresenceLine({
  status,
  lastSeen,
  checking,
  short,
  style,
}: {
  status: PresenceStatus;
  lastSeen: string | null;
  checking?: boolean;
  short?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  const color = status === 'offline' ? theme.textSecondary : PRESENCE_COLOR[status];
  return (
    <View style={styles.line}>
      <PresenceDot status={status} size={9} showOffline borderColor="transparent" />
      <ThemedText type="small" numberOfLines={1} style={[{ color, fontWeight: status === 'offline' ? '500' : '700' }, style]}>
        {presenceText(status, lastSeen, { short })}
      </ThemedText>
      {checking ? <ActivityIndicator size="small" color={theme.textSecondary} style={styles.spin} accessibilityLabel="Vérification de la connexion" /> : null}
    </View>
  );
}

export function PresenceChip({
  status,
  lastSeen,
  checking,
  align = 'center',
}: {
  status: PresenceStatus;
  lastSeen: string | null;
  checking?: boolean;
  align?: 'center' | 'flex-start';
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (status !== 'online') return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [status, pulse]);

  const color = PRESENCE_COLOR[status];
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${presenceText(status, lastSeen)}. Que veut dire cet état ?`}
        style={({ pressed }) => [styles.chip, { alignSelf: align, borderColor: `${color}66`, backgroundColor: `${color}14` }, pressed && styles.pressed]}>
        <Animated.View style={{ opacity: status === 'online' ? pulse : 1 }}>
          <PresenceDot status={status} size={10} showOffline borderColor="transparent" />
        </Animated.View>
        <ThemedText style={[styles.chipText, { color: status === 'offline' ? theme.textSecondary : color }]} numberOfLines={1}>
          {presenceText(status, lastSeen)}
        </ThemedText>
        {checking ? <ActivityIndicator size="small" color={theme.textSecondary} /> : <Ionicons name="information-circle-outline" size={15} color={theme.textSecondary} />}
      </Pressable>
      {open ? <PresenceLegend current={status} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function PresenceLegend({ current, onClose }: { current?: PresenceStatus; onClose: () => void }) {
  const theme = useTheme();
  return (
    <BottomSheet title="Que veulent dire ces états ?" onClose={onClose}>
      <View style={styles.legend}>
        {(['online', 'reachable', 'offline'] as const).map((s) => (
          <View key={s} style={[styles.legendRow, current === s && { backgroundColor: theme.backgroundElement }]}>
            <PresenceDot status={s} size={14} showOffline borderColor="transparent" style={styles.legendDot} />
            <View style={styles.flex}>
              <ThemedText style={[styles.legendTitle, { color: s === 'offline' ? theme.text : PRESENCE_COLOR[s] }]}>{PRESENCE_TITLE[s]}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {PRESENCE_HELP[s]}
              </ThemedText>
            </View>
          </View>
        ))}
        <ThemedText type="small" themeColor="textSecondary" style={styles.legendNote}>
          « Joignable » se vérifie quand vous ouvrez sa conversation ou son profil : son téléphone répond en quelques secondes s’il est connecté.
        </ThemedText>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  spin: { transform: [{ scale: 0.7 }] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 32, maxWidth: '100%' },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700', flexShrink: 1 },
  legend: { gap: 8, paddingBottom: 12 },
  legendRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 10, borderRadius: 12 },
  legendDot: { marginTop: 3 },
  legendTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  legendNote: { marginTop: 4, paddingHorizontal: 4 },
});
