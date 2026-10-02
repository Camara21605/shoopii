/**
 * Paramètres › Notifications — comme NotifsSection du site : les VRAIES
 * préférences (GET/PATCH …/parametres/notifications) — canaux push / e-mail
 * et une ligne par famille de notifications réellement envoyées aux
 * boutiques. Chaque interrupteur s'enregistre aussitôt (seule la ligne
 * touchée est envoyée), une requête à la fois, et seule la dernière réponse
 * remplace l'écran.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Brand } from '@/constants/theme';
import { qk } from '@/lib/query-keys';

import { fetchNotifs, patchNotifs, type NotifsView } from '../api';
import { FormCard, Hint, SettingsShell, toast, ToggleRow } from '../components/ui';

const GROUPS: { title: string; icon: React.ComponentProps<typeof FormCard>['icon']; items: { key: string; label: string }[] }[] = [
  {
    title: 'Commandes',
    icon: 'cube-outline',
    items: [
      { key: 'newOrder', label: 'Nouvelle commande reçue' },
      { key: 'orderCancelled', label: 'Commande annulée ou remboursée' },
      { key: 'orderDelivered', label: 'Livraison terminée, échouée ou retournée' },
      { key: 'returns', label: 'Demande de retour / suivi d’un retour' },
      { key: 'paymentReceived', label: 'Paiement reçu' },
    ],
  },
  {
    title: 'Stock & Catalogue',
    icon: 'bar-chart-outline',
    items: [
      { key: 'outOfStock', label: 'Produit en rupture de stock' },
      { key: 'nearThreshold', label: 'Stock proche du seuil minimum' },
      { key: 'productPublished', label: 'Produit validé et publié' },
      { key: 'promos', label: 'Mes promotions (fin proche, terminée, limite atteinte, utilisée)' },
    ],
  },
  {
    title: 'Clients & messages',
    icon: 'people-outline',
    items: [
      { key: 'newReview', label: 'Nouvel avis client' },
      { key: 'newFollower', label: 'Nouvel abonné à ma boutique' },
      { key: 'likes', label: '« J’aime » sur mes produits et services' },
      { key: 'messages', label: 'Messages et appels manqués' },
    ],
  },
  { title: 'Shoneya', icon: 'megaphone-outline', items: [{ key: 'shopNews', label: 'Annonces de Shoneya' }] },
];

export default function NotifsScreen() {
  return (
    <SettingsShell title="Notifications" icon="notifications-outline" subtitle="Choisissez les événements pour lesquels vous souhaitez être prévenu.">
      <Content />
    </SettingsShell>
  );
}

function Content() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.company.settingsNotifs, queryFn: fetchNotifs });
  const [pending, setPending] = useState<string | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const seq = useRef(0);

  if (q.isPending) return <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  if (!q.data) return <Hint icon="cloud-offline-outline" tone="warning" text="Préférences momentanément indisponibles. Réessayez plus tard." />;
  const view = q.data;

  const send = (key: string, body: Parameters<typeof patchNotifs>[0], optimistic: NotifsView) => {
    qc.setQueryData(qk.company.settingsNotifs, optimistic);
    setPending(key);
    const mine = ++seq.current;
    chain.current = chain.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const res = await patchNotifs(body);
          if (mine === seq.current) {
            qc.setQueryData(qk.company.settingsNotifs, res);
            setPending(null);
          }
          toast('Notifications sauvegardées');
        } catch {
          toast('Erreur lors de la sauvegarde', 'danger');
          if (mine === seq.current) void qc.invalidateQueries({ queryKey: qk.company.settingsNotifs }).finally(() => setPending(null));
        }
      });
  };

  const toggleItem = (key: string, v: boolean) => send(key, { items: { [key]: v } }, { ...view, items: { ...view.items, [key]: v } });
  const toggleChannel = (ch: 'push' | 'email', v: boolean) => send(ch, { global: { [ch]: v } }, { ...view, global: { ...view.global, [ch]: v } });
  const noChannel = !view.global.push && !view.global.email;

  return (
    <>
      <FormCard title="Comment être prévenu" icon="radio-outline" subtitle="Canaux utilisés pour toutes les alertes ci-dessous">
        <ToggleRow first label="Notifications sur le téléphone" sub="Alertes instantanées, même application fermée" value={view.global.push} busy={pending === 'push'} onChange={(v) => toggleChannel('push', v)} />
        <ToggleRow label="E-mail" sub="À l’adresse e-mail de votre compte" value={view.global.email} busy={pending === 'email'} onChange={(v) => toggleChannel('email', v)} />
        {noChannel ? (
          <Hint
            icon="warning-outline"
            tone="warning"
            text="Push et e-mail sont coupés : vous ne recevrez plus aucune alerte (elles restent visibles dans la cloche de l’application)."
          />
        ) : null}
      </FormCard>

      {GROUPS.map((g) => (
        <FormCard key={g.title} title={g.title} icon={g.icon}>
          {g.items.map((it, i) => (
            <ToggleRow key={it.key} first={i === 0} label={it.label} value={!!view.items[it.key]} busy={pending === it.key} onChange={(v) => toggleItem(it.key, v)} />
          ))}
        </FormCard>
      ))}

      <Hint tone="neutral" text="Chaque notification reste aussi visible dans la cloche de l’application, même coupée ici." />
    </>
  );
}

const styles = StyleSheet.create({ loader: { marginTop: 32 } });
