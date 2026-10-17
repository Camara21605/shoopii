/**
 * « Retoucher la photo » d'un produit — plein écran, au-dessus de la fiche :
 * ✨ Embellir (photo plus lumineuse, plus nette, couleurs justes — « Auto »
 * déjà appliqué à l'ouverture) et ✂️ Retirer le fond. Étapes :
 *   1. photo ramenée à 1 200 px (rapide même sur un petit téléphone) ;
 *   2. détection du produit par l'IA du téléphone (Android) — sinon la page
 *      utilise la méthode « couleur du fond » ;
 *   3. retouches au doigt dans la page (editor-html.ts) ;
 *   4. « Terminer » : la photo finale (JPEG sur blanc ou PNG transparent)
 *      est écrite sur le téléphone et rendue à la fiche, qui l'envoie et
 *      remplace la photo d'origine à la même place.
 * Rien n'est modifié tant que le vendeur n'a pas touché « Terminer ».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { EDITOR_HTML } from './editor-html';
import { editorOptions, getPhotoSettings } from './photo-settings';
import { prepare, writeDataUrl, type BgResult } from './photo-io';

export type { BgResult } from './photo-io';

export function BackgroundEditor({
  uri,
  startTab = 'look',
  onClose,
  onDone,
}: {
  uri: string | null;
  /** look = Embellir (par défaut) · bg = Retirer le fond directement */
  startTab?: 'look' | 'bg';
  onClose: () => void;
  onDone: (r: BgResult) => void;
}) {
  const theme = useTheme();
  const webRef = useRef<WebView>(null);
  const [booted, setBooted] = useState(false);
  const [payload, setPayload] = useState<{ image: string; mask: string | null; ai: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* Préparation (réduction + IA) dès l'ouverture. */
  useEffect(() => {
    if (!uri) return;
    let alive = true;
    prepare(uri)
      .then((p) => { if (alive) setPayload(p); })
      .catch(() => { if (alive) setFailed('Impossible d’ouvrir cette photo. Vérifiez la connexion et réessayez.'); });
    return () => { alive = false; };
  }, [uri]);

  /* Photo prête + page prête → chargement dans l'éditeur. */
  useEffect(() => {
    if (!booted || !payload) return;
    webRef.current?.injectJavaScript(`window.__shoneyaLoad && window.__shoneyaLoad(${JSON.stringify({ image: payload.image, mask: payload.mask, startTab, ...editorOptions(getPhotoSettings()) })});true;`);
  }, [booted, payload, startTab]);

  function onMessage(e: WebViewMessageEvent) {
    let m: { type?: string; dataUrl?: string; mime?: string; message?: string } = {};
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'boot') setBooted(true);
    else if (m.type === 'ready') setReady(true);
    else if (m.type === 'error') { setFinishing(false); Alert.alert('Retoucher la photo', m.message ?? 'Une erreur est survenue.'); }
    else if (m.type === 'result' && m.dataUrl) {
      try {
        const mime = m.mime === 'image/png' ? 'image/png' : 'image/jpeg';
        onDone({ uri: writeDataUrl(m.dataUrl, mime), mime });
      } catch {
        Alert.alert('Retoucher la photo', 'La photo n’a pas pu être enregistrée sur le téléphone.');
      } finally {
        setFinishing(false);
      }
    }
  }

  function finish() {
    if (!ready || finishing) return;
    setFinishing(true);
    webRef.current?.injectJavaScript('window.exportResult && window.exportResult();true;');
  }

  function close() {
    if (finishing) return;
    if (!ready) return onClose();
    Alert.alert('Abandonner les retouches ?', 'La photo d’origine est gardée telle quelle.', [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Abandonner', style: 'destructive', onPress: onClose },
    ]);
  }

  return (
    <Modal visible={!!uri} animationType="slide" presentationStyle="fullScreen" onRequestClose={close} statusBarTranslucent>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <View style={[styles.head, { borderBottomColor: theme.border }]}>
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer sans modifier" style={styles.headBtn}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.flex}>
            <ThemedText style={styles.title}>Retoucher la photo</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {payload ? 'Embellir · Retirer le fond — rien ne change avant « Terminer »' : 'Préparation…'}
            </ThemedText>
          </View>
          <Pressable
            onPress={finish}
            disabled={!ready || finishing}
            accessibilityRole="button"
            style={[styles.done, (!ready || finishing) && styles.off]}>
            {finishing ? <ActivityIndicator size="small" color={Brand.primaryInk} /> : <Ionicons name="checkmark" size={18} color={Brand.primaryInk} />}
            <ThemedText style={styles.doneText}>Terminer</ThemedText>
          </Pressable>
        </View>

        {failed ? (
          <View style={styles.center}>
            <Ionicons name="image-outline" size={40} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.centerText}>{failed}</ThemedText>
          </View>
        ) : (
          <WebView
            ref={webRef}
            source={{ html: EDITOR_HTML, baseUrl: 'https://localhost/' }}
            originWhitelist={['*']}
            onMessage={onMessage}
            javaScriptEnabled
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            setBuiltInZoomControls={false}
            androidLayerType="hardware"
            style={styles.flex}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  headBtn: { padding: 4 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  done: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, paddingHorizontal: 14, minHeight: 40 },
  doneText: { color: Brand.primaryInk, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  off: { opacity: 0.5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
});
