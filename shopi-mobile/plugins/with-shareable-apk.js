/**
 * Application partageable par Xender, Bluetooth, Nearby Share, WhatsApp…
 *
 * PROBLÈME : publiée en « app bundle », l'application est installée par le
 * Play Store en PLUSIEURS morceaux (APK séparés par processeur, écran et
 * langue). Les applis de partage ne copient que le morceau principal
 * (base.apk) : sur l'autre téléphone, « Application non installée ».
 *
 * CORRECTION :
 *   1. Le bundle demande au Play Store d'installer UN SEUL APK complet
 *      (bundle.abi/density/language.enableSplit = false) : l'appli installée
 *      devient copiable telle quelle.
 *   2. Seules les architectures des vrais téléphones sont compilées
 *      (armeabi-v7a pour les anciens / petits budgets, arm64-v8a pour les
 *      récents) : pas d'x86 (émulateurs), l'APK reste léger.
 */
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const MARKER = '// shoneya: apk unique partageable';

function withSingleApkBundle(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    cfg.modResults.contents += `
${MARKER}
android {
    bundle {
        abi { enableSplit = false }
        density { enableSplit = false }
        language { enableSplit = false }
    }
}
`;
    return cfg;
  });
}

function withPhoneArchitectures(config) {
  return withGradleProperties(config, (cfg) => {
    const key = 'reactNativeArchitectures';
    cfg.modResults = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === key));
    cfg.modResults.push({ type: 'property', key, value: 'armeabi-v7a,arm64-v8a' });
    return cfg;
  });
}

module.exports = function withShareableApk(config) {
  return withPhoneArchitectures(withSingleApkBundle(config));
};
