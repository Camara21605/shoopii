/**
 * Remplaçant WEB de react-native-incall-manager (branché par metro.config.js,
 * pour la plateforme web uniquement). Gestion du haut-parleur / de l'écran
 * pendant un appel : sans objet dans le navigateur — chaque méthode ne fait rien.
 */
const noop = () => undefined;

const InCallManager = new Proxy({} as Record<string, () => undefined>, { get: () => noop });

export default InCallManager;
