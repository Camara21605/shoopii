/**
 * Inscription — parcours PAR ÉTAPES, identique au site (RegisterForm.tsx) :
 *   1 Votre compte (rôle + email) · 2 Votre identité · [3 Vos catégories ·
 *   4 Votre logo — entreprise] · Votre profil · Vos coordonnées · Votre mot de passe
 * Chaque étape est vérifiée avant de passer à la suivante (mêmes règles et
 * messages que le site, voir features/auth/register/validation.ts).
 * Rôles : Client et, si la plateforme l'autorise sans code, Entreprise ; les
 * autres rôles demandent un lien d'invitation (comme sur le site).
 * Fin : POST /auth/register → connexion, ou écran du code email.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchRegistrationPolicy, register, type RegisterPayload } from '@/features/auth/api';
import { flushPendingLogo, setPendingLogo } from '@/features/auth/pending-logo';
import { ContactStep } from '@/features/auth/register/contact-step';
import { COUNTRIES } from '@/features/auth/register/countries';
import { AccountStep, CategoriesStep, IdentityStep, LogoStep, PasswordStep, ProfileStep } from '@/features/auth/register/steps';
import { STEP_INFO, stepsFor, type RegisterErrors, type RegisterForm } from '@/features/auth/register/types';
import { parseBirthDate, validateStep } from '@/features/auth/register/validation';
import { isRoleOpen } from '@/features/auth/roles';
import { useSession } from '@/features/auth/session-store';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

const GN = COUNTRIES[0];

const INITIAL: RegisterForm = {
  role: 'client',
  email: '',
  firstName: '',
  lastName: '',
  shopName: '',
  businessModel: null,
  companyTypeId: null,
  categoryIds: [],
  logo: null,
  birth: '',
  gender: null,
  country: { code: GN.code, name: GN.name, dial: GN.dial, flag: GN.flag },
  phone: '',
  gps: null,
  city: null,
  company: null,
  password: '',
  confirm: '',
  terms: false,
};

/** Formulaire → corps de POST /auth/register (même contenu que le site). */
function toPayload(f: RegisterForm): RegisterPayload {
  const company = f.role === 'company';
  return {
    role: f.role,
    email: f.email.toLowerCase(),
    password: f.password,
    firstName: company ? undefined : f.firstName,
    lastName: company ? undefined : f.lastName,
    phone: `${f.country.dial}${f.phone}`,
    birthDate: parseBirthDate(f.birth)!,
    gender: f.gender!,
    countryCode: f.country.code,
    countryName: f.country.name,
    dialCode: f.country.dial,
    ...(company
      ? {
          shopName: f.shopName,
          companyName: f.shopName,
          businessModel: f.businessModel ?? undefined,
          companyTypeId: f.companyTypeId ?? undefined,
          categoryIds: f.categoryIds,
          companyPaysId: f.company?.paysId,
          companyVilleId: f.company?.prefectureId,
          country: f.company?.paysNom,
          region: f.company?.regionNom,
          city: f.company?.prefectureNom,
          district: f.company?.communeNom,
          quartier: f.company?.quartierNom,
        }
      : f.gps
        ? {
            latitude: f.gps.latitude,
            longitude: f.gps.longitude,
            locationAccuracy: f.gps.accuracy,
            address: f.gps.address,
            city: f.gps.city,
            district: f.gps.district,
            quartier: f.gps.quartier,
            region: f.gps.region,
            country: f.gps.country,
            postalCode: f.gps.postalCode,
            gpsEnabled: true,
          }
        : { city: f.city ?? undefined, gpsEnabled: false }),
  };
}

