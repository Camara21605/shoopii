/**
 * Photos et vidéo d'un produit — mêmes quotas que le serveur : 4 photos +
 * 1 vidéo. Chaque photo est réduite à 1 600 px et recompressée (JPEG 82 %)
 * avant l'envoi, comme sur le site : envoi rapide en 3G et jamais de refus
 * « fichier > 5 Mo ». Vidéo : 50 Mo et 3 minutes au plus.
 * L'envoi démarre dès le choix (le vendeur continue de remplir la fiche
 * pendant ce temps) ; un échec se renvoie d'un toucher. La 1re photo est la
 * photo principale ; toucher une photo = la mettre en principale / la retirer.
 *
 * Ajout : trois cases à icône seule, dans la grille même (Galerie · Appareil
 * photo · Vidéo, avec leur compteur) — elles disparaissent quand le quota
 * est atteint. ✨ sur une photo : « Retoucher la photo » (background/) —
 * l'embellir (Auto déjà appliqué) et, au choix, retirer son fond.
 * ⚡ Arranger : applique les Réglages photo (⚙️) à toutes les photos pas
 * encore retouchées, en un toucher, sans ouvrir d'écran ; avec le réglage
 * « Arranger chaque nouvelle photo », c'est fait dès l'ajout, avant l'envoi.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

import { BackgroundEditor, type BgResult } from '../background/background-editor';
import { PhotoProcessor, type PhotoProcessorHandle } from '../background/photo-processor';
import { getPhotoSettings, STYLES, usePhotoSettings } from '../background/photo-settings';
import { PhotoSettingsSheet } from '../background/photo-settings-sheet';

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
  /* Photo ouverte dans « Retirer le fond » */
  const [bgFor, setBgFor] = useState<{ item: MediaItem; tab: 'look' | 'bg' } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [arranging, setArranging] = useState<{ done: number; total: number } | null>(null);
  const processor = useRef<PhotoProcessorHandle>(null);
  const photoSettings = usePhotoSettings();
  const toArrange = media.filter((m) => m.type === 'image' && !m.retouched && m.status !== 'uploading' && !m.retouching);
  const settingsSummary = [
    STYLES.find((x) => x.key === photoSettings.style)?.label ?? 'Auto',
    photoSettings.removeBg ? (photoSettings.bg === 'white' ? 'fond blanc' : 'fond transparent') : null,
    photoSettings.removeBg && photoSettings.crop ? 'cadré' : null,
    photoSettings.autoOnAdd ? 'auto à l’ajout' : null,
  ].filter(Boolean).join(' · ');

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
        /* Réglage « Arranger chaque nouvelle photo » : retouche AVANT l'envoi (un seul envoi) */
        const settings = getPhotoSettings();
        if (settings.autoOnAdd && processor.current) {
          patch(item.key, { retouching: true });
          try {
            const r = await processor.current.process(ready.uri, settings);
            patch(item.key, { preview: r.uri, retouching: false, retouched: true });
            await upload(item, { uri: r.uri, mimeType: r.mime, name: r.mime === 'image/png' ? `produit-${i + 1}.png` : `produit-${i + 1}.jpg` });
            continue;
          } catch {
            patch(item.key, { retouching: false }); /* retouche impossible : la photo d'origine part telle quelle */
          }
        }
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

  /* Photo retouchée : envoyée à la place de l'originale, à la même position. */
  function applyBackground(m: MediaItem, r: BgResult) {
    setBgFor(null);
    const next: MediaItem = { ...m, preview: r.uri, url: null, status: 'uploading', error: undefined, retouched: true };
    patch(m.key, { preview: r.uri, url: null, status: 'uploading', error: undefined, retouched: true, retouching: false });
    void upload(next, { uri: r.uri, mimeType: r.mime, name: r.mime === 'image/png' ? 'produit-retouche.png' : 'produit-retouche.jpg' });
  }

  /* ⚡ Arranger : une photo, ou toutes celles pas encore retouchées */
  async function arrange(targets: MediaItem[]) {
    const list = targets.filter((m) => m.type === 'image' && m.status !== 'uploading' && !m.retouching);
    if (!list.length || !processor.current || arranging) return;
    const settings = getPhotoSettings();
    setArranging({ done: 0, total: list.length });
    let failed = 0;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      patch(m.key, { retouching: true });
      try {
        const r = await processor.current.process(m.preview, settings);
        applyBackground({ ...m, retouching: false }, r);
      } catch {
        failed++;
        patch(m.key, { retouching: false });
      }
      setArranging({ done: i + 1, total: list.length });
    }
    setArranging(null);
    if (failed) Alert.alert('Arranger les photos', failed === list.length ? 'Les photos n’ont pas pu être arrangées. Réessayez ou utilisez ✨ Retoucher.' : `${failed} photo(s) n’ont pas pu être arrangées : elles restent telles quelles.`);
  }

  function actions(m: MediaItem, index: number) {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (m.type === 'image' && m.status !== 'uploading' && !m.retouching) {
      buttons.push({ text: '⚡ Arranger (mes réglages)', onPress: () => void arrange([m]) });
      buttons.push({ text: '✨ Embellir la photo', onPress: () => setBgFor({ item: m, tab: 'look' }) });
      buttons.push({ text: '✂️ Retirer le fond', onPress: () => setBgFor({ item: m, tab: 'bg' }) });
    }
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
            {m.retouching ? <View style={styles.veil}><Ionicons name="flash" size={20} color="#FCD34D" /><ThemedText style={styles.veilText}>Retouche…</ThemedText></View>
              : m.status === 'uploading' ? <View style={styles.veil}><ActivityIndicator color="#fff" /><ThemedText style={styles.veilText}>Envoi…</ThemedText></View> : null}
            {m.retouched && m.status === 'done' ? <View style={styles.retouchedTag}><Ionicons name="sparkles" size={10} color="#fff" /></View> : null}
            {m.status === 'error' ? <View style={[styles.veil, styles.veilErr]}><Ionicons name="refresh" size={22} color="#fff" /><ThemedText style={styles.veilText}>Renvoyer</ThemedText></View> : null}
            {m.status === 'done' ? <View style={styles.ok}><Ionicons name="checkmark" size={12} color="#fff" /></View> : null}
            {/* ✨ Retoucher (embellir, retirer le fond) — un toucher, directement sur la photo */}
            {m.type === 'image' && m.status !== 'uploading' && !m.retouching ? (
              <Pressable onPress={() => setBgFor({ item: m, tab: 'look' })} hitSlop={6} accessibilityRole="button" accessibilityLabel="Retoucher cette photo : embellir, retirer le fond" style={styles.wand}>
                <Ionicons name="sparkles" size={15} color="#fff" />
              </Pressable>
            ) : null}
          </Pressable>
        ))}

        {/* Ajouter : icônes seules, dans la grille ; disparaissent quand le quota est atteint */}
        {roomImages > 0 ? <AddTile icon="images" label="Choisir des photos dans la galerie" count={`${images.length}/${LIMITS.images}`} onPress={() => void pickImages()} /> : null}
        {roomImages > 0 ? <AddTile icon="camera" label="Prendre une photo" onPress={() => void takePhoto()} /> : null}
        {roomVideo > 0 ? <AddTile icon="videocam" label="Ajouter une vidéo" count={`${videos.length}/${LIMITS.videos}`} onPress={() => void pickVideo()} /> : null}
      </View>

      {/* ⚡ Arranger en un toucher (selon les réglages ⚙️) */}
      {images.length ? (
        <View style={styles.toolbar}>
          <Pressable
            onPress={() => void arrange(toArrange)}
            disabled={!toArrange.length || !!arranging}
            accessibilityRole="button"
            accessibilityLabel={toArrange.length ? `Arranger ${toArrange.length} photo(s) selon mes réglages` : 'Toutes les photos sont arrangées'}
            style={({ pressed }) => [styles.arrange, (!toArrange.length || !!arranging) && styles.arrangeOff, pressed && styles.pressed]}>
            {arranging ? <ActivityIndicator size="small" color={Brand.primaryInk} /> : <Ionicons name={toArrange.length ? 'flash' : 'checkmark-done'} size={18} color={Brand.primaryInk} />}
            <View style={styles.flex}>
              <ThemedText style={styles.arrangeText} numberOfLines={1}>
                {arranging ? `Arrangement ${Math.min(arranging.done + 1, arranging.total)}/${arranging.total}…` : toArrange.length ? (toArrange.length > 1 ? `Arranger les ${toArrange.length} photos` : 'Arranger la photo') : 'Photos arrangées'}
              </ThemedText>
              <ThemedText style={styles.arrangeSub} numberOfLines={1}>{settingsSummary}</ThemedText>
            </View>
          </Pressable>
          <Pressable onPress={() => setSettingsOpen(true)} accessibilityRole="button" accessibilityLabel="Réglages photo" hitSlop={6}
            style={({ pressed }) => [styles.gear, { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundSelected : theme.background }]}>
            <Ionicons name="options-outline" size={20} color={theme.text} />
          </Pressable>
        </View>
      ) : null}

      {error ? <ErrorLine text={error} /> : (
        <View style={styles.legend}>
          <Legend icon="images" text="Galerie" />
          <Legend icon="camera" text="Photo" />
          <Legend icon="videocam" text="Vidéo" />
          <Legend icon="sparkles" text="Retoucher" />
          <Legend icon="flash" text="Arranger" />
        </View>
      )}

      <PhotoProcessor ref={processor} />
      {settingsOpen ? <PhotoSettingsSheet onClose={() => setSettingsOpen(false)} /> : null}
      {bgFor ? (
        <BackgroundEditor
          key={bgFor.item.key}
          uri={bgFor.item.preview}
          startTab={bgFor.tab}
          onClose={() => setBgFor(null)}
          onDone={(r) => applyBackground(bgFor.item, r)}
        />
      ) : null}
    </View>
  );
}

