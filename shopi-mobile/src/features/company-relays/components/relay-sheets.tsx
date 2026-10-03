/**
 * Actions rapides de « Mes correspondants ». Sur le site, ces trois boutons
 * n'affichaient qu'un message ; ici elles sont réelles :
 *   · CircularSheet  « Envoyer une circulaire » : le même e-mail à tous les
 *                    correspondants actifs (POST /correspondants/:id/contacter,
 *                    un par un, avec progression et bilan des échecs) ;
 *   · NetworkReport  rapport du réseau calculé sur les données déjà chargées ;
 *   · RelayMapSheet  carte des dépôts de l'équipe (positions de la carte Localisation).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { Sheet, ZoneBar } from '@/features/company-drivers/components';
import { MapView } from '@/features/location/MapView';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { contactRelay, fetchTeamPositions, place, TYPE, type Relay, type RelayStats, type RelayType } from '../api';
import { TypeBadge } from './relay-rows';

/* ── Circulaire ───────────────────────────────────────────────────── */

export function CircularSheet({ team, onClose, onDone }: { team: Relay[]; onClose: () => void; onDone: (m: string, error?: boolean) => void }) {
  const theme = useTheme();
  const targets = team.filter((r) => r.status === 'active' && r.email);
  const [sujet, setSujet] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ sujet?: string; message?: string }>({});
  const [progress, setProgress] = useState<{ done: number; failed: string[] } | null>(null);
  const sending = progress != null && progress.done < targets.length;

  async function send() {
    const e: typeof errors = {};
    if (!sujet.trim()) e.sujet = 'Le sujet est obligatoire.';
    else if (sujet.trim().length > 255) e.sujet = '255 caractères maximum.';
    if (!message.trim()) e.message = 'Le message est obligatoire.';
    else if (message.trim().length > 5000) e.message = '5 000 caractères maximum.';
    setErrors(e);
    if (Object.keys(e).length || !targets.length) return;

    const failed: string[] = [];
    setProgress({ done: 0, failed });
    for (let i = 0; i < targets.length; i++) {
      try { await contactRelay(targets[i].id, sujet.trim(), message.trim()); } catch (err) { failed.push(`${targets[i].fullName} (${toUserMessage(err)})`); }
      setProgress({ done: i + 1, failed: [...failed] });
    }
    const ok = targets.length - failed.length;
    if (!failed.length) { onDone(`Circulaire envoyée à ${ok} correspondant${ok > 1 ? 's' : ''}`); onClose(); }
    else onDone(`${ok} envoi(s) réussi(s), ${failed.length} échec(s)`, true);
  }

  return (
    <Sheet title="Envoyer une circulaire" sub={`Par e-mail à vos ${targets.length} correspondant${targets.length > 1 ? 's' : ''} actif${targets.length > 1 ? 's' : ''}`} onClose={() => !sending && onClose()}
      footer={progress && !sending ? <PrimaryButton title="Fermer" onPress={onClose} /> : <PrimaryButton title={sending ? `Envoi… ${progress!.done}/${targets.length}` : 'Envoyer à tous'} onPress={() => void send()} loading={sending} disabled={!targets.length} />}>
      {!targets.length ? (
        <ThemedText type="small" themeColor="textSecondary">Aucun correspondant actif avec une adresse e-mail.</ThemedText>
      ) : (
        <>
          <Field label="Sujet" value={sujet} onChangeText={(v) => { setSujet(v); setErrors((x) => ({ ...x, sujet: undefined })); }} placeholder="ex. Nouveaux horaires de dépôt" maxLength={255} error={errors.sujet} editable={!progress} />
          <Field label="Message" value={message} onChangeText={(v) => { setMessage(v); setErrors((x) => ({ ...x, message: undefined })); }} placeholder="Votre message à tout le réseau…"
            multiline style={styles.textarea} maxLength={5000} error={errors.message} editable={!progress} />
          <View style={[styles.info, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="people-outline" size={18} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {targets.slice(0, 5).map((r) => r.fullName).join(', ')}{targets.length > 5 ? ` et ${targets.length - 5} autre(s)` : ''}. Chacun reçoit un e-mail séparé.
            </ThemedText>
          </View>
        </>
      )}
      {progress ? (
        <View style={styles.progress}>
          <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.barFill, { width: `${Math.round((progress.done / Math.max(1, targets.length)) * 100)}%` }]} />
          </View>
          <ThemedText type="small" themeColor="textSecondary">{progress.done}/{targets.length} envoyé(s)</ThemedText>
          {progress.failed.map((f) => <ThemedText key={f} type="small" style={styles.err}>• Échec : {f}</ThemedText>)}
        </View>
      ) : null}
    </Sheet>
  );
}

