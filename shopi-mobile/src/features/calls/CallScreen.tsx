/**
 * src/features/calls/CallScreen.tsx
 *
 * Écran plein écran d'un appel : sonnerie entrante (Refuser / Répondre),
 * appel sortant, connexion, appel en cours audio ou vidéo.
 *
 * - Fond : photo de l'interlocuteur floutée sous un voile sombre (immersif,
 *   volontairement différent du reste de l'app qui reste blanc).
 * - Appel audio → vidéo sans raccrocher : bouton « Vidéo » (toggleVideo).
 * - Vidéo de l'autre plein écran ; toucher l'écran masque / affiche les
 *   commandes ; ma caméra en vignette.
 * - Mention « Chiffré de bout en bout » : WebRTC chiffre toujours la voix et
 *   l'image (DTLS-SRTP) d'un téléphone à l'autre ; le serveur ne fait que
 *   mettre en relation et ne peut ni écouter ni enregistrer.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

import {
  acceptCall, flipCamera, hangUp, rejectCall, toggleMute, toggleSpeaker, toggleVideo, useCallStore,
} from './call-store';
import { CallButton, ControlsRow, PulseAvatar } from './components';

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function statusLabel(status: string, incoming: boolean, video: boolean): string {
  switch (status) {
    case 'calling':      return 'Appel en cours…';
    case 'ringing':      return incoming ? (video ? 'Appel vidéo entrant' : 'Appel audio entrant') : 'Ça sonne…';
    case 'connecting':   return 'Connexion…';
    case 'reconnecting': return 'Reconnexion…';
    default:             return '';
  }
}

export default function CallScreen() {
  const insets = useSafeAreaInsets();
  const status          = useCallStore(s => s.status);
  const callInfo        = useCallStore(s => s.callInfo);
  const localStreamURL  = useCallStore(s => s.localStreamURL);
  const remoteStreamURL = useCallStore(s => s.remoteStreamURL);
  const muted           = useCallStore(s => s.muted);
  const speakerOn       = useCallStore(s => s.speakerOn);
  const videoEnabled    = useCallStore(s => s.videoEnabled);
  const remoteVideo     = useCallStore(s => s.remoteVideo);
  const upgrading       = useCallStore(s => s.upgrading);
  const durationSec     = useCallStore(s => s.durationSec);
  const errorMessage    = useCallStore(s => s.errorMessage);
  const [chromeVisible, setChromeVisible] = useState(true);

  const showRemoteVideo = remoteVideo && !!remoteStreamURL;
  const myCameraOn = videoEnabled && !!localStreamURL && callInfo?.callType === 'video';

  /* En vidéo, les commandes s'effacent après 5 s pour laisser voir l'image ; un toucher les ramène. */
  useEffect(() => {
    if (!showRemoteVideo || !chromeVisible) return;
    const t = setTimeout(() => setChromeVisible(false), 5000);
    return () => clearTimeout(t);
  }, [showRemoteVideo, chromeVisible]);

  if (!callInfo) return null;

  const isIncoming = callInfo.direction === 'incoming';
  const isRinging  = status === 'ringing';
  const connected  = status === 'connected';
  const establishing = !connected && status !== 'reconnecting';
  const chrome = !showRemoteVideo || chromeVisible || !connected;
  const subtitle = errorMessage ?? (connected ? fmtDuration(durationSec) : statusLabel(status, isIncoming, callInfo.callType === 'video'));

  return (
    <View style={styles.root}>
      {/* ── Fond ── */}
      {showRemoteVideo ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setChromeVisible(v => !v)} accessibilityLabel="Afficher les commandes">
          <RTCView streamURL={remoteStreamURL!} style={StyleSheet.absoluteFill} objectFit="cover" />
        </Pressable>
      ) : (
        <>
          {callInfo.remoteAvatar
            ? <Image source={{ uri: callInfo.remoteAvatar }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} />
            : null}
          <LinearGradient colors={['rgba(14,16,22,.72)', 'rgba(14,16,22,.88)', '#0E1016']} style={StyleSheet.absoluteFill} />
        </>
      )}

      {/* Voiles haut/bas pour garder le texte lisible sur la vidéo */}
      {showRemoteVideo && chrome ? (
        <>
          <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,.6)', 'transparent']} style={[styles.topShade, { height: 170 + insets.top }]} />
          <LinearGradient pointerEvents="none" colors={['transparent', 'rgba(0,0,0,.7)']} style={styles.bottomShade} />
        </>
      ) : null}

      {/* ── En-tête ── */}
      {chrome ? (
        <View style={[styles.header, { paddingTop: insets.top + 14 }]} pointerEvents="none">
          <View style={styles.securePill}>
            <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,.85)" />
            <ThemedText style={styles.secureText}>Chiffré de bout en bout</ThemedText>
          </View>
          {showRemoteVideo ? (
            <View style={styles.compactHead}>
              <ThemedText numberOfLines={1} style={styles.compactName}>{callInfo.remoteName}</ThemedText>
              <ThemedText style={styles.compactStatus}>{subtitle}</ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Centre (sans vidéo de l'autre) ── */}
      {!showRemoteVideo ? (
        <View style={styles.center} pointerEvents="none">
          <PulseAvatar name={callInfo.remoteName} uri={callInfo.remoteAvatar} pulsing={establishing} />
          <ThemedText numberOfLines={1} style={styles.name}>{callInfo.remoteName}</ThemedText>
          <View style={[styles.statusPill, status === 'reconnecting' && styles.statusWarn, !!errorMessage && styles.statusError]}>
            {connected && !errorMessage ? <View style={styles.liveDot} /> : null}
            <ThemedText style={styles.status}>{subtitle}</ThemedText>
          </View>
        </View>
      ) : null}

      {/* ── Ma caméra ── */}
      {myCameraOn ? (
        <View style={[styles.localWrap, { top: insets.top + (showRemoteVideo ? 96 : 64) }]}>
          <RTCView streamURL={localStreamURL!} style={StyleSheet.absoluteFill} objectFit="cover" mirror zOrder={1} />
        </View>
      ) : null}

      {/* ── Commandes ── */}
      {chrome ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 28 }]}>
          {isRinging && isIncoming ? (
            <ControlsRow>
              <CallButton icon="call" label="Refuser" tone="danger" size={70} onPress={rejectCall} iconStyle={styles.rotate} />
              <CallButton
                icon={callInfo.callType === 'video' ? 'videocam' : 'call'}
                label="Répondre" tone="success" size={70} onPress={() => void acceptCall()} />
            </ControlsRow>
          ) : (
            <View style={styles.panel}>
              <ControlsRow>
                <CallButton icon={muted ? 'mic-off' : 'mic'} label={muted ? 'Micro coupé' : 'Micro'} active={muted} onPress={toggleMute} />
                <CallButton icon={speakerOn ? 'volume-high' : 'volume-medium'} label="Haut-parleur" active={speakerOn} onPress={toggleSpeaker} />
                <CallButton
                  icon={myCameraOn ? 'videocam' : 'videocam-off'}
                  label={callInfo.callType === 'video' ? 'Caméra' : 'Vidéo'}
                  active={myCameraOn}
                  busy={upgrading}
                  onPress={() => void toggleVideo()}
                />
                {myCameraOn ? <CallButton icon="camera-reverse" label="Retourner" onPress={flipCamera} /> : null}
              </ControlsRow>
              <View style={styles.hangupRow}>
                <CallButton icon="call" label="Raccrocher" tone="danger" size={68} onPress={hangUp} iconStyle={styles.rotate} />
              </View>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E1016' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomShade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 320 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  securePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,.1)',
  },
  secureText: { fontSize: 11, lineHeight: 15, color: 'rgba(255,255,255,.85)', fontWeight: '600' },
  compactHead: { alignItems: 'center', gap: 2 },
  compactName: { fontSize: 18, lineHeight: 24, fontWeight: '800', color: '#fff' },
  compactStatus: { fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,.8)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 120, gap: 6 },
  name: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#fff', marginTop: 4, textAlign: 'center' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
  },
  statusWarn: { backgroundColor: 'rgba(245,158,11,.22)' },
  statusError: { backgroundColor: 'rgba(217,48,37,.28)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' },
  status: { fontSize: 15, lineHeight: 20, color: 'rgba(255,255,255,.85)', fontVariant: ['tabular-nums'], textAlign: 'center' },
  localWrap: {
    position: 'absolute', right: 16, width: 108, height: 156, borderRadius: 18, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,.55)', backgroundColor: '#000',
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  panel: { borderRadius: 30, paddingTop: 20, paddingBottom: 6, backgroundColor: 'rgba(255,255,255,.07)', gap: 18 },
  hangupRow: { alignItems: 'center' },
  rotate: { transform: [{ rotate: '135deg' }] },
});
