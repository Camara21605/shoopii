/**
 * /messages/infos?id=<conversation> — infos du contact d'une discussion 1:1
 * (toucher sa photo ou son nom en haut de la discussion), comme WhatsApp :
 *
 *   photo · nom · type de compte · état de connexion
 *   [Message] [Audio] [Vidéo] [Profil]   ← « Profil » ouvre le profil PUBLIC :
 *        boutique → /boutique/:id · livreur → /profil-livreur/:id ·
 *        point relais → /point-relais/:id · client → aperçu ici (bio,
 *        membre depuis, commandes — selon SA confidentialité)
 *   Médias, documents et nombre de messages échangés
 *   Couper les notifications · Bloquer · Supprimer la discussion
 *
 * Données : GET /messagerie/conversations/:id/media-summary (contact, médias,
 * blocage) + la conversation déjà en cache (sourdine).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { initials } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { startCall } from '@/features/calls/call-store';
import { thumb } from '@/features/catalog/format';
import {
  deleteConversation, fetchClientPublicProfile, fetchMediaSummary, setContactBlocked, setConversationMuted,
  type ConversationPage,
} from '@/features/messagerie/api';
import MediaViewer from '@/features/messagerie/MediaViewer';
import { PresenceLegend, PresenceLine, usePresence } from '@/features/presence';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type ConvPages = InfiniteData<ConversationPage, string | null>;

const TYPE_LABEL: Record<string, string> = {
  client: 'Client', company: 'Boutique', delivery: 'Livreur', correspondent: 'Point relais', partner: 'Partenaire',
};

function publicRoute(type: string, id: string) {
  switch (type) {
    case 'company': return { pathname: '/boutique/[id]', params: { id } } as const;
    case 'delivery': return { pathname: '/profil-livreur/[id]', params: { id } } as const;
    case 'correspondent': return { pathname: '/point-relais/[id]', params: { id } } as const;
    default: return null;
  }
}

export default function ContactInfoScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ id: string; name?: string; logo?: string; userId?: string }>();
  const convId = params.id;
  const name = params.name || 'Contact';
  const logo = thumb(params.logo, 400);
  const [viewer, setViewer] = useState<{ kind: 'image' | 'video'; url: string } | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [busy, setBusy] = useState<'mute' | 'block' | 'delete' | null>(null);

  const summary = useQuery({ queryKey: ['conversation-info', convId], queryFn: () => fetchMediaSummary(convId), enabled: !!convId });
  /* Conversation (sourdine, et contact si le serveur ne le renvoie pas encore) : état de la conversation déjà chargée dans la liste */
  const conv = qc.getQueriesData<ConvPages>({ queryKey: ['conversations'] })
    .flatMap(([, d]) => d?.pages.flatMap((p) => p.data) ?? [])
    .find((c) => c.id === convId);
  const contact = summary.data?.contact ?? (conv ? { type: conv.contactType, id: conv.contactId, userId: conv.contactUserId ?? null } : undefined);
  const userId = params.userId || contact?.userId || '';
  const presence = usePresence(userId || null, { probe: true });

  const client = useQuery({
    queryKey: ['client-public', contact?.id],
    queryFn: () => fetchClientPublicProfile(contact!.id),
    enabled: contact?.type === 'client',
    retry: false,
  });

  const [muted, setMuted] = useState<boolean>(conv?.muted ?? false);
  const blocked = summary.data?.isBlockedByMe ?? false;

  const route = contact ? publicRoute(contact.type, contact.id) : null;
  const typeLabel = contact ? TYPE_LABEL[contact.type] ?? 'Utilisateur' : null;
  const images = (summary.data?.media ?? []).filter((m) => (m.contentType === 'image' || m.contentType === 'video') && m.mediaUrl);
  const docs = (summary.data?.media ?? []).filter((m) => m.contentType === 'file' || m.contentType === 'audio');

  function call(kind: 'audio' | 'video') {
    if (!userId) { Alert.alert('Indisponible', 'Impossible de joindre ce contact pour le moment.'); return; }
    void startCall(convId, userId, name, logo ?? null, kind);
  }

  function openProfile() {
    if (route) router.push(route);
    else if (contact?.type === 'client') Alert.alert(name, 'Son profil est affiché sur cette page.');
    else Alert.alert('Profil', 'Ce compte n’a pas de profil public.');
  }

  async function toggleMute(next: boolean) {
    setBusy('mute');
    setMuted(next);
    try {
      await setConversationMuted(convId, next);
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      setMuted(!next);
      Alert.alert('Action impossible', toUserMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function toggleBlock() {
    const next = !blocked;
    Alert.alert(
      next ? `Bloquer ${name} ?` : `Débloquer ${name} ?`,
      next ? 'Vous ne pourrez plus vous envoyer de messages, dans un sens comme dans l’autre. La discussion reste visible.' : 'Vous pourrez de nouveau vous écrire.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: next ? 'Bloquer' : 'Débloquer', style: next ? 'destructive' : 'default',
          onPress: () => {
            setBusy('block');
            setContactBlocked(convId, next)
              .then(() => qc.invalidateQueries({ queryKey: ['conversation-info', convId] }))
              .catch((err: unknown) => Alert.alert('Action impossible', toUserMessage(err)))
              .finally(() => setBusy(null));
          },
        },
      ],
    );
  }

  function removeConversation() {
    Alert.alert('Supprimer la discussion ?', 'Elle disparaîtra de votre liste. L’autre personne garde sa copie.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: () => {
          setBusy('delete');
          deleteConversation(convId)
            .then(() => {
              void qc.invalidateQueries({ queryKey: ['conversations'] });
              router.dismissTo('/messages');
            })
            .catch((err: unknown) => { setBusy(null); Alert.alert('Suppression impossible', toUserMessage(err)); });
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Infos du contact" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Identité ── */}
        <View style={styles.hero}>
          <Pressable onPress={() => logo && setViewer({ kind: 'image', url: thumb(params.logo, 1200) ?? logo })} disabled={!logo} accessibilityRole="imagebutton" accessibilityLabel="Voir la photo">
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
              {logo ? <Image source={{ uri: logo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.avatarText}>{initials(name)}</ThemedText>}
            </View>
          </Pressable>
          <ThemedText style={styles.name} numberOfLines={2}>{name}</ThemedText>
          {typeLabel ? (
            <View style={[styles.typePill, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" style={styles.typeText}>{typeLabel}</ThemedText>
            </View>
          ) : null}
          {userId ? (
            <Pressable onPress={() => setLegendOpen(true)} accessibilityRole="button" accessibilityHint="Explique l’état de connexion">
              <PresenceLine status={presence.status} lastSeen={presence.lastSeen} checking={presence.checking} />
            </Pressable>
          ) : null}
        </View>

        {/* ── Actions rapides ── */}
        <View style={styles.actions}>
          <Action icon="chatbubble-ellipses" label="Message" onPress={() => router.back()} />
          <Action icon="call" label="Audio" onPress={() => call('audio')} />
          <Action icon="videocam" label="Vidéo" onPress={() => call('video')} />
          <Action icon="person-circle" label="Profil" onPress={openProfile} disabled={!contact} />
        </View>

        {/* ── Profil public ── */}
        {route ? (
          <Pressable onPress={() => router.push(route)} accessibilityRole="button" style={({ pressed }) => [styles.card, styles.profileCard, { borderColor: theme.border }, pressed && styles.pressed]}>
            <Ionicons name="storefront-outline" size={20} color={Brand.primary} />
            <View style={styles.flex}>
              <ThemedText style={styles.lineTitle}>Voir le profil public</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {contact?.type === 'company' ? 'Boutique, produits, avis et horaires' : contact?.type === 'delivery' ? 'Zones, tarifs et avis du livreur' : 'Adresse, horaires et avis du point relais'}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
        {contact?.type === 'client' ? (
          <View style={[styles.card, { borderColor: theme.border }]}>
            {client.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : client.data ? (
              <>
                {client.data.bio ? <InfoRow icon="information-circle-outline" text={client.data.bio} /> : null}
                {client.data.membreDepuis ? <InfoRow icon="calendar-outline" text={`Membre depuis ${new Date(client.data.membreDepuis).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`} /> : null}
                {client.data.commandesCount != null ? <InfoRow icon="bag-handle-outline" text={`${client.data.commandesCount} commande${client.data.commandesCount > 1 ? 's' : ''} sur Shoneya`} last /> : null}
                {!client.data.bio && !client.data.membreDepuis && client.data.commandesCount == null ? <InfoRow icon="lock-closed-outline" text="Ce client a choisi de garder son profil privé." last /> : null}
              </>
            ) : <InfoRow icon="lock-closed-outline" text="Ce client a choisi de garder son profil privé." last />}
          </View>
        ) : null}

        {/* ── Médias ── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <ThemedText style={styles.sectionTitle}>MÉDIAS ET DOCUMENTS</ThemedText>
            {summary.data ? <ThemedText type="small" themeColor="textSecondary">{summary.data.totalMessages} messages</ThemedText> : null}
          </View>
          {summary.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : images.length === 0 && docs.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>Aucune photo ni aucun document échangé pour l’instant.</ThemedText>
          ) : (
            <>
              {images.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
                  {images.slice(0, 30).map((m) => (
                    <Pressable key={m.id} onPress={() => setViewer({ kind: m.contentType === 'video' ? 'video' : 'image', url: m.mediaUrl! })} accessibilityRole="imagebutton">
                      {m.contentType === 'video' ? (
                        <View style={[styles.thumb, styles.videoThumb]}><Ionicons name="play" size={22} color="#fff" /></View>
                      ) : (
                        <Image source={{ uri: thumb(m.mediaUrl, 240) ?? m.mediaUrl! }} style={styles.thumb} contentFit="cover" />
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              {docs.slice(0, 5).map((d) => (
                <InfoRow key={d.id} icon={d.contentType === 'audio' ? 'mic-outline' : 'document-text-outline'} text={d.contentType === 'audio' ? 'Message vocal' : d.mediaName || 'Document'} />
              ))}
            </>
          )}
        </View>

        {/* ── Réglages de la discussion ── */}
        <View style={[styles.card, { borderColor: theme.border }]}>
          <View style={[styles.line, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
            <Ionicons name="notifications-off-outline" size={20} color={theme.text} />
            <ThemedText style={[styles.lineTitle, styles.flex]}>Couper les notifications</ThemedText>
            {busy === 'mute' ? <ActivityIndicator color={Brand.primary} /> : <Switch value={muted} onValueChange={(v) => void toggleMute(v)} trackColor={{ true: Brand.primary }} />}
          </View>
          <Pressable onPress={toggleBlock} disabled={busy !== null || !summary.data} accessibilityRole="button" style={({ pressed }) => [styles.line, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }, pressed && styles.pressed]}>
            <Ionicons name={blocked ? 'lock-open-outline' : 'ban-outline'} size={20} color={Brand.danger} />
            <ThemedText style={[styles.lineTitle, styles.flex, { color: Brand.danger }]}>{blocked ? `Débloquer ${name}` : `Bloquer ${name}`}</ThemedText>
            {busy === 'block' ? <ActivityIndicator color={Brand.danger} /> : null}
          </Pressable>
          <Pressable onPress={removeConversation} disabled={busy !== null} accessibilityRole="button" style={({ pressed }) => [styles.line, pressed && styles.pressed]}>
            <Ionicons name="trash-outline" size={20} color={Brand.danger} />
            <ThemedText style={[styles.lineTitle, styles.flex, { color: Brand.danger }]}>Supprimer la discussion</ThemedText>
            {busy === 'delete' ? <ActivityIndicator color={Brand.danger} /> : null}
          </Pressable>
        </View>
      </ScrollView>

      <MediaViewer visible={!!viewer} kind={viewer?.kind ?? 'image'} url={viewer?.url ?? ''} onClose={() => setViewer(null)} />
      {legendOpen ? <PresenceLegend current={presence.status} onClose={() => setLegendOpen(false)} /> : null}
    </SafeAreaView>
  );
}

function Action({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [styles.action, { borderColor: theme.border }, (pressed || disabled) && styles.pressed]}>
      <Ionicons name={icon} size={22} color={Brand.primary} />
      <ThemedText type="small" style={styles.actionText}>{label}</ThemedText>
    </Pressable>
  );
}

function InfoRow({ icon, text, last }: { icon: IconName; text: string; last?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.line, styles.infoLine, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      <Ionicons name={icon} size={18} color={theme.textSecondary} />
      <ThemedText type="small" style={styles.flex}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  pressed: { opacity: 0.7 },
  loader: { marginVertical: Spacing.three },
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  hero: { alignItems: 'center', gap: 8, paddingTop: Spacing.two },
  avatar: { width: 112, height: 112, borderRadius: 56, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 40, lineHeight: 48, fontWeight: '800', color: Brand.primary },
  name: { fontSize: 22, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
  typePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  typeText: { fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  actionText: { fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  sectionTitle: { fontSize: 11.5, lineHeight: 16, fontWeight: '800', letterSpacing: 1.3, color: Brand.primary },
  note: { paddingHorizontal: 4 },
  mediaRow: { gap: 8 },
  thumb: { width: 86, height: 86, borderRadius: 12, backgroundColor: '#00000010' },
  videoThumb: { backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  infoLine: { alignItems: 'flex-start' },
  lineTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
});
