/**
 * Onglets Infos, Véhicule et Localisation du profil d'un livreur (DriverProfileView).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { MapView, type MapViewHandle } from '@/features/location/MapView';
import { useTheme } from '@/hooks/use-theme';

import { vehicleLabel, VEHICLE_ICON, type DriverProfile } from '../api';
import { useTrackDelivery } from '../tracking';
import { Card, Chip, InfoRow } from './ui';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const CONAKRY = { lat: 9.537, lng: -13.677 };
const OK = '#047857';

export function InfoTab({ p }: { p: DriverProfile }) {
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

export function VehiculeTab({ p }: { p: DriverProfile }) {
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
export function LocationTab({ p }: { p: DriverProfile }) {
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 7 },
  dayName: { width: 118 },
  veh: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12 },
  vehIcon: { fontSize: 34, lineHeight: 42 },
  plate: { alignSelf: 'flex-start', marginTop: 4, fontSize: 12.5, lineHeight: 17, fontWeight: '900', letterSpacing: 1, borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 8 },
  share: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  shareText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  map: { height: 300, borderRadius: 14, overflow: 'hidden' },
  notice: { flexDirection: 'row', gap: 8, borderRadius: 12, padding: 12 },
});
