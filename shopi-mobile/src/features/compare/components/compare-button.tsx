/**
 * Bouton ⚖️ « Comparer » de la fiche produit — comme sur le site :
 *   · ajoute / retire le produit de la comparaison ;
 *   · comparaison pleine → message ; autre catégorie → proposition de démarrer
 *     une nouvelle comparaison avec ce produit (on ne mélange jamais deux catégories) ;
 *   · dès qu'au moins un produit est comparé, lien « Voir la comparaison (n) ».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import type { ProductDetail } from '@/features/product/api';
import { useTheme } from '@/hooks/use-theme';

import { MAX_COMPARE, metaOf, useCompareCount, useCompareStore, useIsComparing } from '../api';

export function CompareButton({ product }: { product: ProductDetail }) {
  const theme = useTheme();
  const comparing = useIsComparing(product.id);
  const count = useCompareCount();
  const toggle = useCompareStore((s) => s.toggle);
  const replaceWith = useCompareStore((s) => s.replaceWith);

  const onPress = () => {
    const meta = metaOf(product);
    const r = toggle(product.id, meta);
    if (r.mismatch != null) {
      Alert.alert(
        'Autre catégorie',
        `Votre comparaison contient des produits de la catégorie « ${r.mismatch || 'autre'} ». Démarrer une nouvelle comparaison avec ce produit ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Nouvelle comparaison', onPress: () => replaceWith(product.id, meta) },
        ],
      );
    } else if (r.full) {
      Alert.alert('Comparaison pleine', `${MAX_COMPARE} produits au plus : retirez-en un pour en ajouter un autre.`, [
        { text: 'OK' },
        { text: 'Voir la comparaison', onPress: () => router.push('/comparer') },
      ]);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        style={[styles.btn, comparing ? styles.on : { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
        accessibilityRole="button"
        accessibilityState={{ selected: comparing }}
        accessibilityLabel={comparing ? 'Retirer de la comparaison' : 'Ajouter à la comparaison'}>
        <Ionicons name={comparing ? 'checkmark' : 'git-compare-outline'} size={18} color={comparing ? '#fff' : theme.text} />
        <ThemedText style={[styles.text, { color: comparing ? '#fff' : theme.text }]}>{comparing ? 'Dans la comparaison' : 'Comparer'}</ThemedText>
      </Pressable>
      {count > 0 ? (
        <Pressable onPress={() => router.push('/comparer')} style={styles.link} hitSlop={6} accessibilityRole="link">
          <ThemedText style={styles.linkText}>Voir la comparaison ({count})</ThemedText>
          <Ionicons name="arrow-forward" size={15} color={Brand.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, minHeight: 44 },
  on: { backgroundColor: Brand.success, borderColor: Brand.success },
  text: { fontWeight: '800' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  linkText: { fontWeight: '800', textDecorationLine: 'underline' },
});
