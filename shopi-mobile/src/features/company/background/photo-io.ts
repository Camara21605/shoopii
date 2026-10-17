/**
 * Préparation et écriture des photos retouchées (éditeur et « ⚡ Arranger ») :
 *   - prepare : copie locale, réduction à 1 200 px, JPEG → data URL ;
 *     + masque du produit par l'IA du téléphone si demandé ;
 *   - writeDataUrl : résultat de la page (data URL) → fichier du cache.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { segmentSubject } from '../../../../modules/shopi-calls';

const EDIT_SIDE = 1200;

export type BgResult = { uri: string; mime: 'image/jpeg' | 'image/png' };

/** Photo locale prête pour l'éditeur (copie distante téléchargée au besoin). */
async function localCopy(uri: string): Promise<string> {
  if (!uri.startsWith('http')) return uri;
  const dir = new Directory(Paths.cache, 'shoneya-bg');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = await File.downloadFileAsync(uri, new File(dir, `src-${Date.now()}.jpg`), { idempotent: true });
  return file.uri;
}

export async function prepare(uri: string, opts: { withMask?: boolean } = {}): Promise<{ image: string; mask: string | null; ai: boolean }> {
  const local = await localCopy(uri);
  const original = await ImageManipulator.manipulate(local).renderAsync();
  let fitted = original;
  if (Math.max(original.width, original.height) > EDIT_SIDE) {
    const ctx = ImageManipulator.manipulate(local);
    ctx.resize(original.width >= original.height ? { width: EDIT_SIDE } : { height: EDIT_SIDE });
    fitted = await ctx.renderAsync();
  }
  const saved = await fitted.saveAsync({ compress: 0.92, format: SaveFormat.JPEG });
  const image = `data:image/jpeg;base64,${await new File(saved.uri).base64()}`;
  const maskUri = opts.withMask === false ? null : await segmentSubject(saved.uri);
  let mask: string | null = null;
  if (maskUri) {
    try { mask = `data:image/png;base64,${await new File(maskUri).base64()}`; } catch { mask = null; }
  }
  return { image, mask, ai: !!mask };
}

/** data:…;base64,xxx → fichier dans le cache. */
export function writeDataUrl(dataUrl: string, mime: 'image/jpeg' | 'image/png'): string {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const dir = new Directory(Paths.cache, 'shoneya-bg');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, `sans-fond-${Date.now()}.${mime === 'image/png' ? 'png' : 'jpg'}`);
  file.create({ overwrite: true });
  file.write(b64, { encoding: 'base64' });
  return file.uri;
}

