/**
 * Paramètres › Horaires d'ouverture — comme HorairesSection du site :
 *   · un jour = ouvert/fermé + heure d'ouverture et de fermeture ;
 *   · horaires proposés (08:00–20:00, dimanche fermé) tant que rien n'est
 *     enregistré — les clients voient alors « Horaires non renseignés » ;
 *   · jour invalide (heure manquante, ouverture = fermeture) signalé en rouge
 *     et JAMAIS envoyé ; « Ferme après minuit » quand la fermeture est plus tôt ;
 *   · raccourci « Copier les horaires du lundi sur les autres jours ouverts ».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { JOURS, patchSection, type Horaire, type Settings } from '../api';
import { FormCard, Hint, SaveButton, SettingsShell, toast, toastError, useEditable } from '../components/ui';
import { useMergeSettings, useSettings } from '../hooks';

const LABEL: Record<string, string> = { lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche' };
const hhmm = (v: string | null) => (v ? v.slice(0, 5) : '');
const defaults = (): Horaire[] => JOURS.map((jour) => ({ jour, ouverture: '08:00', fermeture: jour === 'dimanche' ? '18:00' : '20:00', actif: jour !== 'dimanche' }));
const errorOf = (h: Horaire) => (!h.actif ? null : !h.ouverture || !h.fermeture ? 'Heures manquantes' : hhmm(h.ouverture) === hhmm(h.fermeture) ? 'Ouverture et fermeture identiques' : null);
/** Forme comparable d'une semaine (heures d'un jour fermé ignorées). */
const snap = (l: Horaire[]) => JSON.stringify(l.map((h) => [h.jour, h.actif, h.actif ? hhmm(h.ouverture) : '', h.actif ? hhmm(h.fermeture) : '']));

function normalize(list: Horaire[] | undefined): Horaire[] {
  if (!list?.length) return defaults();
  return JOURS.map((jour) => {
    const h = list.find((x) => x.jour === jour);
    return h ? { ...h, ouverture: hhmm(h.ouverture) || null, fermeture: hhmm(h.fermeture) || null } : { jour, ouverture: null, fermeture: null, actif: false };
  });
}

export default function HorairesScreen() {
  const q = useSettings();
  return (
    <SettingsShell title="Horaires d’ouverture" icon="time-outline" subtitle="Vos jours et heures d’ouverture, affichés sur votre page boutique.">
      {q.data ? <Content d={q.data} /> : null}
    </SettingsShell>
  );
}

