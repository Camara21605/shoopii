/**
 * Paramètres › Point de dépôt — comme SecDepot du site
 * (PATCH /correspondant/parametres/depot) : le local physique où boutiques et
 * livreurs déposent et retirent les colis.
 *   · nom, adresse, ville → commune → quartier (référentiel de la Guinée),
 *     repère : affichés aux clients et sur la carte des points relais ;
 *   · position GPS : « Ma position actuelle » ou toucher la carte (Android) —
 *     place le relais sur la carte et sert aux distances ; effaçable ;
 *   · téléphone PUBLIC du relais (≠ téléphone personnel du profil) ;
 *   · capacité, type de local, accès : affichés sur le profil public. Aucune
 *     valeur par défaut inventée (le site pré-remplit « Jusqu'à 50 colis ») ;
 *   · équipements (PMR, parking…) : enregistrés comme sur le site, mais pas
 *     encore affichés nulle part — l'écran le dit.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { SelectField } from '@/components/select-field';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { MapView, type MapState } from '@/features/location/MapView';
import { FormCard, Hint, Input, LocationFields, SaveButton, SettingsShell, toast, toastError, ToggleRow, useUnsavedGuard } from '@/features/settings-kit';
import { useTheme } from '@/hooks/use-theme';

import { DEPOT_ACCES, DEPOT_CAPACITES, DEPOT_EQUIPEMENTS, DEPOT_TYPES_LOCAL, type CorrespondantSettings } from '../api';
import { useCorrespondantSettings, useSectionSave } from '../hooks';

const CONAKRY = { lat: 9.5092, lng: -13.7122 };

type Form = {
  nom: string;
  adresse: string;
  ville: string;
  commune: string;
  quartier: string;
  repere: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  capacite: string;
  typeLocal: string;
  acces: string;
  equip: Record<string, boolean>;
};

const toForm = (d: CorrespondantSettings): Form => ({
  nom: d.depotNom ?? '',
  adresse: d.depotAdresse ?? '',
  ville: d.depotVille ?? '',
  commune: d.depotCommune ?? '',
  quartier: d.depotQuartier ?? '',
  repere: d.depotRepere ?? '',
  phone: (d.depotPhone ?? '').replace(/^(\+|00)224\s?/, ''),
  lat: d.depotLatitude ?? null,
  lng: d.depotLongitude ?? null,
  capacite: d.depotCapacite ?? '',
  typeLocal: d.depotTypeLocal ?? '',
  acces: d.depotAcces ?? '',
  equip: Object.fromEntries(DEPOT_EQUIPEMENTS.map((e) => [e.key, !!d.depotAccessOptions?.[e.key]])),
});
const same = (a: Form, b: Form) => JSON.stringify(a) === JSON.stringify(b);
/** Liste du site + valeur actuelle si elle n'y figure pas (jamais perdue). */
const optionsOf = (list: string[], current: string) => [...list, ...(current && !list.includes(current) ? [current] : [])].map((v) => ({ value: v, label: v }));

export default function DepotScreen() {
  const q = useCorrespondantSettings();
  return (
    <SettingsShell<CorrespondantSettings> query={q} title="Point de dépôt" icon="storefront-outline" subtitle="Le local où boutiques et livreurs déposent et retirent les colis — affiché aux clients.">
      {(d) => <Content d={d} />}
    </SettingsShell>
  );
}

