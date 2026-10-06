/**
 * Espace livreur › Réseau › Profil d'un correspondant — équivalent mobile de
 * ProfilCorrespondantReseauPage (profil public profil-correspondant du site) :
 *   · en-tête : initiales (point vert si en ligne), nom, type, localisation
 *     (+ distance), en ligne, membre depuis, abonnés, badges (identité vérifiée,
 *     assuré, top, premium) ; « Partager » (lien du profil public) ;
 *   · « Appeler » et « Message » RÉSERVÉS aux abonnés (masqués sinon, comme le
 *     site) — vraie discussion / vrai appel dans l'application ;
 *   · 8 chiffres clés ; onglets Infos (à propos, infos pratiques, horaires),
 *     Services, Zones, Tarifs, Avis, Galerie (sans données publiques côté
 *     serveur pour l'instant : mêmes états vides que le site) ;
 *   · contacts détaillés (copier, appeler, écrire), statistiques, abonnés,
 *     vérifications Shoneya.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Share, StyleSheet, View } from 'react-native';

import { useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useActorContact } from '@/features/company-drivers/components';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { experienceLabel, fetchRelayProfile, formatKm, fr, type RelayProfile } from '../api';
import { ProfileFrame } from '../components/profile-frame';
import { Avatar, Card, Chip, EmptyCard, FollowControl, InfoRow, KpiGrid, Tabs, type IconName } from '../components/ui';
import { useDistances, useFollowActions } from '../hooks';

type Tab = 'info' | 'services' | 'zones' | 'tarifs' | 'avis' | 'galerie';
const SITE = 'https://www.shoneya.com';
const OK = '#047857';

/* Icônes Font Awesome du serveur → Ionicons */
const ICON: Record<string, IconName> = {
  'fa-location-dot': 'location-outline',
  'fa-box': 'cube-outline',
  'fa-phone': 'call-outline',
  'fa-language': 'language-outline',
  'fa-truck': 'business-outline',
  'fa-clock': 'time-outline',
  'fa-envelope': 'mail-outline',
  'fa-whatsapp': 'logo-whatsapp',
};
const BADGE_ICON: Record<string, IconName> = { verif: 'checkmark-circle', assur: 'shield-checkmark-outline', top: 'trophy-outline', premium: 'ribbon-outline' };

export default function RelayProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const snack = useSnack();
  const q = useQuery({ queryKey: qk.livreur.relay(id), queryFn: () => fetchRelayProfile(id), enabled: !!id });
  const actions = useFollowActions('correspondants', snack.show);
  const contact = useActorContact('correspondent');
  const p = q.data;

  const bar = p ? (
    <>
      {p.suivi ? (
        <Pressable onPress={() => void contact.message(p.id)} disabled={!!contact.busy} accessibilityRole="button" accessibilityLabel="Message" style={styles.barMain}>
          {contact.busy === `msg:${p.id}` ? <ActivityIndicator color="#fff" /> : <Ionicons name="chatbubble-ellipses-outline" size={17} color="#fff" />}
          <ThemedText style={styles.barMainText}>Message</ThemedText>
        </Pressable>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          Abonnez-vous à ce correspondant pour lui envoyer un message ou l’appeler.
        </ThemedText>
      )}
      <FollowControl name={p.nom} kindLabel="ce correspondant" suivi={p.suivi} busy={actions.busy === p.id} onToggle={() => actions.toggle(p.id, p.nom)} onHide={() => actions.hide(p.id)} large />
    </>
  ) : null;

  return (
    <ProfileFrame
      title={p?.nom || 'Profil du correspondant'}
      loading={q.isPending}
      error={q.error}
      notFound="Correspondant introuvable."
      onRetry={() => void q.refetch()}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      bar={bar}
      snack={snack.msg}>
      {p ? <Content p={p} contact={contact} notify={snack.show} /> : null}
    </ProfileFrame>
  );
}

