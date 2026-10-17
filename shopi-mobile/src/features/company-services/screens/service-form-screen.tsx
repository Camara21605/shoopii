/**
 * Espace entreprise (compte « services ») › Ajouter / Modifier une prestation —
 * équivalent NATIF d'AjouterServicePage.tsx (le site). Même contenu, mêmes
 * règles que le serveur (prestations.service.ts) :
 *   · photos (4 au plus) + 1 vidéo, avec la retouche et le détourage des produits ;
 *   · nom, description, catégorie / sous-catégorie CHOISIES par l'entreprise ;
 *   · tarif : prix fixe, à l'heure ou « sur devis » (+ prix barré) ;
 *   · durée (min – max), lieux : sur place, à domicile (zone, frais de
 *     déplacement), à distance ;
 *   · réservation, délai de réponse, politique d'annulation ;
 *   · « Publier » ou « Brouillon ». Sans photo, le serveur garde la
 *     prestation en brouillon : on le dit clairement.
 * Route : /entreprise/services/nouveau (création) · /entreprise/services/:id (modification).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { Chips } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { FormSection, ProductMedia, SelectField, SwitchRow, TextField, type MediaItem } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import {
  createService,
  DELAYS,
  fetchService,
  fetchServiceCategories,
  POLICIES,
  PRICING,
  updateService,
  type CancellationPolicy,
  type PricingType,
  type ResponseDelay,
  type Service,
} from '../api';

type Form = {
  nom: string;
  description: string;
  categoryId: string;
  subCategoryId: string;
  pricingType: PricingType;
  prix: string;
  prixAncien: string;
  dureeMin: string;
  dureeMax: string;
  surPlace: boolean;
  aDomicile: boolean;
  aDistance: boolean;
  zone: string;
  frais: string;
  reservation: boolean;
  delai: ResponseDelay;
  politique: CancellationPolicy;
};

const EMPTY: Form = {
  nom: '', description: '', categoryId: '', subCategoryId: '', pricingType: 'fixe', prix: '', prixAncien: '',
  dureeMin: '', dureeMax: '', surPlace: true, aDomicile: false, aDistance: false, zone: '', frais: '',
  reservation: true, delai: '24h', politique: 'moderee',
};

const digits = (v: string) => v.replace(/[^\d]/g, '');
const toInt = (v: string) => (v.trim() ? parseInt(digits(v), 10) : undefined);

function fromService(s: Service): Form {
  const n = (v?: number | null) => (v ? String(Math.round(v)) : '');
  return {
    nom: s.nom, description: s.description ?? '', categoryId: s.category?.id ?? '', subCategoryId: s.subCategory?.id ?? '',
    pricingType: s.pricingType, prix: n(s.prix), prixAncien: n(s.prixAncien), dureeMin: n(s.dureeMinMinutes), dureeMax: n(s.dureeMaxMinutes),
    surPlace: s.surPlaceEntreprise, aDomicile: s.aDomicile, aDistance: s.aDistance, zone: s.zoneCouverture ?? '', frais: n(s.fraisDeplacement),
    reservation: s.reservationRequise, delai: s.delaiReponse, politique: s.politiqueAnnulation,
  };
}

const mediaFrom = (s: Service): MediaItem[] =>
  [...s.media]
    .sort((a, b) => a.ordre - b.ordre)
    .map((m, i) => ({ key: `srv-${i}-${m.url}`, type: m.type === 'video' ? 'video' : 'image', preview: m.url, url: m.url, status: 'done' }));

export default function ServiceFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id && id !== 'nouveau' ? id : null;
  const existing = useQuery({ queryKey: qk.company.service(editId ?? ''), queryFn: () => fetchService(editId!), enabled: !!editId });

  if (editId && existing.isPending) {
    return (
      <Shell title="Modifier la prestation">
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      </Shell>
    );
  }
  if (editId && (existing.isError || !existing.data)) {
    return (
      <Shell title="Modifier la prestation">
        <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />
      </Shell>
    );
  }
  return <Editor key={editId ?? 'new'} service={existing.data ?? null} />;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title={title} />
      {children}
    </SafeAreaView>
  );
}

function Editor({ service }: { service: Service | null }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const perms = usePermissions();
  const [f, setF] = useState<Form>(() => (service ? fromService(service) : EMPTY));
  const [media, setMediaState] = useState<MediaItem[]>(() => (service ? mediaFrom(service) : []));
  const [errors, setErrors] = useState<Partial<Record<keyof Form | 'media' | 'lieux', string>>>({});
  const [saving, setSaving] = useState<'public' | 'draft' | null>(null);
  const cats = useQuery({ queryKey: qk.company.serviceCategories, queryFn: fetchServiceCategories });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const setMedia = (fn: (prev: MediaItem[]) => MediaItem[]) => setMediaState(fn);

  /* Une seule catégorie possible : choisie d'office. */
  const categories = useMemo(() => cats.data ?? [], [cats.data]);
  // Une seule catégorie disponible : elle est choisie d'office (dérivé, sans effet).
  const categoryId = f.categoryId || (categories.length === 1 ? categories[0].id : '');
  const subs = categories.find((c) => c.id === categoryId)?.subCategories ?? [];

  const canSave = service ? perms.can('services', 'edit') : perms.can('services', 'create');
  const uploading = media.some((m) => m.status === 'uploading');
  const hasImage = media.some((m) => m.type === 'image' && m.status === 'done' && m.url);

  function validate(): boolean {
    const e: typeof errors = {};
    if (f.nom.trim().length < 3) e.nom = 'Donnez un nom d’au moins 3 caractères.';
    if (!categoryId) e.categoryId = 'Choisissez une catégorie.';
    if (f.pricingType !== 'sur_devis' && !(toInt(f.prix) ?? 0)) e.prix = 'Indiquez un prix (ou choisissez « Sur devis »).';
    const ancien = toInt(f.prixAncien);
    if (ancien && ancien <= (toInt(f.prix) ?? 0)) e.prixAncien = 'Le prix barré doit être plus élevé que le prix.';
    const min = toInt(f.dureeMin);
    const max = toInt(f.dureeMax);
    if (min && max && max < min) e.dureeMax = 'La durée maximale doit être plus longue que la minimale.';
    if (!f.surPlace && !f.aDomicile && !f.aDistance) e.lieux = 'Choisissez au moins un lieu.';
    if (media.some((m) => m.status === 'error')) e.media = 'Une photo n’a pas pu être envoyée : retirez-la ou réessayez.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save(visibilite: 'public' | 'draft') {
    if (!canSave || saving) return;
    if (uploading) return Alert.alert('Envoi en cours', 'Attendez la fin de l’envoi des photos.');
    if (!validate()) return;
    setSaving(visibilite);
    const dto = {
      nom: f.nom.trim(),
      description: f.description.trim() || undefined,
      categoryId,
      subCategoryId: f.subCategoryId || undefined,
      pricingType: f.pricingType,
      prix: f.pricingType !== 'sur_devis' ? toInt(f.prix) : undefined,
      prixAncien: f.pricingType !== 'sur_devis' ? toInt(f.prixAncien) : undefined,
      dureeMinMinutes: toInt(f.dureeMin),
      dureeMaxMinutes: toInt(f.dureeMax),
      surPlaceEntreprise: f.surPlace,
      aDomicile: f.aDomicile,
      aDistance: f.aDistance,
      zoneCouverture: f.aDomicile && f.zone.trim() ? f.zone.trim() : undefined,
      fraisDeplacement: f.aDomicile ? toInt(f.frais) : undefined,
      reservationRequise: f.reservation,
      delaiReponse: f.delai,
      politiqueAnnulation: f.politique,
      visibilite,
      media: media.filter((m) => m.status === 'done' && m.url).map((m, ordre) => ({ url: m.url, type: m.type, ordre })),
    };
    try {
      const res = service ? await updateService(service.id, dto) : await createService(dto);
      void qc.invalidateQueries({ queryKey: qk.company.services });
      if (service) void qc.invalidateQueries({ queryKey: qk.company.service(service.id) });
      const draftForced = visibilite === 'public' && res.visibilite !== 'public';
      Alert.alert(
        draftForced ? 'Enregistrée en brouillon' : visibilite === 'public' ? 'Prestation publiée ✅' : 'Brouillon enregistré',
        draftForced
          ? 'Ajoutez au moins une photo pour la publier : vos clients la verront ensuite dans votre boutique.'
          : visibilite === 'public'
            ? 'Vos clients la voient maintenant dans votre boutique.'
            : 'Vous pourrez la publier quand elle sera prête.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e) {
      Alert.alert('Enregistrement impossible', toUserMessage(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title={service ? 'Modifier la prestation' : 'Nouvelle prestation'} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!canSave && !perms.loading ? (
            <ThemedText type="small" themeColor="textSecondary">
              Votre rôle dans l’équipe ne permet pas d’enregistrer de prestation.
            </ThemedText>
          ) : null}

          <FormSection icon="images-outline" title="Photos" subtitle={hasImage ? 'La première photo est l’image principale.' : 'Au moins une photo pour pouvoir publier.'} error={errors.media}>
            <ProductMedia media={media} setMedia={setMedia} maxImages={4} maxVideos={1} noun="prestation" />
          </FormSection>

          <FormSection icon="create-outline" title="La prestation">
            <TextField label="Nom" required value={f.nom} onChangeText={(v) => set('nom', v)} placeholder="Ex. : Tresses africaines" max={120} error={errors.nom} />
            <TextField label="Description" value={f.description} onChangeText={(v) => set('description', v)} placeholder="Ce qui est inclus, le déroulé, les conseils…" multiline max={5000} />
            {cats.isError ? (
              <ThemedText type="small" style={{ color: Brand.danger }}>
                Catégories indisponibles : {toUserMessage(cats.error)}
              </ThemedText>
            ) : (
              <SelectField
                label="Catégorie"
                required
                value={categoryId}
                options={categories.map((c) => ({ value: c.id, label: c.nom }))}
                onChange={(v) => {
                  set('categoryId', v);
                  set('subCategoryId', '');
                }}
                placeholder={cats.isPending ? 'Chargement…' : 'Choisir'}
                error={errors.categoryId}
              />
            )}
            {subs.length ? (
              <SelectField label="Sous-catégorie" value={f.subCategoryId} options={subs.map((s) => ({ value: s.id, label: s.nom }))} onChange={(v) => set('subCategoryId', v)} placeholder="Choisir (facultatif)" allowEmpty="Aucune" />
            ) : null}
          </FormSection>

          <FormSection icon="cash-outline" title="Tarif">
            <Chips options={PRICING} value={f.pricingType} onChange={(v) => set('pricingType', v)} />
            {f.pricingType !== 'sur_devis' ? (
              <>
                <TextField label={f.pricingType === 'horaire' ? 'Prix par heure' : 'Prix'} required value={f.prix} onChangeText={(v) => set('prix', digits(v))} keyboardType="number-pad" suffix="GNF" error={errors.prix} />
                <TextField label="Prix barré (promotion)" value={f.prixAncien} onChangeText={(v) => set('prixAncien', digits(v))} keyboardType="number-pad" suffix="GNF" hint="Facultatif : ancien prix affiché barré." error={errors.prixAncien} />
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Le client vous contacte pour un devis : aucun prix n’est affiché.
              </ThemedText>
            )}
          </FormSection>

          <FormSection icon="time-outline" title="Durée" subtitle="En minutes — facultatif">
            <View style={styles.row}>
              <View style={styles.flex}>
                <TextField label="Minimum" value={f.dureeMin} onChangeText={(v) => set('dureeMin', digits(v))} keyboardType="number-pad" suffix="min" />
              </View>
              <View style={styles.flex}>
                <TextField label="Maximum" value={f.dureeMax} onChangeText={(v) => set('dureeMax', digits(v))} keyboardType="number-pad" suffix="min" error={errors.dureeMax} />
              </View>
            </View>
          </FormSection>

          <FormSection icon="location-outline" title="Où ?" error={errors.lieux}>
            <SwitchRow icon="storefront-outline" label="Sur place" sub="Dans votre établissement" value={f.surPlace} onChange={(v) => { set('surPlace', v); setErrors((e) => ({ ...e, lieux: undefined })); }} />
            <SwitchRow icon="home-outline" label="À domicile" sub="Vous vous déplacez chez le client" value={f.aDomicile} onChange={(v) => { set('aDomicile', v); setErrors((e) => ({ ...e, lieux: undefined })); }} />
            {f.aDomicile ? (
              <View style={styles.sub}>
                <TextField label="Zone couverte" value={f.zone} onChangeText={(v) => set('zone', v)} placeholder="Ex. : Ratoma, Kaloum" max={255} />
                <TextField label="Frais de déplacement" value={f.frais} onChangeText={(v) => set('frais', digits(v))} keyboardType="number-pad" suffix="GNF" hint="Laissez vide si gratuit." />
              </View>
            ) : null}
            <SwitchRow icon="videocam-outline" label="À distance" sub="Appel, visio…" value={f.aDistance} onChange={(v) => { set('aDistance', v); setErrors((e) => ({ ...e, lieux: undefined })); }} last />
          </FormSection>

          <FormSection icon="calendar-outline" title="Réservation">
            <SwitchRow icon="calendar-outline" label="Sur rendez-vous" sub="Le client réserve avant de venir" value={f.reservation} onChange={(v) => set('reservation', v)} last />
            <ThemedText type="smallBold">Délai de réponse</ThemedText>
            <Chips options={DELAYS} value={f.delai} onChange={(v) => set('delai', v)} />
            <ThemedText type="smallBold">Annulation</ThemedText>
            <Chips options={POLICIES} value={f.politique} onChange={(v) => set('politique', v)} />
          </FormSection>
        </ScrollView>

        <View style={[styles.bar, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          <Pressable onPress={() => void save('draft')} disabled={!canSave || !!saving} accessibilityRole="button" style={[styles.btn, styles.btnDraft, { borderColor: theme.border }, (!canSave || !!saving) && styles.off]}>
            {saving === 'draft' ? <ActivityIndicator color={theme.text} /> : <ThemedText style={styles.btnDraftText}>Brouillon</ThemedText>}
          </Pressable>
          <Pressable onPress={() => void save('public')} disabled={!canSave || !!saving} accessibilityRole="button" style={[styles.btn, styles.btnMain, (!canSave || !!saving) && styles.off]}>
            {saving === 'public' ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
            <ThemedText style={styles.btnMainText}>{service ? 'Enregistrer et publier' : 'Publier'}</ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 40 },
  content: { padding: 16, gap: 14, paddingBottom: 30 },
  row: { flexDirection: 'row', gap: 10 },
  sub: { gap: 10, paddingLeft: 8 },
  bar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  btn: { minHeight: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  btnDraft: { flex: 1, borderWidth: 1.5 },
  btnDraftText: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  btnMain: { flex: 2, backgroundColor: '#1F1F1F' },
  btnMainText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '900' },
  off: { opacity: 0.5 },
});
