/**
 * Contenu du profil public d'un livreur (ProfilLivreurReseauPage / profil-livreur du site),
 * partagé par le profil d'un livreur du réseau et « Mon profil » :
 * identité, pastilles, 6 chiffres clés, onglets (Infos, Véhicule, Zones,
 * Localisation en temps réel, Tarifs, Avis, Historique), contact et statistiques.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useActorContact } from '@/features/company-drivers/components';
import { MapView, type MapViewHandle } from '@/features/location/MapView';
import { useTheme } from '@/hooks/use-theme';

import { experienceLabel, formatKm, fr, gnf, vehicleLabel, VEHICLE_ICON, type DriverProfile } from '../api';
import { useDistances } from '../hooks';
import { useTrackDelivery } from '../tracking';
import { Avatar, Card, Chip, EmptyCard, InfoRow, KpiGrid, Tabs, type IconName } from './ui';

type Tab = 'info' | 'vehicule' | 'zones' | 'localisation' | 'tarifs' | 'avis' | 'historique';
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const CONAKRY = { lat: 9.537, lng: -13.677 };
const OK = '#047857';

export function DriverProfileView({
  p,
  self,
  onCall,
  calling,
  contact,
  notify,
}: {
  p: DriverProfile;
  self: boolean;
  onCall: () => void;
  calling: boolean;
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
    { id: 'localisation', label: 'Localisation', icon: 'location-outline' },
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
              {p.disponible ? 'Disponible maintenant' : 'Hors ligne'} · {fr(p.abonnesCount)} abonné{p.abonnesCount > 1 ? 's' : ''}
            </ThemedText>
          </View>
        </View>
      </View>
      <View style={styles.chips}>
        <Chip icon="checkmark-circle" label="Identité vérifiée" />
        {p.assurance ? <Chip icon="shield-checkmark-outline" label="Assuré Shoneya" /> : null}
        {p.averageRating != null ? <Chip icon="star" label={`${p.averageRating.toFixed(1)}★ · ${p.reviewsCount ?? 0} avis`} /> : null}
      </View>
      {p.isSuivi && !self ? (
        <Pressable onPress={onCall} disabled={calling} accessibilityRole="button" accessibilityLabel="Appeler dans l’application" style={[styles.call, { borderColor: theme.border }]}>
          {calling ? <ActivityIndicator color={Brand.primary} /> : <Ionicons name="call-outline" size={17} color={Brand.primary} />}
          <ThemedText style={styles.callText}>Appeler dans l’application</ThemedText>
        </Pressable>
      ) : null}

      <KpiGrid
        items={[
          { v: p.totalLivraisons != null ? fr(p.totalLivraisons) : '—', l: 'Livraisons' },
          { v: rating, l: 'Note' },
          { v: `${p.ponctualite}%`, l: 'Ponctualité' },
          { v: fr(p.abonnesCount), l: 'Abonnés' },
          { v: p.reviewsCount != null ? String(p.reviewsCount) : '—', l: 'Avis' },
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
        <Card icon="pricetag-outline" title="Grille tarifaire">
          <InfoRow icon="flag-outline" label="Tarif de base" value={gnf(p.tarifs.base)} />
          <InfoRow icon="git-commit-outline" label="Par kilomètre" value={gnf(p.tarifs.parKm)} />
          <InfoRow icon="barbell-outline" label="Supplément colis lourd" value={gnf(p.tarifs.supplementLourd)} />
          <InfoRow icon="moon-outline" label="Majoration nocturne" value={`+${p.tarifs.majorationNocturne}%`} last />
        </Card>
      ) : null}
      {tab === 'avis' ? <EmptyCard icon="star-outline" title={`Avis (${p.reviewsCount ?? 0})`} text="Les avis clients seront affichés ici prochainement." /> : null}
      {tab === 'historique' ? <EmptyCard icon="time-outline" title="Historique" text="L’historique des livraisons sera affiché ici prochainement." /> : null}

      {/* ── Contact (colonne latérale du site) ── */}
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
      <Card icon="stats-chart-outline" title="Statistiques">
        <KpiGrid
          items={[
            { v: p.totalLivraisons != null ? fr(p.totalLivraisons) : '—', l: 'Livraisons' },
            { v: rating, l: 'Note' },
            { v: `${p.ponctualite}%`, l: 'Ponctualité' },
            { v: fr(p.abonnesCount), l: 'Abonnés' },
          ]}
        />
      </Card>
    </>
  );
}

