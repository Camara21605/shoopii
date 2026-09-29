/**
 * Cadre commun des écrans d'accès (connexion, inscription, code email) :
 * fond blanc, logo Shoneya, titre + sous-titre, défilement qui suit le
 * clavier, marges de sécurité (encoche, barre de navigation).
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Bas de page (ex. « Pas encore de compte ? Créer un compte »). */
  footer?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText style={styles.logo} accessibilityRole="header">
              Sho<ThemedText style={[styles.logo, { color: Brand.primary }]}>neya</ThemedText>
            </ThemedText>
            <ThemedText style={styles.title}>{title}</ThemedText>
            {subtitle ? <ThemedText themeColor="textSecondary">{subtitle}</ThemedText> : null}
          </View>
          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.five },
  header: { gap: Spacing.two, marginBottom: Spacing.four },
  logo: { fontSize: 32, lineHeight: 38, fontWeight: '800', marginBottom: Spacing.three },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  body: { gap: Spacing.three },
  footer: { marginTop: Spacing.four, alignItems: 'center' },
});
