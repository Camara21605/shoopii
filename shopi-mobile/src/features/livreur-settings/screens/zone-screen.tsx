/**
 * Paramètres › Zones & Horaires — comme SecZone du site. Chaque réglage a un
 * effet RÉEL :
 *   · type de livraison → niveau des zones proposées (pays … quartiers) ;
 *     verrouillé 6 mois après chaque choix (le serveur le refuse aussi) ;
 *   · zones actives → recherche des livreurs par les clients, affectation par
 *     l'administrateur de zone (300 au maximum) ;
 *   · planning hebdomadaire → affiché aux clients sur la fiche du livreur ; un
 *     jour ouvert doit avoir un début et une fin différents (fin avant le début
 *     = se termine après minuit).
 * Deux enregistrements séparés (zones / horaires), comme sur le site. La saisie
 * n'est jamais écrasée par un rechargement, et quitter avec des modifications
 * non enregistrées demande confirmation.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/form';
import { normalize } from '@/components/select-field';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { DELIVERY_TYPES, fetchGeoLevel, typeLock, type LivreurSettings } from '../api';
import { confirmAction, FormCard, Hint, SaveButton, SettingsShell, toast, toastError, useUnsavedGuard } from '../components/ui';
import { useSectionSave } from '../hooks';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
const JOUR_LABEL: Record<string, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
  samedi: 'Samedi',
  dimanche: 'Dimanche',
};
const MAX_ZONES = 300;

const hhmm = (v: string | null | undefined) => (v ?? '').slice(0, 5);

type Day = { on: boolean; open: string; close: string };
type Planning = Day[];

/** Planning affiché : valeurs du serveur, sinon lun → sam 07:00 – 21:00 (comme le site). */
function planningOf(d: LivreurSettings): Planning {
  const byDay = new Map(d.horaires.map((h) => [h.jour, h]));
  return JOURS.map((j, i) => {
    const h = byDay.get(j);
    return {
      on: h?.actif ?? i < 6,
      open: hhmm(h?.ouverture) || '07:00',
      close: hhmm(h?.fermeture) || '21:00',
    };
  });
}
const samePlanning = (a: Planning, b: Planning) => a.every((x, i) => x.on === b[i].on && x.open === b[i].open && x.close === b[i].close);

type Zones = { type: string; zones: string[] };
const zonesOf = (d: LivreurSettings): Zones => ({
  type: d.deliveryType ?? '',
  zones: d.communesActives ?? [],
});
const sameZones = (a: Zones, b: Zones) => a.type === b.type && a.zones.length === b.zones.length && [...a.zones].sort().join('|') === [...b.zones].sort().join('|');

function dayError(day: Day): string | null {
  if (!day.on) return null;
  if (!day.open || !day.close) return 'Indiquez l’heure de début et de fin.';
  if (day.open === day.close) return 'Le début et la fin doivent être différents.';
  return null;
}

export default function ZoneScreen() {
  return (
    <SettingsShell<LivreurSettings> title="Zones & Horaires" icon="map-outline" subtitle="Définissez votre périmètre de livraison et vos plages horaires.">
      {(d) => <Content d={d} />}
    </SettingsShell>
  );
}