function Content({ d }: { d: Settings }) {
  const theme = useTheme();
  const editable = useEditable();
  const merge = useMergeSettings();
  const registered = !!d.horaires?.length;
  const server = normalize(d.horaires);
  const [edit, setEdit] = useState<Horaire[] | null>(null);
  const [picker, setPicker] = useState<{ jour: string; field: 'ouverture' | 'fermeture' } | null>(null);
  const [saving, setSaving] = useState(false);
  const list = edit ?? server;
  const dirty = !registered || snap(list) !== snap(server);
  const invalid = list.some((h) => errorOf(h));

  const update = (jour: string, patch: Partial<Horaire>) =>
    setEdit(
      list.map((h) => {
        if (h.jour !== jour) return h;
        const next = { ...h, ...patch };
        /* Rouvrir un jour sans heures : on repart d'horaires raisonnables */
        if (patch.actif && (!next.ouverture || !next.fermeture)) return { ...next, ouverture: '08:00', fermeture: '20:00' };
        return next;
      }),
    );

  const copyMonday = () => {
    const lundi = list[0];
    if (!lundi.actif || errorOf(lundi)) return toast('Ouvrez d’abord le lundi avec des horaires valides.', 'warning');
    setEdit(list.map((h) => (h.actif ? { ...h, ouverture: lundi.ouverture, fermeture: lundi.fermeture } : h)));
    toast('Horaires du lundi copiés');
  };

  const submit = async () => {
    if (invalid) return toast('Corrigez les jours en rouge : rien n’est enregistré tant qu’ils sont invalides.', 'danger');
    setSaving(true);
    try {
      const res = await patchSection('horaires', {
        horaires: list.map(({ jour, ouverture, fermeture, actif }) => ({ jour, ouverture: ouverture ?? '08:00', fermeture: fermeture ?? '20:00', actif })),
      });
      merge({ horaires: Array.isArray(res) ? (res as Horaire[]) : list });
      setEdit(null);
      toast('Horaires sauvegardés');
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {!registered ? (
        <Hint
          icon="alert-circle-outline"
          tone="warning"
          text="Vos horaires ne sont pas encore enregistrés : les clients voient « Horaires non renseignés ». Vérifiez les horaires proposés ci-dessous puis enregistrez-les."
        />
      ) : null}

      <FormCard title="Horaires par jour" icon="calendar-outline" subtitle="Activez les jours d’ouverture et définissez les horaires">
        {list.map((h, i) => {
          const err = errorOf(h);
          const afterMidnight = h.actif && !err && hhmm(h.fermeture) < hhmm(h.ouverture);
          return (
            <View key={h.jour} style={[styles.day, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
              <View style={styles.dayHead}>
                <ThemedText style={[styles.dayName, !h.actif && { color: theme.textSecondary }]}>{LABEL[h.jour] ?? h.jour}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {h.actif ? 'Ouvert' : 'Fermé ce jour'}
                </ThemedText>
                <DaySwitch on={h.actif} label={`${LABEL[h.jour]} ouvert`} disabled={!editable} onChange={(v) => update(h.jour, { actif: v })} />
              </View>
              {h.actif ? (
                <View style={styles.times}>
                  <TimeBtn label="Ouverture" value={hhmm(h.ouverture)} error={!!err} disabled={!editable} onPress={() => setPicker({ jour: h.jour, field: 'ouverture' })} />
                  <Ionicons name="arrow-forward" size={16} color={theme.textSecondary} />
                  <TimeBtn label="Fermeture" value={hhmm(h.fermeture)} error={!!err} disabled={!editable} onPress={() => setPicker({ jour: h.jour, field: 'fermeture' })} />
                </View>
              ) : null}
              {err ? <ThemedText style={styles.err}>{err}</ThemedText> : null}
              {afterMidnight ? (
                <ThemedText type="small" themeColor="textSecondary">
                  <Ionicons name="moon-outline" size={12} /> Ferme après minuit
                </ThemedText>
              ) : null}
            </View>
          );
        })}
        {editable ? (
          <Pressable onPress={copyMonday} accessibilityRole="button" style={styles.copy}>
            <Ionicons name="copy-outline" size={16} color={Brand.primary} />
            <ThemedText style={styles.copyText}>Copier les horaires du lundi sur les autres jours ouverts</ThemedText>
          </Pressable>
        ) : null}
      </FormCard>

      {invalid ? <Hint icon="alert-circle" tone="danger" text="Corrigez les jours en rouge : rien n’est enregistré tant qu’ils sont invalides." /> : null}
      {dirty ? <SaveButton label={registered ? 'Sauvegarder les horaires' : 'Enregistrer ces horaires'} onPress={() => void submit()} loading={saving} disabled={invalid} /> : null}
      {!dirty && registered ? <Hint icon="checkmark-circle" tone="success" text="Horaires enregistrés et visibles sur votre page boutique." /> : null}

      {picker ? (
        <TimeSheet
          title={`${LABEL[picker.jour]} — ${picker.field}`}
          value={hhmm(list.find((h) => h.jour === picker.jour)?.[picker.field] ?? null)}
          onClose={() => setPicker(null)}
          onPick={(v) => {
            update(picker.jour, { [picker.field]: v });
            setPicker(null);
          }}
        />
      ) : null}
    </>
  );
}

function DaySwitch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={() => !disabled && onChange(!on)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled }}
      hitSlop={8}
      style={[styles.sw, { backgroundColor: on ? Brand.primary : '#D4D4D4' }, disabled && styles.dim]}>
      <View style={[styles.knob, { left: on ? 22 : 3 }]} />
    </Pressable>
  );
}

function TimeBtn({ label, value, error, onPress, disabled }: { label: string; value: string; error: boolean; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value || 'non définie'}`}
      style={[styles.time, { borderColor: error ? Brand.danger : theme.border, backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.timeV}>{value || '--:--'}</ThemedText>
    </Pressable>
  );
}

/** Heures par quart d'heure (+ l'heure actuelle si elle n'est pas « ronde »). */
function TimeSheet({ title, value, onPick, onClose }: { title: string; value: string; onPick: (v: string) => void; onClose: () => void }) {
  const theme = useTheme();
  const base = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);
  const times = value && !base.includes(value) ? [...base, value].sort() : base;
  const index = Math.max(0, times.indexOf(value || '08:00'));
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: theme.background }]}>
        <View style={styles.sheetHead}>
          <ThemedText style={styles.sheetTitle}>{title}</ThemedText>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>
        <FlatList
          data={times}
          keyExtractor={(t) => t}
          numColumns={4}
          initialScrollIndex={Math.floor(index / 4)}
          getItemLayout={(_, i) => ({ length: 52, offset: 52 * i, index: i })}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => {
            const on = item === value;
            return (
              <Pressable onPress={() => onPick(item)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.slot, { backgroundColor: on ? Brand.primary : theme.backgroundElement }]}>
                <ThemedText style={[styles.slotText, on && { color: '#fff' }]}>{item}</ThemedText>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.5 },
  day: { paddingVertical: 10, gap: 8 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayName: { fontSize: 15, lineHeight: 20, fontWeight: '800', width: 86 },
  sw: { width: 46, height: 26, borderRadius: 13 },
  knob: { position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  times: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  time: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  timeV: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  err: { color: Brand.danger, fontSize: 12.5, lineHeight: 16, fontWeight: '700' },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6 },
  copyText: { color: Brand.primary, fontSize: 13.5, lineHeight: 18, fontWeight: '700', flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '60%', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  sheetTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', textTransform: 'capitalize' },
  grid: { paddingHorizontal: 12, paddingBottom: 16 },
  slot: { flex: 1, margin: 4, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  slotText: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
});
