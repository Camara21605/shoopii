/**
 * Photos et vidéo d'un produit — mêmes quotas que le serveur : 4 photos +
 * 1 vidéo. Chaque photo est réduite à 1 600 px et recompressée (JPEG 82 %)
 * avant l'envoi, comme sur le site : envoi rapide en 3G et jamais de refus
 * « fichier > 5 Mo ». Vidéo : 50 Mo et 3 minutes au plus.
 * L'envoi démarre dès le choix (le vendeur continue de remplir la fiche
 * pendant ce temps) ; un échec se renvoie d'un toucher. La 1re photo est la
 * photo principale ; appui long sur une photo = la mettre en principale / la retirer.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

import { uploadProductMedia } from '../product-api';
import { LIMITS, type MediaItem } from '../product-form';
import { ErrorLine } from './product-form-ui';

type SetMedia = (fn: (prev: MediaItem[]) => MediaItem[]) => void;

const newKey = () => `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const MAX_SIDE = 1600;

/** Réduit une photo (1 600 px max) et la recompresse ; renvoie l'URI du fichier prêt à envoyer. */
async function prepareImage(asset: ImagePicker.ImagePickerAsset): Promise<{ uri: string; bytes: number | null }> {
  const ctx = ImageManipulator.manipulate(asset.uri);
  const big = Math.max(asset.width ?? 0, asset.height ?? 0);
  if (big > MAX_SIDE) {
    ctx.resize((asset.width ?? 0) >= (asset.height ?? 0) ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  let bytes: number | null = null;
  try { bytes = new File(out.uri).size ?? null; } catch { /* taille inconnue : le serveur contrôlera */ }
  return { uri: out.uri, bytes };
}

export function ProductMedia({ media, setMedia, error }: { media: MediaItem[]; setMedia: SetMedia; error?: string }) {
  const theme = useTheme();
  const images = media.filter((m) => m.type === 'image');
  const videos = media.filter((m) => m.type === 'video');
  const roomImages = LIMITS.images - images.length;
  const roomVideo = LIMITS.videos - videos.length;

  const patch = (key: string, p: Partial<MediaItem>) => setMedia((prev) => prev.map((m) => (m.key === key ? { ...m, ...p } : m)));

  async function upload(item: MediaItem, source: { uri: string; mimeType: string; name: string }) {
    try {
      const url = await uploadProductMedia(item.type, source);
      patch(item.key, { url, status: 'done', error: undefined });
    } catch (err) {
      patch(item.key, { status: 'error', error: toUserMessage(err) });
    }
  }

  async function addImages(assets: ImagePicker.ImagePickerAsset[]) {
    const accepted = assets.slice(0, Math.max(0, roomImages));
    if (assets.length > accepted.length) Alert.alert('Limite atteinte', `${LIMITS.images} photos au maximum par produit : ${assets.length - accepted.length} photo(s) ignorée(s).`);
    const items = accepted.map<MediaItem>((a) => ({ key: newKey(), type: 'image', preview: a.uri, url: null, status: 'uploading' }));
    setMedia((prev) => [...prev, ...items]);
    /* Une par une : en 3G, plusieurs envois en parallèle se gênent et échouent ensemble. */
    for (let i = 0; i < accepted.length; i++) {
      const item = items[i];
      try {
        const ready = await prepareImage(accepted[i]);
        if (ready.bytes != null && ready.bytes > LIMITS.imageBytes) {
          patch(item.key, { status: 'error', error: 'Photo trop lourde même après réduction (5 Mo max).' });
          continue;
        }
        patch(item.key, { preview: ready.uri });
        await upload(item, { uri: ready.uri, mimeType: 'image/jpeg', name: `produit-${i + 1}.jpg` });
      } catch {
        patch(item.key, { status: 'error', error: 'Impossible de préparer cette photo.' });
      }
    }
  }

  async function pickImages() {
    if (roomImages <= 0) { Alert.alert('Limite atteinte', `${LIMITS.images} photos au maximum par produit.`); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission refusée', 'Autorisez l’accès à vos photos pour en ajouter.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: roomImages, orderedSelection: true, quality: 1,
    });
    if (!res.canceled && res.assets.length) void addImages(res.assets);
  }

  async function takePhoto() {
    if (roomImages <= 0) { Alert.alert('Limite atteinte', `${LIMITS.images} photos au maximum par produit.`); return; }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission refusée', 'Autorisez l’appareil photo pour photographier le produit.'); return; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled && res.assets[0]) void addImages([res.assets[0]]);
  }

  async function pickVideo() {
    if (roomVideo <= 0) { Alert.alert('Limite atteinte', 'Une seule vidéo par produit : retirez la vidéo actuelle pour en mettre une autre.'); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission refusée', 'Autorisez l’accès à vos vidéos pour en ajouter une.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1, videoMaxDuration: LIMITS.videoSeconds });
    const a = res.canceled ? null : res.assets[0];
    if (!a) return;
    const seconds = a.duration ? a.duration / 1000 : 0;
    if (seconds > LIMITS.videoSeconds) { Alert.alert('Vidéo trop longue', `La vidéo dure ${Math.round(seconds)} s : ${LIMITS.videoSeconds / 60} minutes au maximum.`); return; }
    if (a.fileSize && a.fileSize > LIMITS.videoBytes) {
      Alert.alert('Vidéo trop lourde', `${(a.fileSize / 1024 / 1024).toFixed(0)} Mo : 50 Mo au maximum. Raccourcissez-la ou filmez en qualité plus basse.`);
      return;
    }
    const mime = a.mimeType ?? 'video/mp4';
    if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(mime)) { Alert.alert('Format non pris en charge', 'Formats acceptés : MP4, MOV ou WebM.'); return; }
    const item: MediaItem = { key: newKey(), type: 'video', preview: a.uri, url: null, status: 'uploading', durationSec: Math.round(seconds) };
    setMedia((prev) => [...prev, item]);
    void upload(item, { uri: a.uri, mimeType: mime, name: a.fileName ?? 'video.mp4' });
  }

  function retry(m: MediaItem) {
    if (m.status !== 'error') return;
    patch(m.key, { status: 'uploading', error: undefined });
    void upload(m, { uri: m.preview, mimeType: m.type === 'video' ? 'video/mp4' : 'image/jpeg', name: m.type === 'video' ? 'video.mp4' : 'produit.jpg' });
  }

  function actions(m: MediaItem, index: number) {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (m.type === 'image' && index > 0 && m.status === 'done') {
      buttons.push({ text: 'Photo principale', onPress: () => setMedia((prev) => [m, ...prev.filter((x) => x.key !== m.key)]) });
    }
    if (m.status === 'error') buttons.push({ text: 'Renvoyer', onPress: () => retry(m) });
    buttons.push({ text: 'Retirer', style: 'destructive', onPress: () => setMedia((prev) => prev.filter((x) => x.key !== m.key)) });
    buttons.push({ text: 'Annuler', style: 'cancel' });
    Alert.alert(m.type === 'video' ? 'Vidéo' : index === 0 ? 'Photo principale' : `Photo ${index + 1}`, m.error ?? undefined, buttons);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {media.map((m, i) => (
          <Pressable key={m.key} onPress={() => (m.status === 'error' ? retry(m) : actions(m, i))} onLongPress={() => actions(m, i)}
            accessibilityRole="button" accessibilityLabel={`${m.type === 'video' ? 'Vidéo' : `Photo ${i + 1}`}, ${m.status === 'done' ? 'envoyée' : m.status === 'uploading' ? 'envoi en cours' : 'échec'}`}
            style={[styles.tile, { backgroundColor: theme.backgroundElement, borderColor: m.status === 'error' ? Brand.danger : theme.border }]}>
            {m.type === 'image'
              ? <Image source={{ uri: m.preview }} style={styles.fill} contentFit="cover" />
              : (
                <View style={[styles.fill, styles.video]}>
                  <Ionicons name="videocam" size={26} color="#fff" />
                  {m.durationSec ? <ThemedText style={styles.videoDur}>{Math.floor(m.durationSec / 60)}:{String(m.durationSec % 60).padStart(2, '0')}</ThemedText> : null}
                </View>
              )}
            {i === 0 && m.type === 'image' ? <View style={styles.mainTag}><ThemedText style={styles.mainText}>Principale</ThemedText></View> : null}
            {m.status === 'uploading' ? <View style={styles.veil}><ActivityIndicator color="#fff" /><ThemedText style={styles.veilText}>Envoi…</ThemedText></View> : null}
            {m.status === 'error' ? <View style={[styles.veil, styles.veilErr]}><Ionicons name="refresh" size={22} color="#fff" /><ThemedText style={styles.veilText}>Renvoyer</ThemedText></View> : null}
            {m.status === 'done' ? <View style={styles.ok}><Ionicons name="checkmark" size={12} color="#fff" /></View> : null}
          </Pressable>
        ))}
      </View>

      <View style={styles.buttons}>
        <AddButton icon="images" label="Galerie" sub={`${images.length}/${LIMITS.images} photos`} onPress={() => void pickImages()} disabled={roomImages <= 0} />
        <AddButton icon="camera" label="Photographier" onPress={() => void takePhoto()} disabled={roomImages <= 0} />
        <AddButton icon="videocam" label="Vidéo" sub={`${videos.length}/${LIMITS.videos}`} onPress={() => void pickVideo()} disabled={roomVideo <= 0} />
      </View>
      {error ? <ErrorLine text={error} /> : (
        <ThemedText type="small" themeColor="textSecondary">
          Fond clair, produit centré et bien éclairé. Touchez une photo pour la mettre en principale ou la retirer.
        </ThemedText>
      )}
    </View>
  );
}

