/**
 * Version web (aperçu navigateur) de la carte « Localisation ».
 *
 * Pourquoi : MapView.tsx repose sur react-native-webview, qui n'existe pas
 * dans un navigateur (« requireNativeComponent is not a function »). Comme le
 * rendu web charge toutes les routes, cela faisait planter TOUT l'aperçu,
 * même hors de la carte. Metro choisit ce fichier pour le web ; Android/iOS
 * gardent MapView.tsx. Même interface (props, ref) : l'écran ne change pas.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useImperativeHandle, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

import type { MapState, MapViewHandle } from './MapView';

export type { CameraCommand, MapState, MapStyleId, MapViewHandle } from './MapView';

interface Props {
  state: MapState;
  initialCenter: { lat: number; lng: number };
  onSelect: (key: string) => void;
  /** Toucher la carte hors épingle, avec la position touchée. */
  onTap?: (at: { lat: number; lng: number }) => void;
  onError?: () => void;
  onDrag?: () => void;
  ref?: Ref<MapViewHandle>;
}

export function MapView({ ref }: Props) {
  useImperativeHandle(ref, () => ({ camera: () => undefined }), []);
  return (
    <View style={styles.box}>
      <Ionicons name="map-outline" size={40} color="#6B6B6B" />
      <ThemedText themeColor="textSecondary" style={styles.text}>
        La carte s’affiche dans l’application Android.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F5F5F5' },
  text: { textAlign: 'center', paddingHorizontal: 24 },
});
