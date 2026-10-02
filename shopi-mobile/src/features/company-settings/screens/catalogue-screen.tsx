/**
 * Paramètres › Catalogue & Règles de publication — comme CatalogueSection du site :
 * 4 règles d'affichage (enregistrées dès qu'on touche l'interrupteur),
 * devise GNF (seule devise de la plateforme) et politique de retour.
 */
import { useState } from 'react';

import { patchSection, type Settings } from '../api';
import { FormCard, Hint, Input, SaveButton, SettingsShell, toast, toastError, ToggleRow } from '../components/ui';
import { useMergeSettings, useSectionSave, useSettings } from '../hooks';

type RuleKey = 'showOutOfStock' | 'autoPublish' | 'showStrikePrice' | 'allowReviews';

const RULES: { key: RuleKey; label: string; sub: string }[] = [
  { key: 'showOutOfStock', label: 'Afficher les produits en rupture de stock', sub: 'Si désactivé, les produits épuisés sont masqués automatiquement' },
  { key: 'autoPublish', label: 'Publication automatique', sub: 'Les nouveaux produits sont publiés immédiatement sans validation manuelle' },
  { key: 'showStrikePrice', label: 'Afficher les prix barrés', sub: 'Montre l’ancien prix barré lors des promotions' },
  { key: 'allowReviews', label: 'Autoriser les avis clients', sub: 'Seuls les acheteurs confirmés peuvent laisser un avis' },
];

export default function CatalogueScreen() {
  const q = useSettings();
  return (
    <SettingsShell title="Catalogue & Produits" icon="pricetags-outline" subtitle="Contrôlez comment vos produits sont affichés et publiés sur Shoneya.">
      {q.data ? <Content d={q.data} /> : null}
    </SettingsShell>
  );
}

function Content({ d }: { d: Settings }) {
  const save = useSectionSave();
  const merge = useMergeSettings();
  const [busy, setBusy] = useState<RuleKey | null>(null);
  const [policy, setPolicy] = useState(d.returnPolicy ?? '');
  const [saving, setSaving] = useState(false);

  const toggle = (key: RuleKey, v: boolean) => {
    setBusy(key);
    save('catalogue', { [key]: v }, { [key]: v })
      .then(() => toast('Catalogue sauvegardé'))
      .catch((e) => toastError(e))
      .finally(() => setBusy((b) => (b === key ? null : b)));
  };

  const submitPolicy = async () => {
    setSaving(true);
    try {
      const res = await patchSection('catalogue', { returnPolicy: policy.trim() });
      merge({ ...res, returnPolicy: policy.trim() });
      toast('Politique de retour enregistrée');
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FormCard title="Règles d’affichage" icon="options-outline" subtitle="Comportement de votre catalogue public">
        {RULES.map((r, i) => (
          <ToggleRow key={r.key} first={i === 0} label={r.label} sub={r.sub} value={d[r.key]} busy={busy === r.key} onChange={(v) => toggle(r.key, v)} />
        ))}
      </FormCard>

      <FormCard title="Devise d’affichage" icon="cash-outline">
        <Input value="GNF — Franc guinéen" editable={false} />
        <Hint tone="neutral" text="Tous les prix de la plateforme sont en francs guinéens (GNF) : c’est la devise payée par vos clients." />
      </FormCard>

      <FormCard title="Politique de retour" icon="return-down-back-outline" subtitle="Texte affiché sur chaque fiche produit">
        <Input
          value={policy}
          onChangeText={setPolicy}
          multiline
          maxLength={2000}
          placeholder="Ex : Retour accepté sous 7 jours après réception, produit non ouvert et dans son emballage d’origine."
          hint="Ce texte rassure vos acheteurs et réduit les litiges."
          style={{ minHeight: 110, textAlignVertical: 'top' }}
        />
        {policy.trim() !== (d.returnPolicy ?? '').trim() ? <SaveButton label="Sauvegarder la politique de retour" onPress={() => void submitPolicy()} loading={saving} /> : null}
      </FormCard>
    </>
  );
}
