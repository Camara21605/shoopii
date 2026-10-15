/**
 * Ajouter (/adresses/nouvelle) ou modifier (/adresses/[id]) une adresse —
 * mêmes champs et mêmes règles que le formulaire du site :
 *   1. Type (domicile, bureau…) et libellé facultatif (100 car.)
 *   2. Ville (obligatoire) → commune → quartier (référentiel de la Guinée) + rue / repère
 *   3. Épingle sur la carte (toucher la carte ou « Ma position »)
 *   4. Pour le livreur : téléphone de contact (+224) et consignes (500 car.)
 *   5. Adresse par défaut (on ne peut pas la « décocher » : il faut en choisir une autre)
 * Quitter avec des changements non enregistrés demande confirmation.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { Input, LocationFields, ToggleRow, useUnsavedGuard } from '@/features/settings-kit';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { confirmAction } from '@/lib/confirm';

import { addressTitle, type Address, type AddressInput, type AddressType } from '../api';
import { MapPin, TypePicker, type Pin } from '../components';
import { useAddressActions, useAddresses } from '../hooks';

type Form = Omit<AddressInput, 'latitude' | 'longitude'> & { pin: Pin };
type Errors = Partial<Record<'ville' | 'telephone', string>>;

/** Le serveur garde « +224620000000 » ; le champ montre les 9 chiffres locaux. */
const localDigits = (p?: string | null) => {
  const d = (p ?? '').replace(/\D/g, '');
  return d.startsWith('224') && d.length > 9 ? d.slice(3) : d;
};
const TYPES: AddressType[] = ['domicile', 'bureau', 'boutique', 'entrepot', 'relais', 'autre'];

function toForm(a?: Address, first?: boolean): Form {
  return {
    typeAdresse: TYPES.includes(a?.typeAdresse as AddressType) ? (a!.typeAdresse as AddressType) : 'domicile',
    libelle: a?.libelle ?? '',
    rue: a?.rue ?? '',
    quartier: a?.quartier ?? '',
    commune: a?.commune ?? '',
    ville: a?.ville ?? '',
    instructions: a?.instructions ?? '',
    telephone: localDigits(a?.telephone),
    pin: a?.latitude != null && a?.longitude != null ? { lat: a.latitude, lng: a.longitude } : null,
    estDefaut: a ? a.estDefaut : !!first,
  };
}

export default function AddressFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useAddresses();
  const editing = q.data?.find((a) => a.id === id);
  const theme = useTheme();

  if (id && q.isPending) {
    return (
      <Shell title="Modifier l’adresse">
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      </Shell>
    );
  }
  if (id && (q.error || !editing)) {
    return (
      <Shell title="Modifier l’adresse">
        {q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : (
          <ThemedText themeColor="textSecondary" style={[styles.loader, { textAlign: 'center', color: theme.textSecondary }]}>
            Cette adresse n’existe plus.
          </ThemedText>
        )}
      </Shell>
    );
  }
  /* key : le formulaire repart des bonnes valeurs si l'on passe d'une adresse à l'autre */
  return <FormBody key={id ?? 'new'} address={editing} isFirst={!id && (q.data?.length ?? 0) === 0} />;
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title={title} />
      {children}
    </SafeAreaView>
  );
}

