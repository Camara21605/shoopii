/**
 * Espace livreur › Ma zone de livraison — équivalent mobile de
 * /dashboard/livreur/zone (ZonePage.tsx) :
 *   · partage de position : « Partager » / « Arrêter » ; automatique et
 *     impossible à arrêter pendant une livraison (une seule connexion pour tout
 *     l'espace livreur, voir sharing.ts) ; latitude / longitude affichées ;
 *   · carte : mes zones (icône du type de livraison, grisées si non disponibles),
 *     ma position, et la mission choisie avec « Voir sur la carte » (boutique 🏪,
 *     client 🏠 — position approximative si le client n'a pas d'adresse GPS) +
 *     les adresses (pays, ville, quartier) ; toucher une épingle l'explique ;
 *   · mes zones : type de livraison, nuage des zones, interrupteur « disponible »
 *     par zone (enregistré aussitôt, un à la fois, retour en arrière si échec) ;
 *   · répartition RÉELLE de mes missions actuelles par zone (le site affiche
 *     des chiffres tirés au hasard : remplacés ici par de vraies données).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { DELIVERY_TYPES, fetchSettings, type LivreurSettings } from '@/features/livreur-settings/api';
import { MapView, type MapState, type MapViewHandle } from '@/features/location/MapView';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { Box, CARD, LivreurScreen, useHasActiveMission } from '../components';
import { useMissions } from '../hooks';
import { startSharing, stopSharing, useSharing } from '../sharing';
import { approxCoords, fetchGeoCoords, GUINEA_ZONE_COORDS, missionInZone, setZonesDisponibles } from '../zone';

const CONAKRY = { lat: 9.537, lng: -13.6773 };
const OK = '#047857';

export default function LivreurZoneScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const snack = useSnack();
  const { mission: missionId } = useLocalSearchParams<{ mission?: string }>();
  const settings = useQuery({ queryKey: qk.livreur.settings, queryFn: fetchSettings, staleTime: 60_000 });
  const missions = useMissions();
  const hasActive = useHasActiveMission();
  const share = useSharing();
  const mapRef = useRef<MapViewHandle>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const d = settings.data;
  const zones = useMemo(() => d?.communesActives ?? [], [d?.communesActives]);
  /* null = jamais choisi → toutes les zones disponibles (règle du site) */
  const dispo = useMemo(() => (d ? (d.zonesDisponibles ?? zones) : []), [d, zones]);
  const typeConf = DELIVERY_TYPES.find((t) => t.key === d?.deliveryType);
  const nDispo = zones.filter((z) => dispo.includes(z)).length;

  /* Coordonnées : dictionnaire du site, puis celles de la base quand elles existent */
  const geo = useQuery({ queryKey: qk.livreur.zoneGeo(typeConf?.niveau ?? ''), queryFn: () => fetchGeoCoords(typeConf!.niveau), enabled: !!typeConf, staleTime: 30 * 60_000 });
  const coords = useMemo(() => {
    const map: Record<string, [number, number]> = {};
    zones.forEach((z) => {
      if (GUINEA_ZONE_COORDS[z]) map[z] = GUINEA_ZONE_COORDS[z];
    });
    (geo.data ?? []).forEach((g) => {
      if (zones.includes(g.nom) && g.latitude != null && g.longitude != null) map[g.nom] = [g.latitude, g.longitude];
    });
    return map;
  }, [zones, geo.data]);

  const mission = missionId ? (missions.data ?? []).find((m) => m.uuid === missionId) : undefined;
  const clientExact = mission?.clientLat != null && mission?.clientLng != null;
  /* Mémorisés : la carte ne reçoit un nouvel état que si les positions changent vraiment */
  const clientPos = useMemo<[number, number] | null>(
    () => (mission ? (clientExact ? [mission.clientLat!, mission.clientLng!] : approxCoords(mission.clientCommune)) : null),
    [mission, clientExact],
  );
  const shopPos = useMemo<[number, number] | null>(
    () => (mission && mission.companyLat != null && mission.companyLng != null ? [mission.companyLat, mission.companyLng] : null),
    [mission],
  );

  /* ── Carte ── */
  const state: MapState = useMemo(() => {
    const actors: MapState['actors'] = zones
      .filter((z) => coords[z])
      .map((z) => ({
        key: `zone|${z}|${dispo.includes(z) ? 1 : 0}`,
        role: 'vendor',
        emoji: typeConf?.em ?? '📍',
        dim: !dispo.includes(z),
        lat: coords[z][0],
        lng: coords[z][1],
        approx: false,
        precision: 'exact',
      }));
    if (shopPos) actors.push({ key: 'mission|shop', role: 'vendor', emoji: '🏪', lat: shopPos[0], lng: shopPos[1], approx: false, precision: 'exact' });
    if (clientPos) actors.push({ key: 'mission|client', role: 'vendor', emoji: '🏠', lat: clientPos[0], lng: clientPos[1], approx: !clientExact, precision: clientExact ? 'exact' : 'commune' });
    return {
      actors,
      selectedKey: selected,
      me: share.position ? { lat: share.position.latitude, lng: share.position.longitude, acc: share.position.accuracy ?? null } : null,
      place: null,
      activePlace: null,
      radius: null,
      route: null,
      style: 'plan',
      labelsOn: true,
    };
  }, [zones, coords, dispo, typeConf, shopPos, clientPos, clientExact, selected, share.position]);

  /* Cadrage : la mission si elle est affichée, sinon mes zones (+ ma position) */
  const fitKey = `${missionId ?? ''}|${Object.keys(coords).join(',')}|${shopPos ?? ''}|${clientPos ?? ''}`;
  useEffect(() => {
    const pts: [number, number][] = mission ? ([shopPos, clientPos].filter(Boolean) as [number, number][]) : Object.values(coords);
    if (!mission && share.position) pts.push([share.position.latitude, share.position.longitude]);
    if (pts.length) {
      const t = setTimeout(() => mapRef.current?.camera({ kind: 'fit', points: pts, zoom: 13 }), 600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  /* ── Partage ── */
  const toggleSharing = async () => {
    if (share.sharing) {
      /* Verrou aussi dans la fonction (le bouton est déjà masqué pendant une livraison) */
      if (hasActive) return snack.show('🛵 Livraison en cours — le partage ne peut pas être arrêté.');
      stopSharing();
      snack.show('⏹ Partage de position arrêté.');
    } else {
      const ok = await startSharing();
      if (ok) snack.show('📍 Partage de position démarré.');
    }
  };
  useEffect(() => {
    if (share.error) snack.show(`❌ ${share.error}`, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [share.error]);

  /* ── Disponibilité par zone : enregistrée aussitôt, une requête à la fois ── */
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const [saving, setSaving] = useState<string | null>(null);
  const toggleZone = (z: string) => {
    const before = dispo;
    const next = before.includes(z) ? before.filter((x) => x !== z) : [...before, z];
    qc.setQueryData<LivreurSettings>(qk.livreur.settings, (p) => (p ? { ...p, zonesDisponibles: next } : p));
    setSaving(z);
    chain.current = chain.current
      .catch(() => undefined)
      .then(() => setZonesDisponibles(next))
      .then(() => snack.show(next.includes(z) ? `✅ Disponible sur ${z}` : `⏸ Non disponible sur ${z}`))
      .catch((e) => {
        qc.setQueryData<LivreurSettings>(qk.livreur.settings, (p) => (p ? { ...p, zonesDisponibles: before } : p));
        snack.show(`❌ Impossible de mettre à jour la disponibilité — ${toUserMessage(e)}`, true);
      })
      .finally(() => setSaving(null));
  };

  /* ── Répartition réelle des missions actuelles ── */
  const list = missions.data ?? [];
  const stats = zones.map((z) => ({ z, n: list.filter((m) => missionInZone(z, m)).length }));
  const inZones = list.filter((m) => zones.some((z) => missionInZone(z, m))).length;
  const outside = list.length - inZones;

  const sel = selected?.split('|') ?? [];
  const selInfo =
    sel[0] === 'zone'
      ? { title: `${typeConf?.em ?? '📍'} ${sel[1]}`, sub: sel[2] === '1' ? '✅ Disponible' : '⏸ Non disponible' }
      : sel[1] === 'shop' && mission
        ? { title: `🏪 ${mission.shop}`, sub: `Boutique · ${mission.id}` }
        : sel[1] === 'client' && mission
          ? { title: `🏠 ${mission.client}`, sub: `${mission.clientCommune ?? mission.clientVille ?? ''}${clientExact ? '' : ' (position approximative)'}` }
          : null;

  return (
    <LivreurScreen title="Ma zone de livraison" subtitle="Votre position, vos zones et votre disponibilité" snack={snack.msg}>
      <ScrollView
        {...hideOnScroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={settings.isRefetching}
            onRefresh={() => {
              void settings.refetch();
              void missions.refetch();
            }}
            colors={[Brand.primary]}
            tintColor={Brand.primary}
          />
        }>
        {/* ── Carte + partage ── */}
        <Box icon="map-outline" title="Ma position en temps réel">
          {missionId ? (
            <View style={[styles.banner, { borderColor: theme.border }]}>
              <Ionicons name="git-merge-outline" size={17} color={Brand.primary} />
              <ThemedText type="small" style={styles.flex} numberOfLines={2}>
                {mission ? (
                  <>
                    <ThemedText type="smallBold">{mission.id}</ThemedText> · 🏪 {mission.shop} → 🏠 {mission.client}
                  </>
                ) : missions.isPending ? (
                  'Chargement de la mission…'
                ) : (
                  'Cette mission n’est plus dans vos missions.'
                )}
              </ThemedText>
              <Pressable onPress={() => router.setParams({ mission: undefined })} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer la mission">
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.share, { borderColor: share.sharing ? Brand.primary : theme.border, backgroundColor: share.sharing ? 'rgba(0,0,0,0.05)' : theme.background }]}>
            <View style={[styles.dot, { backgroundColor: share.sharing ? '#10B981' : '#A1A1AA' }]} />
            <View style={styles.flex}>
              <ThemedText style={styles.bold}>{hasActive ? 'Partage automatique actif' : share.sharing ? 'Partage actif' : 'Partage désactivé'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {hasActive
                  ? 'Visible en direct par le client et la boutique de votre livraison en cours'
                  : share.sharing
                    ? 'Les boutiques et clients voient votre position'
                    : 'Activez pour être visible sur la carte'}
              </ThemedText>
            </View>
            {!hasActive ? (
              <Pressable
                onPress={() => void toggleSharing()}
                disabled={share.starting}
                accessibilityRole="button"
                accessibilityLabel={share.sharing ? 'Arrêter le partage' : 'Partager ma position'}
                style={[styles.shareBtn, share.sharing ? styles.shareStop : { borderColor: Brand.primary }]}>
                {share.starting ? (
                  <ActivityIndicator size="small" color={Brand.primary} />
                ) : (
                  <ThemedText style={[styles.shareBtnText, share.sharing && { color: '#fff' }]}>{share.sharing ? '⏹ Arrêter' : '▶ Partager'}</ThemedText>
                )}
              </Pressable>
            ) : null}
          </View>
          {share.sharing ? (
            <ThemedText type="small" themeColor="textSecondary">
              Gardez l’application ouverte : le partage s’interrompt quand elle est fermée ou en arrière-plan.
            </ThemedText>
          ) : null}

          <View style={styles.map}>
            <MapView ref={mapRef} initialCenter={CONAKRY} state={state} onSelect={setSelected} onTap={() => setSelected(null)} />
          </View>
          {selInfo ? (
            <View style={[styles.selCard, { borderColor: theme.border }]}>
              <ThemedText style={styles.bold}>{selInfo.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {selInfo.sub}
              </ThemedText>
            </View>
          ) : null}
          {share.position ? (
            <ThemedText type="small" themeColor="textSecondary">
              Lat : {share.position.latitude.toFixed(5)} · Lng : {share.position.longitude.toFixed(5)}
            </ThemedText>
          ) : null}

          {mission ? (
            <View style={styles.addrs}>
              <Address title={`🏪 ${mission.shop}`} pays={mission.companyPays} ville={mission.companyVille} quartier={mission.companyQuartier} />
              <Address title={`🏠 ${mission.client}`} pays={mission.companyPays} ville={mission.clientVille} quartier={mission.clientCommune} approx={!clientExact && !!clientPos} />
            </View>
          ) : null}
        </Box>

        {/* ── Mes zones ── */}
        <Box icon="location-outline" title="Mes zones de livraison">
          {settings.isPending ? (
            <View style={styles.state}>
              <ActivityIndicator color={Brand.primary} />
              <ThemedText type="small" themeColor="textSecondary">
                Chargement des zones…
              </ThemedText>
            </View>
          ) : settings.isError ? (
            <View style={styles.state}>
              <ThemedText type="small" themeColor="textSecondary">
                Impossible de charger les zones.
              </ThemedText>
              <Pressable onPress={() => void settings.refetch()} accessibilityRole="button" style={[styles.link, { borderColor: theme.border }]}>
                <ThemedText style={styles.linkText}>Réessayer</ThemedText>
              </Pressable>
            </View>
          ) : zones.length === 0 ? (
            <View style={styles.state}>
              <Ionicons name="pin-outline" size={28} color={theme.textSecondary} />
              <ThemedText style={styles.bold}>Aucune zone configurée</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                Définissez votre périmètre dans Paramètres › Zones & Horaires.
              </ThemedText>
              <Pressable onPress={() => router.push('/livreur/parametres/zone')} accessibilityRole="button" style={[styles.link, { borderColor: theme.border }]}>
                <ThemedText style={styles.linkText}>Choisir mes zones</ThemedText>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.zoneHead}>
                {typeConf ? (
                  <View style={styles.typeTag}>
                    <ThemedText style={styles.typeTagText}>
                      {typeConf.em} {typeConf.label}
                    </ThemedText>
                  </View>
                ) : null}
                <ThemedText style={styles.count}>
                  {nDispo}/{zones.length} disponible{nDispo > 1 ? 's' : ''}
                </ThemedText>
              </View>
              <View style={[styles.cloud, { backgroundColor: theme.background }]}>
                <ThemedText type="smallBold" style={styles.center}>
                  🗺️ {typeConf ? typeConf.label : 'Zones actives'}
                </ThemedText>
                <View style={styles.chips}>
                  {zones.map((z) => {
                    const on = dispo.includes(z);
                    return (
                      <View key={z} style={[styles.chip, { borderColor: on ? theme.border : 'transparent', backgroundColor: on ? '#fff' : CARD }, !on && styles.off]}>
                        <Ionicons name="location" size={10} color={on ? Brand.primary : theme.textSecondary} />
                        <ThemedText style={styles.chipText}>{z}</ThemedText>
                      </View>
                    );
                  })}
                </View>
              </View>
              {zones.map((z, i) => {
                const on = dispo.includes(z);
                return (
                  <Pressable
                    key={z}
                    onPress={() => toggleZone(z)}
                    disabled={!!saving}
                    accessibilityRole="switch"
                    accessibilityLabel={z}
                    accessibilityState={{ checked: on, disabled: !!saving }}
                    aria-checked={on}
                    style={[styles.zone, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, saving && styles.saving]}>
                    <View style={[styles.zoneIco, { backgroundColor: on ? 'rgba(0,0,0,0.06)' : CARD }]}>
                      <ThemedText>{typeConf?.em ?? '📍'}</ThemedText>
                    </View>
                    <View style={styles.flex}>
                      <ThemedText style={[styles.bold, !on && { color: theme.textSecondary }]}>{z}</ThemedText>
                      <View style={styles.row}>
                        <View style={[styles.smallDot, { backgroundColor: on ? OK : '#A1A1AA' }]} />
                        <ThemedText type="small" style={{ color: on ? OK : theme.textSecondary, fontWeight: '700' }}>
                          {on ? 'Disponible' : 'Non disponible'}
                        </ThemedText>
                      </View>
                    </View>
                    {saving === z ? <ActivityIndicator size="small" color={Brand.primary} /> : null}
                    <Switch
                      value={on}
                      onValueChange={() => toggleZone(z)}
                      disabled={!!saving}
                      trackColor={{ true: Brand.primary, false: '#D4D4D4' }}
                      thumbColor="#fff"
                      {...({ activeThumbColor: '#fff' } as object)}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    />
                  </Pressable>
                );
              })}
              <ThemedText type="small" themeColor="textSecondary">
                Indiquez où vous êtes disponible en ce moment. Pour l’instant, ce choix est enregistré mais ne filtre pas encore les missions qui vous sont proposées. Pour ajouter ou retirer une zone
                : Paramètres › Zones & Horaires.
              </ThemedText>
              <Pressable onPress={() => router.push('/livreur/parametres/zone')} accessibilityRole="button" style={[styles.link, { borderColor: theme.border }]}>
                <ThemedText style={styles.linkText}>Modifier mes zones</ThemedText>
              </Pressable>
            </>
          )}
        </Box>

        {/* ── Répartition réelle ── */}
        {zones.length > 0 ? (
          <Box icon="bar-chart-outline" title="Statistiques par zone">
            <ThemedText type="small" themeColor="textSecondary">
              Vos missions actuelles (à accepter, à récupérer, en route) selon le lieu de livraison du client.
            </ThemedText>
            {missions.isPending ? (
              <ActivityIndicator color={Brand.primary} style={styles.loader} />
            ) : list.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                Aucune mission en cours pour le moment.
              </ThemedText>
            ) : (
              <>
                {stats.map((s) => {
                  const pct = list.length ? Math.round((s.n / list.length) * 100) : 0;
                  return (
                    <View key={s.z} style={styles.stat}>
                      <View style={styles.row}>
                        <ThemedText type="smallBold" style={styles.flex}>
                          📍 {s.z}
                        </ThemedText>
                        <ThemedText type="smallBold">
                          {s.n} mission{s.n > 1 ? 's' : ''} · {pct} %
                        </ThemedText>
                      </View>
                      <View style={[styles.bar, { backgroundColor: theme.background }]}>
                        <View style={[styles.fill, { width: `${pct}%` }]} />
                      </View>
                    </View>
                  );
                })}
                {outside > 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {outside} mission{outside > 1 ? 's' : ''} hors de vos zones.
                  </ThemedText>
                ) : null}
              </>
            )}
          </Box>
        ) : null}
      </ScrollView>
    </LivreurScreen>
  );
}

function Address({ title, pays, ville, quartier, approx }: { title: string; pays?: string | null; ville?: string | null; quartier?: string | null; approx?: boolean }) {
  return (
    <View style={styles.addr}>
      <ThemedText type="smallBold" numberOfLines={1}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Pays : <ThemedText type="smallBold">{pays ?? '—'}</ThemedText>
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Ville : <ThemedText type="smallBold">{ville ?? '—'}</ThemedText>
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Quartier : <ThemedText type="smallBold">{quartier ?? '—'}</ThemedText>
        {approx ? ' (position approximative)' : ''}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  content: { padding: 16, gap: 14, paddingBottom: 110 },
  loader: { marginVertical: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  share: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  shareBtn: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  shareStop: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  shareBtnText: { fontSize: 13, lineHeight: 17, fontWeight: '800', color: Brand.primary },
  map: { height: 300, borderRadius: 14, overflow: 'hidden' },
  selCard: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 2 },
  addrs: { gap: 10 },
  addr: { backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 14, padding: 12, gap: 3 },
  state: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  link: { alignSelf: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, minHeight: 38, justifyContent: 'center' },
  linkText: { fontSize: 13.5, lineHeight: 18, fontWeight: '800', color: Brand.primary },
  zoneHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  typeTag: { borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.2)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  typeTagText: { fontSize: 12.5, lineHeight: 17, fontWeight: '800' },
  count: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: Brand.primary },
  cloud: { borderRadius: 14, padding: 12, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  off: { opacity: 0.55 },
  zone: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  saving: { opacity: 0.7 },
  zoneIco: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  smallDot: { width: 6, height: 6, borderRadius: 3 },
  stat: { gap: 5 },
  bar: { height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4, backgroundColor: Brand.primary },
});
