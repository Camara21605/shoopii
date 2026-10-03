/**
 * Étape « Vos coordonnées » — comme RegisterForm.tsx (renderStep4) du site :
 *   · téléphone avec choix du pays (indicatif)
 *   · CLIENT : position GPS du téléphone (LocationPermission du site),
 *     adresse retrouvée par le géocodage du téléphone ; si la position est
 *     refusée, choix de la ville dans le référentiel (le serveur accepte la
 *     ville seule — RegisterDto : latitude/longitude OU city)
 *   · ENTREPRISE : Pays → Région → Préfecture → Commune → Quartier dans le
 *     référentiel géo (CompanyLocationSelect du site), quartier obligatoire,
 *     « Autre quartier (non listé)… » → saisie libre confirmée.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Field } from '@/components/form';
import { SelectField } from '@/components/select-field';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchGeoItems, fetchVilles } from '@/features/auth/api';
import { useTheme } from '@/hooks/use-theme';

import { COUNTRIES } from './countries';
import type { StepProps } from './types';

export function ContactStep({ form, errors, set }: StepProps) {
  return (
    <>
      {/* Téléphone : indicatif + numéro */}
      <View style={styles.phoneRow}>
        <View style={styles.dial}>
          <SelectField
            placeholder="Pays"
            title="Indicatif du pays"
            options={COUNTRIES.map((c) => ({ value: c.code, label: `${c.name} (${c.dial})`, icon: c.flag }))}
            value={form.country.code}
            onChange={(code) => {
              const c = COUNTRIES.find((x) => x.code === code);
              if (c) set({ country: { code: c.code, name: c.name, dial: c.dial, flag: c.flag }, city: null });
            }}
          />
        </View>
        <View style={styles.flex}>
          <Field
            variant="outline"
            placeholder="620 000 000"
            value={form.phone}
            onChangeText={(v) => set({ phone: v.replace(/\D/g, '').slice(0, 15) })}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            error={errors.phone}
            left={
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.dialText}>
                {form.country.dial}
              </ThemedText>
            }
          />
        </View>
      </View>
      <View style={styles.detected}>
        <Ionicons name="checkmark-circle" size={14} color={Brand.primary} />
        <ThemedText type="small" style={{ color: Brand.primary }}>
          Pays détecté : <ThemedText type="smallBold" style={{ color: Brand.primary }}>{form.country.name}</ThemedText> ({form.country.dial})
        </ThemedText>
      </View>

      {form.role === 'company' ? <CompanyLocationPicker form={form} errors={errors} set={set} /> : <ClientLocation form={form} errors={errors} set={set} />}

      {errors.location ? (
        <ThemedText type="small" style={{ color: Brand.danger }} accessibilityRole="alert">
          {errors.location}
        </ThemedText>
      ) : null}
    </>
  );
}

/* ── Client : position GPS (ou ville en repli) ─────────────────────────── */
function ClientLocation({ form, set }: StepProps) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const villes = useQuery({
    queryKey: ['register-villes', form.country.dial],
    queryFn: () => fetchVilles(form.country.dial),
    enabled: !!refused,
    staleTime: 3_600_000,
  });

  async function locate() {
    setBusy(true);
    setRefused(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setRefused('Position refusée. Choisissez votre ville ci-dessous, ou autorisez la position dans les réglages du téléphone.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude, accuracy } = pos.coords;
      /* Adresse lisible (géocodage du téléphone) — facultative : la position suffit au serveur */
      let place: Location.LocationGeocodedAddress | undefined;
      try {
        [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      } catch {
        place = undefined;
      }
      set({
        city: null,
        gps: {
          latitude,
          longitude,
          accuracy: accuracy ?? undefined,
          city: place?.city ?? place?.subregion ?? undefined,
          district: place?.district ?? undefined,
          quartier: place?.district ?? place?.street ?? undefined,
          region: place?.region ?? undefined,
          country: place?.country ?? undefined,
          postalCode: place?.postalCode ?? undefined,
          address: [place?.streetNumber, place?.street, place?.district, place?.city].filter(Boolean).join(', ') || undefined,
        },
      });
    } catch {
      setRefused('Impossible d’obtenir votre position (GPS désactivé ?). Choisissez votre ville ci-dessous.');
    } finally {
      setBusy(false);
    }
  }

  if (form.gps) {
    const label = [form.gps.quartier, form.gps.city].filter(Boolean).join(', ');
    return (
      <View style={[styles.okBox]}>
        <Ionicons name="location" size={18} color="#047857" />
        <ThemedText type="smallBold" style={[styles.flex, { color: '#065F46' }]}>
          Position enregistrée{label ? ` — ${label}` : ''}
        </ThemedText>
        <Pressable onPress={() => set({ gps: null })} accessibilityRole="button" hitSlop={8}>
          <ThemedText type="smallBold" style={{ color: Brand.primary }}>
            Modifier
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.locBox, { borderColor: theme.border, backgroundColor: theme.backgroundSelected }]}>
      <View style={styles.row}>
        <Ionicons name="navigate-circle-outline" size={22} color={Brand.primary} />
        <ThemedText type="smallBold" style={styles.flex}>
          Votre localisation *
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Shoneya utilise votre position pour vous montrer les boutiques et livreurs proches de chez vous.
      </ThemedText>
      <Pressable onPress={() => void locate()} disabled={busy} accessibilityRole="button" style={styles.locBtn}>
        {busy ? <ActivityIndicator color={Brand.primaryInk} /> : <Ionicons name="locate" size={18} color={Brand.primaryInk} />}
        <ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>
          {busy ? 'Localisation en cours…' : 'Utiliser ma position'}
        </ThemedText>
      </Pressable>
      {refused ? (
        <>
          <ThemedText type="small" style={{ color: '#B45309' }}>
            {refused}
          </ThemedText>
          <SelectField
            placeholder="Choisir votre ville"
            title="Votre ville"
            options={(villes.data ?? []).map((v) => ({ value: v.nom, label: v.nom }))}
            value={form.city}
            onChange={(nom) => set({ city: nom })}
            loading={villes.isFetching}
          />
        </>
      ) : null}
    </View>
  );
}

