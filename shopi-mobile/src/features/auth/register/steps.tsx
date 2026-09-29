/**
 * Étapes de l'inscription (sauf « Vos coordonnées », voir contact-step.tsx).
 * Contenu identique au site (RegisterForm.tsx) : rôle + email · identité
 * (ou boutique, activité, type) · catégories · logo · profil · mot de passe.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Field, PasswordField } from '@/components/form';
import { SelectField } from '@/components/select-field';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchCompanyTypesByNature, fetchTypeCategories } from '@/features/auth/api';
import { PASSWORD_RULES } from '@/features/auth/password-rules';
import { REGISTER_ROLES, ROLE_CONFIGS, isRoleOpen, type RegisterRole, type RegistrationPolicy } from '@/features/auth/roles';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

import type { StepProps } from './types';
import { formatBirthInput } from './validation';

function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <ThemedText type="small" style={{ color: Brand.danger }} accessibilityRole="alert">
      {children}
    </ThemedText>
  );
}

function Label({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" style={styles.label}>
      {children} <ThemedText style={{ color: Brand.danger }}>*</ThemedText>
    </ThemedText>
  );
}

/* ── 1. Votre compte : rôle + email ───────────────────────────────────── */
export function AccountStep({ form, errors, set, policy }: StepProps & { policy: RegistrationPolicy | undefined }) {
  const theme = useTheme();
  const open = (r: RegisterRole) => isRoleOpen(r, policy);
  const clientOpen = open('client');
  const companyOpen = open('company');
  const cfg = ROLE_CONFIGS[form.role];

  return (
    <>
      {!clientOpen && !companyOpen ? (
        <View style={[styles.banner, styles.bannerRed]}>
          <ThemedText type="small" style={{ color: Brand.danger }}>
            🚫 <ThemedText type="smallBold" style={{ color: Brand.danger }}>Inscriptions temporairement fermées.</ThemedText> La
            création de nouveaux comptes sans invitation n’est pas disponible pour le moment. Réessayez plus tard ou contactez le
            support.
          </ThemedText>
        </View>
      ) : (
        <View style={[styles.banner, styles.bannerAmber]}>
          <ThemedText type="small" style={{ color: '#B45309' }}>
            ℹ️ <ThemedText type="smallBold" style={{ color: '#B45309' }}>Inscription sans invitation :</ThemedText>{' '}
            {clientOpen && companyOpen
              ? 'les comptes Client et Entreprise sont disponibles'
              : clientOpen
                ? 'seul le compte Client est disponible'
                : 'seul le compte Entreprise est disponible'}
            . Les autres rôles nécessitent un lien d’invitation envoyé par un administrateur Shoneya.
          </ThemedText>
        </View>
      )}

      <ThemedText type="smallBold" style={styles.label}>
        Je m’inscris en tant que
      </ThemedText>
      <View style={styles.roleGrid} accessibilityRole="radiogroup">
        {REGISTER_ROLES.map((r) => {
          const c = ROLE_CONFIGS[r];
          const on = form.role === r;
          const disabled = !open(r);
          return (
            <Pressable
              key={r}
              onPress={() => !disabled && set({ role: r, businessModel: null, companyTypeId: null, categoryIds: [], logo: null, company: null })}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled }}
              accessibilityLabel={disabled ? `${c.label} — invitation requise` : c.label}
              style={[
                styles.roleCard,
                { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? theme.backgroundSelected : theme.background },
                disabled && styles.roleDisabled,
              ]}>
              <ThemedText style={styles.roleIcon}>{c.icon}</ThemedText>
              <ThemedText type="smallBold" style={on ? { color: Brand.primary } : undefined}>
                {c.label}
              </ThemedText>
              <ThemedText style={styles.roleSub} themeColor="textSecondary">
                {disabled ? '🔒 Invitation' : c.sub}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ErrorText>{errors.role}</ErrorText>

      {form.role !== 'client' && (
        <View style={[styles.infoBox, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText style={styles.roleIcon}>{cfg.icon}</ThemedText>
          <ThemedText type="small" style={styles.flex}>
            <ThemedText type="smallBold">{cfg.label}</ThemedText> — {cfg.info}
          </ThemedText>
        </View>
      )}

      <Field
        variant="outline"
        placeholder="Email"
        value={form.email}
        onChangeText={(v) => set({ email: v })}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        error={errors.email}
        editable={clientOpen || companyOpen}
      />
    </>
  );
}

/* ── 2. Votre identité ─────────────────────────────────────────────────── */
export function IdentityStep({ form, errors, set }: StepProps) {
  const theme = useTheme();
  const types = useQuery({
    queryKey: ['register-types', form.businessModel],
    queryFn: () => fetchCompanyTypesByNature(form.businessModel!),
    enabled: form.role === 'company' && !!form.businessModel,
    staleTime: 600_000,
  });

  if (form.role !== 'company') {
    return (
      <>
        <Field
          variant="outline"
          placeholder="Prénom"
          value={form.firstName}
          onChangeText={(v) => set({ firstName: v })}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          maxLength={50}
          error={errors.firstName}
        />
        <Field
          variant="outline"
          placeholder="Nom de famille"
          value={form.lastName}
          onChangeText={(v) => set({ lastName: v })}
          autoCapitalize="words"
          autoComplete="family-name"
          textContentType="familyName"
          maxLength={50}
          error={errors.lastName}
        />
      </>
    );
  }

  return (
    <>
      <Field
        variant="outline"
        placeholder="Nom de la boutique / entreprise"
        value={form.shopName}
        onChangeText={(v) => set({ shopName: v })}
        autoCapitalize="words"
        maxLength={100}
        error={errors.shopName}
      />
      <Label>Que proposez-vous ?</Label>
      <View style={styles.twoCols}>
        {(
          [
            { value: 'products', icon: 'cube-outline', label: 'Produits physiques', sub: 'Biens en stock, livrés' },
            { value: 'services', icon: 'construct-outline', label: 'Services', sub: 'Prestations, rendez-vous' },
          ] as const
        ).map((o) => {
          const on = form.businessModel === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => set({ businessModel: o.value, companyTypeId: null, categoryIds: [] })}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[
                styles.modelCard,
                { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? theme.backgroundSelected : theme.background },
              ]}>
              <Ionicons name={o.icon} size={24} color={on ? Brand.primary : theme.textSecondary} />
              <ThemedText type="smallBold" style={styles.center}>
                {o.label}
              </ThemedText>
              <ThemedText style={[styles.roleSub, styles.center]} themeColor="textSecondary">
                {o.sub}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ErrorText>{errors.businessModel}</ErrorText>

      <SelectField
        label="Type d’entreprise *"
        placeholder="Choisir le type d’entreprise"
        title="Type d’entreprise"
        options={(types.data ?? []).map((t) => ({ value: t.id, label: t.nom, icon: t.icone ?? undefined }))}
        value={form.companyTypeId}
        onChange={(id) => set({ companyTypeId: id, categoryIds: [] })}
        disabled={!form.businessModel}
        disabledHint="Choisissez d’abord « Produits » ou « Services »"
        loading={types.isFetching}
        error={errors.companyTypeId ?? (types.error ? toUserMessage(types.error) : undefined)}
      />
    </>
  );
}

/* ── 3. Vos catégories (entreprise) ────────────────────────────────────── */
export function CategoriesStep({
  form,
  errors,
  set,
  onCount,
}: StepProps & { onCount: (n: number) => void }) {
  const theme = useTheme();
  const cats = useQuery({
    queryKey: ['register-categories', form.companyTypeId],
    queryFn: () => fetchTypeCategories(form.companyTypeId!),
    enabled: !!form.companyTypeId,
  });
  const list = cats.data ?? [];

  useEffect(() => {
    onCount(list.length);
    /* Retire une sélection périmée (retour arrière + autre type) */
    const valid = new Set(list.map((c) => c.id));
    if (form.categoryIds.some((id) => !valid.has(id)) && cats.data) set({ categoryIds: form.categoryIds.filter((id) => valid.has(id)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats.data]);

  if (cats.isPending) return <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  if (cats.error)
    return (
      <View style={styles.centerBox}>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {toUserMessage(cats.error)}
        </ThemedText>
        <Pressable onPress={() => void cats.refetch()} accessibilityRole="button">
          <ThemedText type="smallBold" style={{ color: Brand.primary }}>
            Réessayer
          </ThemedText>
        </Pressable>
      </View>
    );
  if (!list.length)
    return (
      <ThemedText themeColor="textSecondary" style={styles.center}>
        Aucune catégorie n’est encore proposée pour ce type : vous pouvez continuer.
      </ThemedText>
    );

  const selected = new Set(form.categoryIds);
  const all = list.every((c) => selected.has(c.id));
  const toggle = (id: string) =>
    set({ categoryIds: selected.has(id) ? form.categoryIds.filter((x) => x !== id) : [...form.categoryIds, id] });

  return (
    <>
      <View style={styles.rowBetween}>
        <ThemedText type="small" themeColor="textSecondary">
          {form.categoryIds.length} sélectionnée{form.categoryIds.length > 1 ? 's' : ''} sur {list.length}
        </ThemedText>
        <Pressable onPress={() => set({ categoryIds: all ? [] : list.map((c) => c.id) })} accessibilityRole="button" hitSlop={8}>
          <ThemedText type="smallBold" style={{ color: Brand.primary }}>
            {all ? 'Tout désélectionner' : 'Tout sélectionner'}
          </ThemedText>
        </Pressable>
      </View>
      <View style={styles.catGrid}>
        {list.map((c) => {
          const on = selected.has(c.id);
          return (
            <Pressable
              key={c.id}
              onPress={() => toggle(c.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[
                styles.catCard,
                { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? theme.backgroundSelected : theme.background },
              ]}>
              {on ? <Ionicons name="checkmark-circle" size={18} color={Brand.primary} style={styles.catCheck} /> : null}
              <ThemedText style={styles.catIcon}>{c.icone || '🏷️'}</ThemedText>
              <ThemedText numberOfLines={2} style={[styles.catName, on && { color: Brand.primary }]}>
                {c.nom}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ErrorText>{errors.categoryIds}</ErrorText>
    </>
  );
}

/* ── 4. Votre logo (entreprise, facultatif) ────────────────────────────── */
export function LogoStep({ form, set, onToast }: StepProps & { onToast: (m: string) => void }) {
  const theme = useTheme();

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const type = a.mimeType ?? 'image/jpeg';
    if (a.fileSize && a.fileSize > 5 * 1024 * 1024) return onToast('Le logo ne doit pas dépasser 5 Mo.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return onToast('Formats acceptés : JPEG, PNG ou WebP.');
    set({ logo: { uri: a.uri, mimeType: type } });
  }

  return (
    <View style={styles.logoBox}>
      <Pressable
        onPress={() => void pick()}
        accessibilityRole="button"
        accessibilityLabel="Choisir un logo"
        style={[styles.logoCircle, { borderColor: theme.border, backgroundColor: theme.backgroundSelected }]}>
        {form.logo ? (
          <Image source={{ uri: form.logo.uri }} style={styles.fill} contentFit="cover" />
        ) : (
          <Ionicons name="storefront-outline" size={44} color={Brand.primary} />
        )}
      </Pressable>
      <View style={styles.row}>
        <Pressable onPress={() => void pick()} accessibilityRole="button" style={[styles.smallBtn, { borderColor: theme.border }]}>
          <Ionicons name="cloud-upload-outline" size={16} color={theme.text} />
          <ThemedText type="smallBold">{form.logo ? 'Changer le logo' : 'Choisir un logo'}</ThemedText>
        </Pressable>
        {form.logo ? (
          <Pressable onPress={() => set({ logo: null })} accessibilityRole="button" style={[styles.smallBtn, { borderColor: theme.border }]}>
            <ThemedText type="smallBold" style={{ color: Brand.danger }}>
              Retirer
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        JPEG, PNG ou WebP — 5 Mo max.{'\n'}Facultatif — vous pourrez aussi l’ajouter plus tard depuis Paramètres.
      </ThemedText>
    </View>
  );
}

/* ── 5. Votre profil : date de naissance + genre ───────────────────────── */
const GENDERS = [
  { value: 'male', label: 'Homme', icon: '👨' },
  { value: 'female', label: 'Femme', icon: '👩' },
  { value: 'other', label: 'Autre', icon: '🏳️‍🌈' },
  { value: 'prefer_not', label: 'Non précisé', icon: '🔒' },
] as const;

export function ProfileStep({ form, errors, set }: StepProps) {
  const theme = useTheme();
  return (
    <>
      <Label>Date de naissance</Label>
      <Field
        variant="outline"
        placeholder="JJ/MM/AAAA"
        value={form.birth}
        onChangeText={(v) => set({ birth: formatBirthInput(v) })}
        keyboardType="number-pad"
        autoComplete="birthdate-full"
        maxLength={10}
        error={errors.birth}
        left={<Ionicons name="calendar-outline" size={18} color={theme.textSecondary} style={styles.leftIcon} />}
      />
      <Label>Genre</Label>
      <View style={styles.genderGrid} accessibilityRole="radiogroup">
        {GENDERS.map((g) => {
          const on = form.gender === g.value;
          return (
            <Pressable
              key={g.value}
              onPress={() => set({ gender: g.value })}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[
                styles.genderCard,
                { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? theme.backgroundSelected : theme.background },
              ]}>
              <ThemedText style={styles.genderIcon}>{g.icon}</ThemedText>
              <ThemedText type="smallBold" style={on ? { color: Brand.primary } : undefined}>
                {g.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ErrorText>{errors.gender}</ErrorText>
    </>
  );
}

/* ── 7. Votre mot de passe ─────────────────────────────────────────────── */
const STRENGTH = ['Trop faible', 'Faible', 'Correct', 'Bon', 'Fort', 'Très fort'];
const STRENGTH_COLORS = ['#D93025', '#D93025', '#F59E0B', '#F59E0B', '#0F9D58', '#0F9D58'];

export function PasswordStep({ form, errors, set, onOpenLegal }: StepProps & { onOpenLegal: () => void }) {
  const theme = useTheme();
  const score = PASSWORD_RULES.filter((r) => r.test(form.password)).length;
  return (
    <>
      <PasswordField
        variant="outline"
        placeholder="Créez un mot de passe fort"
        value={form.password}
        onChangeText={(v) => set({ password: v })}
        autoComplete="new-password"
        textContentType="newPassword"
        error={errors.password}
      />
      {form.password ? (
        <View style={styles.strength}>
          <View style={styles.bars}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={[styles.bar, { backgroundColor: i < score ? STRENGTH_COLORS[score] : theme.border }]} />
            ))}
          </View>
          <ThemedText type="small" style={{ color: STRENGTH_COLORS[score] }}>
            {STRENGTH[score]}
          </ThemedText>
          <View style={styles.rules}>
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(form.password);
              return (
                <ThemedText key={r.label} type="small" style={{ color: ok ? Brand.success : theme.textSecondary }}>
                  {ok ? '✓' : '•'} {r.label}
                </ThemedText>
              );
            })}
          </View>
        </View>
      ) : null}
      <PasswordField
        variant="outline"
        placeholder="Répétez votre mot de passe"
        value={form.confirm}
        onChangeText={(v) => set({ confirm: v })}
        autoComplete="new-password"
        textContentType="newPassword"
        error={errors.confirm}
      />
      <Pressable
        onPress={() => set({ terms: !form.terms })}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: form.terms }}
        style={styles.terms}>
        <Ionicons
          name={form.terms ? 'checkbox' : 'square-outline'}
          size={22}
          color={errors.terms ? Brand.danger : form.terms ? Brand.primary : theme.textSecondary}
        />
        <ThemedText type="small" style={[styles.flex, errors.terms ? { color: Brand.danger } : undefined]}>
          J’accepte les{' '}
          <ThemedText type="smallBold" style={{ color: Brand.primary }} onPress={onOpenLegal}>
            conditions d’utilisation
          </ThemedText>{' '}
          et la{' '}
          <ThemedText type="smallBold" style={{ color: Brand.primary }} onPress={onOpenLegal}>
            politique de confidentialité
          </ThemedText>{' '}
          de Shoneya. <ThemedText style={{ color: Brand.danger }}>*</ThemedText>
        </ThemedText>
      </Pressable>
      <ErrorText>{errors.terms}</ErrorText>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  center: { textAlign: 'center' },
  centerBox: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  loader: { marginVertical: Spacing.four },
  label: { fontSize: 13, marginBottom: -4 },
  banner: { borderRadius: 12, borderWidth: 1.5, padding: 12 },
  bannerAmber: { backgroundColor: 'rgba(245,158,11,.06)', borderColor: 'rgba(245,158,11,.25)' },
  bannerRed: { backgroundColor: 'rgba(220,38,38,.06)', borderColor: 'rgba(220,38,38,.2)' },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleCard: { width: '31.5%', borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 2 },
  roleDisabled: { opacity: 0.45 },
  roleIcon: { fontSize: 24, lineHeight: 30 },
  roleSub: { fontSize: 11, lineHeight: 14 },
  infoBox: { flexDirection: 'row', gap: Spacing.two, borderRadius: 12, padding: 12, alignItems: 'flex-start' },
  twoCols: { flexDirection: 'row', gap: 10 },
  modelCard: { flex: 1, borderWidth: 2, borderRadius: 12, padding: 14, alignItems: 'center', gap: 6 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catCard: { width: '31%', borderWidth: 1.5, borderRadius: 12, paddingTop: 14, paddingBottom: 10, paddingHorizontal: 6, alignItems: 'center', gap: 6 },
  catCheck: { position: 'absolute', top: 5, right: 5 },
  catIcon: { fontSize: 24, lineHeight: 30 },
  catName: { fontSize: 12, lineHeight: 15, fontWeight: '600', textAlign: 'center', minHeight: 30 },
  logoBox: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  logoCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderStyle: 'dashed', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  smallBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  leftIcon: { marginRight: Spacing.two },
  genderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genderCard: { width: '48%', borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, alignItems: 'center', gap: 4 },
  genderIcon: { fontSize: 22, lineHeight: 28 },
  strength: { gap: 6, marginTop: -4 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 5, borderRadius: 3 },
  rules: { gap: 1 },
  terms: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
});
