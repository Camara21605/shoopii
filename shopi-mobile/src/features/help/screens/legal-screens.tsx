/**
 * Guides du Centre d'aide (mêmes textes que le site) :
 *   · Politique de retour       (/politique-retour sur le site)
 *   · Politique de remboursement (/remboursements sur le site)
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { Markdown } from '../components/markdown';

type Page = { title: string; icon: React.ComponentProps<typeof Ionicons>['name']; updated: string; body: string; other: { label: string; href: Href } };

const RETOUR: Page = {
  title: 'Politique de retour',
  icon: 'shield-half-outline',
  updated: 'Dernière mise à jour : juillet 2025',
  other: { label: 'Politique de remboursement', href: '/aide/remboursements' },
  body: `## 1. Délai de retour
Vous pouvez retourner un article dans un délai de **7 jours** après la livraison. Au-delà de ce délai, les retours ne seront plus acceptés sauf dans les cas prévus par la garantie légale de conformité.

## 2. État des articles retournés
Tout article retourné doit être :
- Non utilisé et en parfait état
- Dans son emballage d'origine intacte
- Accompagné de tous ses accessoires, notices et cadeaux éventuels

Tout article incomplet, abîmé, endommagé ou sali ne sera ni repris ni remboursé.

## 3. Processus de retour
Pour effectuer un retour, suivez ces étapes :
1. **Initiez le retour** depuis votre espace client dans les 7 jours
2. **Attendez la validation** du vendeur (sous 48h ouvrables)
3. **Emballez soigneusement** l'article et joignez la facture
4. **Expédiez** l'article avec le bordereau fourni
5. **Suivez** votre retour depuis l'application

## 4. Garantie légale de conformité
Conformément à la réglementation en vigueur, vous bénéficiez d'une **garantie légale de conformité de 2 ans** à compter de la délivrance du bien. En cas de défaut de conformité, vous pouvez exiger la réparation ou le remplacement du bien.

## 5. Litiges et SAV
En cas de litige avec un vendeur, notre équipe SAV intervient comme médiateur. Contactez-nous via votre espace client ou à travers notre formulaire de contact. Nous traitons toutes les réclamations sous **72 heures ouvrables**.`,
};

const REMBOURSEMENT: Page = {
  title: 'Politique de remboursement',
  icon: 'refresh-outline',
  updated: 'Dernière mise à jour : juillet 2025',
  other: { label: 'Politique de retour', href: '/aide/politique-retour' },
  body: `## 1. Droit de rétractation
Vous disposez d'un délai de **7 jours calendaires** à compter de la réception de votre commande pour exercer votre droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.

## 2. Conditions de remboursement
Pour bénéficier d'un remboursement, les articles doivent être :
- Dans leur état d'origine (non utilisés, non endommagés)
- Dans leur emballage d'origine avec tous les accessoires
- Accompagnés de la facture d'achat

## 3. Articles non remboursables
Certains articles ne peuvent pas être remboursés :
- Articles périssables (produits alimentaires, fleurs…)
- Articles personnalisés ou sur mesure
- Logiciels descellés
- Articles d'hygiène une fois descellés

## 4. Délai de remboursement
Une fois votre retour reçu et inspecté, nous vous notifierons par email. Si votre retour est approuvé, le remboursement sera effectué dans un délai de **5 à 10 jours ouvrables** via le moyen de paiement initial.

## 5. Comment initier un retour
Pour initier un retour :
1. Connectez-vous à votre espace client Shoneya
2. Accédez à « Mes commandes » et sélectionnez la commande concernée
3. Cliquez sur « Demander un retour » et suivez les instructions
4. Vous recevrez une étiquette de retour par email

## 6. Frais de retour
Les frais de retour sont à la charge du vendeur en cas de produit défectueux ou non conforme. Dans les autres cas, les frais de retour sont à la charge de l'acheteur.`,
};

function LegalScreen({ page }: { page: Page }) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title={page.title} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <View style={styles.ico}>
            <Ionicons name={page.icon} size={24} color="#1F1F1F" />
          </View>
          <View style={styles.flex}>
            <ThemedText style={styles.title}>{page.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {page.updated}
            </ThemedText>
          </View>
        </View>
        <Markdown content={page.body} />
        <View style={styles.foot}>
          <Pressable onPress={() => router.replace(page.other.href)} accessibilityRole="button" style={[styles.btn, { borderColor: theme.border }]}>
            <ThemedText style={styles.btnText}>{page.other.label}</ThemedText>
          </Pressable>
          <Pressable onPress={() => router.push('/aide/contact')} accessibilityRole="button" style={[styles.btn, styles.btnDark]}>
            <Ionicons name="headset-outline" size={17} color="#fff" />
            <ThemedText style={[styles.btnText, { color: '#fff' }]}>Contacter le support</ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function ReturnPolicyScreen() {
  return <LegalScreen page={RETOUR} />;
}
export function RefundPolicyScreen() {
  return <LegalScreen page={REMBOURSEMENT} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 18, gap: 16, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ico: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, lineHeight: 27, fontWeight: '900' },
  foot: { gap: 10, marginTop: 10 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 999, minHeight: 48 },
  btnDark: { backgroundColor: '#1F1F1F', borderColor: '#1F1F1F' },
  btnText: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
});
