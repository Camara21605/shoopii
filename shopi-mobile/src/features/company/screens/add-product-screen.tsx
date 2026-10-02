/**
 * Espace entreprise › Ajouter un produit — version native de
 * /dashboard/entreprise/ajouter (AjouterPage.tsx du site), même API
 * (POST /produits) et mêmes trois modes :
 *   · Rapide   : photo, nom, prix, stock, catégorie — publié en une minute
 *   · Détaillé : fiche complète (description, caractéristiques, variantes,
 *                livraison, garanties, référencement, stories)
 *   · En gros  : paliers de prix par quantité
 *
 * TOUT est contrôlé avant l'envoi (voir product-form.ts) : erreurs affichées
 * sous chaque champ, résumé en haut, défilement jusqu'à la première erreur ;
 * le serveur garde ses propres contrôles et ses messages sont affichés tels quels.
 * Accès : compte « produits » et permission products.create (propriétaire ou collaborateur).
 * La saisie est gardée en brouillon sur le téléphone (rien n'est perdu si
 * l'application se ferme) et restaurée au retour.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import { router, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { openProduct } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { FormSection } from '../components/product-form-ui';
import { ProductMedia } from '../components/product-media';
import {
  ComplementairesFields, GarantiesFields, GrosFields, InfosFields, LivraisonFields, OrganisationFields,
  RevenusFields, SeoFields, SpecsFields, StoriesFields, VariantesFields, type SetField,
} from '../components/product-sections';
import { useCompanyIdentity, usePermissions } from '../hooks';
import { checkSlug, createProduct, fetchCommission, fetchProductCategories, fetchShopDefaults } from '../product-api';
import {
  INITIAL_FORM, completeness, normalizeSlug, parseIntInput, sectionOfError, sectionsFor, toDto, validateProduct,
  type MediaItem, type Mode, type ProductForm, type SectionId,
} from '../product-form';

const MODES: { key: Mode; label: string; sub: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'rapide', label: 'Rapide', sub: 'L’essentiel', icon: 'flash-outline' },
  { key: 'detaille', label: 'Détaillé', sub: 'Fiche complète', icon: 'document-text-outline' },
  { key: 'gros', label: 'En gros', sub: 'Prix par quantité', icon: 'cube-outline' },
];

/* ── Brouillon local (un par compte) ─────────────────────────────────── */

type Draft = { form: ProductForm; mode: Mode; media: MediaItem[] };
const draftFile = (uid: string) => new File(Paths.document, `product-draft-${uid}.json`);

function readDraft(uid: string | undefined): Draft | null {
  if (!uid) return null;
  try {
    const f = draftFile(uid);
    if (!f.exists) return null;
    const d = JSON.parse(f.textSync()) as Draft;
    /* Seuls les médias déjà envoyés survivent (un envoi interrompu est perdu). */
    return d?.form ? { form: { ...INITIAL_FORM, ...d.form }, mode: d.mode ?? 'rapide', media: (d.media ?? []).filter((m) => m.status === 'done' && m.url) } : null;
  } catch {
    return null;
  }
}
function writeDraft(uid: string, d: Draft) {
  try { draftFile(uid).write(JSON.stringify(d)); } catch { /* stockage indisponible : on continue sans brouillon */ }
}
function clearDraft(uid: string | undefined) {
  if (!uid) return;
  try { const f = draftFile(uid); if (f.exists) f.delete(); } catch { /* rien */ }
}
const meaningful = (form: ProductForm, media: MediaItem[]) => !!(form.nom.trim() || form.prix || media.length);

