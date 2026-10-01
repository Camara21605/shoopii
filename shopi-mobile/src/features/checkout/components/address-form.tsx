/**
 * Adresse de livraison : adresses enregistrées (une touche pour remplir),
 * destinataire, téléphone (+224), ville et commune (référentiel géo), adresse
 * précise, instructions pour le livreur.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Field } from '@/components/form';
import { SelectField, type SelectOption } from '@/components/select-field';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { normCommune, type SavedAddress } from '../api';

export type AddressForm = {
  firstName: string;
  lastName: string;
  phone: string;
  cityId: string | null;
  city: string;
  commune: string;
  address: string;
  instructions: string;
  savedId: string | null;
};

export function AddressFormView({
  value,
  onChange,
  saved,
  onPickSaved,
  cities,
  communes,
  loadingCommunes,
  errors,
}: {
  value: AddressForm;
  onChange: (patch: Partial<AddressForm>) => void;
  saved: SavedAddress[];
  onPickSaved: (a: SavedAddress) => void;
  cities: SelectOption[];
  communes: SelectOption[];
  loadingCommunes: boolean;
  errors: Partial<Record<keyof AddressForm, string>>;
}) {
  const theme = useTheme();
  return (
    <View style={styles.gap}>
      {saved.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.saved}>
          {saved.map((a) => {
            const on = value.savedId === a.id;
            return (
              <Pressable
                key={a.id}
                onPress={() => onPickSaved(a)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.savedChip, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? theme.backgroundSelected : theme.background }]}>
                <Ionicons name={a.estDefaut ? 'home' : 'location-outline'} size={15} color={Brand.primary} />
                <View>
                  <ThemedText type="smallBold">{a.libelle || (a.typeAdresse ? a.typeAdresse.charAt(0).toUpperCase() + a.typeAdresse.slice(1) : 'Adresse')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {[a.quartier, a.commune, a.ville].filter(Boolean).join(', ')}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.row}>
        <View style={styles.flex}>
          <Field label="Prénom" value={value.firstName} onChangeText={(t) => onChange({ firstName: t })} autoComplete="given-name" error={errors.firstName} />
        </View>
        <View style={styles.flex}>
          <Field label="Nom" value={value.lastName} onChangeText={(t) => onChange({ lastName: t })} autoComplete="family-name" error={errors.lastName} />
        </View>
      </View>
      <Field
        label="Téléphone du destinataire"
        value={value.phone}
        onChangeText={(t) => onChange({ phone: t.replace(/\D/g, '').slice(0, 9) })}
        keyboardType="phone-pad"
        placeholder="620 00 00 00"
        left={<ThemedText style={styles.dial}>🇬🇳 +224</ThemedText>}
        error={errors.phone}
      />
      <SelectField
        label="Ville"
        placeholder="Choisir la ville"
        options={cities}
        value={value.cityId}
        onChange={(id) => onChange({ cityId: id, city: cities.find((c) => c.value === id)?.label ?? '', commune: '' })}
        error={errors.city}
      />
      <SelectField
        label="Commune"
        placeholder={value.cityId ? 'Choisir la commune' : 'Choisissez d’abord la ville'}
        options={communes}
        value={communes.find((c) => normCommune(c.label) === normCommune(value.commune))?.value ?? null}
        onChange={(id) => onChange({ commune: communes.find((c) => c.value === id)?.label ?? '' })}
        loading={loadingCommunes}
        disabled={!value.cityId}
        disabledHint="Choisissez d’abord la ville"
      />
      <Field
        label="Adresse précise"
        value={value.address}
        onChangeText={(t) => onChange({ address: t })}
        placeholder="Quartier, rue, repère (ex. : à côté de la pharmacie)"
        error={errors.address}
      />
      <Field
        label="Instructions pour le livreur (facultatif)"
        value={value.instructions}
        onChangeText={(t) => onChange({ instructions: t })}
        placeholder="Ex. : appeler en arrivant, 2ᵉ étage…"
        multiline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  saved: { gap: 8, paddingRight: 8 },
  savedChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, maxWidth: 240 },
  dial: { fontWeight: '700', marginRight: 6 },
});
