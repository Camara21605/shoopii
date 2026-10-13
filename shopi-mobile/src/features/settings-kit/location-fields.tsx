/**
 * Ville → Commune → Quartier, comme VilleCommuneQuartier du site : chaque
 * liste se filtre selon le niveau au-dessus (référentiel de la Guinée). Une
 * valeur absente du référentiel reste saisissable via « Autre… » et est
 * conservée telle quelle. Aucune valeur par défaut inventée.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SelectField } from '@/components/select-field';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';

import { getCommunesByVille, getQuartiersByCommune, VILLES_SORTED } from './geo-guinee';
import { Input } from './ui';

export type Place = { ville: string; commune: string; quartier: string };

const OTHER = '__autre__';
const VILLES = VILLES_SORTED.map((v) => v.nom);

/** `villeLabel` : « Ville de résidence » par défaut (profil) ; « Ville du dépôt » pour un point relais. */
export function LocationFields({ value, onChange, villeLabel = 'Ville de résidence' }: { value: Place; onChange: (next: Place) => void; villeLabel?: string }) {
  const communes = getCommunesByVille(value.ville).map((c) => c.nom);
  const quartiers = getQuartiersByCommune(value.ville, value.commune);
  return (
    <>
      <Level label={villeLabel} value={value.ville} options={VILLES} onPick={(v) => onChange({ ville: v, commune: '', quartier: '' })} />
      <Level label="Commune" value={value.commune} options={communes} disabled={!value.ville} onPick={(v) => onChange({ ...value, commune: v, quartier: '' })} />
      <Level label="Quartier" value={value.quartier} options={quartiers} disabled={!value.ville} onPick={(v) => onChange({ ...value, quartier: v })} />
    </>
  );
}

/** Un niveau : liste si le référentiel connaît des options, saisie libre sinon (ou après « Autre… »). */
function Level({ label, value, options, onPick, disabled }: { label: string; value: string; options: string[]; onPick: (v: string) => void; disabled?: boolean }) {
  const [forceFree, setForceFree] = useState(false);
  const known = value === '' || options.includes(value);
  const free = forceFree || !known || options.length === 0;

  if (free && !disabled) {
    return (
      <View style={styles.wrap}>
        <Input label={label} value={value} onChangeText={onPick} placeholder={label} maxLength={100} />
        {options.length > 0 ? (
          <Pressable
            onPress={() => {
              setForceFree(false);
              onPick('');
            }}
            accessibilityRole="button"
            hitSlop={6}>
            <ThemedText type="small" style={styles.link}>
              Choisir dans la liste
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <SelectField
      label={label}
      title={label}
      placeholder="— Choisir —"
      options={options.map((o) => ({ value: o, label: o }))}
      value={value || null}
      disabled={disabled}
      disabledHint="Choisissez d’abord la ville"
      pinned={{ value: OTHER, label: 'Autre…' }}
      onChange={(v) => {
        if (v === OTHER) {
          setForceFree(true);
          onPick('');
        } else onPick(v);
      }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  link: {
    color: Brand.primary,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
