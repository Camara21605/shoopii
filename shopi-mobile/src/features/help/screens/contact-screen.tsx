/**
 * Centre d'aide › Contact (comme /contact) — public, sans compte :
 *   · délais de réponse (24-48 h ouvrées ; sécurité / fraude : priorité 4 h) ;
 *   · type de demande, nom, e-mail, sujet, message (mêmes règles que le serveur :
 *     nom ≥ 2, e-mail valide, sujet 5-500, message 20-3000 caractères) ;
 *   · nom et e-mail pré-remplis si l'on est connecté ;
 *   · confirmation avec la référence de la demande ;
 *   · autres canaux : e-mail du support, ticket, centre d'aide.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/features/auth/session-store';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

import { CONTACT_TYPES, sendContact } from '../api';
import { TypeCard } from '../components/ui';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactScreen() {
  const theme = useTheme();
  const user = useSession((s) => s.user);
  const [type, setType] = useState<string>('general');
  const [name, setName] = useState(user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [touched, setTouched] = useState(false);
  const send = useMutation({ mutationFn: () => sendContact({ name: name.trim(), email: email.trim(), subject: subject.trim(), body: body.trim(), type }) });

  const errors = {
    name: name.trim().length < 2 ? 'Indiquez votre nom (2 caractères minimum).' : null,
    email: !EMAIL.test(email.trim()) ? 'Adresse e-mail invalide.' : null,
    subject: subject.trim().length < 5 ? 'Le sujet doit faire au moins 5 caractères.' : null,
    body: body.trim().length < 20 ? `Encore ${20 - body.trim().length} caractère${20 - body.trim().length > 1 ? 's' : ''} minimum.` : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const submit = () => {
    setTouched(true);
    if (valid) send.mutate();
  };

  if (send.isSuccess) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <ScreenHeader title="Contact" />
        <View style={styles.success}>
          <View style={styles.successIco}>
            <Ionicons name="checkmark" size={34} color="#fff" />
          </View>
          <ThemedText style={styles.successTitle}>Message envoyé</ThemedText>
          {send.data?.reference ? (
            <View style={styles.ref}>
              <ThemedText type="small" themeColor="textSecondary">
                Référence de votre demande
              </ThemedText>
              <ThemedText style={styles.refV} selectable>
                {send.data.reference}
              </ThemedText>
            </View>
          ) : null}
          <ThemedText themeColor="textSecondary" style={styles.center}>
            Nous vous répondons à {email.trim()} sous 24 à 48 h ouvrées (4 h pour la sécurité et la fraude).
          </ThemedText>
          <PrimaryButton title="Retour au centre d’aide" onPress={() => router.back()} pill />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Contacter le support" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.sla}>
            <SlaItem icon="time-outline" label="Temps de réponse" value="24-48h ouvrées" />
            <SlaItem icon="shield-half-outline" label="Sécurité / Fraude" value="Priorité haute — 4h" danger />
          </View>

          <ThemedText style={styles.label}>Type de demande</ThemedText>
          <View style={styles.types}>
            {CONTACT_TYPES.map((t) => (
              <TypeCard key={t.value} icon={t.icon} label={t.label} desc={t.desc} selected={type === t.value} onPress={() => setType(t.value)} />
            ))}
          </View>

          <Field label="Nom" value={name} onChangeText={setName} placeholder="Votre nom" maxLength={255} error={touched ? errors.name : null} />
          <Field label="E-mail" value={email} onChangeText={setEmail} placeholder="votre@email.com" keyboardType="email-address" autoCapitalize="none" maxLength={255} error={touched ? errors.email : null} />
          <Field label="Sujet" value={subject} onChangeText={setSubject} placeholder="Sujet de votre message" maxLength={500} error={touched ? errors.subject : null} />
          <Field
            label="Message"
            value={body}
            onChangeText={setBody}
            placeholder="Décrivez votre demande en détail (min. 20 caractères)"
            multiline
            maxLength={3000}
            style={styles.area}
            error={touched ? errors.body : null}
          />
          <ThemedText type="small" style={[styles.counter, body.length > 2700 && styles.warn]} themeColor="textSecondary">
            {body.length}/3000
          </ThemedText>

          {send.isError ? <ThemedText style={styles.err}>{toUserMessage(send.error)}</ThemedText> : null}
          <PrimaryButton title="Envoyer le message" onPress={submit} loading={send.isPending} pill />

          <ThemedText style={styles.label}>Autres moyens</ThemedText>
          <View style={[styles.card, { borderColor: theme.border }]}>
            <Channel icon="mail-outline" label="E-mail support" value="support@shopi.gn" onPress={() => void Linking.openURL('mailto:support@shopi.gn')} first />
            <Channel icon="headset-outline" label="Ticket de support" value="Réponse en 24h" onPress={() => router.push('/support/nouveau')} />
            <Channel icon="book-outline" label="Centre d’aide" value="Base de connaissances" onPress={() => router.push('/aide')} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SlaItem({ icon, label, value, danger }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.slaItem}>
      <Ionicons name={icon} size={20} color={danger ? '#B91C1C' : '#1F1F1F'} />
      <View style={styles.flex}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText style={[styles.slaV, danger && { color: '#B91C1C' }]}>{value}</ThemedText>
      </View>
    </View>
  );
}

function Channel({ icon, label, value, onPress, first }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; onPress: () => void; first?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.channel, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={icon} size={20} color="#1F1F1F" />
      <View style={styles.flex}>
        <ThemedText style={styles.bold}>{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {value}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={17} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  bold: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  sla: { backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 16, padding: 12, gap: 10 },
  slaItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slaV: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '800', marginTop: 6 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  area: { minHeight: 130, textAlignVertical: 'top' },
  counter: { textAlign: 'right', marginTop: -6 },
  warn: { color: '#B45309' },
  err: { color: '#B91C1C', fontSize: 13.5, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  channel: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  success: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 },
  successIco: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#047857', alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  ref: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10 },
  refV: { fontSize: 20, lineHeight: 26, fontWeight: '900', letterSpacing: 1 },
});