/* ── Rapport du réseau ────────────────────────────────────────────── */

export function NetworkReport({ team, stats, zones, onClose }: {
  team: Relay[]; stats: RelayStats | undefined; zones: { zone: string; orders: number; pct: number }[]; onClose: () => void;
}) {
  const theme = useTheme();
  const actifs = team.filter((r) => r.status === 'active');
  const rated = actifs.filter((r) => r.averageRating > 0);
  const note = rated.length ? rated.reduce((s, r) => s + r.averageRating, 0) / rated.length : 0;
  const totalMissions = actifs.reduce((s, r) => s + r.totalMissions, 0);
  const villes = new Map<string, number>();
  for (const r of actifs) if (r.ville) villes.set(r.ville, (villes.get(r.ville) ?? 0) + 1);
  const byType = (Object.keys(TYPE) as RelayType[]).map((t) => ({ t, n: actifs.filter((r) => r.type === t).length })).filter((x) => x.n);
  const top = [...actifs].filter((r) => r.thisMonth > 0).sort((a, b) => b.thisMonth - a.thisMonth).slice(0, 5);

  return (
    <Sheet title="Rapport du réseau" sub={`Basé sur ${actifs.length} correspondant${actifs.length > 1 ? 's' : ''} actif${actifs.length > 1 ? 's' : ''}`} onClose={onClose} tall>
      <View style={styles.kpis}>
        {[
          { l: 'Commandes ce mois', v: (stats?.thisMonth ?? 0).toLocaleString('fr-FR') },
          { l: 'Missions au total', v: totalMissions.toLocaleString('fr-FR') },
          { l: 'Note moyenne', v: note ? `${note.toFixed(1)} ★` : '—' },
          { l: 'Villes couvertes', v: String(stats?.villes ?? villes.size) },
        ].map((k) => (
          <View key={k.l} style={[styles.kpi, { borderColor: theme.border }]}>
            <ThemedText style={styles.kpiV}>{k.v}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>{k.l}</ThemedText>
          </View>
        ))}
      </View>

      <ThemedText style={styles.section}>🏆 Plus actifs ce mois</ThemedText>
      {!top.length ? <ThemedText type="small" themeColor="textSecondary">Aucune commande traitée ce mois-ci.</ThemedText> : top.map((r, i) => (
        <View key={r.id} style={styles.rank}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rankN}>{i + 1}.</ThemedText>
          <ThemedText numberOfLines={1} style={styles.flex}>{r.fullName}</ThemedText>
          <ThemedText type="smallBold">{r.thisMonth}</ThemedText>
        </View>
      ))}

      {byType.length ? (
        <>
          <ThemedText style={styles.section}>🏷️ Par type</ThemedText>
          <View style={styles.types}>{byType.map((x) => <View key={x.t} style={styles.typeItem}><TypeBadge t={x.t} /><ThemedText type="smallBold">{x.n}</ThemedText></View>)}</View>
        </>
      ) : null}

      {villes.size ? (
        <>
          <ThemedText style={styles.section}>🏙️ Par ville</ThemedText>
          {[...villes.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => (
            <View key={v} style={styles.rank}><ThemedText style={styles.flex}>{v}</ThemedText><ThemedText type="smallBold">{n}</ThemedText></View>
          ))}
        </>
      ) : null}

      {zones.length ? (
        <>
          <ThemedText style={styles.section}>🗺️ Couverture par zone</ThemedText>
          {zones.map((z) => <ZoneBar key={z.zone} z={z} />)}
        </>
      ) : null}
    </Sheet>
  );
}

