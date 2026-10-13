/**
 * Paramètres › Confidentialité — SecConfidentialite du site, limité aux
 * réglages que le serveur applique réellement (PATCH …/confidentialite,
 * privacySettings.visibilite — absent = activé) :
 *   · statistiques de performance : masquées → missions, note et fiabilité
 *     n'apparaissent plus sur votre profil public ;
 *   · numéro de téléphone public : masqué → « Non communiqué » ;
 *   · apparaître dans la recherche : non → absent de la carte, des listes et
 *     de la recherche de points relais ;
 *   · position du dépôt : non → pas d'épingle sur la carte.
 * Enregistrés dès le toucher ; l'effet du choix est rappelé sous chaque
 * interrupteur. Les réglages « données » du site (amélioration des
 * algorithmes, statistiques anonymisées, rapports personnalisés) ne sont lus
 * par aucun traitement : pas proposés, l'écran le dit.
 */
import { FormCard, Hint, SettingsShell, toastError, ToggleRow } from '@/features/settings-kit';

import { flagOf, type CorrespondantSettings } from '../api';
import { useCorrespondantSettings, useInstantFlags } from '../hooks';

const ITEMS: { key: string; label: string; sub: string; on: string; off: string }[] = [
  {
    key: 'visibilite.afficherStats',
    label: 'Afficher mes statistiques',
    sub: 'Missions, note et fiabilité sur votre profil public',
    on: 'Visibles par les boutiques, livreurs et clients.',
    off: 'Masquées : votre profil public n’affiche plus vos chiffres.',
  },
  {
    key: 'visibilite.afficherTelephone',
    label: 'Afficher mon numéro de téléphone',
    sub: 'Numéro du dépôt (ou personnel) sur votre profil public',
    on: 'Votre numéro est affiché sur votre profil.',
    off: 'Votre profil indique « Non communiqué ».',
  },
  {
    key: 'visibilite.apparaitreRecherche',
    label: 'Apparaître dans la recherche',
    sub: 'Carte, listes et recherche de points relais',
    on: 'Les boutiques peuvent vous trouver.',
    off: 'Vous n’apparaissez plus dans la recherche ni sur la carte.',
  },
  {
    key: 'visibilite.partagerLocalisation',
    label: 'Partager la position du dépôt',
    sub: 'Épingle de votre relais sur la carte',
    on: 'Votre dépôt est placé sur la carte.',
    off: 'Pas d’épingle sur la carte.',
  },
];

export default function PrivacyScreen() {
  const q = useCorrespondantSettings();
  return (
    <SettingsShell<CorrespondantSettings>
      query={q}
      title="Confidentialité"
      icon="shield-half-outline"
      subtitle="Ce que le public voit de votre point relais. Enregistré dès que vous touchez un interrupteur.">
      {(d) => <Content d={d} />}
    </SettingsShell>
  );
}

function Content({ d }: { d: CorrespondantSettings }) {
  const toggle = useInstantFlags('confidentialite', 'privacySettings');
  const p = d.privacySettings;
  return (
    <>
      <FormCard title="Visibilité" icon="eye-outline">
        {ITEMS.map((it, i) => {
          const on = flagOf(p, it.key);
          return (
            <ToggleRow
              key={it.key}
              first={i === 0}
              label={it.label}
              sub={it.sub}
              note={on ? it.on : it.off}
              value={on}
              onChange={(v) => void toggle(p, { [it.key]: v }).catch((e) => toastError(e, 'Réglage non enregistré'))}
            />
          );
        })}
      </FormCard>
      <Hint
        tone="neutral"
        icon="information-circle-outline"
        text="Les réglages « données » du site (amélioration des algorithmes, statistiques anonymisées, rapports personnalisés) ne sont utilisés par aucun traitement Shoneya : ils ne sont pas proposés."
      />
    </>
  );
}
