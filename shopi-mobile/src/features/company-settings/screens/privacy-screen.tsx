/**
 * Paramètres › Confidentialité — comme PrivacySection du site : les 3 réglages
 * réellement appliqués par le serveur (absent = activé). Chaque interrupteur
 * s'enregistre aussitôt ; la réponse (tout le bloc privacySettings) n'est
 * appliquée que si c'est celle de la DERNIÈRE touche.
 */
import { useRef, useState } from 'react';

import { patchSection, type Settings } from '../api';
import { FormCard, Hint, SettingsShell, toast, ToggleRow } from '../components/ui';
import { useMergeSettings, useSettings } from '../hooks';

type Key = 'showInSearch' | 'showSalesStats' | 'allowFollow';

const ITEMS: { key: Key; label: string; sub: string; on: string; off: string }[] = [
  {
    key: 'showInSearch',
    label: 'Apparaître dans la recherche',
    sub: 'Votre boutique est visible dans les résultats de recherche Shoneya',
    on: 'Les clients trouvent votre boutique en la cherchant par son nom et sur la carte.',
    off: 'Votre boutique n’apparaît plus dans la recherche ni sur la carte (son lien direct fonctionne toujours).',
  },
  {
    key: 'showSalesStats',
    label: 'Afficher les stats de vente',
    sub: 'Les clients voient le nombre de commandes et la note',
    on: 'Votre nombre de ventes est affiché sur votre page boutique.',
    off: 'Votre nombre de ventes est masqué sur votre page boutique.',
  },
  {
    key: 'allowFollow',
    label: 'Permettre les abonnements',
    sub: 'Les utilisateurs peuvent suivre votre boutique',
    on: 'Les clients peuvent s’abonner à votre boutique pour suivre vos nouveautés.',
    off: 'Plus de nouveaux abonnés (vos abonnés actuels restent).',
  },
];

export default function PrivacyScreen() {
  const q = useSettings();
  return (
    <SettingsShell title="Confidentialité" icon="eye-off-outline" subtitle="Contrôlez quelles informations de votre boutique sont visibles et partagées.">
      {q.data ? <Content d={q.data} /> : null}
    </SettingsShell>
  );
}

function Content({ d }: { d: Settings }) {
  const merge = useMergeSettings();
  const [pending, setPending] = useState<Key | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const seq = useRef(0);
  const raw = (d.privacySettings ?? {}) as Record<string, unknown>;
  const value = (k: Key) => raw[k] !== false;

  const toggle = (key: Key, v: boolean) => {
    merge({ privacySettings: { ...raw, [key]: v } });
    setPending(key);
    const mine = ++seq.current;
    chain.current = chain.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const res = await patchSection('confidentialite', { [key]: v });
          if (mine === seq.current) {
            merge({ privacySettings: res });
            setPending(null);
          }
          toast('Confidentialité sauvegardée');
        } catch {
          toast('Erreur lors de la sauvegarde', 'danger');
          if (mine === seq.current) {
            merge({ privacySettings: raw });
            setPending(null);
          }
        }
      });
  };

  return (
    <FormCard title="Préférences de confidentialité" icon="lock-closed-outline" subtitle="Ces paramètres s’appliquent à votre page boutique publique">
      {ITEMS.map((it, i) => (
        <ToggleRow key={it.key} first={i === 0} label={it.label} sub={it.sub} value={value(it.key)} busy={pending === it.key} onChange={(v) => toggle(it.key, v)} />
      ))}
      {ITEMS.map((it) => (
        <Hint key={it.key} icon={value(it.key) ? 'checkmark-circle-outline' : 'eye-off-outline'} tone={value(it.key) ? 'success' : 'neutral'} text={value(it.key) ? it.on : it.off} />
      ))}
    </FormCard>
  );
}
