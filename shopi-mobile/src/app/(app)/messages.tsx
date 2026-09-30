/**
 * Onglet Messages — la messagerie native est l'étape suivante du plan
 * (liste des conversations, discussion, temps réel…). En attendant, accès
 * à la messagerie du site.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SecondaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function MessagesScreen() {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Messages" />
      <View style={styles.center}>
        <View style={[styles.icon, { backgroundColor: theme.backgroundSelected }]}>
          <Ionicons name="chatbubbles-outline" size={40} color={Brand.primary} />
        </View>
        <ThemedText style={styles.heading}>Votre messagerie arrive ici</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.text}>
          Discutez avec les boutiques, les livreurs et vos contacts directement dans l’application — c’est la prochaine
          étape. En attendant, votre messagerie est disponible sur le site.
        </ThemedText>
        <View style={styles.button}>
          <SecondaryButton
            pill
            title="Ouvrir la messagerie du site"
            onPress={() => void WebBrowser.openBrowserAsync('https://www.shoneya.com/messagerie')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  icon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '800', textAlign: 'center' },
  text: { textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: Spacing.three },
});
