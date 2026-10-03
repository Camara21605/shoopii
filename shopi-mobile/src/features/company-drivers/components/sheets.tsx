/**
 * Feuilles du bas (« modales » du site LivreursPage.tsx) :
 *   · InviteSheet   inviter un livreur : e-mail → aperçu → code réel (copiable, partageable)
 *   · ContactSheet  e-mail au livreur (sujet + message)
 *   · SuspendSheet  suspension confirmée, motif facultatif
 *   · MissionSheet  diffuser une mission aux livreurs disponibles + missions diffusées (annuler)
 *   · ReportSheet   rapport de performances calculé sur les données déjà chargées
 *   · MapSheet      carte des dernières positions connues (pas un suivi en direct)
 * Chaque saisie est contrôlée avec les mêmes limites que le serveur (livreur.dto.ts, mission.dto.ts).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import {
  ActivityIndicator, Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { MapView } from '@/features/location/MapView';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import {
  AVAIL, cancelMission, contactDriver, createMission, fetchMissions, inviteDriver, successRate, suspendDriver,
  type Driver, type DriverStats, type Mission, type MissionStatus, type ZoneStat,
} from '../api';
import { AvailBadge, Pill } from './driver-rows';

const H = Dimensions.get('window').height;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function Sheet({ title, sub, onClose, children, tall, footer }: {
  title: string; sub?: string; onClose: () => void; children: React.ReactNode; tall?: boolean; footer?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: theme.background, maxHeight: H * 0.9 }, tall && { height: H * 0.85 }]}>
            <View style={styles.grip} />
            <View style={styles.head}>
              <View style={styles.flex}>
                <ThemedText style={styles.title} numberOfLines={1}>{title}</ThemedText>
                {sub ? <ThemedText type="small" themeColor="textSecondary">{sub}</ThemedText> : null}
              </View>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer" style={[styles.close, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">{children}</ScrollView>
            {footer ? <View style={[styles.footer, { borderTopColor: theme.border }]}>{footer}</View> : null}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Ghost({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[styles.ghost, { borderColor: theme.border }, disabled && styles.off]}>
      <ThemedText type="smallBold">{title}</ThemedText>
    </Pressable>
  );
}

function Info({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.info, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>{text}</ThemedText>
    </View>
  );
}

/* ── Inviter ──────────────────────────────────────────────────────── */

const INVITE_MESSAGE = 'Bonjour,\n\nNous vous invitons à rejoindre l’équipe de livreurs de notre boutique sur Shoneya. Créez votre compte livreur avec le code ci-dessous pour commencer à recevoir nos courses.';

