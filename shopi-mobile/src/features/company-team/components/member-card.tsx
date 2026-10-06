/**
 * Carte d'un collaborateur — reprend les colonnes du tableau du site :
 * membre (photo, nom, e-mail, « MDP à changer »), poste / rôle, statut
 * (+ motif de suspension), dernière connexion, et le résumé des permissions.
 * Toucher la carte ouvre ses actions.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { fullName, lastSeen, roleLabel, type TeamMember } from '../api';
import { Avatar, StatusPill } from './ui';

export function MemberCard({ m, granted, onPress }: { m: TeamMember; granted: { on: number; total: number }; onPress: () => void }) {
  const theme = useTheme();
  const role = roleLabel(m.internalRole);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${fullName(m)}, ${m.jobTitle ?? 'sans poste'}. Ouvrir les actions`}
      style={({ pressed }) => [styles.card, { borderColor: theme.border, backgroundColor: theme.background }, pressed && styles.pressed]}>
      <View style={styles.top}>
        <Avatar m={m} status={m.status} />
        <View style={styles.flex}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {fullName(m)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {m.email}
          </ThemedText>
          {m.mustChangePassword ? (
            <View style={styles.pwd}>
              <Ionicons name="warning-outline" size={12} color="#B45309" />
              <ThemedText style={styles.pwdText}>MDP à changer</ThemedText>
            </View>
          ) : null}
        </View>
        <Ionicons name="ellipsis-vertical" size={18} color={theme.textSecondary} />
      </View>

      <View style={styles.tags}>
        <StatusPill status={m.status} />
        {m.jobTitle ? (
          <View style={[styles.tag, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="briefcase-outline" size={12} color={theme.textSecondary} />
            <ThemedText style={styles.tagText} numberOfLines={1}>
              {m.jobTitle}
            </ThemedText>
          </View>
        ) : null}
        {role ? (
          <View style={[styles.tag, styles.role]}>
            <ThemedText style={[styles.tagText, { color: Brand.primaryInk }]}>{role}</ThemedText>
          </View>
        ) : null}
      </View>

      {m.status === 'suspended' && m.suspensionReason ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.reason}>
          Motif : {m.suspensionReason}
        </ThemedText>
      ) : null}

      <View style={[styles.foot, { borderTopColor: theme.border }]}>
        <View style={styles.footItem}>
          <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {lastSeen(m.lastLoginAt)}
          </ThemedText>
        </View>
        <View style={styles.footItem}>
          <Ionicons name="shield-half-outline" size={14} color={granted.on ? Brand.primary : theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            {granted.on ? `${granted.on}/${granted.total} autorisations` : 'Aucune autorisation'}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 15.5, lineHeight: 20, fontWeight: '800' },
  pwd: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#FEF3E2', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1, marginTop: 3 },
  pwdText: { color: '#B45309', fontSize: 11, lineHeight: 16, fontWeight: '800' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, maxWidth: '100%' },
  role: { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine },
  tagText: { fontSize: 12, lineHeight: 17, fontWeight: '700', flexShrink: 1 },
  reason: { fontStyle: 'italic' },
  foot: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  footItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
});
