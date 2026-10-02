/**
 * Recherche plein écran de l'espace entreprise (🔍 de la barre du haut) —
 * comme la recherche mobile du site : produits, commandes, clients, livreurs
 * et correspondants dès le premier caractère (délai de 300 ms entre deux
 * frappes), 4 résultats par famille. Un résultat ouvre la page de gestion
 * correspondante.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { openSite } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { searchCompany } from '../search';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const gnf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} GNF`;
const dash = (path: string) => openSite(`/dashboard/entreprise/${path}`);

const SHORTCUTS: { label: string; icon: IconName; path: string }[] = [
  { label: 'Commandes', icon: 'cube-outline', path: 'commandes' },
  { label: 'Produits', icon: 'pricetag-outline', path: 'produits' },
  { label: 'Clients', icon: 'people-outline', path: 'clients' },
  { label: 'Livreurs', icon: 'bicycle-outline', path: 'livreurs' },
  { label: 'Correspondants', icon: 'location-outline', path: 'correspondants' },
];

export default function CompanySearchScreen() {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const q = useQuery({
    queryKey: qk.company.search(term),
    queryFn: ({ signal }) => searchCompany(term, signal),
    enabled: term.length >= 1,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const r = q.data;
  const total = r ? r.produits.length + r.commandes.length + r.clients.length + r.livreurs.length + r.correspondants.length : 0;
  const typing = text.trim() !== term || q.isFetching;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <View style={[styles.head, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retour" style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <View style={[styles.input, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder="Rechercher commandes, produits, clients…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.field, { color: theme.text }]}
            returnKeyType="search"
            accessibilityLabel="Rechercher dans l’espace entreprise"
          />
          {text ? (
            <Pressable onPress={() => setText('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Effacer">
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!text.trim() ? (
          <>
            <ThemedText style={styles.secTitle}>ACCÈS RAPIDE</ThemedText>
            <View style={styles.chips}>
              {SHORTCUTS.map((s) => (
                <Pressable key={s.path} onPress={() => dash(s.path)} accessibilityRole="button" style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name={s.icon} size={16} color={Brand.primary} />
                  <ThemedText style={styles.chipText}>{s.label}</ThemedText>
                </Pressable>
              ))}
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Tapez un nom de produit, un numéro de commande, un client, un livreur ou un correspondant.
            </ThemedText>
          </>
        ) : typing && !r ? (
          <ActivityIndicator color={Brand.primary} style={styles.loader} />
        ) : r?.failed ? (
          <State icon="cloud-offline-outline" text="Connexion au serveur impossible — réessayez" />
        ) : total === 0 && !typing ? (
          <State icon="search-outline" text={`Aucun résultat pour « ${term} »`} />
        ) : r ? (
          <>
            {typing ? <ActivityIndicator color={Brand.primary} size="small" /> : null}
            <Section title="Produits" show={r.produits.length > 0}>
              {r.produits.map((p) => (
                <Result key={p.id} image={thumb(p.images?.[0]?.url, 120)} icon="cube-outline" label={p.nom} meta={gnf(p.prix)} onPress={() => dash(`ajouter/${p.id}`)} />
              ))}
            </Section>
            <Section title="Commandes" show={r.commandes.length > 0}>
              {r.commandes.map((c) => (
                <Result key={c.uuid} icon="receipt-outline" label={`#${c.id} · ${c.client}`} meta={gnf(c.price)} onPress={() => dash('commandes')} />
              ))}
            </Section>
            <Section title="Clients" show={r.clients.length > 0}>
              {r.clients.map((c) => (
                <Result key={c.id} image={thumb(c.profilePicture, 120)} icon="person-outline" label={c.fullName} meta={c.email ?? ''} onPress={() => dash('clients')} />
              ))}
            </Section>
            <Section title="Livreurs" show={r.livreurs.length > 0}>
              {r.livreurs.map((l) => (
                <Result key={l.id} emoji={l.avatarEmoji || '🏍️'} label={l.fullName} meta={l.zone ?? ''} onPress={() => dash('livreurs')} />
              ))}
            </Section>
            <Section title="Correspondants" show={r.correspondants.length > 0}>
              {r.correspondants.map((c) => (
                <Result key={c.id} emoji={c.avatarEmoji || '📍'} label={c.fullName} meta={c.ville ?? ''} onPress={() => dash('correspondants')} />
              ))}
            </Section>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, show, children }: { title: string; show: boolean; children: React.ReactNode }) {
  const theme = useTheme();
  if (!show) return null;
  return (
    <View style={styles.section}>
      <ThemedText style={styles.secTitle}>{title.toUpperCase()}</ThemedText>
      <View style={[styles.card, { borderColor: theme.border }]}>{children}</View>
    </View>
  );
}

function Result({ image, icon, emoji, label, meta, onPress }: { image?: string | null; icon?: IconName; emoji?: string; label: string; meta: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.result, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.thumb, { backgroundColor: theme.backgroundSelected }]}>
        {image ? <Image source={{ uri: image }} style={styles.img} contentFit="cover" /> : emoji ? <ThemedText style={styles.emoji}>{emoji}</ThemedText> : <Ionicons name={icon ?? 'ellipse-outline'} size={18} color={Brand.primary} />}
      </View>
      <ThemedText style={styles.label} numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.meta}>
        {meta}
      </ThemedText>
    </Pressable>
  );
}

function State({ icon, text }: { icon: IconName; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.state}>
      <Ionicons name={icon} size={34} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { padding: 4 },
  input: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: 44 },
  field: { flex: 1, fontSize: 15, paddingVertical: 8 },
  body: { padding: 16, gap: 16, paddingBottom: 40 },
  loader: { marginTop: 32 },
  secTitle: { fontSize: 11.5, lineHeight: 15, fontWeight: '800', letterSpacing: 1.3, color: '#5A6B85' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { fontSize: 13.5, lineHeight: 18, fontWeight: '700' },
  hint: { marginTop: 4 },
  section: { gap: 8 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, minHeight: 58 },
  thumb: { width: 38, height: 38, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
  emoji: { fontSize: 20, lineHeight: 26 },
  label: { flex: 1, fontSize: 14.5, lineHeight: 19, fontWeight: '700' },
  meta: { maxWidth: '38%' },
  state: { alignItems: 'center', gap: 10, marginTop: 48, paddingHorizontal: 24 },
});