/* ── Carte des dépôts ─────────────────────────────────────────────── */

const CONAKRY = { lat: 9.6412, lng: -13.5784 };

export function RelayMapSheet({ team, onClose, onOpen }: { team: Relay[]; onClose: () => void; onOpen: (r: Relay) => void }) {
  const theme = useTheme();
  const active = team.filter((r) => r.status === 'active');
  const ids = active.map((r) => r.id).sort().join(',');
  const pos = useQuery({ queryKey: qk.companyRelays.positions(ids), queryFn: ({ signal }) => fetchTeamPositions(active, signal), staleTime: 10 * 60_000 });
  const placed = pos.data ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const sel = active.find((r) => r.id === selected) ?? null;
  const center = placed.length
    ? { lat: placed.reduce((s, p) => s + p.lat, 0) / placed.length, lng: placed.reduce((s, p) => s + p.lng, 0) / placed.length }
    : CONAKRY;
  const approx = placed.filter((p) => p.approx).length;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <View style={[styles.mapHead, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer"><Ionicons name="arrow-back" size={24} color={theme.text} /></Pressable>
          <View style={styles.flex}>
            <ThemedText style={styles.title}>Carte du réseau</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {pos.isPending ? 'Recherche des dépôts…' : `${placed.length} dépôt${placed.length > 1 ? 's' : ''} sur ${active.length} correspondant${active.length > 1 ? 's' : ''} actif${active.length > 1 ? 's' : ''}${approx ? ` · ${approx} position(s) approximative(s)` : ''}`}
            </ThemedText>
          </View>
        </View>
        {pos.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : pos.isError ? (
          <View style={styles.mapEmpty}><ThemedText themeColor="textSecondary" style={styles.center}>{toUserMessage(pos.error)}</ThemedText></View>
        ) : placed.length ? (
          <View style={styles.flex}>
            <MapView
              initialCenter={center}
              onSelect={setSelected}
              onTap={() => setSelected(null)}
              state={{
                actors: placed.map((p) => ({ key: p.id, role: 'correspondent', lat: p.lat, lng: p.lng, approx: p.approx, precision: p.precision })),
                selectedKey: selected, me: null, place: null, activePlace: null, radius: null, route: null, style: 'plan', labelsOn: true,
              }}
            />
            {sel ? (
              <Pressable onPress={() => onOpen(sel)} accessibilityRole="button" style={[styles.mapCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <ThemedText style={styles.emoji}>{sel.avatarEmoji}</ThemedText>
                <View style={styles.flex}>
                  <ThemedText style={styles.cardTitle}>{sel.fullName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{place(sel)}</ThemedText>
                </View>
                <TypeBadge t={sel.type} />
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.mapEmpty}>
            <Ionicons name="map-outline" size={40} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.center}>
              Aucun dépôt localisé : un correspondant apparaît ici dès qu’il a renseigné l’adresse de son dépôt.
            </ThemedText>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  loader: { marginTop: 40 },
  title: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  textarea: { minHeight: 120, textAlignVertical: 'top' },
  info: { flexDirection: 'row', gap: 8, borderRadius: 12, padding: 10 },
  progress: { gap: 6 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: Brand.primary },
  err: { color: Brand.danger, fontWeight: '600' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'center', gap: 2 },
  kpiV: { fontSize: 20, lineHeight: 26, fontWeight: '900' },
  section: { fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 8 },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  rankN: { width: 22 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  mapCard: { position: 'absolute', left: 12, right: 12, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 12 },
  emoji: { fontSize: 26, lineHeight: 32 },
  cardTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  mapEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
});
