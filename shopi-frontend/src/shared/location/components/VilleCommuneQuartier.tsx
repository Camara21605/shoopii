/* ================================================================
 * FICHIER : src/shared/location/components/VilleCommuneQuartier.tsx
 *
 * Trois champs liés — Ville → Commune → Quartier — pour les formulaires
 * de profil (livreur, correspondant…). S'appuie sur le référentiel de la
 * Guinée (geo-guinee.ts) : chaque liste se filtre selon le niveau au-dessus.
 * Une valeur absente du référentiel (ville hors liste, quartier non
 * répertorié) reste saisissable via « Autre… » et est conservée telle quelle.
 *
 * Aucune valeur par défaut inventée : tant que l'utilisateur n'a rien choisi,
 * les champs restent vides (l'ancien formulaire livreur forçait « Conakry »,
 * l'ancien formulaire correspondant « Kaloum / Conakry »).
 *
 * Les classes CSS sont fournies par l'appelant : chaque dashboard a sa propre
 * feuille de style de formulaires.
 * ================================================================ */

import { useMemo, useState } from 'react';
import { VILLES_SORTED, getCommunesByVille, getQuartiersByCommune } from '../data/geo-guinee';

export interface VilleCommuneQuartierValue {
  ville:    string;
  commune:  string;
  quartier: string;
}

interface Props {
  value:    VilleCommuneQuartierValue;
  onChange: (next: VilleCommuneQuartierValue) => void;
  labels?:  Partial<Record<'ville' | 'commune' | 'quartier' | 'autre' | 'choisir', string>>;
  classes:  { group: string; label: string; input: string; wrap?: string };
  /** Affiche aussi la commune (défaut : oui). */
  withCommune?: boolean;
  disabled?:    boolean;
}

const OTHER = '__autre__';

interface LevelProps {
  label:    string;
  value:    string;
  options:  string[];
  onPick:   (v: string) => void;
  classes:  Props['classes'];
  placeholderChoose: string;
  otherLabel: string;
  disabled?: boolean;
}

/* Un niveau : liste déroulante si le référentiel connaît des options,
 * saisie libre sinon (ou si l'utilisateur choisit « Autre… »). */
function Level({ label, value, options, onPick, classes, placeholderChoose, otherLabel, disabled }: LevelProps) {
  const known  = value === '' || options.includes(value);
  const [forceFree, setForceFree] = useState(false);
  const free   = forceFree || (!known) || options.length === 0;

  return (
    <div className={classes.group}>
      <div className={classes.label}>{label}</div>
      <div className={classes.wrap}>
        {free ? (
          <input
            className={classes.input}
            value={value}
            maxLength={100}
            disabled={disabled}
            onChange={e => onPick(e.target.value)}
            placeholder={label}
          />
        ) : (
          <select
            className={classes.input}
            value={value}
            disabled={disabled}
            onChange={e => {
              if (e.target.value === OTHER) { setForceFree(true); onPick(''); }
              else onPick(e.target.value);
            }}
          >
            <option value="">{placeholderChoose}</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
            <option value={OTHER}>{otherLabel}</option>
          </select>
        )}
      </div>
    </div>
  );
}

export default function VilleCommuneQuartier({
  value, onChange, labels, classes, withCommune = true, disabled,
}: Props) {
  const l = {
    ville: 'Ville', commune: 'Commune', quartier: 'Quartier',
    autre: 'Autre…', choisir: '— Choisir —', ...labels,
  };

  const villes    = useMemo(() => VILLES_SORTED.map(v => v.nom), []);
  const communes  = useMemo(() => getCommunesByVille(value.ville).map(c => c.nom), [value.ville]);
  const quartiers = useMemo(() => getQuartiersByCommune(value.ville, value.commune), [value.ville, value.commune]);

  return (
    <>
      <Level label={l.ville} value={value.ville} options={villes}
        onPick={v => onChange({ ville: v, commune: '', quartier: '' })}
        classes={classes} placeholderChoose={l.choisir} otherLabel={l.autre} disabled={disabled} />

      {withCommune && (
        <Level label={l.commune} value={value.commune} options={communes}
          onPick={v => onChange({ ...value, commune: v, quartier: '' })}
          classes={classes} placeholderChoose={l.choisir} otherLabel={l.autre}
          disabled={disabled || !value.ville} />
      )}

      <Level label={l.quartier} value={value.quartier} options={quartiers}
        onPick={v => onChange({ ...value, quartier: v })}
        classes={classes} placeholderChoose={l.choisir} otherLabel={l.autre}
        disabled={disabled || !value.ville} />
    </>
  );
}
