/**
 * Paramètres › Gestion des colis — SecColis du site, limité à ce qui a un
 * effet réel (PATCH …/colis { colisDelaiMax }) :
 *   · délai maximal de garde (1 à 30 jours) : au-delà, un colis pas encore
 *     réceptionné est signalé « en attente depuis trop longtemps » (Vue
 *     d'ensemble, liste des colis) ; affiché sur votre profil public
 *     (« Délai de conservation »).
 * Capacité max, valeur max, poids, types de colis acceptés et règles
 * d'incident du site ne sont lus par aucun traitement Shoneya : ils ne sont
 * pas proposés (l'écran le dit) et leurs valeurs enregistrées sont conservées.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { FormCard, Hint, SaveButton, SettingsShell, toast, toastError, useUnsavedGuard } from '@/features/settings-kit';
import { useTheme } from '@/hooks/use-theme';

import type { CorrespondantSettings } from '../api';
import { useCorrespondantSettings, useSectionSave } from '../hooks';

const MIN = 1;
const MAX = 30;
const PRESETS = [2, 3, 5, 7, 14];

export default function ColisSettingsScreen() {
  const q = useCorrespondantSettings();
  return (
    <SettingsShell<CorrespondantSettings> query={q} title="Gestion des colis" icon="cube-outline" subtitle="Combien de temps un colis peut attendre avant d’être signalé.">
      {(d) => <Content d={d} />}
    </SettingsShell>
  );
}

function Content({ d }: { d: CorrespondantSettings }) {
  const theme = useTheme();
  const save = useSectionSave();
  const server = d.colisDelaiMax || 3;
  const [delai, setDelai] = useState(server);
  const [base, setBase] = useState(server);
  const [saving, setSaving] = useState(false);
  if (server !== base) {
    setBase(server);
    if (delai === base) setDelai(server);
  }
  const dirty = delai !== base;
  useUnsavedGuard(dirty && !saving);

  const step = (n: number) => setDelai((v) => Math.min(MAX, Math.max(MIN, v + n)));

  const submit = async () => {
    setSaving(true);
    try {
      await save('colis', { colisDelaiMax: delai });
      setBase(delai);
      toast('Délai de garde enregistré');
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FormCard title="Délai maximal de garde" subtitle="Entre 1 et 30 jours." icon="hourglass-outline">
        <View style={styles.stepper}>
          <Pressable
            onPress={() => step(-1)}
            disabled={delai <= MIN}
            accessibilityRole="button"
            accessibilityLabel="Un jour de moins"
            style={[styles.stepBtn, { borderColor: theme.border }, delai <= MIN && styles.dim]}>
            <Ionicons name="remove" size={22} color={Brand.primary} />
          </Pressable>
          <View style={styles.value} accessible accessibilityLabel={`Délai : ${delai} jour${delai > 1 ? 's' : ''}`}>
            <ThemedText style={styles.big}>{delai}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              jour{delai > 1 ? 's' : ''}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => step(1)}
            disabled={delai >= MAX}
            accessibilityRole="button"
            accessibilityLabel="Un jour de plus"
            style={[styles.stepBtn, { borderColor: theme.border }, delai >= MAX && styles.dim]}>
            <Ionicons name="add" size={22} color={Brand.primary} />
          </Pressable>
        </View>
        <View style={styles.presets}>
          {PRESETS.map((p) => {
            const on = p === delai;
            return (
              <Pressable
                key={p}
                onPress={() => setDelai(p)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${p} jours`}
                style={[styles.preset, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                <ThemedText type="smallBold">{p} j</ThemedText>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.effects}>
          <Effect
            icon="alert-circle-outline"
            text={`Un colis pas encore réceptionné depuis plus de ${delai} jour${delai > 1 ? 's' : ''} est signalé « en attente depuis trop longtemps » (Vue d’ensemble et liste des colis).`}
          />
          <Effect icon="eye-outline" text={`Votre profil public affiche « Délai de conservation : ${delai} jours ».`} />
        </View>
      </FormCard>

      <Hint
        tone="neutral"
        icon="information-circle-outline"
        text="Capacité maximale, valeur maximale, poids, types de colis acceptés et règles d’incident du site ne sont appliqués par aucun traitement Shoneya pour l’instant : ils ne sont pas proposés ici (vos valeurs enregistrées sont conservées)."
      />

      <SaveButton label={saving ? 'Sauvegarde…' : 'Enregistrer le délai'} onPress={() => void submit()} loading={saving} disabled={!dirty} />
      {!dirty ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Aucune modification à enregistrer.
        </ThemedText>
      ) : null}
    </>
  );
}

function Effect({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.effect}>
      <Ionicons name={icon} size={16} color={Brand.primary} style={styles.effIco} />
      <ThemedText type="small" style={styles.flex}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  dim: { opacity: 0.4 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 },
  stepBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  value: { alignItems: 'center', minWidth: 70 },
  big: { fontSize: 38, lineHeight: 44, fontWeight: '900' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  preset: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  effects: { gap: 8 },
  effect: { flexDirection: 'row', gap: 8 },
  effIco: { marginTop: 1 },
});
