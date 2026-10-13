/**
 * Paramètres › Profil & identité — comme SecProfil du site :
 *   · complétion du profil : les 7 étapes du site (photo, identité, dépôt,
 *     zone, horaires, infos fiscales, assurance), chacune réellement vérifiée ;
 *   · photo (JPG / PNG / WebP, 5 MB max) envoyée dès qu'elle est choisie ;
 *   · prénom et nom obligatoires, bio publique (500), téléphone « +224 »
 *     (8 ou 9 chiffres, enregistré au format +224XXXXXXXXX pour rester
 *     utilisable à la connexion), e-mail, langues, type de point relais
 *     (régional / zonal / national — filtre de recherche des boutiques) ;
 *   · « Votre partenaire Shoneya » si un partenaire vous a recruté.
 * La saisie en cours n'est jamais écrasée par un rechargement des données, et
 * quitter l'écran avec des modifications non enregistrées demande confirmation.
 * (« Un profil complet attire 2× plus de boutiques » du site n'est fondé sur
 * aucune mesure : pas repris.)
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { FormCard, Input, pickPhoto, SaveButton, SettingsShell, toast, toastError, useUnsavedGuard } from '@/features/settings-kit';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { completionPct, COMPLETION_STEPS, fetchRecruiter, RELAY_TYPES, uploadPhoto, type CorrespondantSettings, type ProfilBody } from '../api';
import { useCorrespondantSettings, useMergeSettings, useSectionSave } from '../hooks';

type Form = Omit<ProfilBody, 'phone'> & { phone: string };

const toForm = (d: CorrespondantSettings): Form => ({
  firstName: d.firstName ?? '',
  lastName: d.lastName ?? '',
  /* « +224 » est affiché devant le champ : jamais en double dans la saisie */
  phone: (d.phone ?? '').replace(/^(\+|00)224\s?/, ''),
  email: d.email ?? '',
  bio: d.bio ?? '',
  langues: d.langues ?? '',
  typeCorrespondant: d.typeCorrespondant || 'regional',
});
const same = (a: Form, b: Form) => (Object.keys(a) as (keyof Form)[]).every((k) => a[k] === b[k]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CorrespondantProfilScreen() {
  const q = useCorrespondantSettings();
  return (
    <SettingsShell<CorrespondantSettings>
      query={q}
      title="Profil & identité"
      icon="person-outline"
      subtitle="Informations publiques de votre point relais — visibles par vos boutiques, livreurs et clients.">
      {(d) => <Content d={d} />}
    </SettingsShell>
  );
}

function Content({ d }: { d: CorrespondantSettings }) {
  const theme = useTheme();
  const save = useSectionSave();
  const merge = useMergeSettings();
  const recruiter = useQuery({ queryKey: qk.correspondant.recruiter, queryFn: fetchRecruiter, staleTime: 10 * 60_000 });
  const [form, setForm] = useState<Form>(() => toForm(d));
  const [base, setBase] = useState<Form>(() => toForm(d));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});

  /* Données du serveur changées (autre écran, rechargement) : le formulaire ne
   * les reprend que si l'on n'était pas en train de le modifier. */
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

  const pct = completionPct(d);

  const changePhoto = async () => {
    const picked = await pickPhoto();
    if (!picked.ok) {
      if (picked.error) toast(picked.error, 'danger');
      return;
    }
    setUploading(true);
    toast('Envoi de la photo en cours…', 'info');
    try {
      const res = await uploadPhoto(picked.file);
      merge({ profilePicture: res.profilePicture });
      toast('Photo de profil mise à jour');
    } catch (e) {
      toastError(e, 'Échec de l’envoi de la photo');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const errs: Partial<Record<keyof Form, string>> = {};
    if (!form.firstName.trim()) errs.firstName = 'Le prénom est obligatoire.';
    if (!form.lastName.trim()) errs.lastName = 'Le nom est obligatoire.';
    const digits = form.phone.replace(/\D/g, '');
    if (form.phone.trim() && (digits.length < 8 || digits.length > 9)) errs.phone = 'Numéro invalide : 8 ou 9 chiffres après +224 (ex. 620 00 00 00).';
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) errs.email = 'Adresse e-mail invalide (ex. nom@domaine.com).';
    setErrors(errs);
    if (Object.keys(errs).length) return toast(Object.values(errs)[0] as string, 'danger');
    setSaving(true);
    try {
      /* Le serveur ignore un téléphone ou un e-mail vide (il garde l'ancien) : on n'envoie que ce qui est rempli */
      const body: Partial<ProfilBody> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        bio: form.bio.trim(),
        langues: form.langues.trim(),
        typeCorrespondant: form.typeCorrespondant,
      };
      if (digits) body.phone = `+224${digits}`;
      if (form.email.trim()) body.email = form.email.trim().toLowerCase();
      await save('profil', body);
      /* Formulaire réaligné sur ce que le serveur a enregistré (téléphone sans espaces, e-mail en minuscules…) */
      setBase(form);
      toast('Profil sauvegardé avec succès');
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const r = recruiter.data;

  return (
    <>
      {/* Complétion */}
      <View style={styles.comp} accessible accessibilityLabel={`Profil complété à ${pct}%`}>
        <View style={styles.compCircle}>
          <ThemedText style={styles.compPct}>{pct}%</ThemedText>
          <ThemedText style={styles.compPctL}>Profil</ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.compTitle}>
            Profil complété à {pct}%{pct < 100 ? ' — À compléter' : ''}
          </ThemedText>
          <View style={styles.compTrack}>
            <View style={[styles.compBar, { width: `${pct}%` }]} />
          </View>
          <View style={styles.steps}>
            {COMPLETION_STEPS.map((s) => {
              const done = s.done(d);
              return (
                <View key={s.label} style={styles.step}>
                  <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={13} color={done ? '#6EE7B7' : 'rgba(255,255,255,0.45)'} />
                  <ThemedText style={[styles.stepText, !done && styles.stepMiss]}>{s.label}</ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <FormCard title="Photo" subtitle="Votre photo rassure les boutiques et livreurs partenaires" icon="camera-outline">
        <View style={styles.photoRow}>
          <Pressable
            onPress={() => void changePhoto()}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="Changer la photo de profil"
            style={[styles.avatar, { borderColor: theme.border }]}>
            {d.profilePicture ? <Image source={{ uri: d.profilePicture }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.avatarEmoji}>📍</ThemedText>}
            {uploading ? (
              <View style={styles.avatarBusy}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
          </Pressable>
          <View style={[styles.flex, styles.photoText]}>
            <ThemedText style={styles.bold}>Photo de profil</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              JPG, PNG ou WebP · max 5 MB. Enregistrée dès qu’elle est choisie.
            </ThemedText>
            <SecondaryButton title={uploading ? 'Envoi…' : d.profilePicture ? 'Changer la photo' : 'Ajouter une photo'} onPress={() => void changePhoto()} disabled={uploading} pill />
          </View>
        </View>
      </FormCard>

      <FormCard title="Informations personnelles" icon="id-card-outline">
        <Input label="Prénom" value={form.firstName} onChangeText={(v) => set('firstName', v)} placeholder="Prénom" maxLength={100} error={errors.firstName} autoComplete="given-name" />
        <Input label="Nom" value={form.lastName} onChangeText={(v) => set('lastName', v)} placeholder="Nom de famille" maxLength={100} error={errors.lastName} autoComplete="family-name" />
        <Input
          label="Bio publique (visible sur votre profil)"
          value={form.bio}
          onChangeText={(v) => set('bio', v)}
          placeholder="Présentez votre point relais : services, accueil, spécialités…"
          multiline
          counter={500}
          style={styles.bio}
        />
      </FormCard>

      <FormCard title="Coordonnées" icon="call-outline">
        <Input
          label="Téléphone principal"
          value={form.phone}
          onChangeText={(v) => set('phone', v.replace(/[^\d\s]/g, ''))}
          placeholder="620 00 00 00"
          keyboardType="phone-pad"
          maxLength={14}
          error={errors.phone}
          hint={errors.phone ? undefined : 'Votre numéro personnel (Orange Money, connexion). Le numéro public du relais se règle dans « Point de dépôt ».'}
          left={<ThemedText style={styles.prefix}>🇬🇳 +224</ThemedText>}
        />
        <Input
          label="E-mail"
          value={form.email}
          onChangeText={(v) => set('email', v)}
          placeholder="votre@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={255}
          error={errors.email}
        />
        <Input label="Langues parlées" value={form.langues} onChangeText={(v) => set('langues', v)} placeholder="Français, Pular, Soussou" maxLength={255} />
      </FormCard>

      <FormCard title="Type de point relais" subtitle="Votre portée géographique — les boutiques peuvent filtrer les relais par type." icon="git-network-outline">
        <View style={styles.types} accessibilityRole="radiogroup">
          {RELAY_TYPES.map((t) => {
            const on = form.typeCorrespondant === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => set('typeCorrespondant', t.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${t.label} — ${t.sub}`}
                style={[styles.type, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? Brand.primary : theme.textSecondary} />
                <View style={styles.flex}>
                  <ThemedText style={styles.bold}>{t.label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t.sub}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </FormCard>

      <SaveButton label={saving ? 'Sauvegarde…' : 'Sauvegarder le profil'} onPress={() => void submit()} loading={saving} disabled={!dirty} />
      {!dirty ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Aucune modification à enregistrer.
        </ThemedText>
      ) : null}

      {r ? (
        <View style={[styles.recruiter, { borderColor: theme.border }]}>
          <View style={[styles.recIco, { backgroundColor: theme.backgroundSelected }]}>
            <Ionicons name="people-outline" size={18} color={Brand.primary} />
          </View>
          <View style={styles.flex}>
            <ThemedText style={styles.recCaps} themeColor="textSecondary">
              Votre partenaire Shoneya
            </ThemedText>
            <ThemedText style={styles.bold}>{r.nom}</ThemedText>
            {r.zone ? (
              <ThemedText type="small" themeColor="textSecondary">
                {r.zone}
              </ThemedText>
            ) : null}
          </View>
          {r.telephone ? (
            <Pressable
              onPress={() => void Linking.openURL(`tel:${r.telephone!.replace(/\s+/g, '')}`)}
              accessibilityRole="button"
              accessibilityLabel={`Appeler votre partenaire, ${r.telephone}`}
              style={styles.recCall}>
              <Ionicons name="call-outline" size={16} color={Brand.primary} />
              <ThemedText type="smallBold">{r.telephone}</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  center: { textAlign: 'center' },
  comp: { flexDirection: 'row', gap: 14, backgroundColor: '#1F1F1F', borderRadius: 18, padding: 16 },
  compCircle: { width: 66, height: 66, borderRadius: 33, borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  compPct: { color: '#fff', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  compPctL: { color: 'rgba(255,255,255,0.6)', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  compTitle: { color: '#fff', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  compTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 8, overflow: 'hidden' },
  compBar: { height: '100%', borderRadius: 3, backgroundColor: '#fff' },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepText: { color: '#fff', fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
  stepMiss: { color: 'rgba(255,255,255,0.5)' },
  photoRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  photoText: { gap: 6 },
  avatar: { width: 88, height: 88, borderRadius: 22, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)' },
  avatarEmoji: { fontSize: 40, lineHeight: 48 },
  avatarBusy: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  bio: { minHeight: 90, textAlignVertical: 'top' },
  prefix: { fontSize: 14, lineHeight: 19, fontWeight: '800', marginRight: 6 },
  types: { gap: 8 },
  type: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  recruiter: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  recIco: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  recCaps: { fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  recCall: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
