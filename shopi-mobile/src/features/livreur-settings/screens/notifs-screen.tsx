/**
 * Paramètres › Notifications — comme SecNotifications du site : préférences
 * RÉELLES du moteur de notifications (acteur livreur) :
 *   · canaux : notifications sur le téléphone, e-mail ;
 *   · familles réellement envoyées aux livreurs : missions, paiements,
 *     messages et appels, avis, nouveaux abonnés, annonces Shoneya.
 * Chaque interrupteur s'enregistre aussitôt, un à la fois (jamais de retour en
 * arrière dû à une réponse en retard). SMS / WhatsApp non proposés : non branchés.
 */
import { useQuery } from '@tanstack/react-query';

import { qk } from '@/lib/query-keys';

import { fetchNotifPrefs, patchNotifPrefs, type NotifPrefs } from '../api';
import { FormCard, Hint, SettingsShell, toast, ToggleRow, type IconName } from '../components/ui';
import { useInstantSave } from '../hooks';

const CHANNELS: { key: 'push' | 'email'; label: string; sub: string }[] = [
  {
    key: 'push',
    label: 'Notifications sur le téléphone',
    sub: 'Alertes même quand l’application est fermée (à autoriser sur l’appareil).',
  },
  {
    key: 'email',
    label: 'E-mail',
    sub: 'Copie des notifications importantes par e-mail.',
  },
];

const ITEMS: { key: string; icon: IconName; label: string; sub: string }[] = [
  {
    key: 'missions',
    icon: 'bicycle-outline',
    label: 'Missions',
    sub: 'Nouvelle mission à confirmer, changements de statut des commandes.',
  },
  {
    key: 'paiements',
    icon: 'cash-outline',
    label: 'Paiements',
    sub: 'Gains reçus, retraits effectués ou refusés.',
  },
  {
    key: 'messages',
    icon: 'chatbubble-ellipses-outline',
    label: 'Messages et appels',
    sub: 'Nouveaux messages, appels manqués.',
  },
  {
    key: 'avis',
    icon: 'star-outline',
    label: 'Avis',
    sub: 'Nouvel avis reçu, réponse à un avis.',
  },
  {
    key: 'abonnes',
    icon: 'person-add-outline',
    label: 'Nouveaux abonnés',
    sub: 'Quand un client vous suit.',
  },
  {
    key: 'annonces',
    icon: 'megaphone-outline',
    label: 'Annonces Shoneya',
    sub: 'Informations importantes de la plateforme.',
  },
];

export default function NotifsScreen() {
  const q = useQuery({
    queryKey: qk.livreur.notifPrefs,
    queryFn: fetchNotifPrefs,
  });
  const save = useInstantSave<NotifPrefs>(qk.livreur.notifPrefs);

  const send = (body: Parameters<typeof patchNotifPrefs>[0], optimistic: (p: NotifPrefs) => NotifPrefs) =>
    save(optimistic, () => patchNotifPrefs(body))
      .then(() => toast('Préférences de notifications sauvegardées'))
      .catch(() => toast('Erreur lors de la sauvegarde', 'danger'));

  return (
    <SettingsShell
      title="Notifications"
      icon="notifications-outline"
      subtitle="Choisissez ce qui vous est signalé. Chaque réglage s’applique aussitôt."
      query={q}
      loadingText="Chargement de vos préférences…">
      {(v) => (
        <>
          <FormCard title="Canaux de notification" icon="phone-portrait-outline">
            {CHANNELS.map((c, i) => (
              <ToggleRow
                key={c.key}
                first={i === 0}
                label={c.label}
                sub={c.sub}
                value={v.global[c.key]}
                onChange={(val) =>
                  void send({ global: { [c.key]: val } }, (p) => ({
                    ...p,
                    global: { ...p.global, [c.key]: val },
                  }))
                }
              />
            ))}
          </FormCard>

          <FormCard title="Ce qui vous est signalé" icon="list-outline">
            {ITEMS.map((it, i) => (
              <ToggleRow
                key={it.key}
                first={i === 0}
                icon={it.icon}
                label={it.label}
                sub={it.sub}
                value={!!v.items[it.key]}
                onChange={(val) =>
                  void send({ items: { [it.key]: val } }, (p) => ({
                    ...p,
                    items: { ...p.items, [it.key]: val },
                  }))
                }
              />
            ))}
            <Hint text="Coupé = ni notification sur le téléphone ni e-mail ; l’historique reste dans la cloche de l’application." />
          </FormCard>
        </>
      )}
    </SettingsShell>
  );
}