/* ── Entreprise : Pays → Région → Préfecture → Commune → Quartier ─────── */
const AUTRE = '__autre__';

function CompanyLocationPicker({ form, set }: StepProps) {
  const theme = useTheme();
  const [paysId, setPaysId] = useState<string | null>(form.company?.paysId ?? null);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [prefectureId, setPrefectureId] = useState<string | null>(form.company?.prefectureId ?? null);
  const [communeId, setCommuneId] = useState<string | null>(null);
  const [quartierId, setQuartierId] = useState<string | null>(null);
  const [libre, setLibre] = useState('');

  const pays = useQuery({ queryKey: ['geo', 'pays'], queryFn: () => fetchGeoItems('pays'), staleTime: 3_600_000 });
  const regions = useQuery({ queryKey: ['geo', 'region', paysId], queryFn: () => fetchGeoItems('region', paysId!), enabled: !!paysId });
  const prefs = useQuery({ queryKey: ['geo', 'prefecture', regionId], queryFn: () => fetchGeoItems('prefecture', regionId!), enabled: !!regionId });
  const communes = useQuery({ queryKey: ['geo', 'commune', prefectureId], queryFn: () => fetchGeoItems('commune', prefectureId!), enabled: !!prefectureId && !!regionId });
  const quartiers = useQuery({ queryKey: ['geo', 'quartier', communeId], queryFn: () => fetchGeoItems('quartier', communeId!), enabled: !!communeId });

  const opts = (list?: { id: string; nom: string }[]) => (list ?? []).map((x) => ({ value: x.id, label: x.nom }));
  const nom = (list: { id: string; nom: string }[] | undefined, id: string | null) => list?.find((x) => x.id === id)?.nom ?? '';

  /** Localisation complète → remontée au formulaire (quartier obligatoire). */
  function emit(qNom: string) {
    if (!paysId || !regionId || !prefectureId || !communeId || !qNom.trim()) return;
    set({
      company: {
        paysId,
        paysNom: nom(pays.data, paysId),
        regionNom: nom(regions.data, regionId),
        prefectureId,
        prefectureNom: nom(prefs.data, prefectureId),
        communeNom: nom(communes.data, communeId),
        quartierNom: qNom.trim(),
      },
    });
  }

  const reset = () => set({ company: null });

  /* Déjà confirmée (retour sur l'étape) : résumé + « Modifier » */
  if (form.company && !communeId) {
    const c = form.company;
    return (
      <View style={styles.okBox}>
        <Ionicons name="checkmark-circle" size={18} color="#047857" />
        <ThemedText type="small" style={[styles.flex, { color: '#065F46' }]}>
          <ThemedText type="smallBold" style={{ color: '#065F46' }}>Localisation confirmée</ThemedText>
          {'\n'}
          {[c.quartierNom, c.communeNom, c.prefectureNom, c.regionNom, c.paysNom].filter(Boolean).join(', ')}
        </ThemedText>
        <Pressable
          onPress={() => {
            reset();
            setPaysId(null);
            setPrefectureId(null);
          }}
          accessibilityRole="button"
          hitSlop={8}>
          <ThemedText type="smallBold" style={{ color: Brand.primary }}>
            Modifier
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  const noQuartierList = !!communeId && !quartiers.isFetching && (quartiers.data?.length ?? 0) === 0;
  const manual = !!communeId && (noQuartierList || quartierId === AUTRE);

  return (
    <View style={[styles.locBox, { borderColor: theme.border, backgroundColor: theme.backgroundSelected }]}>
      <View style={styles.row}>
        <Ionicons name="business-outline" size={20} color={Brand.primary} />
        <ThemedText type="smallBold">Localisation de votre entreprise</ThemedText>
      </View>
      <SelectField
        label="Pays *"
        placeholder="Choisir un pays"
        options={opts(pays.data)}
        value={paysId}
        loading={pays.isFetching}
        onChange={(id) => {
          setPaysId(id);
          setRegionId(null);
          setPrefectureId(null);
          setCommuneId(null);
          setQuartierId(null);
          setLibre('');
          reset();
        }}
      />
      <SelectField
        label="Région *"
        placeholder="Choisir une région"
        options={opts(regions.data)}
        value={regionId}
        disabled={!paysId}
        disabledHint="Choisissez d’abord un pays"
        loading={regions.isFetching}
        onChange={(id) => {
          setRegionId(id);
          setPrefectureId(null);
          setCommuneId(null);
          setQuartierId(null);
          setLibre('');
          reset();
        }}
      />
      <SelectField
        label="Préfecture / Ville *"
        placeholder="Choisir une préfecture / ville"
        options={opts(prefs.data)}
        value={prefectureId}
        disabled={!regionId}
        disabledHint="Choisissez d’abord une région"
        loading={prefs.isFetching}
        onChange={(id) => {
          setPrefectureId(id);
          setCommuneId(null);
          setQuartierId(null);
          setLibre('');
          reset();
        }}
      />
      <SelectField
        label="Commune *"
        placeholder="Choisir une commune"
        options={opts(communes.data)}
        value={communeId}
        disabled={!prefectureId || !regionId}
        disabledHint="Choisissez d’abord une préfecture / ville"
        loading={communes.isFetching}
        onChange={(id) => {
          setCommuneId(id);
          setQuartierId(null);
          setLibre('');
          reset();
        }}
      />
      {communeId && (quartiers.isFetching || (quartiers.data?.length ?? 0) > 0) ? (
        <SelectField
          label="Votre quartier *"
          placeholder="Choisir votre quartier"
          options={opts(quartiers.data)}
          pinned={{ value: AUTRE, label: 'Autre quartier (non listé)…' }}
          value={quartierId}
          loading={quartiers.isFetching}
          onChange={(id) => {
            setQuartierId(id);
            setLibre('');
            if (id !== AUTRE) emit(nom(quartiers.data, id));
            else reset();
          }}
        />
      ) : null}
      {manual ? (
        <>
          <ThemedText type="smallBold" style={styles.small}>
            {noQuartierList ? 'Votre quartier * — aucun quartier n’est encore répertorié pour cette commune' : 'Nom de votre quartier *'}
          </ThemedText>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field
                variant="outline"
                placeholder="Ex : Boussoura, Almamya, Madina…"
                value={libre}
                onChangeText={(v) => {
                  setLibre(v);
                  reset();
                }}
                maxLength={100}
                onSubmitEditing={() => libre.trim().length >= 2 && emit(libre)}
              />
            </View>
            <Pressable
              onPress={() => emit(libre)}
              disabled={libre.trim().length < 2}
              accessibilityRole="button"
              style={[styles.confirmBtn, libre.trim().length < 2 && { opacity: 0.4 }]}>
              <ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>
                Confirmer
              </ThemedText>
            </Pressable>
          </View>
        </>
      ) : null}
      {form.company ? (
        <View style={styles.row}>
          <Ionicons name="checkmark-circle" size={16} color="#047857" />
          <ThemedText type="small" style={{ color: '#065F46' }}>
            Localisation confirmée — quartier identifié
          </ThemedText>
        </View>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        Les clients verront ce quartier sur votre carte et votre profil.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  small: { fontSize: 13 },
  phoneRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  dial: { width: 118 },
  dialText: { marginRight: Spacing.two },
  detected: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -6 },
  locBox: { borderWidth: 1.5, borderRadius: 14, padding: 14, gap: Spacing.three },
  locBtn: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primarySoft,
    borderWidth: 1,
    borderColor: Brand.primaryLine,
    borderRadius: 999,
    minHeight: 48,
  },
  okBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 12,
  },
  confirmBtn: { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 12, paddingHorizontal: 16, minHeight: 58, justifyContent: 'center' },
});
