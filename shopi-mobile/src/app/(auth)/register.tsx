/**
 * Inscription d'un compte CLIENT (POST /auth/register, role « client »).
 * Mêmes règles que le serveur (RegisterDto) vérifiées avant l'envoi :
 *   prénom / nom 2 à 50 caractères, email valide, téléphone guinéen
 *   (9 chiffres), mot de passe ≥ 8 avec majuscule, minuscule, chiffre et
 *   caractère spécial, date de naissance, genre, ville (référentiel géo).
 * Si la plateforme exige la vérification de l'email → écran du code.
 * Entreprise / livreur / partenaire : inscription sur le site (étapes
 * propres à ces comptes : activité, catégories, code d'activation…).
 */
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthScreen } from '@/components/auth-screen';
import { Chips, Field, PasswordField, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import {
  fetchRegistrationPolicy,
  fetchVilles,
  register,
  type Gender,
} from '@/features/auth/api';
import { isStrongPassword } from '@/features/auth/password-rules';
import { useSession } from '@/features/auth/session-store';
import { PasswordRulesList } from '@/components/password-rules-list';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

const SITE = 'https://www.shoneya.com';

const GENRES: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Homme' },
  { value: 'female', label: 'Femme' },
  { value: 'other', label: 'Autre' },
  { value: 'prefer_not', label: 'Ne pas préciser' },
];

/** « 12/05/1998 » → « 1998-05-12 » si c'est une vraie date passée, sinon null. */
function parseBirthDate(v: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number) as unknown as [number, number, number, number];
  const date = new Date(Date.UTC(y, mo - 1, d));
  const real = date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
  if (!real || y < 1900 || date.getTime() > Date.now()) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Saisie « JJ/MM/AAAA » : les barres se placent toutes seules. */
function formatBirthInput(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

type Errors = Partial<Record<'firstName' | 'lastName' | 'email' | 'phone' | 'birth' | 'gender' | 'city' | 'password' | 'confirm', string>>;

export default function RegisterScreen() {
  const theme = useTheme();
  const signIn = useSession((s) => s.signIn);
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const birthRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birth, setBirth] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const policy = useQuery({ queryKey: ['registration-policy'], queryFn: fetchRegistrationPolicy });
  const closed = policy.data?.openSignup === false;

  function validate(): Errors {
    const e: Errors = {};
    if (firstName.trim().length < 2) e.firstName = 'Au moins 2 caractères.';
    if (lastName.trim().length < 2) e.lastName = 'Au moins 2 caractères.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Adresse email invalide.';
    if (!/^\d{9}$/.test(phone)) e.phone = 'Numéro à 9 chiffres (ex. 620 10 26 44).';
    if (!parseBirthDate(birth)) e.birth = 'Date invalide (JJ/MM/AAAA).';
    if (!gender) e.gender = 'Choisissez une option.';
    if (!city) e.city = 'Choisissez votre ville.';
    if (!isStrongPassword(password)) e.password = 'Le mot de passe ne respecte pas toutes les règles.';
    if (confirm !== password) e.confirm = 'Les deux mots de passe ne correspondent pas.';
    return e;
  }

  async function submit() {
    const e = validate();
    setErrors(e);
    setServerError(null);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      const outcome = await register({
        firstName,
        lastName,
        email,
        phone,
        password,
        birthDate: parseBirthDate(birth)!,
        gender: gender!,
        city: city!,
      });
      if (outcome.kind === 'success') {
        await signIn({ accessToken: outcome.accessToken, refreshToken: outcome.refreshToken }, outcome.user);
      } else if (outcome.kind === 'emailVerification') {
        router.replace({ pathname: '/verify-email', params: { userId: outcome.userId, email: outcome.email } });
      }
    } catch (err) {
      setServerError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  /** Efface l'erreur d'un champ dès que l'utilisateur le corrige. */
  const clear = (k: keyof Errors) => errors[k] && setErrors((e) => ({ ...e, [k]: undefined }));

  return (
    <AuthScreen
      title="Créer un compte"
      subtitle="Rejoignez Shoneya pour acheter, discuter avec les boutiques et suivre vos livraisons."
      footer={
        <View style={styles.footer}>
          <View style={styles.row}>
            <ThemedText themeColor="textSecondary">Déjà un compte ?</ThemedText>
            <Pressable onPress={() => router.back()} accessibilityRole="link" hitSlop={8}>
              <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                Se connecter
              </ThemedText>
            </Pressable>
          </View>
          <Pressable
            onPress={() => void WebBrowser.openBrowserAsync(`${SITE}/register`)}
            accessibilityRole="link"
            hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Entreprise, livreur ou partenaire ?{' '}
              <ThemedText type="small" style={{ color: Brand.primary }}>
                Inscription sur shoneya.com
              </ThemedText>
            </ThemedText>
          </Pressable>
        </View>
      }>
      {closed && (
        <View style={styles.notice}>
          <ThemedText type="small">Les inscriptions sont momentanément fermées. Réessayez plus tard.</ThemedText>
        </View>
      )}

      <View style={styles.twoCols}>
        <View style={styles.col}>
          <Field
            label="Prénom"
            placeholder="Moussa"
            value={firstName}
            onChangeText={(v) => (setFirstName(v), clear('firstName'))}
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="next"
            onSubmitEditing={() => lastNameRef.current?.focus()}
            error={errors.firstName}
            maxLength={50}
          />
        </View>
        <View style={styles.col}>
          <Field
            ref={lastNameRef}
            label="Nom"
            placeholder="Camara"
            value={lastName}
            onChangeText={(v) => (setLastName(v), clear('lastName'))}
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            error={errors.lastName}
            maxLength={50}
          />
        </View>
      </View>

      <Field
        ref={emailRef}
        label="Email"
        placeholder="exemple@gmail.com"
        value={email}
        onChangeText={(v) => (setEmail(v), clear('email'))}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
        error={errors.email}
      />

      <Field
        ref={phoneRef}
        label="Téléphone"
        placeholder="620 10 26 44"
        value={phone}
        onChangeText={(v) => (setPhone(v.replace(/\D/g, '').replace(/^224/, '').slice(0, 9)), clear('phone'))}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType="next"
        onSubmitEditing={() => birthRef.current?.focus()}
        error={errors.phone}
        left={
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.dial}>
            🇬🇳 +224
          </ThemedText>
        }
      />

      <Field
        ref={birthRef}
        label="Date de naissance"
        placeholder="JJ/MM/AAAA"
        value={birth}
        onChangeText={(v) => (setBirth(formatBirthInput(v)), clear('birth'))}
        keyboardType="number-pad"
        autoComplete="birthdate-full"
        maxLength={10}
        error={errors.birth}
      />

      <Chips label="Genre" options={GENRES} value={gender} onChange={(g) => (setGender(g), clear('gender'))} error={errors.gender} />

      <View style={styles.group}>
        <ThemedText type="smallBold" style={styles.label}>
          Ville
        </ThemedText>
        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Choisir votre ville"
          style={[
            styles.select,
            { borderColor: errors.city ? Brand.danger : theme.border, backgroundColor: theme.backgroundElement },
          ]}>
          <ThemedText themeColor={city ? 'text' : 'textSecondary'}>{city ?? 'Choisir votre ville'}</ThemedText>
          <ThemedText themeColor="textSecondary">▾</ThemedText>
        </Pressable>
        {errors.city ? (
          <ThemedText type="small" style={{ color: Brand.danger }}>
            {errors.city}
          </ThemedText>
        ) : null}
      </View>

      <PasswordField
        label="Mot de passe"
        placeholder="Créez un mot de passe"
        value={password}
        onChangeText={(v) => (setPassword(v), clear('password'))}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        error={errors.password}
      />
      <PasswordRulesList password={password} />
      <PasswordField
        ref={confirmRef}
        label="Confirmer le mot de passe"
        placeholder="Retapez le mot de passe"
        value={confirm}
        onChangeText={(v) => (setConfirm(v), clear('confirm'))}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        error={errors.confirm}
      />

      {serverError ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <ThemedText type="small" style={{ color: Brand.danger }}>
            {serverError}
          </ThemedText>
        </View>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        En créant un compte, vous acceptez les conditions d’utilisation et la politique de confidentialité de Shoneya.
      </ThemedText>
      <PrimaryButton title="Créer mon compte" onPress={() => void submit()} loading={loading} disabled={closed} />

      <VillePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(v) => {
          setCity(v);
          clear('city');
          setPickerOpen(false);
        }}
      />
    </AuthScreen>
  );
}

