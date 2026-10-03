/**
 * Feuille qui monte du bas de l'écran (fond assombri, poignée, titre, ✕) —
 * pour les formulaires courts et les listes de choix. `height` fixe la
 * hauteur (fraction de l'écran) pour les listes ; sinon elle s'adapte au contenu.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const SCREEN_H = Dimensions.get('window').height;

export function BottomSheet({
  title,
  onClose,
  children,
  height,
  left,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Fraction de la hauteur d'écran (ex. 0.75) ; absent = selon le contenu. */
  height?: number;
  /** Élément avant le titre (ex. bouton retour). */
  left?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['bottom']} style={[styles.sheet, height ? { height: Math.round(SCREEN_H * height) } : null, { backgroundColor: theme.background }]}>
            <View style={styles.grip} />
            <View style={styles.head}>
              {left}
              <ThemedText style={styles.title} numberOfLines={1} accessibilityRole="header">
                {title}
              </ThemedText>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer" style={[styles.close, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>
            {children}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 8, maxHeight: Math.round(SCREEN_H * 0.92) },
  grip: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#E0E0E0', marginTop: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 12 },
  title: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
