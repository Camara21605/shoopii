/**
 * Pays → Ville → Commune → Quartier, tirés du référentiel géographique du
 * super admin (GET /geo/…) : chaque liste se filtre selon le niveau du dessus.
 *   - le choix « Pays » n'apparaît que si plusieurs pays sont actifs ;
 *   - un lieu absent du référentiel reste saisissable (« Pas dans la liste ») ;
 *   - sans réseau ou référentiel vide : repli sur la liste intégrée de la
 *     Guinée (LocationFields), pour ne jamais bloquer la saisie.
 * Les valeurs gardées sont des NOMS (en casse normale) : c'est ce que le
 * livreur lit et ce qu'enregistrent l'adresse et la commande.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SelectField } from '@/components/select-field';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { Input, LocationFields } from '@/features/settings-kit';
import { qk } from '@/lib/query-keys';

import { fetchChildren, fetchPays, fetchVillesOfPays, prettyGeoName, sameName, type GeoRefItem } from '../geo';

export type RefPlace = { pays: string; ville: string; commune: string; quartier: string };

const OTHER = '__autre__';
const DAY = 24 * 60 * 60_000;
const STALE = 30 * 60_000;

/** Pays de l'adresse : code (« GN ») ou nom ; à défaut la Guinée, sinon le premier. */
export function pickPays(list: GeoRefItem[], value: string): GeoRefItem | undefined {
  if (!list.length) return undefined;
  const v = value.trim();
  return (
    (v ? list.find((p) => (p.code && p.code.toUpperCase() === v.toUpperCase()) || sameName(p.nom, v)) : undefined) ??
    list.find((p) => p.code?.toUpperCase() === 'GN' || sameName(p.nom, 'Guinée')) ??
    list[0]
  );
}

/** Valeur gardée pour le pays : son code s'il en a un (comme « GN » jusqu'ici), sinon son nom. */
export const paysValue = (p: Pick<GeoRefItem, 'code' | 'nom'>) => p.code?.trim().toUpperCase() || prettyGeoName(p.nom);

const findByName = (list: GeoRefItem[] | undefined, name: string) => (name ? list?.find((i) => sameName(i.nom, name)) : undefined);

