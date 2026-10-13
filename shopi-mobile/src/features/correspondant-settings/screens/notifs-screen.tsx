/**
 * Paramètres › Notifications — SecNotifications du site, limité aux
 * interrupteurs que le serveur relie au VRAI moteur de notifications
 * (PATCH …/notifications → préférences de l'acteur « correspondant ») :
 *   · « Nouveau colis » : commande qui passe par votre relais (ORDER_PLACED) ;
 *   · « Suivi de vos colis » : changements de statut — transfert au livreur,
 *     remise au client, commission (ORDER_STATUS_CHANGED : un seul type côté
 *     serveur, les 3 interrupteurs du site sont donc réglés ensemble) ;
 *   · canaux Push et E-mail (activation globale de chaque canal).
 * Enregistrés dès le toucher. Les autres interrupteurs du site (attente
 * > 48 h, saturation, virement, bilan hebdomadaire, seuil, SMS, WhatsApp)
 * n'ont aucune notification correspondante : pas proposés, l'écran le dit.
 */
import { FormCard, Hint, SettingsShell, toastError, ToggleRow } from '@/features/settings-kit';

import { flagOf, type CorrespondantSettings } from '../api';
import { useCorrespondantSettings, useInstantFlags } from '../hooks';

const STATUS_KEYS = ['colis.transfertLivreur', 'colis.colisRecupere', 'finances.commissionEncaissee'];

export default function NotifsScreen() {
  const q = useCorrespondantSettings();
  return (
    <SettingsShell<CorrespondantSettings>
      query={q}
      title="Notifications"
      icon="notifications-outline"
      subtitle="Ce que Shoneya vous envoie, et par quel canal. Enregistré dès que vous touchez un interrupteur.">
      {(d) => <Content d={d} />}
    </SettingsShell>
  );
}

function Content({ d }: { d: CorrespondantSettings }) {
  const toggle = useInstantFlags('notifications', 'notifSettings');
  const n = d.notifSettings;
  const set = (changes: Record<string, boolean>) => void toggle(n, changes).catch((e) => toastError(e, 'Préférence non enregistrée'));
  /* Le type « changement de statut » est actif si l'un des 3 interrupteurs du site l'est (règle du serveur) */
  const statusOn = STATUS_KEYS.some((k) => flagOf(n, k));

  return (
    <>
      <FormCard title="Vos colis" icon="cube-outline">
        <ToggleRow first label="Nouveau colis" sub="Une commande passe par votre point relais" value={flagOf(n, 'colis.nouveauColis')} onChange={(v) => set({ 'colis.nouveauColis': v })} />
        <ToggleRow
          label="Suivi de vos colis"
          sub="Transfert au livreur, remise au client, commission encaissée"
          value={statusOn}
          onChange={(v) => set(Object.fromEntries(STATUS_KEYS.map((k) => [k, v])))}
        />
      </FormCard>

      <FormCard title="Canaux" icon="megaphone-outline">
        <ToggleRow first label="Notifications push" sub="Sur votre téléphone, via l’application Shoneya" value={flagOf(n, 'canaux.push')} onChange={(v) => set({ 'canaux.push': v })} />
        <ToggleRow label="E-mail" sub="Dans votre boîte de réception" value={flagOf(n, 'canaux.email')} onChange={(v) => set({ 'canaux.email': v })} />
        {!flagOf(n, 'canaux.push') && !flagOf(n, 'canaux.email') ? (
          <Hint tone="warning" icon="notifications-off-outline" text="Push et e-mail coupés : vous ne recevrez plus d’alerte hors de l’application (le centre de notifications reste à jour)." />
        ) : null}
      </FormCard>

      <Hint
        tone="neutral"
        icon="information-circle-outline"
        text="Les autres alertes du site (colis en attente > 48 h, saturation du dépôt, virement effectué, bilan hebdomadaire, seuil du portefeuille) et les canaux SMS et WhatsApp n’existent pas encore côté Shoneya : ils ne sont pas proposés."
      />
    </>
  );
}
