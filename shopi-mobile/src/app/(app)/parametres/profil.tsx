/**
 * Paramètres › Profil — même contenu et mêmes règles que la rubrique
 * « Profil » du site (ProfilSection.tsx) :
 *   - photo : choisir (JPEG/PNG/WebP, 5 Mo max) ou supprimer ;
 *   - informations personnelles : prénom, nom, nom d'utilisateur, date de
 *     naissance, genre, bio (200 caractères) ; « Annuler » restaure les valeurs ;
 *   - coordonnées : e-mail / téléphone, mot de passe actuel exigé ; un
 *     nouvel e-mail reçoit un code à 6 chiffres à saisir ici.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, PasswordField, PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import {
  confirmEmailCode,
  fetchProfil,
  removeAvatar,
  sendEmailCode,
  updateCoordonnees,
  updateProfil,
  uploadAvatar,
  type Profil,
  type ProfilForm,
} from '@/features/settings/api';
import { Card, LoadState, OutlineButton, Pill, Row, Section, TextButton, useToast } from '@/features/settings/ui';
import { pickPhoto } from '@/features/settings-kit';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const BIO_MAX = 200;
const RESEND_DELAY = 60;
const GENRES = [
  { value: '', label: 'Non précisé' },
  { value: 'homme', label: 'Homme' },
  { value: 'femme', label: 'Femme' },
  { value: 'autre', label: 'Autre' },
];

/* ── Dates : le serveur stocke AAAA-MM-JJ, on saisit JJ/MM/AAAA ── */
const isoToFr = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const frToIso = (fr: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fr);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};
const todayIso = () => new Date().toISOString().slice(0, 10);
/** Ajoute les « / » au fil de la frappe : 1203 → 12/03. */
const maskDate = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/');
};
const longDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

type Draft = Omit<ProfilForm, 'dateNaissance'> & { dateFr: string };
const toDraft = (p: Profil): Draft => ({
  firstName: p.firstName,
  lastName: p.lastName,
  username: p.username,
  dateFr: isoToFr(p.dateNaissance),
  genre: p.genre,
  bio: p.bio,
});

export default function ProfilScreen() {
  const theme = useTheme();
  const toast = useToast();
  const query = useQuery({ queryKey: ['settings', 'profil'], queryFn: fetchProfil });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Profil" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!query.data ? (
          <LoadState loading={query.isLoading} error={query.error ? toUserMessage(query.error) : null} onRetry={() => void query.refetch()} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <PhotoCard profil={query.data} toast={toast.show} />
            <InfosCard profil={query.data} toast={toast.show} />
            <ContactsCard profil={query.data} toast={toast.show} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      {toast.element}
    </SafeAreaView>
  );
}

type CardProps = { profil: Profil; toast: (m: string) => void };

/* ─────────────────────────── Photo ─────────────────────────── */