function Content({ d }: { d: LivreurSettings }) {
  const save = useSectionSave();

  /* ── Zones : formulaire + base (dernières valeurs du serveur) ── */
  const [zones, setZones] = useState<Zones>(() => zonesOf(d));
  const [zonesBase, setZonesBase] = useState<Zones>(() => zonesOf(d));
  const serverZones = zonesOf(d);
  if (!sameZones(serverZones, zonesBase)) {
    setZonesBase(serverZones);
    if (sameZones(zones, zonesBase)) setZones(serverZones);
  }

  /* ── Planning ── */
  const [planning, setPlanning] = useState<Planning>(() => planningOf(d));
  const [planBase, setPlanBase] = useState<Planning>(() => planningOf(d));
  const serverPlan = planningOf(d);
  if (!samePlanning(serverPlan, planBase)) {
    setPlanBase(serverPlan);
    if (samePlanning(planning, planBase)) setPlanning(serverPlan);
  }

  const [savingZones, setSavingZones] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const zonesDirty = !sameZones(zones, zonesBase);
  const planDirty = !samePlanning(planning, planBase);
  useUnsavedGuard((zonesDirty || planDirty) && !savingZones && !savingPlan);

  const { locked, unlockDate } = typeLock(d.deliveryTypeSetAt);
  const typeConf = DELIVERY_TYPES.find((t) => t.key === zones.type);

  const selectType = (key: string) => {
    if (locked || key === zones.type) return;
    setZones({ type: key, zones: [] });
  };

  const saveZones = async () => {
    const typeChanged = !!zones.type && zones.type !== (d.deliveryType ?? '');
    if (typeChanged) {
      const ok = await confirmAction('Confirmer le type de livraison', `« ${typeConf?.label} » sera verrouillé pendant 6 mois. Vous pourrez toujours modifier vos zones actives.`, 'Confirmer');
      if (!ok) return;
    }
    setSavingZones(true);
    try {
      await save('zone', {
        ...(zones.type ? { deliveryType: zones.type } : {}),
        communesActives: zones.zones,
      });
      setZonesBase(zones);
      toast('Zones sauvegardées');
    } catch (e) {
      toastError(e);
    } finally {
      setSavingZones(false);
    }
  };

  const errors = planning.map(dayError);
  const invalid = errors.filter(Boolean).length;

  const savePlanning = async () => {
    if (invalid) return toast('Corrigez les jours signalés avant d’enregistrer.', 'danger');
    setSavingPlan(true);
    try {
      /* Seuls jour / actif / heures : le serveur refuse tout autre champ (ex. id) */
      await save('horaires', {
        horaires: JOURS.map((jour, i) => ({
          jour,
          actif: planning[i].on,
          ouverture: planning[i].on ? planning[i].open : null,
          fermeture: planning[i].on ? planning[i].close : null,
        })),
      });
      setPlanBase(planning);
      toast('Horaires sauvegardés');
    } catch (e) {
      toastError(e);
    } finally {
      setSavingPlan(false);
    }
  };

  const setDay = (i: number, patch: Partial<Day>) => setPlanning((p) => p.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  return (
    <>
      {/* ── Type de livraison ── */}
      <FormCard title="Type de livraison" icon="git-network-outline" right={typeConf ? <ThemedText style={styles.typeTag}>{`${typeConf.em} ${typeConf.label}`}</ThemedText> : undefined}>
        {locked ? (
          <Hint icon="lock-closed" tone="neutral" text={`Type de livraison verrouillé. Modifiable à partir du ${unlockDate}. Vous pouvez modifier vos zones actives à tout moment.`} />
        ) : !zones.type ? (
          <Hint text="Choisissez votre périmètre d’intervention. Ce choix sera verrouillé pendant 6 mois." />
        ) : null}
        <View style={styles.types} accessibilityRole="radiogroup">
          {DELIVERY_TYPES.map((t) => (
            <TypeTile key={t.key} em={t.em} label={t.label} sub={t.sub} selected={zones.type === t.key} locked={locked} onPress={() => selectType(t.key)} />
          ))}
        </View>
      </FormCard>

      {/* ── Zones actives ── */}
      {typeConf ? <ZonesCard niveau={typeConf.niveau} label={typeConf.label} em={typeConf.em} value={zones.zones} onChange={(z) => setZones((s) => ({ ...s, zones: z }))} /> : null}
      {zones.type ? <SaveButton label={savingZones ? 'Sauvegarde…' : 'Sauvegarder les zones'} onPress={() => void saveZones()} loading={savingZones} disabled={!zonesDirty} /> : null}

      {/* ── Planning ── */}
      <FormCard title="Planning hebdomadaire" icon="time-outline" subtitle="Affiché aux clients sur votre fiche livreur">
        <View style={styles.planActions}>
          <SmallBtn
            label="Tout activer"
            onPress={() => {
              setPlanning((p) => p.map((x) => ({ ...x, on: true })));
              toast('Tous les jours activés');
            }}
          />
          <SmallBtn
            label="Effacer"
            onPress={() => {
              setPlanning((p) => p.map((x) => ({ ...x, on: false })));
              toast('Planning effacé', 'warning');
            }}
          />
        </View>
        {JOURS.map((j, i) => (
          <DayRow key={j} label={JOUR_LABEL[j]} day={planning[i]} error={errors[i]} first={i === 0} onChange={(p) => setDay(i, p)} />
        ))}
        {invalid ? <Hint icon="alert-circle" tone="danger" text="Corrigez les jours signalés avant d’enregistrer." /> : null}
        <SaveButton label={savingPlan ? 'Sauvegarde…' : 'Sauvegarder les horaires'} onPress={() => void savePlanning()} loading={savingPlan} disabled={!planDirty || invalid > 0} />
      </FormCard>
    </>
  );
}

/* ── Type ──────────────────────────────────────────────────────────── */

function TypeTile({ em, label, sub, selected, locked, onPress }: { em: string; label: string; sub: string; selected: boolean; locked: boolean; onPress: () => void }) {
  const theme = useTheme();
  const disabled = locked && !selected;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${label} — ${sub}`}
      style={[
        styles.tile,
        {
          borderColor: selected ? Brand.primary : theme.border,
          backgroundColor: selected ? Brand.primarySoft : theme.backgroundElement,
        },
        disabled && styles.tileOff,
      ]}>
      {selected ? <Ionicons name={locked ? 'lock-closed' : 'checkmark-circle'} size={14} color={Brand.primary} style={styles.tileMark} /> : null}
      <ThemedText style={styles.tileEm}>{em}</ThemedText>
      <ThemedText style={styles.tileLabel}>{label}</ThemedText>
      <ThemedText style={styles.tileSub} themeColor="textSecondary">
        {sub}
      </ThemedText>
    </Pressable>
  );
}

/* ── Zones ─────────────────────────────────────────────────────────── */

function ZonesCard({ niveau, label, em, value, onChange }: { niveau: string; label: string; em: string; value: string[]; onChange: (z: string[]) => void }) {
  const theme = useTheme();
  const geo = useQuery({
    queryKey: qk.livreur.geo(niveau),
    queryFn: () => fetchGeoLevel(niveau),
    staleTime: 30 * 60_000,
  });
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const items = useMemo(() => geo.data ?? [], [geo.data]);
  const n = normalize(q.trim());
  const filtered = n ? items.filter((it) => normalize(it.nom).includes(n)) : items;
  /* Sur téléphone, une longue liste (quartiers) est d'abord réduite aux zones choisies + 24 premières */
  const shown = all || n ? filtered : filtered.filter((it, i) => i < 24 || value.includes(it.nom));

  const toggle = (nom: string) => {
    if (value.includes(nom)) onChange(value.filter((z) => z !== nom));
    else if (value.length >= MAX_ZONES) toast(`${MAX_ZONES} zones au maximum.`, 'warning');
    else onChange([...value, nom]);
  };

  return (
    <FormCard title={`Zones ${label.toLowerCase()}`} icon="location-outline" right={<ThemedText style={styles.count}>{`${value.length} sélectionnée${value.length > 1 ? 's' : ''}`}</ThemedText>}>
      {geo.isPending ? (
        <View style={styles.zoneState}>
          <ActivityIndicator color={Brand.primary} />
          <ThemedText type="small" themeColor="textSecondary">
            Chargement des zones…
          </ThemedText>
        </View>
      ) : geo.isError ? (
        <View style={styles.zoneState}>
          <ThemedText type="small" themeColor="textSecondary">
            Impossible de charger les zones.
          </ThemedText>
          <SmallBtn label="Réessayer" onPress={() => void geo.refetch()} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.zoneState}>
          <Ionicons name="pin-outline" size={24} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            Aucune zone configurée dans le référentiel pour ce niveau.
          </ThemedText>
        </View>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Activez les zones que vous acceptez de desservir.
          </ThemedText>
          {items.length > 12 ? (
            <Field value={q} onChangeText={setQ} placeholder="Rechercher une zone…" left={<Ionicons name="search" size={16} color={theme.textSecondary} style={styles.searchIco} />} />
          ) : null}
          <View style={styles.chips}>
            {shown.map((it) => {
              const on = value.includes(it.nom);
              return (
                <Pressable
                  key={it.id}
                  onPress={() => toggle(it.nom)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={it.nom}
                  style={[
                    styles.chip,
                    {
                      borderColor: on ? Brand.primary : theme.border,
                      backgroundColor: on ? Brand.primary : theme.background,
                    },
                  ]}>
                  <ThemedText style={styles.chipEm}>{em}</ThemedText>
                  <ThemedText style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                    {it.nom}
                  </ThemedText>
                  {on ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                </Pressable>
              );
            })}
          </View>
          {n && filtered.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Aucune zone ne correspond à « {q.trim()} ».
            </ThemedText>
          ) : null}
          <View style={styles.zoneFoot}>
            {!n && !all && filtered.length > shown.length ? <SmallBtn label={`Voir les ${filtered.length} zones`} onPress={() => setAll(true)} /> : <View />}
            {value.length ? <SmallBtn label="Tout désélectionner" onPress={() => onChange([])} /> : null}
          </View>
        </>
      )}
    </FormCard>
  );
}

/* ── Planning ──────────────────────────────────────────────────────── */

function DayRow({ label, day, error, first, onChange }: { label: string; day: Day; error: string | null; first: boolean; onChange: (p: Partial<Day>) => void }) {
  const theme = useTheme();
  const [picker, setPicker] = useState<'open' | 'close' | null>(null);
  const afterMidnight = day.on && !error && day.close < day.open;
  return (
    <View
      style={[
        styles.day,
        !first && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
        },
      ]}>
      <View style={styles.dayHead}>
        <ThemedText style={[styles.dayName, !day.on && { color: theme.textSecondary }]}>{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {day.on ? 'Disponible' : 'Repos'}
        </ThemedText>
        <Pressable
          onPress={() => onChange({ on: !day.on })}
          accessibilityRole="switch"
          accessibilityLabel={label}
          accessibilityState={{ checked: day.on }}
          aria-checked={day.on}
          hitSlop={8}
          style={[styles.sw, { backgroundColor: day.on ? Brand.primary : '#D4D4D4' }]}>
          <View style={[styles.knob, { left: day.on ? 22 : 3 }]} />
        </Pressable>
      </View>
      {day.on ? (
        <View style={styles.times}>
          <TimeBtn label="Début" value={day.open} error={!!error} onPress={() => setPicker('open')} />
          <Ionicons name="arrow-forward" size={16} color={theme.textSecondary} />
          <TimeBtn label="Fin" value={day.close} error={!!error} onPress={() => setPicker('close')} />
        </View>
      ) : null}
      {error ? (
        <ThemedText style={styles.err}>
          <Ionicons name="alert-circle" size={13} /> {error}
        </ThemedText>
      ) : null}
      {afterMidnight ? (
        <ThemedText type="small" themeColor="textSecondary">
          <Ionicons name="moon-outline" size={12} /> Se termine après minuit.
        </ThemedText>
      ) : null}
      {picker ? (
        <TimeSheet
          title={`${label} — ${picker === 'open' ? 'début' : 'fin'}`}
          value={picker === 'open' ? day.open : day.close}
          onClose={() => setPicker(null)}
          onPick={(v) => {
            onChange(picker === 'open' ? { open: v } : { close: v });
            setPicker(null);
          }}
        />
      ) : null}
    </View>
  );
}

function TimeBtn({ label, value, error, onPress }: { label: string; value: string; error: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value || 'non définie'}`}
      style={[
        styles.time,
        {
          borderColor: error ? Brand.danger : theme.border,
          backgroundColor: theme.backgroundElement,
        },
      ]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.timeV}>{value || '--:--'}</ThemedText>
    </Pressable>
  );
}

