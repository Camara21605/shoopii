/**
 * Paramètres › Langue (correspondant) — préférence de l'appareil (le serveur
 * n'en lit aucune, comme sur le site). L'application est volontairement en français pour
 * l'instant (comme les paramètres client et entreprise) : on l'indique
 * clairement plutôt que de proposer des langues qui ne changeraient rien.
 * Le site propose déjà d'autres langues.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { openSite } from '@/features/catalog/open';

import { FormCard, Hint, SettingsShell } from '@/features/settings-kit';

import type { CorrespondantSettings } from '../api';
import { useCorrespondantSettings } from '../hooks';

export default function LangueScreen() {
  const q = useCorrespondantSettings();
  return (
    <SettingsShell<CorrespondantSettings> query={q} title="Langue" icon="language-outline" subtitle="Langue d’affichage de l’application.">
      {() => (
        <FormCard title="Langue de l’application" icon="globe-outline">
          <View style={styles.lang}>
            <ThemedText style={styles.flag}>🇫🇷</ThemedText>
            <View style={styles.flex}>
              <ThemedText style={styles.name}>Français</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Langue actuelle
              </ThemedText>
            </View>
            <Ionicons name="checkmark-circle" size={22} color={Brand.primary} />
          </View>
          <Hint text="L’application est en français. D’autres langues arriveront dans une prochaine version ; elles sont déjà disponibles sur le site (English, العربية, Português, 中文)." />
          <SecondaryButton title="Choisir la langue du site" onPress={() => openSite('/dashboard/correspondant/parametres?section=langue')} pill />
        </FormCard>
      )}
    </SettingsShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lang: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: Brand.primary,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 14,
    padding: 12,
  },
  flag: { fontSize: 26, lineHeight: 32 },
  name: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
});
