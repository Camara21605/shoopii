/**
 * Paramètres › Notifications — préférences RÉELLES du compte (mêmes que la
 * rubrique « Notifications » du site, GET/PATCH /client/parametres/notifs) :
 *   - canaux : push, e-mail ;
 *   - catégories (commandes, promotions, messages, social) × push / e-mail ;
 *   - « Ne pas déranger » : plage horaire + fuseau.
 * Chaque interrupteur s'enregistre aussitôt, un à la fois (use-serial-queue) ;
 * la plage « Ne pas déranger » a son propre bouton (saisie d'heures).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchNotifs, updateNotifs, type Notifs } from '@/features/settings/api';
import { Card, LoadState, Row, Section, SwitchRow, Toggle, useToast, type IconName } from '@/features/settings/ui';
import { useSerialQueue } from '@/features/settings/use-serial-queue';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

const KEY = ['settings', 'notifs'];
const GROUPS: { key: string; icon: IconName; title: string; desc: string }[] = [
  { key: 'commandes', icon: 'bag-handle-outline', title: 'Commandes, livraisons & paiements', desc: 'Confirmation, expédition, livraison, retours, paiements' },
  { key: 'promos', icon: 'pricetag-outline', title: 'Promotions & offres', desc: 'Promotions, baisses de prix, retours en stock, messages des boutiques' },
  { key: 'messages', icon: 'chatbubble-ellipses-outline', title: 'Messages & appels', desc: 'Nouveaux messages, appels manqués' },
  { key: 'social', icon: 'people-outline', title: 'Activité sociale', desc: 'Nouveaux abonnés, réponses à vos avis, stories' },
];
const TIMEZONES = ['Africa/Conakry', 'UTC', 'Europe/Paris', 'Europe/London', 'America/New_York', 'Asia/Shanghai', 'Asia/Dubai'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** 2230 → 22:30 au fil de la frappe */
const maskTime = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
};

export default function NotificationsSettings() {
  const theme = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const queue = useSerialQueue();
  const query = useQuery({ queryKey: KEY, queryFn: fetchNotifs });
  const view = query.data;

  /* Modification immédiate : affichage optimiste, envoi en file, seule la dernière réponse s'applique */
  function apply(optimistic: Notifs, body: Parameters<typeof updateNotifs>[0]) {
    qc.setQueryData(KEY, optimistic);
    const { promise, isLatest } = queue(() => updateNotifs(body));
    promise
      .then((v) => {
        if (isLatest()) qc.setQueryData(KEY, v);
      })
      .catch((e) => {
        toast.show(toUserMessage(e));
        if (isLatest()) void qc.invalidateQueries({ queryKey: KEY });
      });
  }

  /* Chaque touche INVERSE la dernière valeur connue (cache à jour), au lieu de
   * se fier à la valeur transmise par l'interrupteur : deux touches arrivées
   * avant que l'écran se redessine donneraient sinon deux fois la même valeur. */
  const latest = () => qc.getQueryData<Notifs>(KEY) ?? view;

  const toggleGlobal = (ch: 'push' | 'email') => {
    const cur = latest();
    if (!cur) return;
    const global = { ...cur.global, [ch]: !cur.global[ch] };
    apply({ ...cur, global }, { global });
  };
  const toggleGroup = (key: string, ch: 'push' | 'email') => {
    const cur = latest();
    if (!cur) return;
    const current = cur.groups[key] ?? { push: true, email: false };
    const next = { ...current, [ch]: !current[ch] };
    apply({ ...cur, groups: { ...cur.groups, [key]: next } }, { groups: { [key]: next } });
  };
  const toggleDnd = () => {
    const cur = latest();
    if (!cur) return;
    const dnd = { ...cur.dnd, enabled: !cur.dnd.enabled };
    /* Plage complète : le serveur compare début et fin même quand seul
     * `enabled` change (envoyé seul, il répond 400 « doivent être différents »). */
    apply({ ...cur, dnd }, { dnd: { enabled: dnd.enabled, start: dnd.start, end: dnd.end, timezone: dnd.timezone } });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Notifications" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!view ? (
          <LoadState loading={query.isLoading} error={query.error ? toUserMessage(query.error) : null} onRetry={() => void query.refetch()} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText themeColor="textSecondary">Choisissez quand et comment être notifié. Chaque réglage s’applique immédiatement.</ThemedText>

            <Section title="Canaux">
              <Card>
                <SwitchRow
                  icon="phone-portrait-outline"
                  label="Notifications push"
                  desc="Alertes sur votre appareil, même hors de l’application"
                  value={view.global.push}
                  onChange={() => toggleGlobal('push')}
                />
                <SwitchRow
                  icon="mail-outline"
                  label="Notifications par e-mail"
                  desc="Résumés et alertes envoyés à votre adresse e-mail"
                  value={view.global.email}
                  onChange={() => toggleGlobal('email')}
                />
              </Card>
            </Section>

            <Section title="Ce qui vous est signalé">
              <Card>
                {GROUPS.map((g) => {
                  const pref = view.groups[g.key] ?? { push: true, email: false };
                  return (
                    <View key={g.key}>
                      <Row icon={g.icon} label={g.title} desc={g.desc} />
                      <View style={styles.channels}>
                        <ChannelToggle
                          label="Push"
                          a11y={`${g.title} — push`}
                          value={pref.push}
                          muted={!view.global.push}
                          onChange={() => toggleGroup(g.key, 'push')}
                        />
                        <ChannelToggle
                          label="E-mail"
                          a11y={`${g.title} — e-mail`}
                          value={pref.email}
                          muted={!view.global.email}
                          onChange={() => toggleGroup(g.key, 'email')}
                        />
                      </View>
                    </View>
                  );
                })}
              </Card>
              {!view.global.push || !view.global.email ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.pad}>
                  Un canal coupé ci-dessus l’emporte sur ces choix.
                </ThemedText>
              ) : null}
            </Section>

            <Section title="Ne pas déranger">
              <Card>
                <SwitchRow
                  icon="moon-outline"
                  label="Ne pas déranger"
                  desc="Aucune notification push ou e-mail pendant la plage choisie (les urgences restent envoyées)"
                  value={view.dnd.enabled}
                  onChange={toggleDnd}
                />
                {view.dnd.enabled ? (
                  /* key : l'éditeur repart des valeurs du serveur quand elles changent */
                  <DndEditor
                    key={`${view.dnd.start}|${view.dnd.end}|${view.dnd.timezone}`}
                    view={view}
                    onSaved={(v) => qc.setQueryData(KEY, v)}
                    toast={toast.show}
                  />
                ) : null}
              </Card>
            </Section>

            <ThemedText type="small" themeColor="textSecondary" style={styles.pad}>
              Les alertes de sécurité du compte et les messages urgents sont toujours envoyés. Les notifications par SMS ne sont pas encore disponibles.
            </ThemedText>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      {toast.element}
    </SafeAreaView>
  );
}