/** Heures par quart d'heure (+ l'heure enregistrée si elle n'est pas « ronde »). */
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
              <Pressable
                onPress={() => onPick(item)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[
                  styles.slot,
                  {
                    backgroundColor: on ? Brand.primary : theme.backgroundElement,
                  },
                ]}>
                <ThemedText style={[styles.slotText, on && { color: '#fff' }]}>{item}</ThemedText>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

function SmallBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.small, { borderColor: theme.border }]}>
      <ThemedText style={styles.smallText}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerText: { textAlign: 'center' },
  typeTag: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: Brand.primary,
  },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  tile: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 3,
  },
  tileOff: { opacity: 0.38 },
  tileMark: { position: 'absolute', top: 6, right: 8 },
  tileEm: { fontSize: 22, lineHeight: 28 },
  tileLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  tileSub: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
  count: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: Brand.primary,
  },
  zoneState: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  searchIco: { marginRight: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 11,
    minHeight: 36,
    maxWidth: '100%',
  },
  chipEm: { fontSize: 13, lineHeight: 17 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700', flexShrink: 1 },
  chipTextOn: { color: '#fff' },
  zoneFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  planActions: { flexDirection: 'row', gap: 8 },
  small: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallText: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '800',
    color: Brand.primary,
  },
  day: { paddingVertical: 10, gap: 8 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayName: { fontSize: 15, lineHeight: 20, fontWeight: '800', width: 86 },
  sw: { width: 46, height: 26, borderRadius: 13 },
  knob: {
    position: 'absolute',
    top: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  times: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  time: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  timeV: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  err: {
    color: Brand.danger,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '60%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sheetTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  grid: { paddingHorizontal: 12, paddingBottom: 16 },
  slot: {
    flex: 1,
    margin: 4,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotText: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
});
