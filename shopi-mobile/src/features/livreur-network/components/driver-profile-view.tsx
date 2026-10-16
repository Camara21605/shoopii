/**
 * Contenu du profil public d'un livreur (ProfilLivreurReseauPage / profil-livreur du site),
 * partagé par le profil d'un livreur du réseau, « Mon profil » et le profil vu par un client
 * (features/driver-public) : identité, pastilles, chiffres clés RÉELS (ponctualité seulement si
 * mesurée), onglets (Infos, Véhicule, Zones, Localisation en temps réel — réseau livreur
 * uniquement, comme le site —, Tarifs, Avis, Historique) et contact. Le téléphone n'est envoyé
 * par le serveur qu'aux abonnés du livreur et au livreur lui-même.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useActorContact } from '@/features/company-drivers/components';
import { useTheme } from '@/hooks/use-theme';

import { experienceLabel, formatKm, fr, gnf, vehicleLabel, type DriverProfile } from '../api';
import { InfoTab, LocationTab, VehiculeTab } from './driver-profile-tabs';
import { useDistances } from '../hooks';
import { Avatar, Card, Chip, EmptyCard, InfoRow, KpiGrid, Tabs, type IconName } from './ui';

type Tab = 'info' | 'vehicule' | 'zones' | 'localisation' | 'tarifs' | 'avis' | 'historique';

export function DriverProfileView({
  p,
  self,
  onCall,
  calling = false,
  showLocation = true,
  contact,
  notify,
}: {
  p: DriverProfile;
  self: boolean;
  /** Bouton « Appeler » sous l'identité ; absent quand l'écran le met déjà dans sa barre d'actions */
  onCall?: () => void;
  calling?: boolean;
  /** Onglet Localisation (position en direct) — réseau livreur ; pas sur le profil vu par un client */
  showLocation?: boolean;
  contact: ReturnType<typeof useActorContact>;
  notify: (m: string, e?: boolean) => void;
}) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('info');
  const dist = useDistances('delivery', self ? [] : [p.id]).data?.[`delivery:${p.id}`];
  const rating = p.averageRating != null ? `${p.averageRating.toFixed(1)}★` : '—';

  const TABS: { id: Tab; label: string; icon: IconName }[] = [
    { id: 'info', label: 'Infos', icon: 'person-outline' },
    { id: 'vehicule', label: 'Véhicule', icon: 'bicycle-outline' },
    { id: 'zones', label: 'Zones', icon: 'map-outline' },
    ...(showLocation ? [{ id: 'localisation' as const, label: 'Localisation', icon: 'location-outline' as IconName }] : []),
    { id: 'tarifs', label: 'Tarifs', icon: 'pricetag-outline' },
    { id: 'avis', label: (p.reviewsCount ?? 0) > 0 ? `Avis (${p.reviewsCount})` : 'Avis', icon: 'star-outline' },
    { id: 'historique', label: 'Historique', icon: 'time-outline' },
  ];

  return (
    <>
      {/* ── Identité ── */}
      <View style={styles.hero}>
        <Avatar name={p.fullName} photo={p.profilePicture} size={76} online={p.disponible} />
        <View style={styles.flex}>
          <ThemedText style={styles.name}>{p.fullName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Livreur · {vehicleLabel(p.vehicule, p.vehiculeType)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            📍 {p.zone || '—'}
            {dist ? ` · ${dist.approx ? '≈ ' : ''}${formatKm(dist.km)}` : ''}
          </ThemedText>
          <View style={styles.metaRow}>
            <View style={[styles.dot, { backgroundColor: p.disponible ? '#10B981' : '#9CA3AF' }]} />
            <ThemedText type="small" themeColor="textSecondary">
              {p.disponible ? 'Disponible maintenant' : 'Hors ligne'}
            </ThemedText>
          </View>
        </View>
      </View>
      <View style={styles.chips}>
        <Chip icon="checkmark-circle" label="Identité vérifiée" />
        {p.assurance ? <Chip icon="shield-checkmark-outline" label="Assuré Shoneya" /> : null}
        {p.averageRating != null ? <Chip icon="star" label={`${p.averageRating.toFixed(1)}★ · ${p.reviewsCount ?? 0} avis`} /> : null}
      </View>
      {onCall && p.isSuivi && !self ? (
        <Pressable onPress={onCall} disabled={calling} accessibilityRole="button" accessibilityLabel="Appeler dans l’application" style={[styles.call, { borderColor: theme.border }]}>
          {calling ? <ActivityIndicator color={Brand.primary} /> : <Ionicons name="call-outline" size={17} color={Brand.primary} />}
          <ThemedText style={styles.callText}>Appeler dans l’application</ThemedText>
        </Pressable>
      ) : null}

      <KpiGrid
        items={[
          { v: p.totalLivraisons != null ? fr(p.totalLivraisons) : '—', l: 'Livraisons' },
          { v: rating, l: 'Note' },
          ...(p.ponctualite != null ? [{ v: `${p.ponctualite}%`, l: 'Ponctualité' }] : []),
          { v: fr(p.abonnesCount), l: 'Abonnés' },
          { v: experienceLabel(p.experience), l: 'Expérience' },
        ]}
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'info' ? <InfoTab p={p} /> : null}
      {tab === 'vehicule' ? <VehiculeTab p={p} /> : null}
      {tab === 'zones' ? (
        p.zones.length ? (
          <Card icon="map-outline" title="Zones de livraison">
            {p.zones.map((z) => (
              <View key={z} style={styles.zone}>
                <View style={styles.zoneDot} />
                <ThemedText style={styles.bold}>{z}</ThemedText>
              </View>
            ))}
          </Card>
        ) : (
          <EmptyCard icon="map-outline" title="Zones de livraison" text="Aucune zone de livraison renseignée." />
        )
      ) : null}
      {tab === 'localisation' ? <LocationTab p={p} /> : null}
      {tab === 'tarifs' ? (
        p.tarifs.length ? (
          <Card icon="pricetag-outline" title="Frais de livraison">
            {p.tarifs.map((t, i) => (
              <InfoRow
                key={t.lieu}
                icon="location-outline"
                label={t.zoneNom && t.zoneNom.toLowerCase() !== t.lieu.toLowerCase() ? `${t.lieu} · zone ${t.zoneNom}` : t.lieu}
                value={t.frais == null ? 'Zone non couverte' : gnf(t.frais)}
                last={i === p.tarifs.length - 1}
              />
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              Frais fixés par Shoneya selon la zone de livraison. Le montant exact pour votre adresse s’affiche au panier.
            </ThemedText>
          </Card>
        ) : (
          <EmptyCard icon="pricetag-outline" title="Frais de livraison" text="Aucune zone de livraison renseignée pour ce livreur." />
        )
      ) : null}
      {tab === 'avis' ? <EmptyCard icon="star-outline" title={`Avis (${p.reviewsCount ?? 0})`} text="Les avis clients seront affichés ici prochainement." /> : null}
      {tab === 'historique' ? <EmptyCard icon="time-outline" title="Historique" text="L’historique des livraisons sera affiché ici prochainement." /> : null}

      {/* ── Contact (colonne latérale du site) — téléphone présent seulement pour un abonné ou soi-même ── */}
      {p.telephone || p.whatsapp ? (
        <Card icon="call-outline" title="Contact">
          {p.telephone ? (
            <InfoRow
              icon="call-outline"
              label="Téléphone"
              value={p.telephone}
              last={!p.whatsapp}
              action={
                <View style={styles.actions}>
                  <IconAction
                    icon="copy-outline"
                    label="Copier le numéro"
                    onPress={() => {
                      void Clipboard.setStringAsync(p.telephone!);
                      notify('📋 Copié !');
                    }}
                  />
                  {/* Pas d'appel vers son propre numéro */}
                  {self ? null : <IconAction icon="call" label="Appeler ce numéro" onPress={() => contact.phoneCall(p.telephone ?? null)} />}
                </View>
              }
            />
          ) : null}
          {p.whatsapp ? (
            <InfoRow
              icon="logo-whatsapp"
              label="WhatsApp"
              value={p.whatsapp}
              last
              action={self ? undefined : <IconAction icon="open-outline" label="Ouvrir WhatsApp" onPress={() => contact.whatsapp(p.whatsapp ?? null)} />}
            />
          ) : null}
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  call: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 999, minHeight: 44 },
  callText: { fontSize: 14, lineHeight: 19, fontWeight: '800', color: Brand.primary },
  zone: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  zoneDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Brand.primary },
  actions: { flexDirection: 'row', gap: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
