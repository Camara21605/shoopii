/**
 * « ⚡ Arranger » en un toucher : la même page que l'éditeur, dans une
 * WebView invisible, applique les Réglages photo du vendeur (style,
 * intensité, fond, cadrage) et rend la photo finie — sans ouvrir d'écran.
 * Une photo à la fois (file d'attente) ; ~1 s par photo sur un téléphone
 * courant ; échec ou délai dépassé (40 s) = la photo d'origine est gardée.
 */
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { EDITOR_HTML } from './editor-html';
import { editorOptions, type PhotoSettings } from './photo-settings';
import { prepare, writeDataUrl, type BgResult } from './photo-io';

export type PhotoProcessorHandle = { process: (uri: string, settings: PhotoSettings) => Promise<BgResult> };

type Job = { uri: string; settings: PhotoSettings; resolve: (r: BgResult) => void; reject: (e: Error) => void };

export const PhotoProcessor = forwardRef<PhotoProcessorHandle>(function PhotoProcessor(_props, ref) {
  const webRef = useRef<WebView>(null);
  const booted = useRef(false);
  const bootWaiters = useRef<(() => void)[]>([]);
  const queue = useRef<Job[]>([]);
  const running = useRef<Job | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Nouvelle page à chaque série (mémoire libérée entre deux photos lourdes). */
  const [generation, setGeneration] = useState(0);

  const waitBoot = () => (booted.current ? Promise.resolve() : new Promise<void>((r) => bootWaiters.current.push(r)));

  function finish(result: BgResult | null, error?: string) {
    const job = running.current;
    running.current = null;
    if (timer.current) clearTimeout(timer.current);
    if (job) {
      if (result) job.resolve(result);
      else job.reject(new Error(error ?? 'Retouche impossible'));
    }
    void next();
  }

  async function next() {
    if (running.current) return;
    const job = queue.current.shift();
    if (!job) return;
    running.current = job;
    try {
      const payload = await prepare(job.uri, { withMask: job.settings.removeBg });
      await waitBoot();
      if (running.current !== job) return;
      timer.current = setTimeout(() => {
        finish(null, 'Délai dépassé');
        booted.current = false;
        setGeneration((g) => g + 1);
      }, 40_000);
      const msg = { image: payload.image, mask: payload.mask, autoExport: true, ...editorOptions(job.settings) };
      webRef.current?.injectJavaScript(`window.__shoneyaLoad && window.__shoneyaLoad(${JSON.stringify(msg)});true;`);
    } catch {
      finish(null, 'Photo illisible');
    }
  }

  function onMessage(e: WebViewMessageEvent) {
    let m: { type?: string; dataUrl?: string; mime?: string; message?: string } = {};
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'boot') {
      booted.current = true;
      bootWaiters.current.splice(0).forEach((r) => r());
    } else if (m.type === 'result' && m.dataUrl && running.current) {
      try {
        const mime = m.mime === 'image/png' ? 'image/png' : 'image/jpeg';
        finish({ uri: writeDataUrl(m.dataUrl, mime), mime });
      } catch {
        finish(null, 'Écriture impossible');
      }
    } else if (m.type === 'error' && running.current) {
      finish(null, m.message);
    }
  }

  useImperativeHandle(ref, () => ({
    process: (uri, settings) =>
      new Promise<BgResult>((resolve, reject) => {
        queue.current.push({ uri, settings, resolve, reject });
        void next();
      }),
  }));

  return (
    <View pointerEvents="none" style={styles.hidden} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <WebView
        key={generation}
        ref={webRef}
        source={{ html: EDITOR_HTML, baseUrl: 'https://localhost/' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        style={styles.web}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  /* Invisible mais « affichée » : Android ne met pas en pause une WebView visible de 1 px */
  hidden: { position: 'absolute', width: 2, height: 2, left: 0, top: 0, opacity: 0.01, overflow: 'hidden' },
  web: { width: 360, height: 640, backgroundColor: 'transparent' },
});