export default function RegisterScreen() {
  const theme = useTheme();
  const signIn = useSession((s) => s.signIn);
  const scrollRef = useRef<ScrollView>(null);
  const [form, setForm] = useState<RegisterForm>(INITIAL);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [index, setIndex] = useState(0);
  const [categoriesAvailable, setCategoriesAvailable] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const policy = useQuery({ queryKey: ['registration-policy'], queryFn: fetchRegistrationPolicy });
  const steps = stepsFor(form.role);
  const step = steps[index];
  const info = STEP_INFO[step];
  const last = index === steps.length - 1;

  /** Mise à jour d'un ou plusieurs champs ; efface leurs erreurs. */
  function set(patch: Partial<RegisterForm>) {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof RegisterErrors];
      if ('gps' in patch || 'city' in patch || 'company' in patch) delete next.location;
      delete next.general;
      return next;
    });
  }

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  }

  function check(): boolean {
    const e = validateStep(step, form, {
      roleOpen: isRoleOpen(form.role, policy.data),
      categoriesAvailable,
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function goTo(i: number) {
    setIndex(i);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  const next = () => check() && goTo(index + 1);
  const back = () => (index === 0 ? router.back() : goTo(index - 1));

  async function submit() {
    if (!check()) return;
    setLoading(true);
    try {
      setPendingLogo(form.role === 'company' ? form.logo : null);
      const outcome = await register(toPayload(form));
      if (outcome.kind === 'success') {
        await signIn({ accessToken: outcome.accessToken, refreshToken: outcome.refreshToken }, outcome.user);
        void flushPendingLogo();
      } else if (outcome.kind === 'emailVerification') {
        router.replace({ pathname: '/verify-email', params: { userId: outcome.userId, email: outcome.email } });
      }
    } catch (err) {
      setPendingLogo(null);
      setErrors({ general: toUserMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  const props = { form, errors, set };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {/* En-tête : retour + progression */}
      <View style={styles.top}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={10} style={styles.backIcon}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.flex}>
          <ThemedText type="small" themeColor="textSecondary">
            Étape {index + 1} sur {steps.length}
          </ThemedText>
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.progress, { width: `${((index + 1) / steps.length) * 100}%` }]} />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <ThemedText style={styles.title}>{info.title}</ThemedText>
            <ThemedText themeColor="textSecondary">{info.sub}</ThemedText>
          </View>

          {step === 'account' && <AccountStep {...props} policy={policy.data} />}
          {step === 'identity' && <IdentityStep {...props} />}
          {step === 'categories' && <CategoriesStep {...props} onCount={setCategoriesAvailable} />}
          {step === 'logo' && <LogoStep {...props} onToast={showToast} />}
          {step === 'profile' && <ProfileStep {...props} />}
          {step === 'contact' && <ContactStep {...props} />}
          {step === 'password' && <PasswordStep {...props} onOpenLegal={() => showToast('Conditions d’utilisation — page bientôt disponible.')} />}

          {errors.general ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <ThemedText type="small" style={{ color: Brand.danger }}>
                {errors.general}
              </ThemedText>
            </View>
          ) : null}

          {index === 0 && (
            <View style={styles.bottomLink}>
              <ThemedText themeColor="textSecondary">Déjà un compte ?</ThemedText>
              <Pressable onPress={() => router.back()} accessibilityRole="link" hitSlop={8}>
                <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                  Se connecter
                </ThemedText>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* Navigation entre les étapes */}
        <View style={[styles.nav, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          {index > 0 ? (
            <View style={styles.navBack}>
              <SecondaryButton pill title="Retour" onPress={back} disabled={loading} />
            </View>
          ) : null}
          <View style={styles.flex}>
            {last ? (
              <PrimaryButton pill title="Créer mon compte" onPress={() => void submit()} loading={loading} />
            ) : (
              <PrimaryButton pill title="Suivant" onPress={next} disabled={step === 'account' && !isRoleOpen(form.role, policy.data)} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <ThemedText type="small" style={{ color: '#fff' }}>
            {toast}
          </ThemedText>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  backIcon: { padding: 4 },
  track: { height: 5, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  progress: { height: 5, borderRadius: 3, backgroundColor: Brand.primary },
  content: { padding: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.three },
  head: { gap: 4, marginBottom: Spacing.one },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  errorBox: { backgroundColor: '#FDECEA', borderRadius: 10, padding: Spacing.three },
  bottomLink: { flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.two },
  nav: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
  navBack: { width: 120 },
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,.92)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '90%',
  },
});