function Content({ d }: { d: CorrespondantSettings }) {
  const theme = useTheme();
  const save = useSectionSave();
  const [form, setForm] = useState<Form>(() => toForm(d));
  const [base, setBase] = useState<Form>(() => toForm(d));
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});

  const fromServer = toForm(d);
  if (!same(fromServer, base)) {
    setBase(fromServer);
    if (same(form, base)) setForm(fromServer);
  }
  const dirty = !same(form, base);
  useUnsavedGuard(dirty && !saving);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const hasGps = form.lat != null && form.lng != null;
  const mapState = useMemo<MapState>(
    () => ({
      actors: hasGps ? [{ key: 'depot', role: 'correspondent', lat: form.lat!, lng: form.lng!, approx: false, precision: 'exact', emoji: '🏪' }] : [],
      selectedKey: null,
      me: null,
      place: null,
      activePlace: null,
      radius: null,
      route: null,
      style: 'plan',
      labelsOn: true,
    }),
    [hasGps, form.lat, form.lng],
  );

  const locateMe = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return toast('Autorisez la localisation pour utiliser votre position.', 'danger');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setForm((f) => ({ ...f, lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) }));
      toast('Position du dépôt placée — pensez à enregistrer', 'info');
    } catch {
      toast('Position introuvable. Réessayez à l’extérieur ou touchez la carte.', 'danger');
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    const errs: Partial<Record<keyof Form, string>> = {};
    if (!form.nom.trim()) errs.nom = 'Le nom du point de dépôt est obligatoire.';
    if (!form.adresse.trim()) errs.adresse = 'L’adresse est obligatoire.';
    if (!form.ville.trim()) errs.ville = 'Choisissez la ville du dépôt.';
    if (!form.quartier.trim()) errs.quartier = 'Choisissez le quartier du dépôt.';
    const digits = form.phone.replace(/\D/g, '');
    if (form.phone.trim() && (digits.length < 8 || digits.length > 9)) errs.phone = 'Numéro invalide : 8 ou 9 chiffres après +224.';
    setErrors(errs);
    if (Object.keys(errs).length) return toast(Object.values(errs)[0] as string, 'danger');
    setSaving(true);
    try {
      await save('depot', {
        depotNom: form.nom.trim(),
        depotAdresse: form.adresse.trim(),
        depotVille: form.ville,
        depotCommune: form.commune,
        depotQuartier: form.quartier,
        depotRepere: form.repere.trim(),
        depotPhone: digits ? `+224 ${digits}` : '',
        depotLatitude: form.lat,
        depotLongitude: form.lng,
        depotCapacite: form.capacite,
        depotTypeLocal: form.typeLocal,
        depotAcces: form.acces,
        /* Les autres clés éventuelles enregistrées par le site sont conservées */
        depotAccessOptions: { ...(d.depotAccessOptions ?? {}), ...form.equip },
      });
      setBase(form);
      toast('Point de dépôt sauvegardé');
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FormCard title="Localisation du dépôt" icon="location-outline">
        <Input
          label="Nom du point de dépôt"
          value={form.nom}
          onChangeText={(v) => set('nom', v)}
          placeholder="Ex. Relais Shoneya Kaloum"
          maxLength={255}
          error={errors.nom}
          hint={errors.nom ? undefined : 'Affiché dans les informations de livraison des clients.'}
        />
        <Input label="Adresse complète" value={form.adresse} onChangeText={(v) => set('adresse', v)} placeholder="Rue, numéro, bâtiment…" maxLength={500} error={errors.adresse} />
        <LocationFields
          villeLabel="Ville du dépôt"
          value={{ ville: form.ville, commune: form.commune, quartier: form.quartier }}
          onChange={(p) => {
            setForm((f) => ({ ...f, ...p }));
            setErrors((e) => ({ ...e, ville: undefined, quartier: undefined }));
          }}
        />
        {errors.ville || errors.quartier ? (
          <ThemedText type="small" style={styles.err}>
            {errors.ville ?? errors.quartier}
          </ThemedText>
        ) : null}
        <Input label="Repère / indication" value={form.repere} onChangeText={(v) => set('repere', v)} placeholder="Ex. face à la pharmacie, 2e étage" maxLength={500} />
      </FormCard>

      <FormCard title="Position GPS du dépôt" subtitle="Place votre relais sur la carte et sert au calcul des distances." icon="navigate-outline">
        {Platform.OS !== 'web' ? (
          <View style={[styles.map, { borderColor: theme.border }]}>
            <MapView
              initialCenter={hasGps ? { lat: form.lat!, lng: form.lng! } : CONAKRY}
              state={mapState}
              onSelect={() => undefined}
              onTap={(at) => setForm((f) => ({ ...f, lat: Number(at.lat.toFixed(6)), lng: Number(at.lng.toFixed(6)) }))}
            />
          </View>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          {hasGps ? `📍 ${form.lat!.toFixed(5)}, ${form.lng!.toFixed(5)}` : 'Aucune position enregistrée.'}
          {Platform.OS !== 'web' ? ' Touchez la carte pour déplacer l’épingle.' : ''}
        </ThemedText>
        <View style={styles.row}>
          <Pressable
            onPress={() => void locateMe()}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel="Utiliser ma position actuelle"
            style={[styles.chip, { borderColor: theme.border }]}>
            {locating ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="locate-outline" size={16} color={Brand.primary} />}
            <ThemedText type="smallBold">Ma position actuelle</ThemedText>
          </Pressable>
          {hasGps ? (
            <Pressable
              onPress={() => setForm((f) => ({ ...f, lat: null, lng: null }))}
              accessibilityRole="button"
              accessibilityLabel="Effacer la position GPS"
              style={[styles.chip, { borderColor: theme.border }]}>
              <Ionicons name="close-circle-outline" size={16} color={Brand.danger} />
              <ThemedText type="smallBold" style={{ color: Brand.danger }}>
                Effacer
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </FormCard>

      <FormCard title="Contact & capacité" icon="call-outline">
        <Input
          label="Téléphone du dépôt"
          value={form.phone}
          onChangeText={(v) => set('phone', v.replace(/[^\d\s]/g, ''))}
          placeholder="620 00 00 00"
          keyboardType="phone-pad"
          maxLength={14}
          error={errors.phone}
          hint={errors.phone ? undefined : 'Numéro PUBLIC du relais, affiché aux clients (différent de votre téléphone personnel).'}
          left={<ThemedText style={styles.prefix}>🇬🇳 +224</ThemedText>}
        />
        <SelectField
          label="Capacité maximale"
          title="Capacité maximale"
          placeholder="— Choisir —"
          options={optionsOf(DEPOT_CAPACITES, form.capacite)}
          value={form.capacite || null}
          onChange={(v) => set('capacite', v)}
        />
      </FormCard>

      <FormCard title="Conditions d’accès" icon="enter-outline">
        <SelectField
          label="Type de local"
          title="Type de local"
          placeholder="— Choisir —"
          options={optionsOf(DEPOT_TYPES_LOCAL, form.typeLocal)}
          value={form.typeLocal || null}
          onChange={(v) => set('typeLocal', v)}
        />
        <SelectField
          label="Accès sécurisé"
          title="Accès sécurisé"
          placeholder="— Choisir —"
          options={optionsOf(DEPOT_ACCES, form.acces)}
          value={form.acces || null}
          onChange={(v) => set('acces', v)}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Capacité, type de local et accès sont affichés sur votre profil public.
        </ThemedText>
      </FormCard>

      <FormCard title="Équipements" icon="construct-outline">
        <Hint tone="warning" icon="eye-off-outline" text="Enregistrés, mais pas encore affichés sur votre profil ni utilisés par Shoneya." />
        {DEPOT_EQUIPEMENTS.map((e, i) => (
          <ToggleRow key={e.key} first={i === 0} label={e.label} sub={e.sub} value={!!form.equip[e.key]} onChange={(v) => set('equip', { ...form.equip, [e.key]: v })} />
        ))}
      </FormCard>

      <SaveButton label={saving ? 'Sauvegarde…' : 'Sauvegarder le point de dépôt'} onPress={() => void submit()} loading={saving} disabled={!dirty} />
      {!dirty ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Aucune modification à enregistrer.
        </ThemedText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  err: { color: Brand.danger, marginTop: -6 },
  prefix: { fontSize: 14, lineHeight: 19, fontWeight: '800', marginRight: 6 },
  map: { height: 220, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 40 },
});
