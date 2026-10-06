/**
 * Paramètres › Confidentialité — comme SecConfidentialite du site. Les 4
 * réglages sont appliqués côté serveur partout où le livreur est visible :
 *   showInSearch      → liste « Livreurs », carte, recherche d'acteurs
 *   showRating        → note + nombre d'avis (liste, profil, carte, tri/filtre)
 *   showDeliveryCount → nombre de livraisons (liste, profil, tri)
 *   shareLocation     → carte / distances : zone approximative au lieu du GPS
 * L'effet du choix actuel est rappelé sous chaque interrupteur. Enregistrement
 * immédiat, une requête à la fois.
 */
import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { fetchPrivacy, patchPrivacy, type Privacy, type PrivacyKey } from '../api';
import { FormCard, Hint, SettingsShell, toast, ToggleRow, type IconName } from '../components/ui';
import { useInstantSave } from '../hooks';

const ITEMS: {
  key: PrivacyKey;
  icon: IconName;
  label: string;
  sub: string;
  on: string;
  off: string;
}[] = [
  {
    key: 'showInSearch',
    icon: 'search-outline',
    label: 'Apparaître dans les recherches',
    sub: 'Liste « Livreurs », carte et recherche de la plateforme.',
    on: 'Visible : les boutiques et clients peuvent vous trouver.',
    off: 'Masqué : seules les personnes qui ont le lien de votre profil peuvent le voir.',
  },
  {
    key: 'showRating',
    icon: 'star-outline',
    label: 'Afficher ma note',
    sub: 'Note moyenne et nombre d’avis, sur votre profil, dans la liste et sur la carte.',
    on: 'Votre note est visible.',
    off: 'Votre note est masquée (et ne sert plus au tri ni au filtre par note).',
  },
  {
    key: 'showDeliveryCount',
    icon: 'cube-outline',
    label: 'Afficher mon nombre de livraisons',
    sub: 'Sur votre profil et dans la liste des livreurs.',
    on: 'Votre nombre de livraisons est visible.',
    off: 'Votre nombre de livraisons est masqué.',
  },
  {
    key: 'shareLocation',
    icon: 'location-outline',
    label: 'Position précise sur la carte',
    sub: 'Votre dernière position GPS sert à vous placer sur la carte et à calculer les distances.',
    on: 'La carte utilise votre dernière position.',
    off: 'La carte vous place seulement dans votre zone (quartier ou commune), jamais à votre position exacte.',
  },
];

export default function PrivacyScreen() {
  const q = useQuery({ queryKey: qk.livreur.privacy, queryFn: fetchPrivacy });
  const save = useInstantSave<Privacy>(qk.livreur.privacy);

  const toggle = (key: PrivacyKey, value: boolean) =>
    void save(
      (p) => ({ ...p, [key]: value }),
      () => patchPrivacy(key, value),
    )
      .then(() => toast('Réglage enregistré'))
      .catch(() => toast('Enregistrement impossible — réessayez', 'danger'));

  return (
    <SettingsShell
      title="Confidentialité"
      icon="shield-half-outline"
      subtitle="Choisissez ce que les boutiques et les clients voient de vous. Chaque changement s’applique immédiatement."
      query={q}
      loadingText="Chargement de vos réglages…">
      {(v) => (
        <FormCard title="Ce que le public voit" icon="eye-outline">
          {ITEMS.map((it, i) => (
            <ToggleRow key={it.key} first={i === 0} icon={it.icon} label={it.label} sub={it.sub} note={v[it.key] ? it.on : it.off} value={v[it.key]} onChange={(val) => toggle(it.key, val)} />
          ))}
          <Hint text="Pendant une livraison, votre position reste transmise au suivi de la commande en cours, quel que soit ce réglage." />
        </FormCard>
      )}
    </SettingsShell>
  );
}