function ChannelToggle({ label, a11y, value, muted, onChange }: { label: string; a11y: string; value: boolean; muted: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[styles.channel, muted && { opacity: 0.55 }]}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Toggle label={a11y} value={value} onChange={onChange} />
    </View>
  );
}

function DndEditor({ view, onSaved, toast }: { view: Notifs; onSaved: (v: Notifs) => void; toast: (m: string) => void }) {
  const theme = useTheme();
  const [start, setStart] = useState(view.dnd.start);
  const [end, setEnd] = useState(view.dnd.end);
  const [tz, setTz] = useState(view.dnd.timezone);
  const [saving, setSaving] = useState(false);

  const startOk = HHMM.test(start);
  const endOk = HHMM.test(end);
  const same = startOk && endOk && start === end;
  const dirty = start !== view.dnd.start || end !== view.dnd.end || tz !== view.dnd.timezone;
  const zones = TIMEZONES.includes(tz) ? TIMEZONES : [tz, ...TIMEZONES];

  async function save() {
    setSaving(true);
    try {
      const v = await updateNotifs({ dnd: { enabled: true, start, end, timezone: tz } });
      onSaved(v);
      toast('Plage « Ne pas déranger » enregistrée');
    } catch (e) {
      toast(toUserMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.dnd}>
      <View style={styles.times}>
        <View style={styles.flex}>
          <Field label="De" value={start} onChangeText={(v) => setStart(maskTime(v))} keyboardType="number-pad" maxLength={5} placeholder="22:00" error={start && !startOk ? 'Format HH:MM' : null} />
        </View>
        <View style={styles.flex}>
          <Field label="À" value={end} onChangeText={(v) => setEnd(maskTime(v))} keyboardType="number-pad" maxLength={5} placeholder="07:00" error={end && !endOk ? 'Format HH:MM' : null} />
        </View>
      </View>
      {same ? (
        <ThemedText type="small" style={{ color: Brand.danger }} accessibilityRole="alert">
          Le début et la fin doivent être différents.
        </ThemedText>
      ) : null}
      <ThemedText type="smallBold">Fuseau horaire</ThemedText>
      <View style={styles.chips}>
        {zones.map((z) => {
          const on = z === tz;
          return (
            <Pressable
              key={z}
              onPress={() => setTz(z)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[styles.chip, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? theme.backgroundSelected : theme.background }]}>
              <ThemedText type="small" style={{ color: on ? Brand.primary : theme.text, fontWeight: on ? '700' : '500' }}>
                {z}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Les heures s’entendent dans ce fuseau horaire.
      </ThemedText>
      <PrimaryButton title="Enregistrer la plage" onPress={() => void save()} loading={saving} disabled={!dirty || !startOk || !endOk || same} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  pad: { paddingHorizontal: 4 },
  channels: { flexDirection: 'row', gap: Spacing.three, paddingLeft: 60, paddingRight: 14, paddingBottom: 12, marginTop: -4 },
  channel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dnd: { padding: 14, gap: Spacing.three },
  times: { flexDirection: 'row', gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
});