/** Liste des villes (référentiel géo) avec recherche, en plein écran. */
function VillePicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (nom: string) => void }) {
  const theme = useTheme();
  const [q, setQ] = useState('');
  const villes = useQuery({ queryKey: ['geo-villes'], queryFn: fetchVilles, enabled: visible, staleTime: 3_600_000 });
  /* Sans accents, casse, apostrophes ni espaces : « nzere » trouve « N'Zérékoré » */
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const list = useMemo(
    () => (villes.data ?? []).filter((v) => norm(v.nom).includes(norm(q.trim()))),
    [villes.data, q],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modal, { backgroundColor: theme.background }]}>
        <View style={styles.modalHead}>
          <ThemedText style={styles.modalTitle}>Votre ville</ThemedText>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10}>
            <ThemedText type="smallBold" style={{ color: Brand.primary }}>
              Fermer
            </ThemedText>
          </Pressable>
        </View>
        <View style={styles.modalSearch}>
          <Field placeholder="Rechercher une ville…" value={q} onChangeText={setQ} autoCorrect={false} />
        </View>
        {villes.isPending ? (
          <ThemedText themeColor="textSecondary" style={styles.modalInfo}>
            Chargement des villes…
          </ThemedText>
        ) : villes.error ? (
          <Pressable onPress={() => void villes.refetch()} style={styles.modalInfo}>
            <ThemedText style={{ color: Brand.danger }}>{toUserMessage(villes.error)} Toucher pour réessayer.</ThemedText>
          </Pressable>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(v) => v.id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: theme.border }]} />}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.modalInfo}>
                Aucune ville trouvée.
              </ThemedText>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPick(item.nom)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.villeRow, pressed && { backgroundColor: theme.backgroundElement }]}>
                <ThemedText>{item.nom}</ThemedText>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  twoCols: { flexDirection: 'row', gap: Spacing.three },
  col: { flex: 1 },
  dial: { marginRight: Spacing.two },
  group: { gap: 6 },
  label: { fontSize: 13 },
  select: {
    borderWidth: 1.5,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notice: { backgroundColor: '#FFF7E6', borderRadius: 10, padding: Spacing.three },
  errorBox: { backgroundColor: '#FDECEA', borderRadius: 10, padding: Spacing.three },
  center: { textAlign: 'center' },
  footer: { gap: Spacing.three, alignItems: 'center' },
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  modal: { flex: 1 },
  modalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalSearch: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  modalInfo: { padding: Spacing.four, textAlign: 'center' },
  villeRow: { paddingHorizontal: Spacing.four, paddingVertical: 16 },
  sep: { height: StyleSheet.hairlineWidth, marginHorizontal: Spacing.four },
});