export function PlaceFields({ value, onChange, villeError }: { value: RefPlace; onChange: (next: RefPlace) => void; villeError?: string }) {
  const paysQ = useQuery({ queryKey: qk.geo.pays, queryFn: fetchPays, staleTime: STALE, gcTime: DAY });
  const pays = useMemo(() => pickPays(paysQ.data ?? [], value.pays), [paysQ.data, value.pays]);

  const villesQ = useQuery({
    queryKey: qk.geo.villes(pays?.id ?? null),
    queryFn: () => fetchVillesOfPays(pays!.id),
    enabled: !!pays,
    staleTime: STALE,
    gcTime: DAY,
  });
  const ville = findByName(villesQ.data, value.ville);

  const communesQ = useQuery({
    queryKey: qk.geo.items('commune', ville?.id ?? null),
    queryFn: () => fetchChildren('commune', ville!.id),
    enabled: !!ville,
    staleTime: STALE,
    gcTime: DAY,
  });
  const commune = findByName(communesQ.data, value.commune);

  const quartiersQ = useQuery({
    queryKey: qk.geo.items('quartier', commune?.id ?? null),
    queryFn: () => fetchChildren('quartier', commune!.id),
    enabled: !!commune,
    staleTime: STALE,
    gcTime: DAY,
  });

  /* Hors ligne, ou référentiel pas encore rempli par le super admin : liste intégrée. */
  const fallback = paysQ.isError || (paysQ.isSuccess && !pays) || villesQ.isError || (villesQ.isSuccess && villesQ.data.length === 0);
  if (fallback) {
    return (
      <>
        <LocationFields
          villeLabel="Ville *"
          value={{ ville: value.ville, commune: value.commune, quartier: value.quartier }}
          onChange={(p) => onChange({ ...value, ...p })}
        />
        {villeError ? <FieldError text={villeError} /> : null}
      </>
    );
  }

  const multiPays = (paysQ.data?.length ?? 0) > 1;

  return (
    <>
      {multiPays ? (
        <Level
          label="Pays"
          value={pays ? prettyGeoName(pays.nom) : ''}
          items={paysQ.data}
          loading={paysQ.isPending}
          allowOther={false}
          onPick={(nom) => {
            const p = paysQ.data?.find((x) => sameName(x.nom, nom));
            if (p) onChange({ pays: paysValue(p), ville: '', commune: '', quartier: '' });
          }}
        />
      ) : null}
      <Level
        label="Ville *"
        value={value.ville}
        items={villesQ.data}
        loading={paysQ.isPending || villesQ.isPending}
        onPick={(v) => onChange({ ...value, pays: pays ? paysValue(pays) : value.pays, ville: v, commune: '', quartier: '' })}
      />
      {villeError ? <FieldError text={villeError} /> : null}
      <Level
        label="Commune"
        value={value.commune}
        items={ville ? communesQ.data : []}
        loading={!!ville && communesQ.isPending}
        disabled={!value.ville}
        disabledHint="Choisissez d’abord la ville"
        onPick={(v) => onChange({ ...value, commune: v, quartier: '' })}
      />
      <Level
        label="Quartier"
        value={value.quartier}
        items={commune ? quartiersQ.data : []}
        loading={!!commune && quartiersQ.isPending}
        disabled={!value.commune}
        disabledHint="Choisissez d’abord la commune"
        onPick={(v) => onChange({ ...value, quartier: v })}
      />
    </>
  );
}

/**
 * Un niveau : liste du référentiel (recherche sans accents), ou saisie libre
 * quand le lieu n'y est pas — choix « Pas dans la liste », niveau du dessus
 * hors référentiel, ou valeur déjà enregistrée inconnue de la liste.
 */
function Level({
  label,
  value,
  items,
  onPick,
  loading,
  disabled,
  disabledHint,
  allowOther = true,
}: {
  label: string;
  value: string;
  items: GeoRefItem[] | undefined;
  onPick: (v: string) => void;
  loading?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  allowOther?: boolean;
}) {
  const [forceFree, setForceFree] = useState(false);
  const options = useMemo(() => {
    const seen = new Set<string>();
    return (items ?? [])
      .map((i) => prettyGeoName(i.nom))
      .filter((n) => n && !seen.has(n.toLowerCase()) && (seen.add(n.toLowerCase()), true))
      .map((n) => ({ value: n, label: n }));
  }, [items]);
  const matched = value ? options.find((o) => sameName(o.value, value)) : undefined;
  const free = allowOther && !disabled && !loading && (forceFree || (!!value && !matched) || (items !== undefined && options.length === 0));

  if (free) {
    return (
      <View style={styles.wrap}>
        <Input label={label} value={value} onChangeText={onPick} placeholder={`Saisissez ${label.replace(' *', '').toLowerCase()}`} maxLength={100} />
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
      title={label.replace(' *', '')}
      placeholder={loading ? 'Chargement…' : '— Choisir —'}
      options={options}
      value={matched?.value ?? null}
      loading={loading}
      disabled={disabled}
      disabledHint={disabledHint}
      pinned={allowOther ? { value: OTHER, label: 'Pas dans la liste…' } : undefined}
      onChange={(v) => {
        if (v === OTHER) {
          setForceFree(true);
          onPick('');
        } else onPick(v);
      }}
    />
  );
}

function FieldError({ text }: { text: string }) {
  return (
    <ThemedText type="small" style={styles.error} accessibilityRole="alert">
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  link: { color: Brand.primary, fontWeight: '800', textDecorationLine: 'underline' },
  error: { color: Brand.danger, marginTop: -6 },
});
