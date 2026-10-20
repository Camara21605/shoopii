/**
 * Paramètres › Mes données — comme la rubrique du site (DonneesSection) :
 *   - télécharger TOUTES mes données, mon historique de commandes ou mes
 *     factures (GET /client/parametres/donnees/export?type=…) : le fichier
 *     JSON est enregistré sur le téléphone puis proposé au partage (Drive,
 *     Fichiers, WhatsApp, e-mail…) ;
 *   - rapport de confidentialité : données collectées, avec qui elles sont
 *     partagées, durée de conservation, droits (…/donnees/rapport) ;
 *   - accès à la suppression du compte.
 * Jamais inclus dans l'export : mot de passe, secrets 2FA, jetons.
 * Le serveur limite à 5 exports par heure.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { exportDonnees, fetchRapportDonnees, type ExportScope } from '@/features/settings/api';
import { Card, Row, Section, useToast, type IconName } from '@/features/settings/ui';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

const EXPORTS: { scope: ExportScope; icon: IconName; title: string; desc: string }[] = [
  { scope: 'all', icon: 'cloud-download-outline', title: 'Toutes mes données', desc: 'Compte, profil, adresses, portefeuille, liste de souhaits et commandes' },
  { scope: 'commandes', icon: 'receipt-outline', title: 'Historique de mes commandes', desc: 'Articles, livraison et paiement de chaque commande' },
  { scope: 'factures', icon: 'document-text-outline', title: 'Mes factures', desc: 'Montants, frais de livraison et références de paiement' },
];

const RAPPORT_SECTIONS = [
  { key: 'donneesCollectees', title: 'Données collectées', icon: 'folder-open-outline' },
  { key: 'partageeAvec', title: 'Partagées avec', icon: 'people-outline' },
  { key: 'droits', title: 'Vos droits', icon: 'shield-checkmark-outline' },
] as const;

export default function DonneesScreen() {
  const theme = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState<ExportScope | null>(null);
  const [showRapport, setShowRapport] = useState(false);
  const rapport = useQuery({ queryKey: qk.accountSettings.rapportDonnees, queryFn: fetchRapportDonnees, enabled: showRapport, staleTime: 10 * 60_000 });

  async function download(scope: ExportScope) {
    if (busy) return;
    setBusy(scope);
    try {
      const data = await exportDonnees(scope);
      const name = `shoneya-${scope === 'all' ? 'mes-donnees' : scope}-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File(Paths.cache, name);
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(data, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Enregistrer ou envoyer mes données', UTI: 'public.json' });
      } else {
        toast.show('Fichier prêt, mais le partage n’est pas disponible sur ce téléphone.');
        return;
      }
      toast.show('Vos données sont prêtes');
    } catch (err) {
      toast.show(toUserMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Mes données" />
      <ScrollView contentContainerStyle={styles.content}>
        <Section
          title="Télécharger mes données"
          note="Fichier au format JSON, lisible par d’autres services. Vous choisissez ensuite où l’enregistrer ou l’envoyer (Drive, Fichiers, WhatsApp, e-mail…). Jamais inclus : mot de passe, codes de sécurité.">
          <Card>
            {EXPORTS.map((e) => (
              <Row
                key={e.scope}
                icon={e.icon}
                label={e.title}
                desc={e.desc}
                onPress={() => void download(e.scope)}
                right={busy === e.scope ? <ActivityIndicator color={Brand.primary} /> : <Ionicons name="download-outline" size={20} color={Brand.primary} />}
              />
            ))}
          </Card>
        </Section>

        <Section title="Confidentialité">
          <Card>
            <Row
              icon="eye-outline"
              label="Rapport de confidentialité"
              desc="Ce que Shoneya collecte, avec qui c’est partagé et combien de temps"
              onPress={() => setShowRapport((v) => !v)}
              right={<Ionicons name={showRapport ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />}
            />
            {showRapport ? (
              <View style={styles.rapport}>
                {rapport.isPending ? (
                  <ActivityIndicator color={Brand.primary} style={styles.loader} />
                ) : rapport.error ? (
                  <Pressable onPress={() => void rapport.refetch()} accessibilityRole="button">
                    <ThemedText type="small" style={styles.error}>{toUserMessage(rapport.error)} — toucher pour réessayer</ThemedText>
                  </Pressable>
                ) : rapport.data ? (
                  <>
                    {RAPPORT_SECTIONS.map((sct) => (
                      <View key={sct.key} style={styles.block}>
                        <View style={styles.blockHead}>
                          <Ionicons name={sct.icon} size={16} color={Brand.primary} />
                          <ThemedText type="smallBold">{sct.title}</ThemedText>
                        </View>
                        {rapport.data[sct.key].map((line) => (
                          <ThemedText key={line} type="small" themeColor="textSecondary" style={styles.bullet}>• {line}</ThemedText>
                        ))}
                      </View>
                    ))}
                    {rapport.data.conservationDuree ? (
                      <View style={styles.block}>
                        <View style={styles.blockHead}>
                          <Ionicons name="time-outline" size={16} color={Brand.primary} />
                          <ThemedText type="smallBold">Durée de conservation</ThemedText>
                        </View>
                        <ThemedText type="small" themeColor="textSecondary">{rapport.data.conservationDuree}</ThemedText>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </View>
            ) : null}
            <Row icon="document-text-outline" label="Politique de confidentialité" onPress={() => void WebBrowser.openBrowserAsync('https://www.shoneya.com/confidentialite')} external />
          </Card>
        </Section>

        <View style={[styles.info, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="information-circle-outline" size={18} color={Brand.primary} />
          <ThemedText type="small" style={styles.flex}>
            Vous pouvez à tout moment corriger vos informations (Paramètres › Profil) ou demander la suppression de votre compte. Pour toute question sur vos données : {rapport.data?.contact || 'camara21605@gmail.com'}.
          </ThemedText>
        </View>

        <Card danger>
          <Row icon="trash-outline" label="Supprimer mon compte et mes données" danger onPress={() => router.push('/parametres/compte')} />
        </Card>
      </ScrollView>
      {toast.element}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  loader: { marginVertical: Spacing.three },
  rapport: { paddingHorizontal: 14, paddingBottom: 14, gap: 12 },
  block: { gap: 4 },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  bullet: { paddingLeft: 4 },
  error: { color: Brand.danger },
  info: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 14 },
});
