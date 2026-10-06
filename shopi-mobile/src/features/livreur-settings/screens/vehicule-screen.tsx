/**
 * Paramètres › Véhicule — comme SecVehicule du site. Effet RÉEL : le type sert
 * de filtre dans la recherche de livreurs des clients ; type, modèle et plaque
 * sont affichés aux clients et aux boutiques.
 *   · le type part sous le nom « vehicleType » (le serveur refuse tout autre nom) ;
 *   · un champ vidé est effacé (envoyé vide), plaque en majuscules ;
 *   · année : 4 chiffres entre 1990 et l'année prochaine, effaçable.
 * « Capacité » et « colis acceptés » ne sont pas proposés : lus nulle part.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { VEHICLE_TYPES, type LivreurSettings } from '../api';
import { FormCard, Input, SaveButton, SettingsShell, toast, toastError, useUnsavedGuard } from '../components/ui';
import { useSectionSave } from '../hooks';

const ANNEE_MAX = new Date().getFullYear() + 1;

type Form = {
  type: string;
  marque: string;
  modele: string;
  annee: string;
  couleur: string;
  plaque: string;
};
const toForm = (d: LivreurSettings): Form => ({
  type: d.VehicleType || 'moto',
  marque: d.vehiculeMarque ?? '',
  modele: d.vehiculeModele ?? '',
  annee: d.vehiculeAnnee ? String(d.vehiculeAnnee) : '',
  couleur: d.vehiculeCouleur ?? '',
  plaque: d.vehiculePlaque ?? '',
});
const same = (a: Form, b: Form) => (Object.keys(a) as (keyof Form)[]).every((k) => a[k] === b[k]);

export default function VehiculeScreen() {
  return (
    <SettingsShell<LivreurSettings> title="Mon véhicule" icon="bicycle-outline" subtitle="Informations sur votre véhicule de livraison.">
      {(d) => <Content d={d} />}
    </SettingsShell>
  );
}

function Content({ d }: { d: LivreurSettings }) {
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
  const dirty = !same(form, base);
  useUnsavedGuard(dirty && !saving);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const anneeInvalide = !!form.annee && (!/^\d{4}$/.test(form.annee) || +form.annee < 1990 || +form.annee > ANNEE_MAX);

  const submit = async () => {
    if (anneeInvalide) return toast(`Année invalide : entre 1990 et ${ANNEE_MAX}.`, 'danger');
    setSaving(true);
    try {
      await save('vehicule', {
        vehicleType: form.type,
        vehiculeMarque: form.marque.trim(),
        vehiculeModele: form.modele.trim(),
        vehiculeAnnee: form.annee ? Number(form.annee) : null,
        vehiculeCouleur: form.couleur.trim(),
        vehiculePlaque: form.plaque.trim().toUpperCase(),
      });
      setBase(form);
      toast('Informations véhicule sauvegardées');
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FormCard title="Type de véhicule" icon="car-sport-outline">
        <View accessibilityRole="radiogroup" style={styles.types}>
          {VEHICLE_TYPES.map((v) => {
            const on = form.type === v.value;
            return (
              <Pressable
                key={v.value}
                onPress={() => set('type', v.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${v.label} — ${v.sub}`}
                style={[
                  styles.type,
                  {
                    borderColor: on ? Brand.primary : theme.border,
                    backgroundColor: on ? Brand.primarySoft : theme.background,
                  },
                ]}>
                <View style={[styles.dot, { borderColor: on ? Brand.primary : theme.border }]}>{on ? <View style={styles.dotIn} /> : null}</View>
                <ThemedText style={styles.em}>{v.em}</ThemedText>
                <View style={styles.flex}>
                  <ThemedText style={styles.typeLabel}>{v.label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {v.sub}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </FormCard>

      <FormCard title="Détails du véhicule" icon="information-circle-outline" subtitle="Affichés aux clients et aux boutiques">
        <Input label="Marque" value={form.marque} onChangeText={(v) => set('marque', v)} placeholder="Ex. Haojue, Yamaha" maxLength={100} />
        <Input label="Modèle" value={form.modele} onChangeText={(v) => set('modele', v)} placeholder="Ex. HJ125" maxLength={100} />
        <Input
          label="Année"
          value={form.annee}
          onChangeText={(v) => set('annee', v.replace(/\D/g, '').slice(0, 4))}
          placeholder={String(new Date().getFullYear())}
          keyboardType="number-pad"
          maxLength={4}
          error={anneeInvalide ? `Année invalide : entre 1990 et ${ANNEE_MAX}.` : null}
        />
        <Input label="Couleur" value={form.couleur} onChangeText={(v) => set('couleur', v)} placeholder="Ex. Rouge" maxLength={50} />
        <Input label="Plaque" value={form.plaque} onChangeText={(v) => set('plaque', v.toUpperCase())} placeholder="Ex. RC 1234 A" autoCapitalize="characters" maxLength={20} />
      </FormCard>

      <SaveButton label={saving ? 'Sauvegarde…' : 'Sauvegarder le véhicule'} onPress={() => void submit()} loading={saving} disabled={!dirty || anneeInvalide} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  types: { gap: 9 },
  type: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotIn: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Brand.primary,
  },
  em: { fontSize: 24, lineHeight: 30 },
  typeLabel: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
});