/** Case d'ajout : grande icône claire + compteur ; le texte complet est lu par le lecteur d'écran. */
function AddTile({ icon, label, count, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; count?: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={count ? `${label}, ${count}` : label}
      style={({ pressed }) => [styles.tile, styles.addTile, { borderColor: Brand.primary, backgroundColor: pressed ? theme.backgroundSelected : theme.background }]}>
      <View style={[styles.addIcon, { backgroundColor: theme.backgroundSelected }]}>
        <Ionicons name={icon} size={26} color={Brand.primary} />
        <View style={styles.plus}><Ionicons name="add" size={13} color="#fff" /></View>
      </View>
      {count ? <ThemedText style={styles.count}>{count}</ThemedText> : null}
    </Pressable>
  );
}

function Legend({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.legendItem}>
      <Ionicons name={icon} size={13} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  fill: { width: '100%', height: '100%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31.5%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  video: { backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center', gap: 4 },
  videoDur: { color: '#fff', fontSize: 12, fontWeight: '700' },
  mainTag: { position: 'absolute', left: 6, top: 6, backgroundColor: Brand.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  mainText: { color: '#fff', fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.42)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  veilErr: { backgroundColor: 'rgba(217,48,37,.7)' },
  veilText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  ok: { position: 'absolute', right: 6, bottom: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: Brand.success, alignItems: 'center', justifyContent: 'center' },
  addTile: { borderStyle: 'dashed', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 6 },
  addIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  plus: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  count: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: Brand.primary },
  retouchedTag: { position: 'absolute', left: 6, bottom: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  toolbar: { flexDirection: 'row', gap: 8 },
  arrange: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, borderRadius: 14, paddingHorizontal: 14, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine },
  arrangeOff: { opacity: 0.55 },
  arrangeText: { color: Brand.primaryInk, fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  arrangeSub: { color: Brand.primaryInk, opacity: 0.75, fontSize: 11.5, lineHeight: 15, fontWeight: '600' },
  gear: { width: 50, minHeight: 50, borderRadius: 14, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  wand: { position: 'absolute', right: 6, top: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(31,31,31,.78)', alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
