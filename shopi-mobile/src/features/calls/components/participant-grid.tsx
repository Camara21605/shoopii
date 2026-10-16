/**
 * Appel à plusieurs : une tuile par personne (vidéo si sa caméra est allumée,
 * sinon sa photo), plus les personnes invitées qui n'ont pas encore répondu.
 * 2 personnes → l'une sous l'autre ; 3 ou 4 → grille 2 × 2.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';

import { ThemedText } from '@/components/themed-text';

export interface Tile {
  key: string;
  name: string;
  avatar?: string | null;
  streamURL?: string | null;
  video?: boolean;
  /** Libellé sous le nom : « Ça sonne… », « Connexion… », « Connexion perdue ». */
  status?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function ParticipantGrid({ tiles, top, bottom }: { tiles: Tile[]; top: number; bottom: number }) {
  const grid = tiles.length > 2;
  return (
    <View style={[styles.wrap, { paddingTop: top, paddingBottom: bottom }]}>
      <View style={[styles.inner, grid && styles.innerGrid]}>
        {tiles.map(t => (
          <View key={t.key} style={[styles.tile, grid ? styles.tileGrid : styles.tileStack]}>
            {t.video && t.streamURL ? (
              <RTCView streamURL={t.streamURL} style={StyleSheet.absoluteFill} objectFit="cover" />
            ) : (
              <View style={styles.noVideo}>
                <View style={styles.avatar}>
                  {t.avatar
                    ? <Image source={{ uri: t.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    : <ThemedText style={styles.initials}>{initials(t.name)}</ThemedText>}
                </View>
              </View>
            )}
            <View style={styles.caption}>
              <ThemedText numberOfLines={1} style={styles.name}>{t.name}</ThemedText>
              {t.status ? (
                <View style={styles.statusRow}>
                  {t.status === 'Connexion perdue' ? <Ionicons name="warning" size={11} color="#FBBF24" /> : null}
                  <ThemedText numberOfLines={1} style={styles.status}>{t.status}</ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, paddingHorizontal: 10 },
  inner: { flex: 1, gap: 10 },
  innerGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,.07)' },
  tileStack: { flex: 1 },
  tileGrid: { width: '48.5%', height: '48.5%', flexGrow: 1 },
  noVideo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 84, height: 84, borderRadius: 42, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.14)', borderWidth: 2, borderColor: 'rgba(255,255,255,.7)',
  },
  initials: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#fff' },
  caption: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  name: { fontSize: 14, lineHeight: 18, fontWeight: '700', color: '#fff' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  status: { fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,.75)' },
});
