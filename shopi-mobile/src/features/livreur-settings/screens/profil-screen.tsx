/**
 * Paramètres › Profil personnel — comme SecProfil du site :
 *   · complétion du profil : exactement les 6 étapes affichées (une liste vide
 *     — zones, horaires — ne compte pas comme remplie) ;
 *   · photo (JPG / PNG / WebP, 5 MB max) envoyée tout de suite ;
 *   · icône de livraison (8 emojis acceptés par le serveur), prénom et nom
 *     obligatoires, bio publique (500), téléphone « +224 » (8 ou 9 chiffres,
 *     normalisé par le serveur), e-mail, langues, ville → commune → quartier.
 * La saisie en cours n'est jamais écrasée par un rechargement des données, et
 * quitter l'écran avec des modifications non enregistrées demande confirmation.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { completionPct, COMPLETION_STEPS, EMOJIS, stepDone, uploadPhoto, type LivreurSettings } from '../api';
import { LocationFields } from '../components/location-fields';
import { pickPhoto } from '../components/pick';
import { FormCard, Input, SaveButton, SettingsShell, toast, toastError, useUnsavedGuard } from '../components/ui';
import { useMergeSettings, useSectionSave } from '../hooks';

type Form = {
  firstName: string;
  lastName: string;
  bio: string;
  phone: string;
  email: string;
  langues: string;
  ville: string;
  commune: string;
  quartier: string;
  emoji: string;
};

const toForm = (d: LivreurSettings): Form => {
  const parts = (d.fullName ?? '').split(' ');
  return {
    firstName: d.firstName ?? parts[0] ?? '',
    lastName: d.lastName ?? parts.slice(1).join(' ') ?? '',
    bio: d.bio ?? '',
    /* « +224 » est affiché devant le champ : jamais en double dans la saisie */
    phone: (d.phone ?? '').replace(/^\+224\s?/, ''),
    email: d.email ?? '',
    langues: d.langues ?? '',
    ville: d.ville ?? '',
    commune: d.commune ?? '',
    quartier: d.quartier ?? '',
    emoji: EMOJIS.includes(d.deliveryEmoji) ? d.deliveryEmoji : '🛵',
  };
};
const same = (a: Form, b: Form) => (Object.keys(a) as (keyof Form)[]).every((k) => a[k] === b[k]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ProfilScreen() {
  return (
    <SettingsShell<LivreurSettings> title="Profil personnel" icon="person-outline" subtitle="Ces informations apparaissent sur votre profil public — visibles par les boutiques et clients.">
      {(d) => <Content d={d} />}
    </SettingsShell>
  );
}

function Content({ d }: { d: LivreurSettings }) {
  const theme = useTheme();
  const save = useSectionSave();
  const merge = useMergeSettings();
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
      merge({ photoUrl: res.photoUrl });
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
      await save('profil', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        bio: form.bio,
        phone: form.phone,
        email: form.email.trim(),
        langues: form.langues,
        ville: form.ville,
        commune: form.commune,
        quartier: form.quartier,
        deliveryEmoji: form.emoji,
      });
      /* Formulaire réaligné sur ce que le serveur a enregistré (téléphone normalisé, espaces…) */
      setBase(form);
      toast('Profil sauvegardé avec succès');
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Complétion */}
      <View style={styles.comp}>
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
              const done = stepDone(d, s.key);
              return (
                <View key={s.label} style={styles.step}>
                  <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={13} color={done ? '#6EE7B7' : 'rgba(255,255,255,0.45)'} />
                  <ThemedText style={[styles.stepText, !done && styles.stepMiss]}>{s.label}</ThemedText>
                </View>
              );
            })}
          </View>
          <ThemedText style={styles.compFoot}>
            Un profil complet reçoit <ThemedText style={styles.compFootBold}>3×</ThemedText> plus de missions
          </ThemedText>
        </View>
      </View>

      <FormCard title="Identité & Photo" icon="id-card-outline">
        <View style={styles.photoRow}>
          <Pressable
            onPress={() => void changePhoto()}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="Changer la photo de profil"
            style={[styles.avatar, { borderColor: theme.border }]}>
            {d.photoUrl ? <Image source={{ uri: d.photoUrl }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.avatarEmoji}>{form.emoji}</ThemedText>}
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
            <SecondaryButton title={uploading ? 'Envoi…' : d.photoUrl ? 'Changer la photo' : 'Ajouter une photo'} onPress={() => void changePhoto()} disabled={uploading} pill />
          </View>
        </View>

        <View style={styles.block}>
          <ThemedText type="smallBold">
            Icône de livraison{' '}
            <ThemedText type="small" themeColor="textSecondary">
              affichée sur vos missions
            </ThemedText>
          </ThemedText>
          <View style={styles.emojis} accessibilityRole="radiogroup">
            {EMOJIS.map((em) => {
              const on = form.emoji === em;
              return (
                <Pressable
                  key={em}
                  onPress={() => set('emoji', em)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`Icône ${em}`}
                  style={[
                    styles.emojiBtn,
                    {
                      borderColor: on ? Brand.primary : theme.border,
                      backgroundColor: on ? Brand.primarySoft : theme.backgroundElement,
                    },
                  ]}>
                  <ThemedText style={styles.emojiText}>{em}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Input label="Prénom" value={form.firstName} onChangeText={(v) => set('firstName', v)} placeholder="Prénom" maxLength={100} error={errors.firstName} autoComplete="given-name" />
        <Input label="Nom" value={form.lastName} onChangeText={(v) => set('lastName', v)} placeholder="Nom de famille" maxLength={100} error={errors.lastName} autoComplete="family-name" />
        <Input
          label="Bio publique (visible sur votre profil)"
          value={form.bio}
          onChangeText={(v) => set('bio', v)}
          placeholder="Décrivez votre expérience, vos zones et vos spécialités…"
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
          hint={errors.phone ? undefined : 'Utilisé pour Orange Money et les appels clients'}
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

      <FormCard title="Lieu de résidence" icon="home-outline">
        <LocationFields
          value={{
            ville: form.ville,
            commune: form.commune,
            quartier: form.quartier,
          }}
          onChange={(p) => setForm((f) => ({ ...f, ...p }))}
        />
      </FormCard>

      <SaveButton label={saving ? 'Sauvegarde…' : 'Sauvegarder le profil'} onPress={() => void submit()} loading={saving} disabled={!dirty} />
      {!dirty ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Aucune modification à enregistrer.
        </ThemedText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  center: { textAlign: 'center' },
  comp: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: '#1F1F1F',
    borderRadius: 18,
    padding: 16,
  },
  compCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compPct: { color: '#fff', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  compPctL: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  compTitle: { color: '#fff', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  compTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 8,
    overflow: 'hidden',
  },
  compBar: { height: '100%', borderRadius: 3, backgroundColor: '#fff' },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepText: {
    color: '#fff',
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '700',
  },
  stepMiss: { color: 'rgba(255,255,255,0.5)' },
  compFoot: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 8,
  },
  compFootBold: {
    color: '#fff',
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '900',
  },
  photoRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  photoText: { gap: 6 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 22,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  avatarEmoji: { fontSize: 40, lineHeight: 48 },
  avatarBusy: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { width: '100%', height: '100%' },
  block: { gap: 8 },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 22, lineHeight: 28 },
  bio: { minHeight: 90, textAlignVertical: 'top' },
  prefix: { fontSize: 14, lineHeight: 19, fontWeight: '800', marginRight: 6 },
});
