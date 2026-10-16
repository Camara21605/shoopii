/**
 * Libellés de l'écran Android de recadrage d'image (expo-image-picker, `allowsEditing`) —
 * bibliothèque com.vanniktech:android-image-cropper.
 *
 * BUG CORRIGÉ — le bouton qui VALIDE le recadrage s'affichait « REDIMENSIONNER » (traduction
 * française de « Crop » fournie par la bibliothèque). Les utilisateurs ne le reconnaissaient
 * pas comme le bouton final et restaient bloqués sur cet écran (« il n'y a pas de bouton pour
 * ajouter la photo »). Les ressources de l'application l'emportent sur celles d'une
 * bibliothèque à la fusion Android : on redéfinit les textes, en français et par défaut.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const LABELS = {
  crop_image_menu_crop: 'Valider',
  ic_rotate_right_24: 'Pivoter',
  ic_rotate_left_24: 'Pivoter à gauche',
  ic_flip_24: 'Retourner',
  ic_flip_24_horizontally: 'Retourner horizontalement',
  ic_flip_24_vertically: 'Retourner verticalement',
};

const xml = () =>
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${Object.entries(LABELS)
    .map(([k, v]) => `    <string name="${k}">${v}</string>`)
    .join('\n')}\n</resources>\n`;

module.exports = function withCropLabels(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const res = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      for (const dir of ['values', 'values-fr']) {
        fs.mkdirSync(path.join(res, dir), { recursive: true });
        fs.writeFileSync(path.join(res, dir, 'crop_labels.xml'), xml());
      }
      return cfg;
    },
  ]);
};
