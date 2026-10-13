/**
 * Paramètres › Zone & horaires — comme SecZone du site :
 *   · zones de couverture (PATCH …/zone { zonesActives }) : les communes de
 *     la ville de votre dépôt (référentiel de la Guinée) + les zones du site
 *     (Conakry, Coyah), mêmes identifiants que le site (« kaloum »…). Une zone
 *     enregistrée ailleurs reste affichée et conservée. Comptées sur votre
 *     profil public (« zones couvertes ») et dans « Ma zone » ;
 *   · horaires d'ouverture des 7 jours (PUT …/zone/horaires), créneaux de
 *     30 min, fermeture après l'ouverture, « Tout ouvrir » / « Tout fermer » :
 *     affichés sur votre profil public (disponibilité hebdomadaire).
 * Les « règles automatiques » du site (refus si dépôt plein, alerte de
 * retard, mode urgence, pause jours fériés) ne sont appliquées par aucun
 * traitement Shoneya : elles ne sont pas proposées, et l'écran le dit.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SelectField } from '@/components/select-field';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { FormCard, getCommunesByVille, Hint, SaveButton, SettingsShell, toast, toastError, useUnsavedGuard } from '@/features/settings-kit';
import { useTheme } from '@/hooks/use-theme';

import { DAY_LABEL, SITE_ZONES, TIMES, weekOf, zoneId, zoneLabel, type CorrespondantSettings, type Horaire } from '../api';
import { useCorrespondantSettings, useSectionSave } from '../hooks';

type Form = { zones: string[]; week: Horaire[] };
const toForm = (d: CorrespondantSettings): Form => ({ zones: [...(d.zonesActives ?? [])], week: weekOf(d.horaires) });
const same = (a: Form, b: Form) => JSON.stringify({ z: [...a.zones].sort(), w: a.week }) === JSON.stringify({ z: [...b.zones].sort(), w: b.week });
const TIME_OPTS = TIMES.map((t) => ({ value: t, label: t }));

export default function ZoneScreen() {
  const q = useCorrespondantSettings();
  return (
    <SettingsShell<CorrespondantSettings> query={q} title="Zone & horaires" icon="map-outline" subtitle="Où vous intervenez et quand votre point relais est ouvert — visibles sur votre profil public.">
      {(d) => <Content d={d} />}
    </SettingsShell>
  );
}

function Content({ d }: { d: CorrespondantSettings }) {
  const theme = useTheme();
  const save = useSectionSave();
  const [form, setForm] = useState<Form>(() => toForm(d));
  const [base, setBase] = useState<Form>(() => toForm(d));
  const [saving, setSaving] = useState(false);

  const fromServer = toForm(d);
  if (!same(fromServer, base)) {
    setBase(fromServer);
    if (same(form, base)) setForm(fromServer);
  }
  const zonesDirty = JSON.stringify([...form.zones].sort()) !== JSON.stringify([...base.zones].sort());
  const weekDirty = JSON.stringify(form.week) !== JSON.stringify(base.week);
  const dirty = zonesDirty || weekDirty;
  useUnsavedGuard(dirty && !saving);

  /* Communes proposées : celles de la ville du dépôt + les zones du site + celles déjà enregistrées */
  const fromVille = getCommunesByVille(d.depotVille ?? '').map((c) => ({ id: zoneId(c.nom), nom: c.nom }));
  const options = [...fromVille, ...SITE_ZONES, ...form.zones.map((id) => ({ id, nom: zoneLabel(id) }))].filter((z, i, all) => all.findIndex((x) => x.id === z.id) === i);

  const toggleZone = (id: string) => setForm((f) => ({ ...f, zones: f.zones.includes(id) ? f.zones.filter((z) => z !== id) : [...f.zones, id] }));
  const setDay = (i: number, patch: Partial<Horaire>) => setForm((f) => ({ ...f, week: f.week.map((h, j) => (j === i ? { ...h, ...patch } : h)) }));
  const setAll = (actif: boolean) => setForm((f) => ({ ...f, week: f.week.map((h) => ({ ...h, actif })) }));

  const badDays = form.week.filter((h) => h.actif && h.fermeture <= h.ouverture).map((h) => DAY_LABEL[h.jour]);

  const submit = async () => {
    if (badDays.length) return toast(`Horaires invalides (${badDays.join(', ')}) : la fermeture doit être après l’ouverture.`, 'danger');
    setSaving(true);
    try {
      /* Seule la partie modifiée est envoyée (les règles automatiques du site restent intactes) */
      if (zonesDirty) await save('zone', { zonesActives: form.zones });
      if (weekDirty) await save('zone/horaires', { horaires: form.week }, 'PUT');
      setBase(form);
      toast('Zone & horaires sauvegardés');
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const openDays = form.week.filter((h) => h.actif).length;

  return (
    <>
      <FormCard
        title="Zones de couverture"
        subtitle={d.depotVille ? `Communes de ${d.depotVille} (ville de votre dépôt) et zones du site.` : 'Renseignez la ville de votre dépôt pour voir ses communes.'}
        icon="location-outline"
        right={
          <ThemedText type="smallBold" style={{ color: Brand.primary }}>
            {form.zones.length} active{form.zones.length > 1 ? 's' : ''}
          </ThemedText>
        }>
        <View style={styles.zones}>
          {options.map((z) => {
            const on = form.zones.includes(z.id);
            return (
              <Pressable
                key={z.id}
                onPress={() => toggleZone(z.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`Zone ${z.nom}`}
                style={[styles.zone, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={on ? Brand.primary : theme.textSecondary} />
                <ThemedText type="smallBold" style={on ? undefined : { color: theme.textSecondary }}>
                  {z.nom}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        {!form.zones.length ? <Hint tone="warning" icon="alert-circle-outline" text="Aucune zone active : votre profil public indique 0 zone couverte." /> : null}
      </FormCard>

      <FormCard title="Horaires d’ouverture" subtitle={`${openDays} jour${openDays > 1 ? 's' : ''} ouvert${openDays > 1 ? 's' : ''} sur 7`} icon="time-outline">
        <View style={styles.row}>
          <Pressable onPress={() => setAll(true)} accessibilityRole="button" style={[styles.chip, { borderColor: theme.border }]}>
            <ThemedText type="smallBold">Tout ouvrir</ThemedText>
          </Pressable>
          <Pressable onPress={() => setAll(false)} accessibilityRole="button" style={[styles.chip, { borderColor: theme.border }]}>
            <ThemedText type="smallBold">Tout fermer</ThemedText>
          </Pressable>
        </View>
        {form.week.map((h, i) => {
          const bad = h.actif && h.fermeture <= h.ouverture;
          return (
            <View key={h.jour} style={[styles.day, { borderTopColor: theme.border }, i === 0 && styles.first]}>
              <Pressable
                onPress={() => setDay(i, { actif: !h.actif })}
                accessibilityRole="switch"
                accessibilityState={{ checked: h.actif }}
                accessibilityLabel={`${DAY_LABEL[h.jour]} ouvert`}
                style={styles.dayHead}>
                <ThemedText style={[styles.dayName, !h.actif && { color: theme.textSecondary }]}>{DAY_LABEL[h.jour]}</ThemedText>
                <View style={[styles.switch, { backgroundColor: h.actif ? Brand.primary : '#D4D4D4' }]}>
                  <View style={[styles.knob, h.actif && styles.knobOn]} />
                </View>
                <ThemedText type="small" style={[styles.state, { color: h.actif ? '#047857' : theme.textSecondary }]}>
                  {h.actif ? 'Ouvert' : 'Fermé'}
                </ThemedText>
              </Pressable>
              {h.actif ? (
                <View style={styles.times}>
                  <View style={styles.flex}>
                    <SelectField label="Ouverture" title={`${DAY_LABEL[h.jour]} — ouverture`} placeholder="—" options={TIME_OPTS} value={h.ouverture} onChange={(v) => setDay(i, { ouverture: v })} />
                  </View>
                  <View style={styles.flex}>
                    <SelectField
                      label="Fermeture"
                      title={`${DAY_LABEL[h.jour]} — fermeture`}
                      placeholder="—"
                      options={TIME_OPTS}
                      value={h.fermeture}
                      onChange={(v) => setDay(i, { fermeture: v })}
                      error={bad ? 'Après l’ouverture' : null}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </FormCard>

      <Hint
        tone="neutral"
        icon="information-circle-outline"
        text="Les règles automatiques du site (refus si dépôt plein, alerte de retard, mode urgence le week-end, pause les jours fériés) ne sont appliquées par aucun traitement Shoneya pour l’instant : elles ne sont pas proposées ici."
      />

      <SaveButton label={saving ? 'Sauvegarde…' : 'Sauvegarder zone & horaires'} onPress={() => void submit()} loading={saving} disabled={!dirty} />
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
  center: { textAlign: 'center' },
  zones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  zone: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  row: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  day: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8 },
  first: { borderTopWidth: 0, paddingTop: 0 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  dayName: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  state: { width: 52, textAlign: 'right', fontWeight: '700' },
  switch: { width: 42, height: 24, borderRadius: 12, padding: 3 },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  knobOn: { marginLeft: 18 },
  times: { flexDirection: 'row', gap: 10 },
});
