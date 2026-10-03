/**
 * src/features/calls/CallScreen.tsx
 *
 * Écran plein écran d'un appel — sonnerie entrante (Répondre/Refuser),
 * appel sortant, connexion, appel en cours (audio ou vidéo). Toujours
 * sombre (immersif, comme tout écran d'appel — WhatsApp/Telegram/FaceTime),
 * volontairement différent du reste de l'app qui reste blanc.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';

import {
  acceptCall, flipCamera, hangUp, rejectCall, toggleMute, toggleSpeaker, toggleVideo, useCallStore,
} from './call-store';

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function statusLabel(status: string, direction: 'incoming' | 'outgoing' | undefined): string {
  switch (status) {
    case 'calling':      return 'Appel en cours…';
    case 'ringing':      return direction === 'incoming' ? 'Appel entrant…' : 'Ça sonne…';
    case 'connecting':   return 'Connexion…';
    case 'reconnecting': return 'Reconnexion…';
    default:             return '';
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export default function CallScreen() {
  const status          = useCallStore(s => s.status);
  const callInfo        = useCallStore(s => s.callInfo);
  const localStreamURL  = useCallStore(s => s.localStreamURL);
  const remoteStreamURL = useCallStore(s => s.remoteStreamURL);
  const muted           = useCallStore(s => s.muted);
  const speakerOn       = useCallStore(s => s.speakerOn);
  const videoEnabled    = useCallStore(s => s.videoEnabled);
  const durationSec     = useCallStore(s => s.durationSec);
  const errorMessage    = useCallStore(s => s.errorMessage);

  if (!callInfo) return null;

  const isVideo       = callInfo.callType === 'video';
  const isIncoming    = callInfo.direction === 'incoming';
  const isRinging     = status === 'ringing';
  const isConnected   = status === 'connected';
  const showRemoteVideo = isVideo && videoEnabled && !!remoteStreamURL;
  const showLocalVideo  = isVideo && videoEnabled && !!localStreamURL;

  return (
    <View style={styles.root}>
      {showRemoteVideo ? (
        <RTCView streamURL={remoteStreamURL!} style={StyleSheet.absoluteFill} objectFit="cover" />
      ) : (
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            {callInfo.remoteAvatar
              ? <Image source={{ uri: callInfo.remoteAvatar }} style={styles.fill} contentFit="cover" />
              : <ThemedText style={styles.avatarText}>{initials(callInfo.remoteName)}</ThemedText>}
          </View>
        </View>
      )}

      {/* Caméra locale — vignette en incrustation, seulement en vidéo */}
      {showLocalVideo && (
        <View style={styles.localWrap}>
          <RTCView streamURL={localStreamURL!} style={styles.fill} objectFit="cover" mirror zOrder={1} />
        </View>
      )}

      {/* En-tête : nom + statut */}
      <View style={styles.header} pointerEvents="none">
        <ThemedText style={styles.name}>{callInfo.remoteName}</ThemedText>
        <ThemedText style={styles.status}>
          {isConnected ? fmtDuration(durationSec) : (errorMessage ?? statusLabel(status, callInfo.direction))}
        </ThemedText>
      </View>

      {/* ── Sonnerie entrante : Répondre / Refuser ── */}
      {isRinging && isIncoming ? (
        <View style={styles.incomingBar}>
          <Pressable onPress={rejectCall} accessibilityRole="button" accessibilityLabel="Refuser" style={[styles.bigBtn, styles.declineBtn]}>
            <Ionicons name="call" size={28} color="#fff" style={styles.rotateDecline} />
          </Pressable>
          <Pressable onPress={() => void acceptCall()} accessibilityRole="button" accessibilityLabel="Répondre" style={[styles.bigBtn, styles.acceptBtn]}>
            <Ionicons name="call" size={28} color="#fff" />
          </Pressable>
        </View>
      ) : (
        /* ── Appel sortant / en cours : contrôles ── */
        <View style={styles.controls}>
          <View style={styles.controlsRow}>
            <ControlButton icon={muted ? 'mic-off' : 'mic'} active={muted} onPress={toggleMute} label="Muet" />
            <ControlButton icon={speakerOn ? 'volume-high' : 'volume-medium'} active={speakerOn} onPress={toggleSpeaker} label="Haut-parleur" />
            {isVideo && (
              <ControlButton icon={videoEnabled ? 'videocam' : 'videocam-off'} active={!videoEnabled} onPress={toggleVideo} label="Caméra" />
            )}
            {isVideo && videoEnabled && (
              <ControlButton icon="camera-reverse" onPress={flipCamera} label="Retourner" />
            )}
          </View>
          <Pressable onPress={hangUp} accessibilityRole="button" accessibilityLabel="Raccrocher" style={[styles.bigBtn, styles.declineBtn, styles.hangupBtn]}>
            <Ionicons name="call" size={26} color="#fff" style={styles.rotateDecline} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ControlButton({ icon, active, onPress, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; active?: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.ctrlBtn, active && styles.ctrlBtnActive]}>
      <Ionicons name={icon} size={22} color={active ? '#1F1F1F' : '#fff'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1F1F1F' },
  fill: { width: '100%', height: '100%' },
  avatarWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.12)' },
  avatarText: { fontSize: 44, fontWeight: '800', color: '#fff' },
  localWrap: { position: 'absolute', top: 60, right: Spacing.three, width: 96, height: 140, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,.4)' },
  header: { position: 'absolute', top: 70, left: 0, right: 0, alignItems: 'center', gap: 6 },
  name: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: '#fff' },
  status: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,.75)' },
  incomingBar: { position: 'absolute', bottom: 70, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: Spacing.five },
  controls: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center', gap: Spacing.four },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.three },
  ctrlBtn: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.16)' },
  ctrlBtnActive: { backgroundColor: '#fff' },
  bigBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  acceptBtn: { backgroundColor: Brand.success },
  declineBtn: { backgroundColor: Brand.danger },
  hangupBtn: { alignSelf: 'center' },
  rotateDecline: { transform: [{ rotate: '135deg' }] },
});