/** Valeur différée (anti-rebond) — pour ne pas interroger le serveur à chaque touche. */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function AddProductScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const navigation = useNavigation();
  const uid = useSession((s) => s.user?.id);
  const identity = useCompanyIdentity();
  const perms = usePermissions();

  const [restored] = useState(() => readDraft(uid));
  const [form, setForm] = useState<ProductForm>(restored?.form ?? INITIAL_FORM);
  const [mode, setMode] = useState<Mode>(restored?.mode ?? 'rapide');
  const [media, setMedia] = useState<MediaItem[]>(restored?.media ?? []);
  const [draftBanner, setDraftBanner] = useState(!!restored && meaningful(restored.form, restored.media));
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string[] | null>(null);
  const [saving, setSaving] = useState<null | 'publish' | 'draft'>(null);
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const sectionY = useRef<Partial<Record<SectionId | 'top', number>>>({});
  const leaving = useRef(false);
  /* Produit tout juste enregistré : le brouillon en attente ne doit pas être réécrit. */
  const justSaved = useRef(false);
  const [attempt, setAttempt] = useState<'publish' | 'draft'>('publish');

  const set: SetField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  /* ── Données serveur ── */
  const categories = useQuery({ queryKey: qk.companyProduct.categories, queryFn: fetchProductCategories, staleTime: 10 * 60_000 });
  const defaults = useQuery({ queryKey: qk.companyProduct.shopDefaults, queryFn: fetchShopDefaults, staleTime: 10 * 60_000 });
  const autoPublishOff = defaults.data?.autoPublish === false;

  /* Valeurs de départ venues de la boutique (une seule fois, jamais par-dessus un brouillon). */
  const [appliedDefaults, setAppliedDefaults] = useState(!!restored);
  if (!appliedDefaults && defaults.data) {
    setAppliedDefaults(true);
    setForm((f) => ({
      ...f,
      visibilite: defaults.data.autoPublish === false ? 'draft' : f.visibilite,
      livraisonStandard: defaults.data.livraisonStandard ?? f.livraisonStandard,
      livraisonLivreur: defaults.data.livraisonShopi ?? f.livraisonLivreur,
      livraisonCorrespondant: defaults.data.livraisonCorresp ?? f.livraisonCorrespondant,
    }));
  }
  /* Une seule catégorie possible : choisie d'office. */
  const cats = categories.data ?? [];
  if (!form.categoryId && cats.length === 1) set('categoryId', cats[0].id);

  const prixNum = parseIntInput(form.prix);
  const prixOk = prixNum && !Number.isNaN(prixNum) ? prixNum : 0;
  const prixDebounced = useDebounced(prixOk, 600);
  const commission = useQuery({
    queryKey: qk.companyProduct.commission(prixDebounced || null),
    queryFn: ({ signal }) => fetchCommission(prixDebounced || null, signal),
    staleTime: 5 * 60_000,
  });

  const slugTyped = mode === 'detaille' && form.urlSlug.trim() ? normalizeSlug(form.urlSlug) : '';
  const slugDebounced = useDebounced(slugTyped, 500);
  const slug = useQuery({
    queryKey: qk.companyProduct.slug(slugDebounced),
    queryFn: ({ signal }) => checkSlug(slugDebounced, signal),
    enabled: !!slugDebounced,
    staleTime: 30_000,
  });
  const slugState: 'idle' | 'checking' | 'free' | 'taken' = !slugTyped ? 'idle'
    : slugTyped !== slugDebounced || slug.isFetching ? 'checking'
    : slug.data ? (slug.data.available ? 'free' : 'taken') : 'idle';

  /* ── Brouillon automatique ── */
  useEffect(() => {
    if (!uid) return;
    const t = setTimeout(() => {
      if (!justSaved.current && meaningful(form, media)) writeDraft(uid, { form, mode, media });
    }, 700);
    return () => clearTimeout(t);
  }, [uid, form, mode, media]);

  /* ── Quitter sans perdre la saisie ── */
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (leaving.current || !meaningful(form, media)) return;
      e.preventDefault();
      const uploading = media.some((m) => m.status === 'uploading');
      Alert.alert(
        'Quitter la fiche ?',
        uploading
          ? 'Un média est en cours d’envoi et sera perdu. Le reste de votre saisie est gardé sur ce téléphone.'
          : 'Votre saisie est gardée sur ce téléphone : vous la retrouverez en revenant.',
        [
          { text: 'Rester', style: 'cancel' },
          { text: 'Tout effacer', style: 'destructive', onPress: () => { clearDraft(uid); leaving.current = true; navigation.dispatch(e.data.action); } },
          { text: 'Quitter', onPress: () => { leaving.current = true; navigation.dispatch(e.data.action); } },
        ],
      );
    });
  }, [navigation, form, media, uid]);

  /* ── Contrôles ── */
  const validationFor = (asDraft: boolean) => validateProduct(form, media, mode, { categories: cats, asDraft, slugTaken: slugState === 'taken' });
  const live = validationFor(attempt === 'draft');
  const err = (key: string) => (showErrors ? live.errors[key] : undefined);
  const errorCount = Object.keys(live.errors).length;
  const visible = sectionsFor(mode);
  const has = (s: SectionId) => visible.includes(s);

  function scrollToSection(s: SectionId | 'top') {
    const y = sectionY.current[s];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }
  function recordY(s: SectionId | 'top', y: number) { sectionY.current[s] = y; }

  function resetForAnother() {
    justSaved.current = false;
    setForm((f) => ({
      ...INITIAL_FORM,
      categoryId: f.categoryId, visibilite: f.visibilite, langue: f.langue, paysOrigine: f.paysOrigine,
      livraisonStandard: f.livraisonStandard, livraisonLivreur: f.livraisonLivreur, livraisonCorrespondant: f.livraisonCorrespondant,
      delaiLivraison: f.delaiLivraison,
    }));
    setMedia([]);
    setShowErrors(false);
    setServerError(null);
    scrollToSection('top');
  }

  async function submit(asDraft: boolean) {
    if (saving) return;
    setServerError(null);
    setAttempt(asDraft ? 'draft' : 'publish');
    const v = validationFor(asDraft);
    const keys = Object.keys(v.errors);
    if (keys.length) {
      setShowErrors(true);
      const first = visible.find((s) => keys.some((k) => sectionOfError(k) === s)) ?? 'top';
      scrollToSection(first);
      return;
    }
    if (!asDraft && v.warnings.length) {
      const ok = await new Promise<boolean>((resolve) =>
        Alert.alert('Vérifiez avant de publier', v.warnings.map((w) => `• ${w}`).join('\n'), [
          { text: 'Corriger', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Publier quand même', onPress: () => resolve(true) },
        ]));
      if (!ok) return;
    }

    setSaving(asDraft ? 'draft' : 'publish');
    try {
      const created = await createProduct(toDto(form, media, mode, asDraft));
      justSaved.current = true;
      clearDraft(uid);
      setDraftBanner(false);
      void qc.invalidateQueries({ queryKey: qk.company.all });
      void qc.invalidateQueries({ queryKey: qk.shop.all });
      void qc.invalidateQueries({ queryKey: qk.products.all });
      const published = !asDraft && created.visibilite !== 'draft';
      Alert.alert(
        published ? 'Produit publié ✅' : 'Brouillon enregistré 💾',
        published ? `« ${form.nom.trim()} » est en ligne dans votre boutique.` : `« ${form.nom.trim()} » est enregistré, invisible des clients pour l’instant.`,
        [
          { text: 'Ajouter un autre', onPress: resetForAnother },
          ...(published ? [{ text: 'Voir', onPress: () => { leaving.current = true; router.back(); openProduct(created.id); } }] : []),
          { text: 'Terminer', style: 'cancel' as const, onPress: () => { leaving.current = true; router.back(); } },
        ],
      );
    } catch (error) {
      const data = error instanceof ApiError ? (error.data as { message?: unknown } | undefined) : undefined;
      const list = Array.isArray(data?.message) ? (data.message as string[]) : [toUserMessage(error)];
      setServerError(error instanceof ApiError && error.isForbidden && list[0] === 'La requête a échoué.' ? ['Vous n’avez pas le droit d’ajouter des produits.'] : list);
      scrollToSection('top');
    } finally {
      setSaving(null);
    }
  }

  /* ── Accès ── */
  const blocked = identity.data?.businessModel === 'services'
    ? { icon: 'construct-outline' as const, title: 'Compte prestataire de services', text: 'Votre boutique est enregistrée pour proposer des services : l’ajout de produits n’est pas disponible.' }
    : !perms.loading && !perms.can('products', 'create')
      ? { icon: 'lock-closed-outline' as const, title: 'Accès refusé', text: 'Votre rôle dans l’équipe ne permet pas d’ajouter des produits. Demandez l’accès au propriétaire de la boutique.' }
      : null;

  const header = (
    <View style={[styles.header, { borderBottomColor: theme.border }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} style={styles.back}>
        <Ionicons name="arrow-back" size={24} color={theme.text} />
      </Pressable>
      <View style={styles.flex}>
        <ThemedText style={styles.title} accessibilityRole="header">Ajouter un produit</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{identity.data?.companyName ?? 'Ma boutique'}</ThemedText>
      </View>
    </View>
  );

  if (blocked || perms.loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        {header}
        {perms.loading ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : (
          <View style={styles.blocked}>
            <View style={[styles.blockedIco, { backgroundColor: theme.backgroundSelected }]}><Ionicons name={blocked!.icon} size={34} color={Brand.primary} /></View>
            <ThemedText style={styles.blockedTitle}>{blocked!.title}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>{blocked!.text}</ThemedText>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const imageCount = media.filter((m) => m.type === 'image' && m.status === 'done').length;
  const uploading = media.some((m) => m.status === 'uploading');
  const score = completeness(form, media);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {header}

      <KeyboardAwareScrollView ref={scrollRef} bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View onLayout={(e) => recordY('top', e.nativeEvent.layout.y)} style={styles.modes}>
          {MODES.map((m) => {
            const on = mode === m.key;
            return (
              <Pressable key={m.key} onPress={() => { setMode(m.key); if (m.key === 'gros') set('venteEnGros', true); }}
                accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={[styles.mode, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? `${Brand.primary}0D` : theme.background }]}>
                <Ionicons name={m.icon} size={20} color={on ? Brand.primary : theme.textSecondary} />
                <ThemedText style={[styles.modeLabel, on && { color: Brand.primary }]}>{m.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{m.sub}</ThemedText>
              </Pressable>
            );
          })}
        </View>

        {draftBanner ? (
          <View style={[styles.banner, { backgroundColor: theme.backgroundSelected }]}>
            <Ionicons name="document-text-outline" size={20} color={Brand.primary} />
            <ThemedText type="small" style={styles.flex}>Saisie précédente restaurée.</ThemedText>
            <Pressable onPress={() => { clearDraft(uid); setDraftBanner(false); setForm(INITIAL_FORM); setMedia([]); setShowErrors(false); setAppliedDefaults(false); }} hitSlop={8} accessibilityRole="button">
              <ThemedText type="smallBold" style={{ color: Brand.danger }}>Recommencer</ThemedText>
            </Pressable>
            <Pressable onPress={() => setDraftBanner(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer">
              <Ionicons name="close" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        ) : null}

        {serverError ? (
          <View style={[styles.alert, styles.alertDanger]} accessibilityRole="alert">
            <Ionicons name="close-circle" size={20} color={Brand.danger} />
            <View style={styles.flex}>
              <ThemedText type="smallBold" style={{ color: Brand.danger }}>Le produit n’a pas été enregistré</ThemedText>
              {serverError.map((m) => <ThemedText key={m} type="small" style={{ color: Brand.danger }}>• {m}</ThemedText>)}
            </View>
          </View>
        ) : null}

        {showErrors && errorCount ? (
          <View style={[styles.alert, styles.alertDanger]} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={20} color={Brand.danger} />
            <View style={styles.flex}>
              <ThemedText type="smallBold" style={{ color: Brand.danger }}>
                {errorCount === 1 ? '1 point à corriger' : `${errorCount} points à corriger`}
              </ThemedText>
              {Object.entries(live.errors).slice(0, 5).map(([k, m]) => (
                <Pressable key={k} onPress={() => scrollToSection(sectionOfError(k))} accessibilityRole="link">
                  <ThemedText type="small" style={styles.alertLink}>• {m}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {has('medias') ? (
          <FormSection icon="images-outline" title="Photos et vidéo" subtitle="4 photos + 1 vidéo · la 1re est la principale" onLayout={(e) => recordY('medias', e.nativeEvent.layout.y)}>
            <ProductMedia media={media} setMedia={setMedia} error={err('media')} />
          </FormSection>
        ) : null}

        <FormSection icon="create-outline" title="Informations" onLayout={(e) => recordY('infos', e.nativeEvent.layout.y)}>
          <InfosFields form={form} set={set} err={err} mode={mode} />
        </FormSection>

        {has('gros') && mode === 'gros' ? (
          <FormSection icon="cube-outline" title="Vente en gros" subtitle="Prix dégressifs par quantité" onLayout={(e) => recordY('gros', e.nativeEvent.layout.y)}>
            <GrosFields form={form} set={set} err={err} forced />
          </FormSection>
        ) : null}

        <FormSection icon="pricetags-outline" title="Organisation" subtitle="Catégorie et visibilité" onLayout={(e) => recordY('organisation', e.nativeEvent.layout.y)}>
          <OrganisationFields form={form} set={set} err={err} mode={mode} categories={cats}
            catState={categories.isPending ? 'loading' : categories.isError ? 'error' : 'ok'} onRetryCats={() => void categories.refetch()}
            autoPublishOff={autoPublishOff} />
        </FormSection>

        {has('complementaires') ? (
          <FormSection icon="information-circle-outline" title="Informations complémentaires" subtitle="État, garantie, retour, origine, dimensions" onLayout={(e) => recordY('complementaires', e.nativeEvent.layout.y)}>
            <ComplementairesFields form={form} set={set} err={err} />
          </FormSection>
        ) : null}

        {has('specs') ? (
          <FormSection icon="list-outline" title="Caractéristiques" subtitle="Tableau affiché sur la fiche" onLayout={(e) => recordY('specs', e.nativeEvent.layout.y)}>
            <SpecsFields form={form} set={set} err={err} />
          </FormSection>
        ) : null}

        {has('variantes') ? (
          <FormSection icon="color-palette-outline" title="Variantes" onLayout={(e) => recordY('variantes', e.nativeEvent.layout.y)}
            right={<SwitchInline value={form.variantesOn} onChange={(v) => set('variantesOn', v)} label="Variantes" />}>
            <VariantesFields form={form} set={set} err={err} />
          </FormSection>
        ) : null}

        {has('gros') && mode === 'detaille' ? (
          <FormSection icon="cube-outline" title="Vente en gros" onLayout={(e) => recordY('gros', e.nativeEvent.layout.y)}
            right={<SwitchInline value={form.venteEnGros} onChange={(v) => set('venteEnGros', v)} label="Vente en gros" />}>
            <GrosFields form={form} set={set} err={err} forced={false} />
          </FormSection>
        ) : null}

        {has('livraison') ? (
          <FormSection icon="car-outline" title="Livraison" onLayout={(e) => recordY('livraison', e.nativeEvent.layout.y)}>
            <LivraisonFields form={form} set={set} err={err} />
          </FormSection>
        ) : null}

        {has('garanties') ? (
          <FormSection icon="shield-checkmark-outline" title="Garanties affichées" subtitle="Rassurent le client sur la fiche" onLayout={(e) => recordY('garanties', e.nativeEvent.layout.y)}>
            <GarantiesFields form={form} set={set} />
          </FormSection>
        ) : null}

        {has('seo') ? (
          <FormSection icon="search-outline" title="Référencement (Google)" onLayout={(e) => recordY('seo', e.nativeEvent.layout.y)}>
            <SeoFields form={form} set={set} err={err} slugState={slugState} score={score} />
          </FormSection>
        ) : null}

        {has('stories') ? (
          <FormSection icon="play-circle-outline" title="Stories" onLayout={(e) => recordY('stories', e.nativeEvent.layout.y)}
            right={<SwitchInline value={form.storiesOn} onChange={(v) => set('storiesOn', v)} label="Stories" />}>
            <StoriesFields form={form} set={set} err={err} imageCount={imageCount} />
          </FormSection>
        ) : null}

        <FormSection icon="calculator-outline" title="Aperçu des revenus" subtitle="Par unité vendue">
          <RevenusFields prix={prixOk} pct={commission.data?.percentage ?? null}
            commission={prixOk && prixOk === prixDebounced ? (commission.data?.commissionAmount ?? null) : null}
            loading={commission.isFetching} />
        </FormSection>

        {mode === 'rapide' ? (
          <Pressable onPress={() => setMode('detaille')} accessibilityRole="button" style={styles.more}>
            <Ionicons name="add-circle-outline" size={18} color={Brand.primary} />
            <ThemedText type="smallBold" style={{ color: Brand.primary }}>Plus d’options (description, variantes, livraison…)</ThemedText>
          </Pressable>
        ) : null}
      </KeyboardAwareScrollView>

      {/* ── Barre d'actions ── */}
      <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
        <Pressable onPress={() => void submit(true)} disabled={!!saving} accessibilityRole="button"
          style={[styles.btn, styles.btnGhost, { borderColor: theme.border }, !!saving && styles.off]}>
          {saving === 'draft' ? <ActivityIndicator color={Brand.primary} /> : <Ionicons name="save-outline" size={18} color={Brand.primary} />}
          <ThemedText type="smallBold" style={{ color: Brand.primary }}>Brouillon</ThemedText>
        </Pressable>
        <Pressable onPress={() => void submit(false)} disabled={!!saving} accessibilityRole="button"
          style={[styles.btn, styles.btnMain, !!saving && styles.off]}>
          {saving === 'publish' ? <ActivityIndicator color="#fff" /> : <Ionicons name={uploading ? 'cloud-upload-outline' : 'checkmark-circle'} size={19} color="#fff" />}
          <ThemedText type="smallBold" style={styles.btnMainText}>
            {saving === 'publish' ? 'Publication…' : uploading ? 'Envoi des médias…' : autoPublishOff || form.visibilite === 'draft' ? 'Enregistrer' : 'Publier'}
          </ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SwitchInline({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: Brand.primary, false: '#D0D5DD' }} thumbColor="#fff" />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  loader: { marginTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { padding: 4 },
  title: { fontSize: 19, lineHeight: 24, fontWeight: '900' },
  content: { padding: 14, gap: 14, paddingBottom: 40 },
  modes: { flexDirection: 'row', gap: 8 },
  mode: { flex: 1, alignItems: 'center', gap: 2, borderWidth: 1.5, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 4 },
  modeLabel: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12 },
  alert: { flexDirection: 'row', gap: 10, borderRadius: 14, padding: 12, borderWidth: 1 },
  alertDanger: { backgroundColor: '#FEF3F2', borderColor: '#FDA29B' },
  alertLink: { color: Brand.danger, textDecorationLine: 'underline' },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 999 },
  btnGhost: { flex: 1, borderWidth: 1.2 },
  btnMain: { flex: 1.6, backgroundColor: Brand.primary },
  btnMainText: { color: '#fff', fontSize: 15.5 },
  off: { opacity: 0.55 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  blockedIco: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  blockedTitle: { fontSize: 19, lineHeight: 24, fontWeight: '800' },
});