function InfoTab({ p }: { p: DriverProfile }) {
  const theme = useTheme();
  const today = JOURS[(new Date().getDay() + 6) % 7];
  const ville = (p.ville ?? '').trim();
  const quartier = (p.quartier || p.commune || '').trim();
  const hasHours = Object.keys(p.horaires).length > 0;
  return (
    <>
      <Card icon="person-outline" title="À propos">
        <ThemedText>{p.bio || 'Aucune description disponible.'}</ThemedText>
        {p.langues.length ? (
          <View style={styles.chips}>
            {p.langues.map((l) => (
              <Chip key={l} icon="language-outline" label={l} />
            ))}
          </View>
        ) : null}
      </Card>
      <Card icon="information-circle-outline" title="Informations pratiques">
        {ville || quartier ? (
          <>
            {ville ? <InfoRow icon="business-outline" label="Ville" value={ville} /> : null}
            {quartier ? <InfoRow icon="pin-outline" label="Quartier" value={quartier} /> : null}
          </>
        ) : (
          <InfoRow icon="pin-outline" label="Zone principale" value={p.zone || '—'} />
        )}
        {p.telephone ? <InfoRow icon="call-outline" label="Contact direct" value={p.telephone} /> : null}
        {p.langues.length ? <InfoRow icon="language-outline" label="Langues parlées" value={p.langues.join(' · ')} /> : null}
        <InfoRow icon="shield-checkmark-outline" label="Assurance" value={p.assurance ? 'Couvert ✓' : 'Non renseignée'} last />
      </Card>
      {hasHours ? (
        <Card icon="calendar-outline" title="Disponibilité hebdomadaire">
          {JOURS.map((j) => {
            const h = p.horaires[j];
            const closed = !h || h === 'Fermé';
            const isToday = j === today;
            return (
              <View key={j} style={[styles.day, isToday && { backgroundColor: theme.background }]}>
                <ThemedText style={[styles.dayName, isToday && styles.bold]}>
                  {j.charAt(0).toUpperCase() + j.slice(1)}
                  {isToday ? (
                    <ThemedText type="small" style={{ color: OK }}>
                      {' '}
                      (auj.)
                    </ThemedText>
                  ) : null}
                </ThemedText>
                <ThemedText style={styles.flex}>{closed ? '—' : h}</ThemedText>
                <ThemedText type="smallBold" style={{ color: closed ? Brand.danger : OK }}>
                  {closed ? 'Fermé' : 'Ouvert'}
                </ThemedText>
              </View>
            );
          })}
        </Card>
      ) : null}
    </>
  );
}

function VehiculeTab({ p }: { p: DriverProfile }) {
  const theme = useTheme();
  return (
    <Card icon="bicycle-outline" title="Informations véhicule">
      <View style={[styles.veh, { backgroundColor: theme.background }]}>
        <ThemedText style={styles.vehIcon}>{VEHICLE_ICON[p.vehiculeType] ?? '🛵'}</ThemedText>
        <View style={styles.flex}>
          <ThemedText style={styles.bold}>{vehicleLabel(p.vehicule, p.vehiculeType)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Type : {p.vehiculeType}
          </ThemedText>
          {p.immatriculation ? <ThemedText style={styles.plate}># {p.immatriculation}</ThemedText> : null}
        </View>
      </View>
      <InfoRow icon="card-outline" label="Permis" value={p.permis ? 'Validé ✓' : 'Non renseigné'} />
      <InfoRow icon="shield-checkmark-outline" label="Assurance" value={p.assurance ? 'Valide ✓' : 'Non renseignée'} />
      <InfoRow icon="keypad-outline" label="Immatriculation" value={p.immatriculation ?? 'Non renseignée'} last />
    </Card>
  );
}

/** Position en temps réel (seulement quand le livreur la partage, pendant une livraison). */
function LocationTab({ p }: { p: DriverProfile }) {
  const theme = useTheme();
  const { position, sharing } = useTrackDelivery(p.id);
  const mapRef = useRef<MapViewHandle>(null);
  useEffect(() => {
    if (position) mapRef.current?.camera({ kind: 'fly', lat: position.latitude, lng: position.longitude, zoom: 15 });
  }, [position]);
  return (
    <Card
      icon="location-outline"
      title="Position en temps réel"
      right={
        <View style={[styles.share, { backgroundColor: sharing ? '#ECFDF5' : theme.background }]}>
          <View style={[styles.dot, { backgroundColor: sharing ? '#10B981' : '#A1A1AA' }]} />
          <ThemedText style={[styles.shareText, { color: sharing ? OK : theme.textSecondary }]}>{sharing ? 'Partage actif' : 'Hors ligne'}</ThemedText>
        </View>
      }>
      <View style={styles.map}>
        <MapView
          ref={mapRef}
          initialCenter={position ? { lat: position.latitude, lng: position.longitude } : CONAKRY}
          onSelect={() => undefined}
          state={{
            actors: position ? [{ key: p.id, role: 'delivery', lat: position.latitude, lng: position.longitude, approx: false, precision: 'exact' }] : [],
            selectedKey: null,
            me: null,
            place: null,
            activePlace: null,
            radius: null,
            route: null,
            style: 'plan',
            labelsOn: true,
          }}
        />
      </View>
      {!sharing && !position ? (
        <View style={[styles.notice, { backgroundColor: theme.background }]}>
          <Ionicons name="information-circle-outline" size={17} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            <ThemedText type="smallBold">{p.fullName}</ThemedText> ne partage pas sa position pour le moment. La position s’affiche automatiquement lorsqu’une livraison est en cours.
          </ThemedText>
        </View>
      ) : null}
      {position ? (
        <ThemedText type="small" themeColor="textSecondary">
          Lat : {position.latitude.toFixed(5)} · Lng : {position.longitude.toFixed(5)}
          {position.vitesseKmh ? ` · ${position.vitesseKmh.toFixed(0)} km/h` : ''}
        </ThemedText>
      ) : null}
    </Card>
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
  day: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 7 },
  dayName: { width: 118 },
  veh: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12 },
  vehIcon: { fontSize: 34, lineHeight: 42 },
  plate: { alignSelf: 'flex-start', marginTop: 4, fontSize: 12.5, lineHeight: 17, fontWeight: '900', letterSpacing: 1, borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 8 },
  share: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  shareText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  map: { height: 300, borderRadius: 14, overflow: 'hidden' },
  notice: { flexDirection: 'row', gap: 8, borderRadius: 12, padding: 12 },
  actions: { flexDirection: 'row', gap: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  barBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, minHeight: 46, paddingHorizontal: 18 },
  barMain: { flex: 1, backgroundColor: Brand.primary },
  barMainText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
});