function FormBody({ address, isFirst }: { address?: Address; isFirst: boolean }) {
  const theme = useTheme();
  const snack = useSnack();
  const { save, remove } = useAddressActions();
  const [base] = useState(() => toForm(address, isFirst));
  const [form, setForm] = useState(base);
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(base), [form, base]);
  useUnsavedGuard(dirty && !done && !save.isPending);
  useEffect(() => {
    if (done) router.back();
  }, [done]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function submit() {
    const errs: Errors = {};
    if (!form.ville.trim()) errs.ville = 'Choisissez la ville : elle est obligatoire.';
    if (form.telephone && form.telephone.length !== 9) errs.telephone = 'Le numéro guinéen compte 9 chiffres (ex. 620 00 00 00).';
    setErrors(errs);
    if (Object.keys(errs).length) return snack.show(Object.values(errs)[0]!, true);

    const { pin, ...rest } = form;
    const body: AddressInput = {
      ...rest,
      libelle: rest.libelle.trim(),
      rue: rest.rue.trim(),
      instructions: rest.instructions.trim(),
      telephone: rest.telephone ? `+224${rest.telephone}` : '',
      latitude: pin?.lat ?? null,
      longitude: pin?.lng ?? null,
    };
    save.mutate(
      { id: address?.id, body },
      {
        onSuccess: () => setDone(true),
        onError: (e) => snack.show(toUserMessage(e), true),
      },
    );
  }

  async function onDelete() {
    if (!address) return;
    const ok = await confirmAction('Supprimer cette adresse ?', `« ${addressTitle(address)} » sera retirée de vos adresses.`, 'Supprimer', true);
    if (!ok) return;
    setDone(true); // la suppression est optimiste : la liste est déjà à jour au retour
    remove.mutate(address.id);
  }

  const lockedDefault = !!address?.estDefaut || isFirst;

  return (
    <Shell title={address ? 'Modifier l’adresse' : 'Nouvelle adresse'}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Block n={1} title="Type d’adresse" sub="Pour la reconnaître d’un coup d’œil.">
            <TypePicker value={form.typeAdresse} onChange={(t) => set('typeAdresse', t)} />
            <Input
              label="Nom de l’adresse (facultatif)"
              value={form.libelle}
              onChangeText={(v) => set('libelle', v)}
              placeholder="Ex. Maison, Bureau Kaloum, Chez maman"
              counter={100}
            />
          </Block>

          <Block n={2} title="Où se trouve-t-elle ?" sub="La ville est obligatoire ; le quartier aide le livreur.">
            <LocationFields
              villeLabel="Ville *"
              value={{ ville: form.ville, commune: form.commune, quartier: form.quartier }}
              onChange={(p) => {
                setForm((f) => ({ ...f, ville: p.ville, commune: p.commune, quartier: p.quartier }));
                if (errors.ville) setErrors((e) => ({ ...e, ville: undefined }));
              }}
            />
            {errors.ville ? <FieldError text={errors.ville} /> : null}
            <Input
              label="Rue, numéro ou repère"
              value={form.rue}
              onChangeText={(v) => set('rue', v)}
              placeholder="Ex. Rue KA-020, maison bleue après la mosquée"
              maxLength={255}
            />
          </Block>

          <Block n={3} title="Épingler sur la carte" sub="Le livreur arrive directement devant votre porte.">
            <MapPin pin={form.pin} onChange={(p) => set('pin', p)} place={{ ville: form.ville, commune: form.commune, quartier: form.quartier }} onMessage={snack.show} />
          </Block>

          <Block n={4} title="Pour le livreur" sub="Facultatif.">
            <Input
              label="Téléphone de contact"
              value={form.telephone}
              onChangeText={(v) => set('telephone', v.replace(/\D/g, '').slice(0, 9))}
              keyboardType="phone-pad"
              placeholder="620 00 00 00"
              error={errors.telephone}
              left={<ThemedText style={styles.dial}>🇬🇳 +224</ThemedText>}
              hint="Si quelqu’un d’autre reçoit les colis à cette adresse."
            />
            <Input
              label="Consignes de livraison"
              value={form.instructions}
              onChangeText={(v) => set('instructions', v)}
              placeholder="Ex. Appeler en arrivant, portail vert, 2e étage"
              counter={500}
              multiline
              style={styles.multiline}
            />
          </Block>

          <View style={[styles.defaultCard, { borderColor: theme.border }]}>
            <ToggleRow
              first
              icon="star-outline"
              label="Adresse par défaut"
              sub={
                isFirst
                  ? 'Votre première adresse devient automatiquement l’adresse par défaut.'
                  : address?.estDefaut
                    ? 'Pour changer, choisissez une autre adresse « par défaut » dans la liste.'
                    : 'Proposée en premier à chaque commande.'
              }
              value={form.estDefaut}
              onChange={(v) => set('estDefaut', v)}
              disabled={lockedDefault}
            />
          </View>

          {address ? (
            <Pressable onPress={() => void onDelete()} accessibilityRole="button" style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
              <Ionicons name="trash-outline" size={17} color={Brand.danger} />
              <ThemedText style={styles.deleteText}>Supprimer cette adresse</ThemedText>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          <PrimaryButton title={address ? 'Enregistrer les modifications' : 'Enregistrer l’adresse'} onPress={submit} loading={save.isPending} disabled={!!address && !dirty} pill />
        </View>
      </KeyboardAvoidingView>
      <Snack msg={snack.msg} bottom={92} />
    </Shell>
  );
}

function Block({ n, title, sub, children }: { n: number; title: string; sub?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.block, { borderColor: theme.border }]}>
      <View style={styles.blockHead}>
        <View style={styles.step}>
          <ThemedText style={styles.stepText}>{n}</ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.blockTitle}>{title}</ThemedText>
          {sub ? (
            <ThemedText type="small" themeColor="textSecondary">
              {sub}
            </ThemedText>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function FieldError({ text }: { text: string }) {
  return (
    <ThemedText type="small" style={styles.error} accessibilityRole="alert">
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  loader: { marginTop: 60 },
  content: { padding: Spacing.three, gap: 14, paddingBottom: 120 },
  block: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  blockHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  step: { width: 26, height: 26, borderRadius: 13, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepText: { color: '#fff', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  blockTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  dial: { fontSize: 14, lineHeight: 19, fontWeight: '700', paddingLeft: 12 },
  multiline: { minHeight: 84, textAlignVertical: 'top', paddingTop: 12 },
  error: { color: Brand.danger, marginTop: -6 },
  defaultCard: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, marginTop: 4 },
  deleteText: { color: Brand.danger, fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.three, paddingTop: 10, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
