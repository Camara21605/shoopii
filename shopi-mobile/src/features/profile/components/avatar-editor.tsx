/**
 * Photo de profil modifiable directement depuis le profil (sans passer par
 * Paramètres) — touche sur la photo ou sur l'appareil photo :
 *   · feuille : Prendre une photo · Choisir dans la galerie · Voir · Supprimer ;
 *   · recadrage carré, puis réduction à 640 px en JPEG (≈ 60–120 Ko : envoi
 *     rapide même en 3G, peu de données consommées) ;
 *   · aperçu IMMÉDIAT de la nouvelle photo avec anneau de chargement ; en cas
 *     d'échec, l'ancienne photo revient et un message l'explique.
 * Même envoi que Paramètres › Profil (POST /upload/avatar puis PATCH /client/parametres/profil/avatar) ;
 * le cache du profil, de l'en-tête et des paramètres est mis à jour ensemble.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { removeAvatar, uploadAvatar } from '@/features/settings/api';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { confirmAction } from '@/lib/confirm';
import { qk } from '@/lib/query-keys';

import type { ClientProfile } from '../api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const SIDE = 640;

async function prepare(asset: ImagePicker.ImagePickerAsset) {
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width ?? 0, asset.height ?? 0) > SIDE) {
    ctx.resize((asset.width ?? 0) >= (asset.height ?? 0) ? { width: SIDE } : { height: SIDE });
  }
  const out = await (await ctx.renderAsync()).saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return out.uri;
}

/** État et actions de la photo : `preview` = photo en cours d'envoi, affichée tout de suite. */
export function useAvatarEditor(onMessage: (text: string, error?: boolean) => void) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const setPhoto = (url: string | null) => {
    qc.setQueryData<ClientProfile>(qk.profile.me, (old) => (old ? { ...old, profilePicture: url } : old));
    void qc.invalidateQueries({ queryKey: qk.accountSettings.profil });
  };

  const upload = useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => {
      const uri = await prepare(asset);
      setPreview(uri);
      return uploadAvatar(uri, 'image/jpeg', `avatar-${Date.now()}.jpg`);
    },
    onSuccess: (url) => {
      setPhoto(url);
      onMessage('Photo de profil mise à jour');
    },
    onError: (e) => onMessage(toUserMessage(e) || 'Envoi impossible. Vérifiez votre connexion et réessayez.', true),
    onSettled: () => setPreview(null),
  });

  const remove = useMutation({
    mutationFn: removeAvatar,
    onSuccess: () => {
      setPhoto(null);
      onMessage('Photo supprimée');
    },
    onError: () => onMessage('Impossible de supprimer la photo pour le moment.', true),
  });

  async function pick(source: 'camera' | 'library') {
    setOpen(false);
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      const go = await confirmAction(
        source === 'camera' ? 'Appareil photo bloqué' : 'Photos bloquées',
        'Autorisez l’accès dans les réglages du téléphone pour choisir votre photo de profil.',
        'Ouvrir les réglages',
      );
      if (go) void Linking.openSettings();
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
    const res =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ ...opts, cameraType: ImagePicker.CameraType.front })
        : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    upload.mutate(res.assets[0]);
  }

  async function askRemove() {
    setOpen(false);
    const ok = await confirmAction('Supprimer la photo ?', 'Vos initiales s’afficheront à la place.', 'Supprimer', true);
    if (ok) remove.mutate();
  }

  return {
    preview,
    busy: upload.isPending || remove.isPending,
    openSheet: () => setOpen(true),
    sheet: (photo: string | null | undefined) => (
      <>
        {open ? (
          <BottomSheet title="Photo de profil" onClose={() => setOpen(false)}>
            <View style={styles.sheetBody}>
              <SheetRow icon="camera-outline" label="Prendre une photo" sub="Avec la caméra avant" onPress={() => void pick('camera')} />
              <SheetRow icon="images-outline" label="Choisir dans la galerie" sub="JPG, PNG ou WebP — recadrée en carré" onPress={() => void pick('library')} />
              {photo ? (
                <>
                  <SheetRow
                    icon="expand-outline"
                    label="Voir la photo"
                    onPress={() => {
                      setOpen(false);
                      setViewer(true);
                    }}
                  />
                  <SheetRow icon="trash-outline" label="Supprimer la photo" danger onPress={() => void askRemove()} />
                </>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                Visible par les boutiques, livreurs et points relais avec qui vous échangez.
              </ThemedText>
            </View>
          </BottomSheet>
        ) : null}
        {viewer && photo ? <PhotoViewer uri={photo} onClose={() => setViewer(false)} /> : null}
      </>
    ),
  };
}

function SheetRow({ icon, label, sub, onPress, danger }: { icon: IconName; label: string; sub?: string; onPress: () => void; danger?: boolean }) {
  const theme = useTheme();
  const color = danger ? Brand.danger : theme.text;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.rowIco, { backgroundColor: danger ? `${Brand.danger}14` : theme.backgroundElement }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.flex}>
        <ThemedText style={[styles.rowLabel, { color }]}>{label}</ThemedText>
        {sub ? (
          <ThemedText type="small" themeColor="textSecondary">
            {sub}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

function PhotoViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 32, 520);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.viewer} onPress={onClose} accessibilityLabel="Fermer">
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
        <View style={styles.viewerClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </View>
      </Pressable>
    </Modal>
  );
}

/** Anneau de chargement posé sur la photo pendant l'envoi. */
export function AvatarBusy() {
  return (
    <View style={styles.busy}>
      <ActivityIndicator color="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheetBody: { paddingHorizontal: 10, paddingBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 10 },
  rowIco: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15.5, lineHeight: 20, fontWeight: '700' },
  note: { paddingHorizontal: 8, paddingTop: 8 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerClose: { position: 'absolute', top: 54, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(31,31,31,0.45)', alignItems: 'center', justifyContent: 'center' },
});
