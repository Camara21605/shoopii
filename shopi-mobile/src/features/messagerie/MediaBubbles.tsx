/**
 * Contenu des bulles « média » — partagé par la discussion privée
 * (messages/[id].tsx) et les groupes (messages/groupe/[id]) : photo, vidéo
 * (repère + lecture plein écran dans MediaViewer), message vocal (lecteur
 * réel expo-audio) et fichier (vrai téléchargement, voir download.ts).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { downloadAttachment } from './download';

/** Champs média communs aux messages privés et aux messages de groupe. */
export interface MediaLike {
  mediaUrl?: string | null;
  mediaName?: string | null;
  mediaDuration?: number | null;
}

export type OpenMedia = (kind: 'image' | 'video', url: string, name?: string | null) => void;

export function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ImageBubble({ m, onOpenMedia }: { m: MediaLike; onOpenMedia: OpenMedia }) {
  if (!m.mediaUrl) return <ActivityIndicator color="#fff" />;
  return (
    <Pressable onPress={() => onOpenMedia('image', m.mediaUrl!, m.mediaName)} accessibilityRole="button" accessibilityLabel="Voir la photo en plein écran">
      <Image source={{ uri: m.mediaUrl }} style={styles.mediaImg} contentFit="cover" />
    </Pressable>
  );
}

/* Pas de lecteur monté dans la bulle (un par message visible serait lourd en
 * mémoire/décodage sur une longue conversation) — juste un repère "vidéo",
 * la lecture réelle se fait dans MediaViewer en plein écran au toucher. */
export function VideoBubble({ m, onOpenMedia }: { m: MediaLike; onOpenMedia: OpenMedia }) {
  if (!m.mediaUrl) return <ActivityIndicator color="#fff" />;
  return (
    <Pressable onPress={() => onOpenMedia('video', m.mediaUrl!, m.mediaName)} accessibilityRole="button" accessibilityLabel="Lire la vidéo en plein écran" style={[styles.mediaImg, styles.videoPlaceholder]}>
      <View style={styles.playOverlay}>
        <View style={styles.playCircle}>
          <Ionicons name="play" size={22} color="#fff" style={styles.playIcon} />
        </View>
        {m.mediaDuration ? <ThemedText style={styles.videoDur}>{fmtClock(m.mediaDuration)}</ThemedText> : null}
      </View>
    </Pressable>
  );
}

export function AudioBubble({ m, isMe }: { m: MediaLike; isMe: boolean }) {
  const theme = useTheme();
  const player = useAudioPlayer(m.mediaUrl ?? undefined);
  const status = useAudioPlayerStatus(player);
  const durationSec = status.duration || m.mediaDuration || 0;
  /* Barres décoratives générées une fois par bulle — useState à initialisation
   * paresseuse plutôt que useMemo(Math.random) : lues pendant le rendu, ce que
   * les règles React 19 interdisent pour un calcul impur dans useMemo. */
  const [bars] = useState(() => Array.from({ length: 22 }, () => Math.floor(Math.random() * 16) + 4));
  const progress = durationSec > 0 ? status.currentTime / durationSec : 0;

  if (!m.mediaUrl) return <ActivityIndicator color={isMe ? '#fff' : Brand.primary} />;

  return (
    <View style={styles.audioRow}>
      <Pressable
        onPress={() => (status.playing ? player.pause() : player.play())}
        accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause' : 'Lecture'}
        style={[styles.audioBtn, { backgroundColor: isMe ? 'rgba(255,255,255,.9)' : Brand.primary }]}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={13} color={isMe ? Brand.primary : '#fff'} style={!status.playing ? { marginLeft: 1.5 } : undefined} />
      </Pressable>
      <View style={styles.audioBars}>
        {bars.map((h, i) => (
          <View key={i} style={[styles.audioTick, { height: h, backgroundColor: isMe ? (i / bars.length <= progress ? '#fff' : 'rgba(255,255,255,.35)') : (i / bars.length <= progress ? Brand.primary : theme.border) }]} />
        ))}
      </View>
      <ThemedText style={[styles.audioDur, isMe && { color: 'rgba(255,255,255,.85)' }]}>{fmtClock(status.playing ? status.currentTime : durationSec)}</ThemedText>
    </View>
  );
}

export function FileBubble({ m, isMe }: { m: MediaLike; isMe: boolean }) {
  const [downloading, setDownloading] = useState(false);

  async function handlePress() {
    if (downloading || !m.mediaUrl) return;
    setDownloading(true);
    const res = await downloadAttachment('document', m.mediaUrl, m.mediaName ?? 'document');
    setDownloading(false);
    if (!res.ok) Alert.alert('Erreur', res.message);
  }

  return (
    <Pressable onPress={() => void handlePress()} accessibilityRole="button" accessibilityLabel={`Télécharger ${m.mediaName ?? 'le document'}`} style={styles.fileRow}>
      <View style={[styles.fileIco, { backgroundColor: isMe ? 'rgba(255,255,255,.18)' : Brand.primary + '1A' }]}>
        <Ionicons name="document-text" size={20} color={isMe ? '#fff' : Brand.primary} />
      </View>
      <View style={styles.flex}>
        <ThemedText numberOfLines={1} style={[styles.fileName, isMe && { color: '#fff' }]}>{m.mediaName ?? 'Document'}</ThemedText>
        <ThemedText type="small" style={isMe ? { color: 'rgba(255,255,255,.75)' } : undefined} themeColor={isMe ? undefined : 'textSecondary'}>
          {downloading ? 'Téléchargement…' : 'Toucher pour télécharger'}
        </ThemedText>
      </View>
      {downloading
        ? <ActivityIndicator size="small" color={isMe ? '#fff' : Brand.primary} />
        : <Ionicons name="download" size={16} color={isMe ? 'rgba(255,255,255,.8)' : '#8A93A3'} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mediaImg: { width: 220, height: 220, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000010' },
  videoPlaceholder: { backgroundColor: '#111111' },
  playOverlay: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  playCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center' },
  playIcon: { marginLeft: 3 },
  videoDur: { color: '#fff', fontSize: 12, fontWeight: '700' },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 190, paddingVertical: 2 },
  audioBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  audioBars: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 24 },
  audioTick: { width: 2.5, borderRadius: 2 },
  audioDur: { fontSize: 11, fontWeight: '700', color: '#8A93A3', minWidth: 30 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 190 },
  fileIco: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 14, fontWeight: '700' },
});