function PhotoCard({ profil, toast }: CardProps) {
  const theme = useTheme();
  const qc = useQueryClient();
  const setPhoto = (url: string | null) =>
    qc.setQueryData<Profil>(['settings', 'profil'], (old) => (old ? { ...old, profilePicture: url } : old));

  const upload = useMutation({
    mutationFn: (a: { uri: string; mimeType: string; fileName: string }) => uploadAvatar(a.uri, a.mimeType, a.fileName),
    onSuccess: (url) => {
      setPhoto(url);
      toast('Photo de profil mise à jour');
    },
    onError: (e) => toast(toUserMessage(e)),
  });
  const remove = useMutation({
    mutationFn: removeAvatar,
    onSuccess: () => {
      setPhoto(null);
      toast('Photo supprimée');
    },
    onError: () => toast('Impossible de supprimer la photo'),
  });

  /* Galerie → recadrage → aperçu avec « Enregistrer la photo » (pickPhoto, settings-kit). */
  async function pick() {
    const picked = await pickPhoto();
    if (!picked.ok) return picked.error ? toast(picked.error) : undefined;
    upload.mutate({ uri: picked.file.uri, mimeType: picked.file.mimeType, fileName: picked.file.name });
  }

  const initial = (profil.firstName.charAt(0) || profil.email.charAt(0) || '?').toUpperCase();
  const busy = upload.isPending || remove.isPending;

  return (
    <Section title="Photo de profil">
      <Card>
        <View style={styles.photoRow}>
          <View>
            {profil.profilePicture ? (
              <Image source={{ uri: profil.profilePicture }} style={styles.photo} contentFit="cover" accessibilityLabel="Photo de profil" />
            ) : (
              <View style={[styles.photo, styles.photoFallback]}>
                <ThemedText style={styles.photoInitial}>{initial}</ThemedText>
              </View>
            )}
            {busy ? (
              <View style={styles.photoBusy}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
          </View>
          <View style={styles.flex}>
            <ThemedText style={styles.bold}>
              {profil.firstName} {profil.lastName}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {profil.username ? `@${profil.username}` : 'Aucun nom d’utilisateur'}
            </ThemedText>
            <View style={styles.photoActions}>
              <SmallButton icon="camera-outline" label="Changer" onPress={() => void pick()} disabled={busy} />
              {profil.profilePicture ? (
                <SmallButton icon="trash-outline" label="Supprimer" danger onPress={() => remove.mutate()} disabled={busy} />
              ) : null}
            </View>
          </View>
        </View>
      </Card>
      <ThemedText type="small" style={{ color: theme.textSecondary, paddingHorizontal: 4 }}>
        JPG, PNG ou WebP · 5 Mo maximum · visible par les autres utilisateurs Shoneya
      </ThemedText>
    </Section>
  );
}

/* ──────────────────── Informations personnelles ──────────────────── */

function InfosCard({ profil, toast }: CardProps) {
  const theme = useTheme();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(profil));

  /* Le formulaire part toujours des valeurs enregistrées au moment d'ouvrir l'édition */
  function startEditing() {
    setDraft(toDraft(profil));
    setErrors({});
    setEditing(true);
  }
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const dirty = useMemo(() => {
    const o = toDraft(profil);
    return (Object.keys(o) as (keyof Draft)[]).some((k) => o[k].trim() !== draft[k].trim());
  }, [profil, draft]);

  const save = useMutation({
    mutationFn: (dto: ProfilForm) => updateProfil(dto),
    onSuccess: (updated) => {
      qc.setQueryData(['settings', 'profil'], updated);
      setEditing(false);
      toast('Modifications enregistrées');
    },
    onError: (e) => toast(toUserMessage(e)),
  });

  function validate(): Partial<Record<keyof Draft, string>> {
    const e: Partial<Record<keyof Draft, string>> = {};
    if (!draft.firstName.trim()) e.firstName = 'Le prénom est obligatoire.';
    if (!draft.lastName.trim()) e.lastName = 'Le nom est obligatoire.';
    const u = draft.username.trim().toLowerCase();
    /* Un ancien nom atypique n'est contrôlé que s'il est modifié (comme le serveur) */
    if (u !== profil.username.toLowerCase() && !USERNAME_RE.test(u)) {
      e.username = '3 à 30 caractères : minuscules, chiffres, « . », « _ » ou « - ».';
    }
    if (draft.dateFr) {
      const iso = frToIso(draft.dateFr);
      const d = new Date(`${iso}T00:00:00`);
      const valide = !!iso && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
      if (!valide || iso < '1900-01-01') e.dateFr = 'Date invalide (JJ/MM/AAAA).';
      else if (iso > todayIso()) e.dateFr = 'La date de naissance ne peut pas être dans le futur.';
    }
    if (draft.bio.length > BIO_MAX) e.bio = `La bio ne peut pas dépasser ${BIO_MAX} caractères.`;
    return e;
  }

  function submit() {
    const e = validate();
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    if (!dirty) {
      setEditing(false);
      return;
    }
    save.mutate({
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      username: draft.username.trim().toLowerCase(),
      dateNaissance: frToIso(draft.dateFr),
      genre: draft.genre,
      bio: draft.bio.trim(),
    });
  }

  function cancel() {
    setDraft(toDraft(profil)); // « Annuler » restaure vraiment les valeurs enregistrées
    setErrors({});
    setEditing(false);
  }

  const genreLabel = GENRES.find((g) => g.value === profil.genre)?.label;

  if (!editing) {
    return (
      <Section title="Informations personnelles">
        <Card>
          <Row label="Prénom & nom" value={`${profil.firstName} ${profil.lastName}`.trim() || 'Non défini'} />
          <Row label="Nom d’utilisateur" value={profil.username ? `@${profil.username}` : 'Non défini'} />
          <Row label="Date de naissance" value={profil.dateNaissance ? longDate(profil.dateNaissance) : 'Non renseignée'} />
          <Row label="Genre" value={profil.genre ? (genreLabel ?? profil.genre) : 'Non renseigné'} />
          <View style={styles.bioView}>
            <ThemedText style={styles.rowLabel}>Bio</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {profil.bio || 'Aucune bio renseignée'}
            </ThemedText>
          </View>
        </Card>
        <OutlineButton icon="create-outline" label="Modifier mes informations" onPress={startEditing} />
      </Section>
    );
  }

  return (
    <Section title="Informations personnelles">
      <Card style={styles.formCard}>
        <View style={styles.form}>
          <Field label="Prénom" value={draft.firstName} onChangeText={(v) => set('firstName', v)} maxLength={50} autoComplete="given-name" error={errors.firstName} />
          <Field label="Nom" value={draft.lastName} onChangeText={(v) => set('lastName', v)} maxLength={50} autoComplete="family-name" error={errors.lastName} />
          <Field
            label="Nom d’utilisateur"
            value={draft.username}
            onChangeText={(v) => set('username', v.toLowerCase().replace(/\s+/g, ''))}
            maxLength={30}
            autoCapitalize="none"
            autoCorrect={false}
            left={<ThemedText themeColor="textSecondary" style={styles.at}>@</ThemedText>}
            error={errors.username}
          />
          {!errors.username ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              3 à 30 caractères : minuscules, chiffres, « . », « _ » ou « - ».
            </ThemedText>
          ) : null}
          <Field
            label="Date de naissance"
            value={draft.dateFr}
            onChangeText={(v) => set('dateFr', maskDate(v))}
            placeholder="JJ/MM/AAAA"
            keyboardType="number-pad"
            maxLength={10}
            error={errors.dateFr}
          />
          <View style={styles.group}>
            <ThemedText type="smallBold">Genre</ThemedText>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {GENRES.map((g) => {
                const on = draft.genre === g.value;
                return (
                  <Pressable
                    key={g.value || 'np'}
                    onPress={() => set('genre', g.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={[styles.chip, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? theme.backgroundSelected : theme.background }]}>
                    <ThemedText type="small" style={{ color: on ? Brand.primary : theme.text, fontWeight: on ? '700' : '500' }}>
                      {g.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Field
            label="Bio"
            value={draft.bio}
            onChangeText={(v) => set('bio', v)}
            maxLength={BIO_MAX}
            multiline
            placeholder="Présentez-vous en quelques mots…"
            style={styles.bioInput}
            error={errors.bio}
          />
          <ThemedText type="small" themeColor="textSecondary" style={[styles.hint, styles.right]}>
            {draft.bio.length}/{BIO_MAX} caractères
          </ThemedText>
          <PrimaryButton title="Enregistrer" onPress={submit} loading={save.isPending} disabled={!dirty} />
          <TextButton label="Annuler" onPress={cancel} disabled={save.isPending} />
        </View>
      </Card>
    </Section>
  );
}

/* ─────────────────────────── Coordonnées ─────────────────────────── */

function ContactsCard({ profil, toast }: CardProps) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(profil.email);
  const [phone, setPhone] = useState(profil.phone);
  const [password, setPassword] = useState('');
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const emailChanged = email.trim().toLowerCase() !== profil.email.toLowerCase();
  const phoneChanged = phone.replace(/\D/g, '') !== profil.phone.replace(/\D/g, '');
  const refresh = () => qc.invalidateQueries({ queryKey: ['settings'] });

  const save = useMutation({
    mutationFn: () =>
      updateCoordonnees({
        ...(emailChanged ? { email: email.trim() } : {}),
        ...(phoneChanged ? { phone: phone.trim() } : {}),
        currentPassword: password,
      }),
    onSuccess: async (res) => {
      await refresh(); // le serveur normalise le numéro : on relit l'état réel
      setEditing(false);
      setPassword('');
      if (res.emailCodeSent) {
        setVerifyOpen(true);
        setCode('');
        setCooldown(RESEND_DELAY);
      }
      toast(res.message || 'Coordonnées mises à jour');
    },
    onError: (e) => toast(toUserMessage(e)),
  });

  const requestCode = useMutation({
    mutationFn: sendEmailCode,
    onSuccess: async (res) => {
      setVerifyOpen(true);
      setCode('');
      if (res.sent) setCooldown(RESEND_DELAY);
      else await refresh(); // déjà vérifiée entre-temps
      toast(res.message || 'Code envoyé');
    },
    onError: (e) => toast(toUserMessage(e)),
  });

  const confirm = useMutation({
    mutationFn: () => confirmEmailCode(code),
    onSuccess: async () => {
      qc.setQueryData<Profil>(['settings', 'profil'], (old) => (old ? { ...old, emailVerified: true } : old));
      setVerifyOpen(false);
      setCode('');
      await refresh();
      toast('Adresse e-mail vérifiée');
    },
    onError: (e) => toast(toUserMessage(e)),
  });

  function submit() {
    if (!emailChanged && !phoneChanged) return toast('Aucune modification à enregistrer.');
    if (emailChanged && !/^\S+@\S+\.\S+$/.test(email.trim())) return toast('Adresse e-mail invalide.');
    if (phoneChanged && phone.replace(/\D/g, '').length < 8) return toast('Numéro invalide : indicatif du pays + au moins 8 chiffres.');
    if (!password) return toast('Saisissez votre mot de passe actuel pour modifier vos coordonnées.');
    save.mutate();
  }

  function cancel() {
    setEmail(profil.email);
    setPhone(profil.phone);
    setPassword('');
    setEditing(false);
  }

  return (
    <Section title="Coordonnées" note="Utilisées pour la connexion et les alertes de sécurité.">
      <Card>
        <Row
          icon="mail-outline"
          label="Adresse e-mail"
          desc={profil.email || 'Non renseignée'}
          right={<Pill label={profil.emailVerified ? 'Vérifié' : 'Non vérifié'} tone={profil.emailVerified ? 'success' : 'warning'} />}
        />
        <Row
          icon="call-outline"
          label="Téléphone"
          desc={profil.phone || 'Non renseigné'}
          right={profil.phone ? <Pill label={profil.phoneVerified ? 'Vérifié' : 'Non vérifié'} tone={profil.phoneVerified ? 'success' : 'neutral'} /> : undefined}
        />
      </Card>

      {!profil.emailVerified && !verifyOpen && !editing ? (
        <OutlineButton
          icon="shield-checkmark-outline"
          label="Vérifier mon adresse e-mail"
          onPress={() => requestCode.mutate()}
          loading={requestCode.isPending}
        />
      ) : null}

      {verifyOpen ? (
        <Card style={styles.formCard}>
          <View style={styles.form}>
            <ThemedText type="small" themeColor="textSecondary">
              Un code à 6 chiffres a été envoyé à {profil.email}. Il est valable 10 minutes — pensez à vérifier vos courriers indésirables.
            </ThemedText>
            <Field
              label="Code de vérification"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              placeholder="000000"
              style={styles.code}
            />
            <PrimaryButton title="Confirmer" onPress={() => confirm.mutate()} loading={confirm.isPending} disabled={code.length !== 6} />
            <TextButton
              label={cooldown > 0 ? `Renvoyer le code dans ${cooldown} s` : 'Renvoyer le code'}
              onPress={() => requestCode.mutate()}
              disabled={cooldown > 0 || requestCode.isPending}
            />
          </View>
        </Card>
      ) : null}

      {editing ? (
        <Card style={styles.formCard}>
          <View style={styles.form}>
            <Field
              label="Adresse e-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
            {emailChanged ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                Un code de confirmation sera envoyé à la nouvelle adresse.
              </ThemedText>
            ) : null}
            <Field label="Téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="+224 620 00 00 00" />
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Avec l’indicatif du pays (ex. +224 620 00 00 00).
            </ThemedText>
            <PasswordField label="Mot de passe actuel" value={password} onChangeText={setPassword} autoComplete="current-password" />
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Requis pour protéger votre compte.
            </ThemedText>
            <PrimaryButton title="Enregistrer les changements" onPress={submit} loading={save.isPending} disabled={!emailChanged && !phoneChanged} />
            <TextButton label="Annuler" onPress={cancel} disabled={save.isPending} />
          </View>
        </Card>
      ) : (
        <OutlineButton
          icon="create-outline"
          label="Modifier l’e-mail ou le téléphone"
          onPress={() => {
            setEmail(profil.email); // part des valeurs enregistrées
            setPhone(profil.phone);
            setPassword('');
            setEditing(true);
          }}
        />
      )}
    </Section>
  );
}

/* ─────────────────────────── Boutons ─────────────────────────── */

function SmallButton({ icon, label, onPress, danger, disabled }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  const theme = useTheme();
  const color = danger ? Brand.danger : Brand.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.small, { borderColor: theme.border, opacity: disabled ? 0.5 : 1 }, pressed && { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={icon} size={16} color={color} />
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  bold: { fontSize: 16, lineHeight: 22, fontWeight: '800' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  photo: { width: 76, height: 76, borderRadius: 38 },
  photoFallback: { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, alignItems: 'center', justifyContent: 'center' },
  photoInitial: { color: Brand.primaryInk, fontSize: 30, lineHeight: 36, fontWeight: '800' },
  photoBusy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 38, backgroundColor: 'rgba(31,31,31,0.45)', alignItems: 'center', justifyContent: 'center' },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  small: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  rowLabel: { fontSize: 15, lineHeight: 21 },
  bioView: { paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  formCard: { padding: 0 },
  form: { padding: 14, gap: Spacing.three },
  group: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  bioInput: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
  hint: { marginTop: -Spacing.two },
  right: { textAlign: 'right' },
  at: { paddingLeft: 12 },
  code: { letterSpacing: 8, fontSize: 22, textAlign: 'center' },
});
