/**
 * Configuration Metro = celle d'Expo + des remplaçants WEB pour les
 * bibliothèques natives uniquement.
 *
 * Pourquoi : le rendu web (aperçu `npm run preview`) charge toutes les routes ;
 * react-native-webrtc et react-native-incall-manager (appels) n'existent pas
 * dans un navigateur et faisaient planter TOUT l'aperçu
 * (« requireNativeComponent is not a function »). Pour la plateforme web
 * seulement, on les remplace par des modules inactifs (src/lib/web-shims/) ;
 * Android et iOS utilisent toujours les vraies bibliothèques.
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const WEB_SHIMS = {
  'react-native-webrtc': path.resolve(__dirname, 'src/lib/web-shims/webrtc.ts'),
  'react-native-incall-manager': path.resolve(__dirname, 'src/lib/web-shims/incall-manager.ts'),
};

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_SHIMS[moduleName]) {
    return { type: 'sourceFile', filePath: WEB_SHIMS[moduleName] };
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