function AddButton({ icon, label, sub, onPress, disabled }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; sub?: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.add, { borderColor: Brand.primary, backgroundColor: pressed ? theme.backgroundSelected : theme.background }, disabled && styles.addOff]}>
      <Ionicons name={icon} size={20} color={Brand.primary} />
      <ThemedText style={styles.addLabel}>{label}</ThemedText>
      {sub ? <ThemedText type="small" themeColor="textSecondary">{sub}</ThemedText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  fill: { width: '100%', height: '100%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31.5%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  video: { backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center', gap: 4 },
  videoDur: { color: '#fff', fontSize: 12, fontWeight: '700' },
  mainTag: { position: 'absolute', left: 6, top: 6, backgroundColor: Brand.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  mainText: { color: '#fff', fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.42)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  veilErr: { backgroundColor: 'rgba(217,48,37,.7)' },
  veilText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  ok: { position: 'absolute', right: 6, bottom: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: Brand.success, alignItems: 'center', justifyContent: 'center' },
  buttons: { flexDirection: 'row', gap: 8 },
  add: { flex: 1, alignItems: 'center', gap: 2, borderWidth: 1.2, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 12 },
  addOff: { opacity: 0.4 },
  addLabel: { fontSize: 13.5, lineHeight: 18, fontWeight: '800', color: Brand.primary },
});
