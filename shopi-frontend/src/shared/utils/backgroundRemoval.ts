/* ================================================================
 * FICHIER : src/shared/utils/backgroundRemoval.ts
 *
 * Suppression du fond d'une photo — algorithmique pure, sans IA, sans
 * serveur : tout se fait dans le navigateur sur les pixels (ImageData).
 *
 * Principe (« remplissage depuis les bords ») :
 *   1. La couleur du fond est estimée sur le pourtour de l'image
 *      (médiane des pixels du bord — robuste à un objet qui touche le bord).
 *   2. On part de chaque pixel du bord proche de cette couleur et on
 *      s'étend de proche en proche aux voisins de couleur proche. Tout ce
 *      qui est atteint = fond. L'intérieur de l'objet n'est jamais touché,
 *      même s'il contient la couleur du fond, car il n'est pas relié au bord.
 *   3. Tolérance aux dégradés et ombres douces : un voisin un peu plus loin
 *      de la couleur du fond est quand même pris s'il ressemble beaucoup au
 *      pixel d'où l'on vient (le fond varie lentement, un objet change net).
 *   4. Contour adouci (moyenne 3×3 du masque) pour éviter l'effet escalier.
 *
 * Fonctionne bien : fond uni ou presque (drap, mur, carton, table unie).
 * Limites : fond chargé, objet de la même couleur que le fond, cheveux.
 * Le vendeur peut toucher une zone restante pour l'effacer (floodFromPoint).
 * ================================================================ */

export type RGB = [number, number, number];

/** Écart de couleur perçu, ramené à 0 (identique) … 100 (noir ↔ blanc).
 *  Pondération proche de la sensibilité de l'œil (vert > rouge > bleu). */
export function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9) / 2.55;
}

/** Couleur du fond : médiane, canal par canal, des pixels du pourtour. */
export function estimateBackground(data: Uint8ClampedArray, w: number, h: number): RGB {
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const step = Math.max(1, Math.floor((w + h) / 400));
  const push = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
  };
  for (let x = 0; x < w; x += step) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y += step) { push(0, y); push(w - 1, y); }
  const med = (a: number[]) => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
  return [med(rs), med(gs), med(bs)];
}

/** Croissance de région depuis des pixels de départ ; marque 1 dans `mask`
 *  chaque pixel atteint. `ref` = couleur de référence de la zone à effacer. */
function grow(
  data: Uint8ClampedArray, w: number, h: number, mask: Uint8Array,
  seeds: number[], ref: RGB, tol: number,
): void {
  const [R, G, B] = ref;
  const far = tol * 1.8;          // plafond absolu (dégradés, ombres douces)
  const step = tol * 0.35;        // écart toléré avec le pixel voisin
  const stack = new Int32Array(w * h);
  let top = 0;
  for (const p of seeds) {
    if (mask[p]) continue;
    mask[p] = 1; stack[top++] = p;
  }
  while (top > 0) {
    const p = stack[--top];
    const x = p % w, y = (p - x) / w;
    const i = p * 4;
    const pr = data[i], pg = data[i + 1], pb = data[i + 2];
    for (let k = 0; k < 4; k++) {
      const nx = k === 0 ? x - 1 : k === 1 ? x + 1 : x;
      const ny = k === 2 ? y - 1 : k === 3 ? y + 1 : y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (mask[n]) continue;
      const j = n * 4;
      const nr = data[j], ng = data[j + 1], nb = data[j + 2];
      if (data[j + 3] < 16) { mask[n] = 1; stack[top++] = n; continue; }   // déjà transparent
      const dRef = colorDistance(nr, ng, nb, R, G, B);
      if (dRef <= tol || (dRef <= far && colorDistance(nr, ng, nb, pr, pg, pb) <= step)) {
        mask[n] = 1; stack[top++] = n;
      }
    }
  }
}

/** Masque du fond (1 = fond) obtenu depuis tout le pourtour de l'image. */
export function floodFromBorders(data: Uint8ClampedArray, w: number, h: number, bg: RGB, tol: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const seeds: number[] = [];
  const consider = (x: number, y: number) => {
    const p = y * w + x, i = p * 4;
    if (data[i + 3] < 16 || colorDistance(data[i], data[i + 1], data[i + 2], bg[0], bg[1], bg[2]) <= tol) seeds.push(p);
  };
  for (let x = 0; x < w; x++) { consider(x, 0); consider(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { consider(0, y); consider(w - 1, y); }
  grow(data, w, h, mask, seeds, bg, tol);
  return mask;
}

/** Efface aussi la zone touchée par le vendeur (ex. intérieur d'une anse,
 *  fond resté entre deux objets) : croissance depuis le point, avec la
 *  couleur de ce point comme référence. Modifie `mask` sur place. */
export function floodFromPoint(
  data: Uint8ClampedArray, w: number, h: number, mask: Uint8Array, x: number, y: number, tol: number,
): void {
  const cx = Math.min(w - 1, Math.max(0, Math.round(x)));
  const cy = Math.min(h - 1, Math.max(0, Math.round(y)));
  const p = cy * w + cx, i = p * 4;
  grow(data, w, h, mask, [p], [data[i], data[i + 1], data[i + 2]], tol);
}

/** Part de l'image reconnue comme fond (0…1) — sert aux avertissements. */
export function backgroundRatio(mask: Uint8Array): number {
  let n = 0;
  for (let k = 0; k < mask.length; k++) n += mask[k];
  return mask.length ? n / mask.length : 0;
}

/** Image finale : opacité = moyenne 3×3 du « non-fond » (contour adouci),
 *  posée sur blanc (`white`) ou laissée transparente. */
export function composeResult(
  src: ImageData, mask: Uint8Array, background: 'white' | 'transparent',
): ImageData {
  const { width: w, height: h, data } = src;
  const out = new ImageData(w, h);
  const o = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let fg = 0, cnt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w) continue;
          fg += 1 - mask[yy * w + xx]; cnt++;
        }
      }
      const a = (fg / cnt) * (data[(y * w + x) * 4 + 3] / 255);
      const i = (y * w + x) * 4;
      if (background === 'white') {
        o[i]     = Math.round(data[i]     * a + 255 * (1 - a));
        o[i + 1] = Math.round(data[i + 1] * a + 255 * (1 - a));
        o[i + 2] = Math.round(data[i + 2] * a + 255 * (1 - a));
        o[i + 3] = 255;
      } else {
        o[i] = data[i]; o[i + 1] = data[i + 1]; o[i + 2] = data[i + 2];
        o[i + 3] = Math.round(255 * a);
      }
    }
  }
  return out;
}
