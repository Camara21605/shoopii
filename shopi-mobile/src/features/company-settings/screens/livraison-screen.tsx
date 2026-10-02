/**
 * Paramètres › Livraison — comme LivraisonSection du site :
 *   · 4 modes (standard, livreurs Shoneya, correspondants, Click & Collect),
 *     au moins un toujours actif — sinon plus aucun client ne peut commander ;
 *   · zones desservies = communes de la zone attribuée à la boutique
 *     (GET …/livraison/zones-disponibles) ;
 * chaque touche est enregistrée aussitôt (une requête à la fois).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchZonesDispo, type Settings } from '../api';
import { Badge, FormCard, Hint, SettingsShell, toast, toastError, ToggleRow, useEditable } from '../components/ui';
import { useSectionSave, useSettings } from '../hooks';

type ModeKey = 'livraisonStandard' | 'livraisonShopi' | 'livraisonCorresp' | 'clickCollect';

const MODES: { key: ModeKey; label: string; sub: string }[] = [
  { key: 'livraisonStandard', label: 'Livraison standard', sub: 'Gérée par votre équipe boutique' },
  { key: 'livraisonShopi', label: 'Livreurs Shoneya', sub: 'Réseau de livreurs partenaires Shoneya' },
  { key: 'livraisonCorresp', label: 'Correspondants', sub: 'Réseau de relais locaux et internationaux' },
  { key: 'clickCollect', label: 'Click & Collect', sub: 'Le client récupère en boutique' },
];

export default function LivraisonScreen() {
  const q = useSettings();
  return (
    <SettingsShell title="Livraison" icon="bicycle-outline" subtitle="Choisissez vos méthodes de livraison et les communes que vous desservez.">
      {q.data ? <Content d={q.data} /> : null}
    </SettingsShell>
  );
}

function Content({ d }: { d: Settings }) {
  const theme = useTheme();
  const editable = useEditable();
  const save = useSectionSave();
  const [busy, setBusy] = useState<string | null>(null);
  const zones = useQuery({ queryKey: qk.company.settingsZones, queryFn: fetchZonesDispo, staleTime: 10 * 60_000 });
  const selected = d.zonesLivraison ?? [];
  const activeCount = MODES.filter((m) => d[m.key]).length;

  const run = (key: string, body: Record<string, unknown>, optimistic: Partial<Settings>) => {
    setBusy(key);
    save('livraison', body, optimistic)
      .then(() => toast('Livraison sauvegardée'))
      .catch((e) => toastError(e))
      .finally(() => setBusy((b) => (b === key ? null : b)));
  };

  const toggleMode = (key: ModeKey, v: boolean) => {
    if (!v && activeCount <= 1) return toast('Gardez au moins un mode de livraison actif.', 'warning');
    run(key, { [key]: v }, { [key]: v });
  };

  const toggleZone = (nom: string) => {
    if (!editable) return;
    const next = selected.includes(nom) ? selected.filter((z) => z !== nom) : [...selected, nom];
    run(`zone:${nom}`, { zonesLivraison: next }, { zonesLivraison: next });
  };

  return (
    <>
      <FormCard title="Méthodes de livraison" icon="car-outline" subtitle="Activez les modes de livraison disponibles pour vos clients">
        {MODES.map((m, i) => (
          <ToggleRow key={m.key} first={i === 0} label={m.label} sub={m.sub} value={d[m.key]} busy={busy === m.key} onChange={(v) => toggleMode(m.key, v)} />
        ))}
        {activeCount <= 1 ? <Hint icon="warning-outline" tone="warning" text="Gardez au moins un mode de livraison actif : sans lui, vos clients ne peuvent plus commander." /> : null}
        <Hint tone="neutral" text="Ces modes sont affichés sur votre page boutique et vérifiés à chaque commande : un client ne peut pas choisir un mode que vous avez désactivé." />
      </FormCard>

      <FormCard
        title="Zones de livraison"
        icon="map-outline"
        subtitle="Sélectionnez les communes que vous desservez"
        right={<Badge label={`${selected.length} zone${selected.length > 1 ? 's' : ''}`} tone={selected.length ? 'info' : 'neutral'} />}>
        {zones.isPending ? (
          <View style={styles.row}>
            <ActivityIndicator color={Brand.primary} />
            <ThemedText type="small" themeColor="textSecondary">
              Chargement de vos zones…
            </ThemedText>
          </View>
        ) : !zones.data?.zoneId && !zones.data?.communes.length ? (
          <Hint icon="information-circle" tone="warning" text="Aucune zone de livraison ne vous a encore été assignée. Contactez votre administrateur." />
        ) : (
          <>
            {zones.data?.zoneNom ? (
              <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                Zone assignée : {zones.data.zoneNom}
              </ThemedText>
            ) : null}
            <View style={styles.chips}>
              {(zones.data?.communes ?? []).map((c) => {
                const on = selected.includes(c.nom);
                const pending = busy === `zone:${c.nom}`;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => toggleZone(c.nom)}
                    disabled={!editable}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: !editable }}
                    style={[styles.chip, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? Brand.primary : theme.backgroundElement }]}>
                    {pending ? <ActivityIndicator size="small" color={on ? '#fff' : Brand.primary} /> : on ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                    <ThemedText style={[styles.chipText, { color: on ? '#fff' : theme.text }]}>{c.nom}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        {/* Zones enregistrées qui ne font plus partie de la zone attribuée : on peut les retirer */}
        {selected.filter((z) => !(zones.data?.communes ?? []).some((c) => c.nom === z)).length && zones.data ? (
          <View style={styles.chips}>
            {selected
              .filter((z) => !zones.data.communes.some((c) => c.nom === z))
              .map((z) => (
                <Pressable key={z} onPress={() => toggleZone(z)} disabled={!editable} accessibilityRole="button" accessibilityLabel={`Retirer ${z}`} style={[styles.chip, styles.old]}>
                  <ThemedText style={styles.chipText}>{z}</ThemedText>
                  {editable ? <Ionicons name="close" size={14} color={Brand.danger} /> : null}
                </Pressable>
              ))}
          </View>
        ) : null}
      </FormCard>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  old: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
});
