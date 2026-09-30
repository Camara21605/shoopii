/**
 * src/features/messagerie/MediaViewer.tsx
 *
 * Visionneuse plein écran pour une image ou une vidéo reçue/envoyée dans une
 * conversation — fermer, télécharger (voir download.ts : galerie pour une
 * image/vidéo). Le contenu n'est monté QUE pendant que la modale est
 * visible : rouvrir sur un autre média démarre toujours un lecteur vidéo
 * neuf (pas de synchronisation manuelle d'un lecteur persistant entre deux
 * sources différentes).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { downloadAttachment } from './download';

interface Props {
  visible: boolean;
  onClose: () => void;
  kind: 'image' | 'video';
  url: string;
  name?: string;
}

export default function MediaViewer({ visible, onClose, kind, url, name }: Props) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    const res = await downloadAttachment(kind, url, name ?? (kind === 'image' ? 'photo.jpg' : 'video.mp4'));
    setDownloading(false);
    Alert.alert(res.ok ? 'Terminé' : 'Erreur', res.message);
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent presentationStyle="fullScreen">
      <View style={styles.root}>
        {visible && (kind === 'image'
          ? <Image source={{ uri: url }} style={styles.fill} contentFit="contain" />
          : <VideoPane url={url} />)}

        <View style={styles.topBar}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Pressable onPress={() => void handleDownload()} disabled={downloading} accessibilityRole="button" accessibilityLabel="Télécharger" hitSlop={10} style={styles.iconBtn}>
            {downloading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="download" size={21} color="#fff" />}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Composant séparé : useVideoPlayer(url) n'est appelé qu'au montage, jamais avec une url périmée. */
function VideoPane({ url }: { url: string }) {
  const player = useVideoPlayer(url, p => { p.play(); });
  // Déjà en plein écran (Modal) — pas besoin du bouton plein écran natif de VideoView.
  return <VideoView player={player} style={styles.fill} contentFit="contain" nativeControls />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  fill: { width: '100%', height: '100%' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.45)' },
});
