/**
 * src/features/calls/GroupCallScreen.tsx
 *
 * Écran plein écran d'un appel de GROUPE (group-call-store.ts) — même habillage
 * que l'appel 1:1 (CallScreen.tsx) :
 *   sonnerie   → photo du groupe, « X appelle le groupe », Refuser / Rejoindre ;
 *   lancement  → « Ça sonne… » tant que personne n'a rejoint ;
 *   en cours   → une tuile par participant (vidéo ou initiales, micro coupé),
 *                ma caméra en vignette, micro / haut-parleur / caméra / quitter.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

import { CallButton, ControlsRow, ParticipantGrid, PulseAvatar, type Tile } from './components';
import {
  declineGroupCall, flipGroupCamera, joinGroupCall, leaveGroupCall, toggleGroupMute, toggleGroupSpeaker,
  toggleGroupVideo, useGroupCallStore,
} from './group-call-store';
import { minimizeCall } from './ongoing-call';

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export default function GroupCallScreen() {
  const insets = useSafeAreaInsets();
  const s = useGroupCallStore();
  const peers = Object.values(s.peers);
  const ringing = s.status === 'ringing';
  const connected = s.status === 'connected';
  const video = s.callType === 'video';
  const myCameraOn = s.videoEnabled && !!s.localStreamURL;

  const subtitle = ringing
    ? `${s.initiatorName} appelle le groupe`
    : connected
      ? `${fmtDuration(s.durationSec)} · ${peers.length + 1} dans l’appel`
      : s.outgoing ? 'Ça sonne chez les membres…' : 'Connexion…';

  const tiles: Tile[] = peers.map((p) => ({
    key: p.userId,
    name: p.muted ? `${p.name} 🔇` : p.name,
    streamURL: p.streamURL,
    video: p.video,
    status: p.state === 'connecting' ? 'Connexion…' : p.state === 'lost' ? 'Connexion perdue' : undefined,
  }));

  return (
    <View style={styles.root}>
      {s.groupPhoto ? <Image source={{ uri: s.groupPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} /> : null}
      <LinearGradient colors={['rgba(14,16,22,.72)', 'rgba(14,16,22,.9)', '#0E1016']} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 14 }]} pointerEvents="none">
        <View style={styles.securePill}>
          <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,.85)" />
          <ThemedText style={styles.secureText}>Chiffré de bout en bout</ThemedText>
        </View>
        {peers.length > 0 ? (
          <View style={styles.compactHead}>
            <ThemedText numberOfLines={1} style={styles.compactName}>{s.groupName}</ThemedText>
            <ThemedText style={styles.compactStatus}>{subtitle}</ThemedText>
          </View>
        ) : null}
      </View>

      {!ringing ? (<Pressable onPress={minimizeCall} hitSlop={10} accessibilityRole="button" accessibilityLabel="Réduire l’appel" style={[styles.minimize, { top: insets.top + 8 }]}>
        <Ionicons name="chevron-down" size={26} color="#fff" />
      </Pressable>) : null}

      {peers.length > 0 ? (
        <ParticipantGrid tiles={tiles} top={insets.top + 92} bottom={insets.bottom + 236} />
      ) : (
        <View style={styles.center} pointerEvents="none">
          {s.groupPhoto ? (
            <PulseAvatar name={s.groupName} uri={s.groupPhoto} pulsing={!connected} />
          ) : (
            <View style={styles.groupIcon}><Ionicons name="people" size={58} color="#fff" /></View>
          )}
          <ThemedText numberOfLines={2} style={styles.name}>{s.groupName}</ThemedText>
          <View style={styles.kindPill}>
            <Ionicons name={video ? 'videocam' : 'call'} size={13} color="rgba(255,255,255,.85)" />
            <ThemedText style={styles.kindText}>{video ? 'Appel vidéo de groupe' : 'Appel audio de groupe'}</ThemedText>
          </View>
          <ThemedText style={styles.status}>{subtitle}</ThemedText>
        </View>
      )}

      {s.notice ? (
        <View style={[styles.notice, { top: insets.top + 92 }]} pointerEvents="none">
          <ThemedText style={styles.noticeText}>{s.notice}</ThemedText>
        </View>
      ) : null}

      {myCameraOn ? (
        <View style={[styles.localWrap, { top: insets.top + 96 }]}>
          <RTCView streamURL={s.localStreamURL!} style={StyleSheet.absoluteFill} objectFit="cover" mirror zOrder={1} />
        </View>
      ) : null}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 28 }]}>
        {ringing ? (
          <ControlsRow>
            <CallButton icon="call" label="Refuser" tone="danger" size={70} onPress={declineGroupCall} iconStyle={styles.rotate} />
            <CallButton icon={video ? 'videocam' : 'call'} label="Rejoindre" tone="success" size={70}
              onPress={() => s.groupId && s.callId && void joinGroupCall(s.groupId, s.callId, s.callType)} />
          </ControlsRow>
        ) : (
          <View style={styles.panel}>
            <ControlsRow>
              <CallButton icon={s.muted ? 'mic-off' : 'mic'} label={s.muted ? 'Micro coupé' : 'Micro'} active={s.muted} onPress={toggleGroupMute} />
              <CallButton icon={s.speakerOn ? 'volume-high' : 'volume-medium'} label="Haut-parleur" active={s.speakerOn} onPress={toggleGroupSpeaker} />
              <CallButton icon={myCameraOn ? 'videocam' : 'videocam-off'} label={video ? 'Caméra' : 'Vidéo'} active={myCameraOn} busy={s.upgrading} onPress={() => void toggleGroupVideo()} />
              {myCameraOn ? <CallButton icon="camera-reverse" label="Retourner" onPress={flipGroupCamera} /> : null}
            </ControlsRow>
            <View style={styles.hangupRow}>
              <CallButton icon="call" label="Quitter" tone="danger" size={68} onPress={leaveGroupCall} iconStyle={styles.rotate} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E1016' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  securePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.1)' },
  secureText: { fontSize: 11, lineHeight: 15, color: 'rgba(255,255,255,.85)', fontWeight: '600' },
  compactHead: { alignItems: 'center', gap: 2 },
  compactName: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: '#fff' },
  compactStatus: { fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,.8)', fontVariant: ['tabular-nums'] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 120, gap: 8 },
  groupIcon: { width: 132, height: 132, borderRadius: 66, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: '#fff', marginTop: 6, textAlign: 'center' },
  kindPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.1)' },
  kindText: { fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,.85)', fontWeight: '600' },
  status: { fontSize: 15, lineHeight: 20, color: 'rgba(255,255,255,.85)', textAlign: 'center', fontVariant: ['tabular-nums'] },
  notice: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,.72)' },
  noticeText: { fontSize: 13, lineHeight: 18, color: '#fff', fontWeight: '600' },
  localWrap: { position: 'absolute', right: 16, width: 84, height: 120, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,.55)', backgroundColor: '#000' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  panel: { borderRadius: 30, paddingTop: 20, paddingBottom: 6, backgroundColor: 'rgba(255,255,255,.07)', gap: 18 },
  hangupRow: { flexDirection: 'row', justifyContent: 'center' },
  rotate: { transform: [{ rotate: '135deg' }] },
  minimize: { position: 'absolute', left: 12, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.12)', zIndex: 5 },
});
