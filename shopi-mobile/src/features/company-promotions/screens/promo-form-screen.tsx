/**
 * Espace entreprise › Promotions › créer / modifier une promotion
 * (fenêtre « Créer une promotion » du site, en plein écran).
 *   · type : réduction, livraison offerte, lot, vente flash ; en % ou en GNF ;
 *   · nom, code (proposé à partir du nom), valeur, plafond (si %), panier minimum ;
 *   · champs propres au type : stock flash, quantités du lot, seuil de livraison offerte ;
 *   · portée : toute la boutique ou produits choisis (recherche dans le catalogue) ;
 *   · dates de début / fin, limites d'utilisation (totale, par client), description ;
 *   · aperçu de la promotion telle que le client la verra.
 * Création = brouillon puis activation immédiate (comme le site) ; « Brouillon »
 * enregistre sans activer. Tout est contrôlé avant l'envoi (promo-form.ts).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { ErrorLine, FormSection, TextField } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { fetchAllProducts, gnf, normalize, type Product } from '@/features/company-products/api';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { activatePromo, createPromo, fetchPromo, TYPE, updatePromo, valueLabel, type PromoType } from '../api';
import { EMPTY_FORM, TEMPLATES, digits, fmtDate, fromPromo, maskDate, suggestCode, thousands, toDto, validatePromo, type PromoForm } from '../promo-form';

const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const endOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0); };

export default function PromoFormScreen() {
  const { id, template } = useLocalSearchParams<{ id?: string; template?: string }>();
  const editing = !!id;
  const theme = useTheme();
  const qc = useQueryClient();
  const navigation = useNavigation();
  const perms = usePermissions();
  const scrollRef = useRef<React.ComponentRef<typeof KeyboardAwareScrollView>>(null);
  const leaving = useRef(false);

  const original = useQuery({ queryKey: qk.companyPromos.detail(id ?? ''), queryFn: () => fetchPromo(id!), enabled: editing });
  const products = useQuery({ queryKey: qk.company.products, queryFn: fetchAllProducts, staleTime: 5 * 60_000 });

  const [form, setForm] = useState<PromoForm>(() => {
    const t = template != null ? TEMPLATES[Number(template)] : undefined;
    return { ...EMPTY_FORM, ...(t?.patch ?? {}) };
  });
  const [loaded, setLoaded] = useState(!editing);
  if (!loaded && original.data) { setLoaded(true); setForm(fromPromo(original.data)); }

  const [codeTouched, setCodeTouched] = useState(editing);
  const [dirty, setDirty] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [mode, setMode] = useState<'publish' | 'draft'>('publish');
  const [saving, setSaving] = useState<null | 'publish' | 'draft'>(null);
  const [serverError, setServerError] = useState<string[] | null>(null);
  const [q, setQ] = useState('');

  const set = <K extends keyof PromoForm>(k: K, v: PromoForm[K]) => { setDirty(true); setForm((f) => ({ ...f, [k]: v })); };
  const setNom = (v: string) => { setDirty(true); setForm((f) => ({ ...f, nom: v, code: codeTouched ? f.code : suggestCode(v) })); };

  const check = validatePromo(form, { draft: mode === 'draft', original: original.data ?? null });
  const err = (k: keyof PromoForm) => (showErrors ? check.errors[k] : undefined);
  const nErrors = Object.keys(check.errors).length;

  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (leaving.current || !dirty) return;
    e.preventDefault();
    Alert.alert('Quitter sans enregistrer ?', 'Vos modifications seront perdues.', [
      { text: 'Rester', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: () => { leaving.current = true; navigation.dispatch(e.data.action); } },
    ]);
  }), [navigation, dirty]);

  async function submit(asDraft: boolean) {
    if (saving) return;
    setMode(asDraft ? 'draft' : 'publish');
    setServerError(null);
    const c = validatePromo(form, { draft: asDraft, original: original.data ?? null });
    if (Object.keys(c.errors).length) { setShowErrors(true); scrollRef.current?.scrollTo({ y: 0, animated: true }); return; }
    if (!asDraft && c.warnings.length) {
      const ok = await new Promise<boolean>((res) => Alert.alert('Vérifiez avant de continuer', c.warnings.map((w) => `• ${w}`).join('\n'), [
        { text: 'Corriger', style: 'cancel', onPress: () => res(false) },
        { text: 'Continuer', onPress: () => res(true) },
      ]));
      if (!ok) return;
    }

    setSaving(asDraft ? 'draft' : 'publish');
    let message = '';
    try {
      const dto = toDto(form, original.data ?? null);
      if (editing) {
        await updatePromo(id!, dto);
        message = 'Promotion mise à jour';
      } else {
        const created = await createPromo(dto);
        if (asDraft) message = 'Brouillon enregistré : activez-le quand vous voulez';
        else {
          try {
            await activatePromo(created.id);
            message = form.scope === 'global' ? 'Promotion créée et active sur toute la boutique' : `Promotion créée et active sur ${form.productIds.length} produit(s)`;
          } catch (e) {
            message = `Promotion créée en brouillon, mais non activée : ${toUserMessage(e)}`;
          }
        }
      }
      void qc.invalidateQueries({ queryKey: qk.companyPromos.all });
      void qc.invalidateQueries({ queryKey: qk.company.products });
      leaving.current = true;
      Alert.alert(editing ? 'Enregistré ✅' : asDraft ? 'Brouillon 💾' : 'Promotion créée 🎉', message, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      const data = e instanceof ApiError ? (e.data as { message?: unknown } | undefined) : undefined;
      setServerError(Array.isArray(data?.message) ? (data.message as string[]) : [toUserMessage(e)]);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(null);
    }
  }

  const header = (
    <View style={[styles.top, { borderBottomColor: theme.border }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retour"><Ionicons name="arrow-back" size={24} color={theme.text} /></Pressable>
      <View style={styles.flex}>
        <ThemedText style={styles.topTitle}>{editing ? 'Modifier la promotion' : 'Nouvelle promotion'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{editing ? 'Les modifications s’appliquent tout de suite' : 'Visible dans votre boutique dès sa création'}</ThemedText>
      </View>
    </View>
  );

  const allowed = editing ? perms.can('promotions', 'edit') : perms.can('promotions', 'create');
  if (perms.loading || (editing && !loaded)) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        {header}
        {original.isError ? <ThemedText style={styles.center}>{toUserMessage(original.error)}</ThemedText> : <ActivityIndicator color={Brand.primary} style={styles.loader} />}
      </SafeAreaView>
    );
  }
  if (!allowed || original.data?.status === 'ended') {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        {header}
        <View style={styles.blocked}>
          <Ionicons name="lock-closed" size={34} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.center}>
            {allowed ? 'Cette promotion est terminée : elle ne peut plus être modifiée. Créez-en une nouvelle.' : 'Votre rôle dans l’équipe ne permet pas cette action.'}
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const free = form.type === 'free-ship';
  const pct = !free && form.valueType === 'percent';
  const all = products.data ?? [];
  const term = normalize(q.trim());
  const visible = all.filter((p) => !term || normalize(`${p.nom} ${p.category?.nom ?? ''} ${p.reference ?? ''}`).includes(term));
  const toggle = (pid: string) => set('productIds', form.productIds.includes(pid) ? form.productIds.filter((x) => x !== pid) : [...form.productIds, pid]);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {header}
      <KeyboardAwareScrollView ref={scrollRef} bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {serverError ? (
          <View style={styles.alert} accessibilityRole="alert">
            <Ionicons name="close-circle" size={20} color={Brand.danger} />
            <View style={styles.flex}>
              <ThemedText type="smallBold" style={styles.danger}>La promotion n’a pas été enregistrée</ThemedText>
              {serverError.map((m) => <ThemedText key={m} type="small" style={styles.danger}>• {m}</ThemedText>)}
            </View>
          </View>
        ) : null}
        {showErrors && nErrors ? (
          <View style={styles.alert} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={20} color={Brand.danger} />
            <View style={styles.flex}>
              <ThemedText type="smallBold" style={styles.danger}>{nErrors === 1 ? '1 point à corriger' : `${nErrors} points à corriger`}</ThemedText>
              {Object.values(check.errors).slice(0, 5).map((m) => <ThemedText key={m} type="small" style={styles.danger}>• {m}</ThemedText>)}
            </View>
          </View>
        ) : null}

        <FormSection icon="pricetags-outline" title="Type de promotion">
          <View style={styles.types}>
            {(Object.keys(TYPE) as PromoType[]).map((k) => {
              const on = form.type === k;
              return (
                <Pressable key={k} onPress={() => set('type', k)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                  style={[styles.type, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? theme.backgroundElement : theme.background }]}>
                  <ThemedText style={styles.typeEmoji}>{TYPE[k].icon}</ThemedText>
                  <ThemedText style={styles.typeLabel}>{TYPE[k].label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.center}>{TYPE[k].sub}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          {!free ? (
            <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
              {(['percent', 'fixed'] as const).map((v) => (
                <Pressable key={v} onPress={() => set('valueType', v)} accessibilityRole="radio" accessibilityState={{ selected: form.valueType === v }}
                  style={[styles.segBtn, form.valueType === v && { backgroundColor: theme.background }]}>
                  <ThemedText type="smallBold" themeColor={form.valueType === v ? 'text' : 'textSecondary'}>{v === 'percent' ? 'En pourcentage (%)' : 'Montant fixe (GNF)'}</ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </FormSection>

        <FormSection icon="create-outline" title="Informations">
          <TextField label="Nom de la promotion" required value={form.nom} onChangeText={setNom} max={255} placeholder="ex. Soldes de fin d’année" error={err('nom')} />
          <TextField label="Code promo" required value={form.code} autoCapitalize="characters" autoCorrect={false} maxLength={50}
            onChangeText={(v) => { setCodeTouched(true); set('code', v.toUpperCase().replace(/[^A-Z0-9_-]/g, '')); }}
            placeholder="ex. SOLDES20" error={err('code')} hint="Le client le saisit au paiement. Lettres, chiffres, - et _." />
          <TextField label="Description (interne)" value={form.description} onChangeText={(v) => set('description', v)} multiline max={1000} placeholder="Objectif, conditions, notes pour l’équipe…" error={err('description')} />
        </FormSection>

        <FormSection icon="cash-outline" title={free ? 'Livraison offerte' : 'Réduction'}>
          {free ? (
            <TextField label="Commande minimum pour la livraison offerte" value={thousands(form.freeShipSeuil)} onChangeText={(v) => set('freeShipSeuil', digits(v))}
              keyboardType="number-pad" suffix="GNF" placeholder="0 = dès le premier achat" error={err('freeShipSeuil')} />
          ) : (
            <>
              <TextField label={pct ? 'Pourcentage de réduction' : 'Montant de la réduction'} required value={pct ? form.valeur : thousands(form.valeur)}
                onChangeText={(v) => set('valeur', pct ? v.replace(/[^\d.,]/g, '') : digits(v))}
                keyboardType={pct ? 'decimal-pad' : 'number-pad'} suffix={pct ? '%' : 'GNF'} placeholder={pct ? 'ex. 20' : 'ex. 5 000'} error={err('valeur')} />
              {pct ? (
                <TextField label="Réduction maximale (plafond)" value={thousands(form.plafondReduction)} onChangeText={(v) => set('plafondReduction', digits(v))}
                  keyboardType="number-pad" suffix="GNF" placeholder="Sans plafond" error={err('plafondReduction')} hint="Ex. -20 % mais jamais plus de 50 000 GNF" />
              ) : null}
              <TextField label="Montant minimum du panier" value={thousands(form.montantMinimum)} onChangeText={(v) => set('montantMinimum', digits(v))}
                keyboardType="number-pad" suffix="GNF" placeholder="Aucun minimum" error={err('montantMinimum')} />
            </>
          )}
          {form.type === 'flash' ? (
            <TextField label="Stock flash" value={form.flashStock} onChangeText={(v) => set('flashStock', digits(v))} keyboardType="number-pad" suffix="utilisations"
              placeholder="Illimité" error={err('flashStock')} hint="La vente s’arrête quand ce nombre est atteint." />
          ) : null}
          {form.type === 'bundle' ? (
            <View style={styles.row}>
              <View style={styles.flex}><TextField label="Articles achetés" value={form.bundleQuantiteMin} onChangeText={(v) => set('bundleQuantiteMin', digits(v))} keyboardType="number-pad" placeholder="ex. 2" error={err('bundleQuantiteMin')} /></View>
              <View style={styles.flex}><TextField label="Articles offerts" value={form.bundleQuantiteOfferte} onChangeText={(v) => set('bundleQuantiteOfferte', digits(v))} keyboardType="number-pad" placeholder="ex. 1" error={err('bundleQuantiteOfferte')} /></View>
            </View>
          ) : null}
        </FormSection>

        <FormSection icon="locate-outline" title="Portée" subtitle={form.scope === 'global' ? `Tout le catalogue (${all.length} produit${all.length > 1 ? 's' : ''})` : `${form.productIds.length} produit(s) choisi(s)`}>
          {(['global', 'products'] as const).map((s) => {
            const on = form.scope === s;
            return (
              <Pressable key={s} onPress={() => { set('scope', s); if (s === 'global') set('productIds', []); }} accessibilityRole="radio" accessibilityState={{ selected: on }}
                style={[styles.scope, { borderColor: on ? Brand.primary : theme.border }]}>
                <View style={[styles.radio, { borderColor: on ? Brand.primary : theme.border }]}>{on ? <View style={styles.radioIn} /> : null}</View>
                <Ionicons name={s === 'global' ? 'storefront-outline' : 'cube-outline'} size={20} color={theme.text} />
                <View style={styles.flex}>
                  <ThemedText style={styles.scopeTitle}>{s === 'global' ? 'Toute la boutique' : 'Produits choisis'}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{s === 'global' ? 'S’applique à tous vos produits' : 'Seulement les produits sélectionnés ci-dessous'}</ThemedText>
                </View>
              </Pressable>
            );
          })}
          {form.scope === 'products' ? (
            <View style={styles.picker}>
              {err('productIds') ? <ErrorLine text={err('productIds')!} /> : null}
              <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="search" size={16} color={theme.textSecondary} />
                <TextInput value={q} onChangeText={setQ} placeholder="Nom, catégorie ou référence" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text }]} />
              </View>
              <View style={styles.pickHead}>
                <ThemedText type="small" themeColor="textSecondary">{form.productIds.length} sélectionné(s)</ThemedText>
                <View style={styles.row}>
                  {visible.length ? <Pressable onPress={() => set('productIds', Array.from(new Set([...form.productIds, ...visible.map((p) => p.id)])))} hitSlop={6}><ThemedText type="smallBold">Tout cocher</ThemedText></Pressable> : null}
                  {form.productIds.length ? <Pressable onPress={() => set('productIds', [])} hitSlop={6}><ThemedText type="smallBold" style={styles.danger}>Tout retirer</ThemedText></Pressable> : null}
                </View>
              </View>
              {products.isPending ? <ActivityIndicator color={Brand.primary} /> : !visible.length ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>{all.length ? 'Aucun produit ne correspond.' : 'Aucun produit dans votre catalogue.'}</ThemedText>
              ) : visible.slice(0, 80).map((p) => <ProductPick key={p.id} p={p} on={form.productIds.includes(p.id)} onPress={() => toggle(p.id)} />)}
              {visible.length > 80 ? <ThemedText type="small" themeColor="textSecondary" style={styles.center}>Affinez la recherche pour voir les {visible.length - 80} autres produits.</ThemedText> : null}
            </View>
          ) : null}
        </FormSection>

        <FormSection icon="calendar-outline" title="Durée">
          <DateField label="Date de début" value={form.startDate} onChange={(v) => set('startDate', v)} error={err('startDate')} placeholder="Tout de suite"
            chips={[{ l: 'Aujourd’hui', d: new Date() }, { l: 'Demain', d: addDays(1) }]} />
          <DateField label="Date de fin" value={form.endDate} onChange={(v) => set('endDate', v)} error={err('endDate')} placeholder="Sans limite"
            chips={[{ l: '7 jours', d: addDays(7) }, { l: '14 jours', d: addDays(14) }, { l: '30 jours', d: addDays(30) }, { l: 'Fin du mois', d: endOfMonth() }]} />
        </FormSection>

        <FormSection icon="people-outline" title="Limites d’utilisation">
          <View style={styles.row}>
            <View style={styles.flex}><TextField label="Utilisations au total" value={form.maxUtilisations} onChangeText={(v) => set('maxUtilisations', digits(v))} keyboardType="number-pad" placeholder="Illimité" error={err('maxUtilisations')} /></View>
            <View style={styles.flex}><TextField label="Par client" value={form.maxParClient} onChangeText={(v) => set('maxParClient', digits(v))} keyboardType="number-pad" placeholder="1" error={err('maxParClient')} /></View>
          </View>
        </FormSection>

        <View style={[styles.preview, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">Aperçu</ThemedText>
          <View style={styles.previewRow}>
            <ThemedText style={styles.previewEmoji}>{TYPE[form.type].icon}</ThemedText>
            <View style={styles.flex}>
              <ThemedText style={styles.scopeTitle} numberOfLines={1}>{form.nom.trim() || 'Nom de la promotion'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {form.code || 'CODE'} · {form.scope === 'global' ? 'toute la boutique' : `${form.productIds.length} produit(s)`}
                {form.endDate ? ` · jusqu’au ${form.endDate}` : ''}
              </ThemedText>
            </View>
            <ThemedText style={styles.previewValue}>
              {free ? 'Livraison offerte' : form.valeur ? valueLabel({ type: form.type, valueType: form.valueType, valeur: Number(form.valeur.replace(',', '.')) }) : '—'}
            </ThemedText>
          </View>
        </View>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
        {!editing ? (
          <Pressable onPress={() => void submit(true)} disabled={!!saving} accessibilityRole="button" style={[styles.btn, styles.ghost, { borderColor: theme.border }, !!saving && styles.off]}>
            {saving === 'draft' ? <ActivityIndicator color={theme.text} /> : <Ionicons name="save-outline" size={18} color={theme.text} />}
            <ThemedText type="smallBold">Brouillon</ThemedText>
          </Pressable>
        ) : null}
        <Pressable onPress={() => void submit(false)} disabled={!!saving} accessibilityRole="button" style={[styles.btn, styles.main, !!saving && styles.off]}>
          {saving === 'publish' ? <ActivityIndicator color="#fff" /> : <Ionicons name={editing ? 'checkmark' : 'rocket-outline'} size={18} color="#fff" />}
          <ThemedText type="smallBold" style={styles.white}>{editing ? 'Enregistrer' : 'Créer et activer'}</ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ProductPick({ p, on, onPress }: { p: Product; on: boolean; onPress: () => void }) {
  const theme = useTheme();
  const img = p.images.find((m) => m.type !== 'video')?.url;
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
      style={[styles.pick, { borderColor: on ? Brand.primary : theme.border }]}>
      <View style={[styles.check, on ? styles.checkOn : { borderColor: theme.border }]}>{on ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}</View>
      <View style={[styles.pickImg, { backgroundColor: theme.backgroundElement }]}>
        {img ? <Image source={{ uri: thumb(img, 120) }} style={styles.fill} contentFit="cover" /> : <Ionicons name="cube-outline" size={18} color={theme.textSecondary} />}
      </View>
      <View style={styles.flex}>
        <ThemedText numberOfLines={1} style={styles.pickName}>{p.nom}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{[p.category?.nom, gnf(p.prix)].filter(Boolean).join(' · ')}</ThemedText>
      </View>
    </Pressable>
  );
}

function DateField({ label, value, onChange, error, placeholder, chips }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; placeholder: string; chips: { l: string; d: Date }[];
}) {
  const theme = useTheme();
  return (
    <View style={styles.dateWrap}>
      <TextField label={label} value={value} onChangeText={(v) => onChange(maskDate(v))} keyboardType="number-pad" maxLength={10}
        placeholder={`JJ/MM/AAAA — ${placeholder}`} error={error} />
      <View style={styles.dateChips}>
        {chips.map((c) => {
          const v = fmtDate(c.d);
          return (
            <Pressable key={c.l} onPress={() => onChange(v)} accessibilityRole="button" style={[styles.dateChip, { borderColor: value === v ? Brand.primary : theme.border }]}>
              <ThemedText type="small" style={styles.bold}>{c.l}</ThemedText>
            </Pressable>
          );
        })}
        {value ? (
          <Pressable onPress={() => onChange('')} accessibilityRole="button" style={[styles.dateChip, { borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">Effacer</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  white: { color: '#fff' },
  bold: { fontWeight: '700' },
  danger: { color: Brand.danger },
  center: { textAlign: 'center' },
  loader: { marginTop: 50 },
  off: { opacity: 0.5 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  topTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  content: { padding: 14, gap: 14, paddingBottom: 40 },
  alert: { flexDirection: 'row', gap: 10, borderRadius: 14, padding: 12, borderWidth: 1, backgroundColor: '#FEF3F2', borderColor: '#FDA29B' },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  type: { width: '48%', flexGrow: 1, alignItems: 'center', gap: 2, borderWidth: 1.5, borderRadius: 14, padding: 10 },
  typeEmoji: { fontSize: 24, lineHeight: 30 },
  typeLabel: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segBtn: { flex: 1, alignItems: 'center', borderRadius: 10, paddingVertical: 9 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  scope: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioIn: { width: 10, height: 10, borderRadius: 5, backgroundColor: Brand.primary },
  scopeTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  picker: { gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 12, minHeight: 42 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  pickHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.2, borderRadius: 12, padding: 8 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  pickImg: { width: 40, height: 40, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pickName: { fontSize: 14.5, lineHeight: 19, fontWeight: '700' },
  dateWrap: { gap: 6 },
  dateChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dateChip: { borderWidth: 1.2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  preview: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 12, gap: 6 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewEmoji: { fontSize: 28, lineHeight: 34 },
  previewValue: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 999 },
  ghost: { flex: 1, borderWidth: 1.2 },
  main: { flex: 1.6, backgroundColor: Brand.primary },
});
