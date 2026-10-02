/**
 * Paramètres › Langue — préférence personnelle (jamais en lecture seule).
 * L'application est volontairement en français pour l'instant (comme les
 * paramètres du compte client) : on l'indique clairement plutôt que de
 * proposer des langues qui ne changeraient rien. Le site, lui, propose déjà
 * les langues traduites.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { openSite } from '@/features/catalog/open';

import { FormCard, Hint, SettingsShell } from '../components/ui';

export default function LangueScreen() {
  return (
    <SettingsShell title="Langue" icon="language-outline" subtitle="Langue d’affichage de l’application." alwaysEditable>
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
        <Hint tone="info" text="L’application est en français. D’autres langues arriveront dans une prochaine version ; elles sont déjà disponibles sur le site." />
        <SecondaryButton title="Choisir la langue du site" onPress={() => openSite('/dashboard/entreprise/parametres')} pill />
      </FormCard>
    </SettingsShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lang: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: Brand.primary, backgroundColor: '#EEF3FF', borderRadius: 14, padding: 12 },
  flag: { fontSize: 26, lineHeight: 32 },
  name: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
});