function Content({ p, contact, notify }: { p: RelayProfile; contact: ReturnType<typeof useActorContact>; notify: (m: string, e?: boolean) => void }) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('info');
  const dist = useDistances('correspondent', [p.id]).data?.[`correspondent:${p.id}`];

  const share = async () => {
    const url = `${SITE}/correspondants/${p.id}`;
    try {
      await Share.share({ message: `${p.nom} — ${p.typeLabel} sur Shoneya\n${url}`, url });
    } catch {
      await Clipboard.setStringAsync(url);
      notify('🔗 Lien du profil copié');
    }
  };

  const TABS: { id: Tab; label: string; icon: IconName }[] = [
    { id: 'info', label: 'Infos', icon: 'person-outline' },
    { id: 'services', label: 'Services', icon: 'cube-outline' },
    { id: 'zones', label: 'Zones', icon: 'map-outline' },
    { id: 'tarifs', label: 'Tarifs', icon: 'pricetag-outline' },
    { id: 'avis', label: p.nbAvis > 0 ? `Avis (${p.nbAvis})` : 'Avis', icon: 'star-outline' },
    { id: 'galerie', label: 'Galerie', icon: 'images-outline' },
  ];

  /* Statistiques de la colonne latérale du site (mêmes règles : « — » quand inconnu) */
  const stats = [
    { v: p.missions > 0 ? fr(p.missions) : '—', l: 'Missions totales' },
    { v: p.note > 0 ? `${p.note.toFixed(1)}★` : '—', l: 'Note moyenne' },
    { v: p.fiabilite > 0 ? `${p.fiabilite}%` : '—', l: 'Taux fiabilité' },
    { v: p.delaiMoyen !== '—' ? p.delaiMoyen : '—', l: 'Délai remise' },
    { v: p.missionsMois > 0 ? String(p.missionsMois) : '—', l: 'Missions ce mois' },
    { v: '0', l: 'Litiges résolus' },
  ];

  /* Contact : action selon le type de ligne (le site se contentait d'un message) */
  const contactAction = (label: string, value: string) => {
    if (!value || value === '—') return null;
    const isPhone = /téléphone/i.test(label);
    const isMail = /mail/i.test(label);
    return (
      <View style={styles.actions}>
        <IconAction
          icon="copy-outline"
          label={`Copier — ${label}`}
          onPress={() => {
            void Clipboard.setStringAsync(value);
            notify(`📋 ${value}`);
          }}
        />
        {isPhone ? <IconAction icon="call" label="Appeler ce numéro" onPress={() => contact.phoneCall(value)} /> : null}
        {isMail ? <IconAction icon="mail" label="Écrire un e-mail" onPress={() => void Linking.openURL(`mailto:${value}`)} /> : null}
      </View>
    );
  };

  return (
    <>
      {/* ── Identité ── */}
      <View style={styles.hero}>
        <Avatar name={p.nom} text={p.initiales} size={76} online={p.enLigne} />
        <View style={styles.flex}>
          <ThemedText style={styles.name}>{p.nom}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            📌 {p.typeLabel}
          </ThemedText>
          {p.localisation ? (
            <ThemedText type="small" themeColor="textSecondary">
              📍 {p.localisation}
              {dist ? ` · ${dist.approx ? '≈ ' : ''}${formatKm(dist.km)}` : ''}
            </ThemedText>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary">
            {p.enLigne ? '🟢 En ligne maintenant · ' : ''}
            {p.membreDepuis} · {fr(p.abonnes)} abonné{p.abonnes > 1 ? 's' : ''}
          </ThemedText>
        </View>
        <Pressable onPress={() => void share()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Partager le profil" style={[styles.iconBtn, { borderColor: theme.border }]}>
          <Ionicons name="share-social-outline" size={18} color={Brand.primary} />
        </Pressable>
      </View>
      {p.badges.length ? (
        <View style={styles.chips}>
          {p.badges.map((b) => (
            <Chip key={b.label} icon={BADGE_ICON[b.type] ?? 'checkmark-circle'} label={b.label} />
          ))}
        </View>
      ) : null}
      {p.suivi ? (
        <Pressable onPress={() => void contact.call(p.id, p.nom)} disabled={!!contact.busy} accessibilityRole="button" accessibilityLabel="Appeler dans l’application" style={[styles.call, { borderColor: theme.border }]}>
          {contact.busy === `call:${p.id}` ? <ActivityIndicator color={Brand.primary} /> : <Ionicons name="call-outline" size={17} color={Brand.primary} />}
          <ThemedText style={styles.callText}>Appeler dans l’application</ThemedText>
        </Pressable>
      ) : null}

      <KpiGrid
        items={[
          { v: fr(p.missions), l: 'Missions', badge: `+${p.missionsMois}` },
          { v: `${p.note.toFixed(1)} ★`, l: 'Note', badge: 'Top 5%' },
          { v: `${p.fiabilite}%`, l: 'Fiabilité' },
          { v: fr(p.abonnes), l: 'Abonnés' },
          { v: String(p.nbAvis), l: 'Avis clients' },
          { v: experienceLabel(p.experience), l: 'Expérience' },
          { v: String(p.zonesCount), l: 'Zones couvertes' },
          { v: p.delaiMoyen, l: 'Délai moyen' },
        ]}
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'info' ? (
        <>
          <Card icon="information-circle-outline" title="À propos">
            {p.bio.map((para, i) => (
              <ThemedText key={i}>{para}</ThemedText>
            ))}
            {p.aboutTags.length ? (
              <View style={styles.chips}>
                {p.aboutTags.map((t) => (
                  <Chip key={t} icon="checkmark" label={t} />
                ))}
              </View>
            ) : null}
          </Card>
          {p.infosPratiques.length ? (
            <Card icon="clipboard-outline" title="Informations pratiques">
              {p.infosPratiques.map((info, i) => (
                <InfoRow
                  key={info.label}
                  icon={ICON[info.icone] ?? 'information-circle-outline'}
                  label={info.label}
                  value={info.valeur}
                  sub={info.sub || undefined}
                  last={i === p.infosPratiques.length - 1}
                />
              ))}
            </Card>
          ) : null}
          {p.horaires.length ? (
            <Card icon="calendar-outline" title="Disponibilité hebdomadaire">
              {p.horaires.map((h) => (
                <View key={h.jour} style={[styles.day, h.aujourdhui && { backgroundColor: theme.background }]}>
                  <ThemedText style={[styles.dayName, h.aujourdhui && styles.bold]}>
                    {h.jour}
                    {h.aujourdhui ? (
                      <ThemedText type="small" style={{ color: OK }}>
                        {' '}
                        (auj.)
                      </ThemedText>
                    ) : null}
                  </ThemedText>
                  <ThemedText style={styles.flex}>{h.heures}</ThemedText>
                  <ThemedText type="smallBold" style={{ color: h.statut === 'open' ? OK : h.statut === 'partial' ? '#B45309' : Brand.danger }}>
                    {h.statutLabel}
                  </ThemedText>
                </View>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}
      {tab === 'services' ? <EmptyCard icon="cube-outline" title="Services en cours de renseignement" text="Le correspondant n’a pas encore renseigné ses services." /> : null}
      {tab === 'zones' ? (
        <>
          <EmptyCard icon="pin-outline" title="Zones non renseignées" text="Le correspondant n’a pas encore défini ses zones de couverture." />
          <EmptyCard icon="earth-outline" title="Réseau international non renseigné" text="Les pays partenaires seront affichés ici dès que renseignés." />
        </>
      ) : null}
      {tab === 'tarifs' ? (
        <EmptyCard icon="receipt-outline" title="Tarifs non renseignés" text="Le correspondant n’a pas encore publié sa grille tarifaire. Contactez-le directement pour obtenir un devis." />
      ) : null}
      {tab === 'avis' ? <EmptyCard icon="star-outline" title="Aucun avis pour le moment" text="Les avis clients apparaîtront ici après chaque mission complétée." /> : null}
      {tab === 'galerie' ? <EmptyCard icon="images-outline" title="Galerie non disponible" text="Le correspondant n’a pas encore publié de photos de son dépôt." /> : null}

      {/* ── Colonne latérale du site ── */}
      {p.contacts.length ? (
        <Card icon="book-outline" title="Contacts détaillés">
          {p.contacts.map((c, i) => (
            <InfoRow key={c.label} icon={ICON[c.icone] ?? 'call-outline'} label={c.label} value={c.valeur} last={i === p.contacts.length - 1} action={contactAction(c.label, c.valeur)} />
          ))}
        </Card>
      ) : null}
      <Card icon="stats-chart-outline" title="Statistiques">
        <KpiGrid items={stats} />
      </Card>
      <Card icon="people-outline" title="Abonnés">
        <ThemedText style={styles.bold}>{p.abonnes > 0 ? `${fr(p.abonnes)} abonné${p.abonnes > 1 ? 's' : ''}` : 'Aucun abonné pour le moment'}</ThemedText>
      </Card>
      {p.badges.length ? (
        <Card icon="shield-checkmark-outline" title="Vérifications Shoneya">
          {p.badges.map((b) => (
            <View key={b.label} style={styles.verif}>
              <Ionicons name="checkmark-circle" size={18} color={OK} />
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>{b.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  ✓ Vérifié par Shoneya
                </ThemedText>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );
}

function IconAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label} style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <Ionicons name={icon} size={16} color={Brand.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { fontSize: 21, lineHeight: 27, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  call: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 999, minHeight: 44 },
  callText: { fontSize: 14, lineHeight: 19, fontWeight: '800', color: Brand.primary },
  day: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 7 },
  dayName: { width: 118 },
  verif: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  actions: { flexDirection: 'row', gap: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  barMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, minHeight: 46, paddingHorizontal: 18, backgroundColor: Brand.primary },
  barMainText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
});