export function InviteSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const theme = useTheme();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const send = useMutation({ mutationFn: () => inviteDriver(email.trim().toLowerCase(), INVITE_MESSAGE), onSuccess: () => { setStep(3); onDone(); } });

  function next() {
    const e = email.trim();
    if (!e) return setError('L’adresse e-mail est obligatoire.');
    if (e.length > 255 || !EMAIL_RE.test(e)) return setError('Adresse e-mail invalide (ex. nom@exemple.com).');
    setError(null);
    setStep(2);
  }

  const res = send.data;
  return (
    <Sheet title="Inviter un livreur" sub={['1. E-mail', '2. Aperçu', '3. Confirmé'].map((s, i) => (i + 1 === step ? `● ${s}` : s)).join('   ')} onClose={onClose}
      footer={
        step === 1 ? <View style={styles.row}><Ghost title="Annuler" onPress={onClose} /><View style={styles.flex}><PrimaryButton title="Suivant" onPress={next} /></View></View>
        : step === 2 ? <View style={styles.row}><Ghost title="Retour" onPress={() => setStep(1)} disabled={send.isPending} /><View style={styles.flex}><PrimaryButton title="Envoyer l’invitation" onPress={() => send.mutate()} loading={send.isPending} /></View></View>
        : <PrimaryButton title="Fermer" onPress={onClose} />
      }>
      {step === 1 ? (
        <>
          <Field label="E-mail du livreur" value={email} onChangeText={(v) => { setEmail(v); setError(null); }} placeholder="livreur@exemple.com"
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoFocus error={error} returnKeyType="next" onSubmitEditing={next} />
          <Info text="Un code d’invitation lui sera envoyé par e-mail. Il renseignera lui-même son nom, son véhicule et sa zone à l’inscription." />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <View style={[styles.mail, { borderColor: theme.border }]}>
            <View style={styles.mailHead}>
              <View style={styles.logo}><ThemedText style={styles.logoText}>S</ThemedText></View>
              <View style={styles.flex}>
                <ThemedText type="smallBold">Invitation à rejoindre une équipe de livreurs</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">À : {email.trim()}</ThemedText>
              </View>
            </View>
            <ThemedText type="small" style={styles.mailBody}>{INVITE_MESSAGE}</ThemedText>
            <View style={[styles.codeBox, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" themeColor="textSecondary">Code d’invitation</ThemedText>
              <ThemedText style={styles.codeMasked}>••••-••••-••</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Généré à l’envoi</ThemedText>
            </View>
          </View>
          <Info text="Le code expire après quelques jours : le livreur doit l’utiliser pour créer son compte." />
          {send.isError ? <ThemedText type="small" style={styles.err}>{toUserMessage(send.error)}</ThemedText> : null}
        </>
      ) : null}
      {step === 3 && res ? (
        <View style={styles.success}>
          <View style={[styles.successIco, { backgroundColor: `${Brand.success}1A` }]}><Ionicons name="checkmark" size={30} color={Brand.success} /></View>
          <ThemedText style={styles.successTitle}>Invitation envoyée</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>Le code a été envoyé à {res.email}.</ThemedText>
          <View style={[styles.codeBox, styles.full, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">Code généré</ThemedText>
            <ThemedText style={styles.code} selectable>{res.code}</ThemedText>
            <View style={styles.row}>
              <Pressable onPress={() => { void Clipboard.setStringAsync(res.code); setCopied(true); }} accessibilityRole="button" style={styles.smallBtn}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={Brand.primaryInk} />
                <ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>{copied ? 'Copié' : 'Copier'}</ThemedText>
              </Pressable>
              <Pressable onPress={() => void Share.share({ message: `Votre code d’invitation livreur Shoneya : ${res.code}` })} accessibilityRole="button" style={styles.smallBtn}>
                <Ionicons name="share-social-outline" size={16} color={Brand.primaryInk} />
                <ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>Partager</ThemedText>
              </Pressable>
            </View>
            {res.expiresAt ? <ThemedText type="small" themeColor="textSecondary">Expire le {new Date(res.expiresAt).toLocaleDateString('fr-FR')}</ThemedText> : null}
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

/* ── Contacter par e-mail ─────────────────────────────────────────── */

export function ContactSheet({ d, onClose, onDone }: { d: Driver; onClose: () => void; onDone: (m: string) => void }) {
  const [sujet, setSujet] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ sujet?: string; message?: string }>({});
  const send = useMutation({ mutationFn: () => contactDriver(d.id, sujet.trim(), message.trim()), onSuccess: () => onDone(`Message envoyé à ${d.fullName}`) });

  function submit() {
    const e: typeof errors = {};
    if (!sujet.trim()) e.sujet = 'Le sujet est obligatoire.';
    else if (sujet.trim().length > 255) e.sujet = '255 caractères maximum.';
    if (!message.trim()) e.message = 'Le message est obligatoire.';
    else if (message.trim().length > 5000) e.message = '5 000 caractères maximum.';
    setErrors(e);
    if (!Object.keys(e).length) send.mutate();
  }

  return (
    <Sheet title="Contacter par e-mail" sub={`${d.fullName}${d.email ? ` · ${d.email}` : ''}`} onClose={onClose}
      footer={<View style={styles.row}><Ghost title="Annuler" onPress={onClose} disabled={send.isPending} /><View style={styles.flex}><PrimaryButton title="Envoyer" onPress={submit} loading={send.isPending} /></View></View>}>
      <Field label="Sujet" value={sujet} onChangeText={(v) => { setSujet(v); setErrors((x) => ({ ...x, sujet: undefined })); }} placeholder="ex. Course de demain matin" maxLength={255} error={errors.sujet} />
      <Field label="Message" value={message} onChangeText={(v) => { setMessage(v); setErrors((x) => ({ ...x, message: undefined })); }} placeholder="Votre message…"
        multiline style={styles.textarea} maxLength={5000} error={errors.message} />
      <Info text={`Le livreur recevra ce message par e-mail${d.email ? ` (${d.email})` : ''}.`} />
      {send.isError ? <ThemedText type="small" style={styles.err}>{toUserMessage(send.error)}</ThemedText> : null}
    </Sheet>
  );
}

/* ── Suspendre ────────────────────────────────────────────────────── */

export function SuspendSheet({ d, onClose, onDone }: { d: Driver; onClose: () => void; onDone: (m: string) => void }) {
  const [raison, setRaison] = useState('');
  const send = useMutation({ mutationFn: () => suspendDriver(d.id, raison.trim() || undefined), onSuccess: () => onDone(`${d.fullName} est suspendu`) });
  return (
    <Sheet title="Suspendre ce livreur ?" onClose={onClose}
      footer={<View style={styles.row}><Ghost title="Annuler" onPress={onClose} disabled={send.isPending} /><View style={styles.flex}><DangerButton title="Suspendre" onPress={() => send.mutate()} loading={send.isPending} /></View></View>}>
      <View style={[styles.warn, { backgroundColor: `${Brand.danger}12` }]}>
        <Ionicons name="warning-outline" size={22} color={Brand.danger} />
        <ThemedText type="small" style={styles.flex}>
          {d.fullName} ne recevra plus de courses de votre boutique tant qu’il est suspendu. Vous pourrez le réactiver à tout moment depuis sa fiche.
        </ThemedText>
      </View>
      <Field label="Motif (facultatif)" value={raison} onChangeText={setRaison} placeholder="ex. Retards répétés" maxLength={500} multiline style={styles.textareaSm} />
      {send.isError ? <ThemedText type="small" style={styles.err}>{toUserMessage(send.error)}</ThemedText> : null}
    </Sheet>
  );
}

export function DangerButton({ title, onPress, loading }: { title: string; onPress: () => void; loading?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={loading} accessibilityRole="button" style={[styles.danger, loading && styles.off]}>
      {loading ? <ActivityIndicator color="#fff" /> : <ThemedText type="smallBold" style={styles.dangerText}>{title}</ThemedText>}
    </Pressable>
  );
}

/* ── Missions ─────────────────────────────────────────────────────── */

const MISSION_LABEL: Record<MissionStatus, string> = { open: 'Ouverte', accepted: 'Acceptée', completed: 'Terminée', cancelled: 'Annulée' };
const MISSION_COLOR: Record<MissionStatus, string> = { open: Brand.success, accepted: Brand.primaryInk, completed: '#6B6B6B', cancelled: Brand.danger };

export function MissionSheet({ canAssign, onClose, onDone }: { canAssign: boolean; onClose: () => void; onDone: (m: string, error?: boolean) => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [zone, setZone] = useState('');
  const [reward, setReward] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const missions = useQuery({ queryKey: qk.companyDrivers.missions, queryFn: fetchMissions });

  const create = useMutation({
    mutationFn: () => createMission({
      title: title.trim(), description: description.trim() || undefined, zone: zone.trim() || undefined,
      reward: reward ? Number(reward) : undefined, urgent,
    }),
    onSuccess: () => {
      setTitle(''); setDescription(''); setZone(''); setReward(''); setUrgent(false);
      void qc.invalidateQueries({ queryKey: qk.companyDrivers.missions });
      onDone('Mission diffusée aux livreurs disponibles');
    },
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelMission(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.companyDrivers.missions }); onDone('Mission annulée'); },
    onError: (e) => onDone(toUserMessage(e), true),
  });

  function submit() {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Le titre de la mission est obligatoire.';
    else if (title.trim().length < 5) e.title = 'Titre trop court : décrivez la mission en quelques mots.';
    else if (title.trim().length > 255) e.title = '255 caractères maximum.';
    if (description.length > 2000) e.description = '2 000 caractères maximum.';
    if (zone.trim().length > 255) e.zone = '255 caractères maximum.';
    if (reward && (!/^\d+$/.test(reward) || Number(reward) > 100_000_000)) e.reward = 'Montant invalide (GNF, chiffres uniquement).';
    setErrors(e);
    if (!Object.keys(e).length) create.mutate();
  }

  const list = missions.data ?? [];
  return (
    <Sheet title="Diffuser une mission" sub="Proposée à vos livreurs disponibles — le premier qui l’accepte la reçoit." onClose={onClose} tall>
      {canAssign ? (
        <>
          <Field label="Titre *" value={title} onChangeText={(v) => { setTitle(v); setErrors((x) => ({ ...x, title: '' })); }} placeholder="ex. Récupérer un colis chez le fournisseur" maxLength={255} error={errors.title || null} />
          <Field label="Description" value={description} onChangeText={setDescription} placeholder="Détails utiles au livreur…" multiline style={styles.textareaSm} maxLength={2000} error={errors.description || null} />
          <View style={styles.row}>
            <View style={styles.flex}><Field label="Zone" value={zone} onChangeText={setZone} placeholder="ex. Kaloum" maxLength={255} error={errors.zone || null} /></View>
            <View style={styles.flex}>
              <Field label="Récompense (GNF)" value={reward} onChangeText={(v) => { setReward(v.replace(/\D/g, '')); setErrors((x) => ({ ...x, reward: '' })); }} placeholder="Facultatif" keyboardType="number-pad" error={errors.reward || null} />
            </View>
          </View>
          <Pressable onPress={() => setUrgent((u) => !u)} accessibilityRole="switch" accessibilityState={{ checked: urgent }} style={styles.switchRow}>
            <Ionicons name="alert-circle-outline" size={20} color={urgent ? Brand.danger : theme.textSecondary} />
            <ThemedText style={styles.flex}>Mission urgente</ThemedText>
            <Switch value={urgent} onValueChange={setUrgent} trackColor={{ true: Brand.primary, false: '#D0D0D0' }} thumbColor="#fff" />
          </Pressable>
          <PrimaryButton title="Diffuser" onPress={submit} loading={create.isPending} />
          {create.isError ? <ThemedText type="small" style={styles.err}>{toUserMessage(create.error)}</ThemedText> : null}
        </>
      ) : (
        <Info text="Votre rôle permet de consulter les missions, pas d’en diffuser." />
      )}

      <ThemedText style={styles.section}>Missions diffusées</ThemedText>
      {missions.isPending ? <ActivityIndicator color={Brand.primary} /> : !list.length ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>Aucune mission diffusée pour l’instant.</ThemedText>
      ) : list.map((m: Mission) => (
        <View key={m.id} style={[styles.mission, { borderColor: theme.border }]}>
          <View style={styles.flex}>
            <ThemedText numberOfLines={1} style={styles.missionTitle}>{m.urgent ? '🔴 ' : ''}{m.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {[m.zone, m.reward ? `${m.reward.toLocaleString('fr-FR')} GNF` : null, m.status === 'accepted' && m.assignedDeliveryName ? `par ${m.assignedDeliveryName}` : null].filter(Boolean).join(' · ') || '—'}
            </ThemedText>
          </View>
          <Pill label={MISSION_LABEL[m.status]} color={MISSION_COLOR[m.status]} soft />
          {m.status === 'open' && canAssign ? (
            <Pressable onPress={() => cancel.mutate(m.id)} disabled={cancel.isPending} hitSlop={8} accessibilityRole="button" accessibilityLabel="Annuler la mission">
              {cancel.isPending && cancel.variables === m.id ? <ActivityIndicator size="small" color={Brand.danger} /> : <Ionicons name="close-circle-outline" size={22} color={Brand.danger} />}
            </Pressable>
          ) : null}
        </View>
      ))}
    </Sheet>
  );
}

/* ── Rapport de performances ──────────────────────────────────────── */

export function ReportSheet({ drivers, stats, zones, onClose }: { drivers: Driver[]; stats: DriverStats | undefined; zones: ZoneStat[]; onClose: () => void }) {
  const theme = useTheme();
  const actifs = drivers.filter((l) => l.status === 'active');
  const total = actifs.reduce((s, l) => s + l.totalDeliveries, 0);
  const ok = actifs.reduce((s, l) => s + l.successfulDeliveries, 0);
  const rated = actifs.filter((l) => l.averageRating > 0);
  const note = rated.length ? rated.reduce((s, l) => s + l.averageRating, 0) / rated.length : 0;
  const topNote = [...rated].sort((a, b) => b.averageRating - a.averageRating).slice(0, 5);
  const topCourses = [...actifs].filter((l) => l.totalDeliveries > 0).sort((a, b) => b.totalDeliveries - a.totalDeliveries).slice(0, 5);

  return (
    <Sheet title="Rapport de performances" sub={`Basé sur ${actifs.length} livreur${actifs.length > 1 ? 's' : ''} actif${actifs.length > 1 ? 's' : ''}`} onClose={onClose} tall>
      <View style={styles.kpis}>
        {[
          { l: 'Taux de réussite', v: `${total ? Math.round((ok / total) * 100) : 0} %` },
          { l: 'Note moyenne', v: note ? `${note.toFixed(1)} ★` : '—' },
          { l: 'Livraisons totales', v: total.toLocaleString('fr-FR') },
          { l: 'Aujourd’hui', v: (stats?.livrAuj ?? 0).toLocaleString('fr-FR') },
        ].map((k) => (
          <View key={k.l} style={[styles.kpi, { borderColor: theme.border }]}>
            <ThemedText style={styles.kpiV}>{k.v}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>{k.l}</ThemedText>
          </View>
        ))}
      </View>
      <Ranking title="🏆 Meilleures notes" items={topNote.map((l) => ({ id: l.id, name: l.fullName, value: `${l.averageRating.toFixed(1)} ★` }))} />
      <Ranking title="📦 Plus de livraisons" items={topCourses.map((l) => ({ id: l.id, name: l.fullName, value: `${l.totalDeliveries} (${successRate(l)} % réussies)` }))} />
      {zones.length ? (
        <>
          <ThemedText style={styles.section}>🗺️ Répartition par zone</ThemedText>
          {zones.map((z) => <ZoneBar key={z.zone} z={z} />)}
        </>
      ) : null}
    </Sheet>
  );
}

function Ranking({ title, items }: { title: string; items: { id: string; name: string; value: string }[] }) {
  return (
    <>
      <ThemedText style={styles.section}>{title}</ThemedText>
      {!items.length ? <ThemedText type="small" themeColor="textSecondary">Aucune donnée pour l’instant.</ThemedText> : items.map((it, i) => (
        <View key={it.id} style={styles.rank}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rankN}>{i + 1}.</ThemedText>
          <ThemedText numberOfLines={1} style={styles.flex}>{it.name}</ThemedText>
          <ThemedText type="smallBold">{it.value}</ThemedText>
        </View>
      ))}
    </>
  );
}

export function ZoneBar({ z }: { z: ZoneStat }) {
  const theme = useTheme();
  return (
    <View style={styles.zone}>
      <View style={styles.rowBetween}>
        <ThemedText numberOfLines={1} style={styles.flex}>{z.zone}</ThemedText>
        <ThemedText type="smallBold">{z.orders}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.pct}>{z.pct} %</ThemedText>
      </View>
      <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.barFill, { width: `${Math.max(2, Math.min(100, z.pct))}%` }]} />
      </View>
    </View>
  );
}

/* ── Carte ────────────────────────────────────────────────────────── */

const CONAKRY = { lat: 9.6412, lng: -13.5784 };

export function MapSheet({ drivers, onClose, onOpen }: { drivers: Driver[]; onClose: () => void; onOpen: (d: Driver) => void }) {
  const theme = useTheme();
  const placed = drivers.filter((l) => l.lastLatitude != null && l.lastLongitude != null);
  const [selected, setSelected] = useState<string | null>(null);
  const sel = placed.find((l) => l.id === selected) ?? null;
  const center = placed.length
    ? { lat: placed.reduce((s, l) => s + l.lastLatitude!, 0) / placed.length, lng: placed.reduce((s, l) => s + l.lastLongitude!, 0) / placed.length }
    : CONAKRY;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <View style={[styles.mapHead, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer"><Ionicons name="arrow-back" size={24} color={theme.text} /></Pressable>
          <View style={styles.flex}>
            <ThemedText style={styles.title}>Carte des livreurs</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {placed.length ? `${placed.length} livreur${placed.length > 1 ? 's' : ''} · dernière position connue` : 'Aucune position partagée'}
            </ThemedText>
          </View>
        </View>
        {placed.length ? (
          <View style={styles.flex}>
            <MapView
              initialCenter={center}
              onSelect={setSelected}
              onTap={() => setSelected(null)}
              state={{
                actors: placed.map((l) => ({ key: l.id, role: 'delivery', lat: l.lastLatitude!, lng: l.lastLongitude!, approx: false, precision: 'exact' })),
                selectedKey: selected, me: null, place: null, activePlace: null, radius: null, route: null, style: 'plan', labelsOn: true,
              }}
            />
            <View style={styles.legend}>
              {(['available', 'on_delivery', 'offline'] as const).map((a) => (
                <View key={a} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: AVAIL[a].color }]} /><ThemedText type="small">{placed.filter((l) => l.availability === a).length} {AVAIL[a].label.toLowerCase()}</ThemedText></View>
              ))}
            </View>
            {sel ? (
              <Pressable onPress={() => onOpen(sel)} accessibilityRole="button" style={[styles.mapCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <ThemedText style={styles.avatarEmoji}>{sel.avatarEmoji}</ThemedText>
                <View style={styles.flex}>
                  <ThemedText style={styles.missionTitle}>{sel.fullName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{sel.zone ?? 'Zone non définie'}</ThemedText>
                </View>
                <AvailBadge a={sel.availability} />
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.mapEmpty}>
            <Ionicons name="map-outline" size={40} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.center}>
              La position d’un livreur apparaît ici dès qu’il la partage depuis son application, pendant une course.
            </ThemedText>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,.35)' },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  full: { alignSelf: 'stretch' },
  off: { opacity: 0.5 },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D0D0', marginTop: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6 },
  title: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 18, gap: 12 },
  footer: { paddingHorizontal: 18, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ghost: { borderWidth: 1.2, borderRadius: 999, paddingHorizontal: 18, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  info: { flexDirection: 'row', gap: 8, borderRadius: 12, padding: 10 },
  err: { color: Brand.danger, fontWeight: '600' },
  textarea: { minHeight: 120, textAlignVertical: 'top' },
  textareaSm: { minHeight: 72, textAlignVertical: 'top' },
  mail: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
  mailHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 10, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: Brand.primaryInk, fontWeight: '900', fontSize: 18 },
  mailBody: { lineHeight: 19 },
  codeBox: { borderRadius: 12, padding: 12, alignItems: 'center', gap: 6 },
  codeMasked: { fontSize: 20, letterSpacing: 4, fontWeight: '800', color: '#A3A3A3' },
  code: { fontSize: 24, lineHeight: 30, letterSpacing: 3, fontWeight: '900' },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Brand.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  success: { alignItems: 'center', gap: 8 },
  successIco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  warn: { flexDirection: 'row', gap: 10, borderRadius: 12, padding: 12, alignItems: 'flex-start' },
  danger: { backgroundColor: Brand.danger, borderRadius: 999, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  dangerText: { color: '#fff', fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  section: { fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 8 },
  mission: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  missionTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 2 },
  kpiV: { fontSize: 20, lineHeight: 26, fontWeight: '900' },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  rankN: { width: 22 },
  zone: { gap: 5 },
  pct: { width: 44, textAlign: 'right' },
  bar: { height: 7, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: Brand.primary },
  mapHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  legend: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10, backgroundColor: 'rgba(255,255,255,.94)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  mapCard: { position: 'absolute', left: 12, right: 12, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 12 },
  avatarEmoji: { fontSize: 26, lineHeight: 32 },
  mapEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
});
