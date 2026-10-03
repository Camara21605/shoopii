/**
 * Demande de confirmation : boîte de dialogue native (Alert) sur téléphone,
 * window.confirm dans l'aperçu web (Alert y est sans effet).
 */
import { Alert, Platform } from 'react-native';

export function confirmAction(title: string, message: string, ok: string, destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') {
    const c = (globalThis as { confirm?: (m: string) => boolean }).confirm;
    return Promise.resolve(c ? c(`${title}\n\n${message}`) : true);
  }
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}
