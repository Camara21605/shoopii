/**
 * Joindre un livreur depuis l'espace entreprise — mêmes règles que le site :
 *   · Message et appel dans l'application : seulement si l'entreprise SUIT
 *     ce livreur (isSuivi) ; la discussion est ouverte ou créée
 *     (POST /messagerie/conversations), puis l'appel part de cette discussion ;
 *   · WhatsApp et appel téléphonique : toujours, s'il a un numéro.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking } from 'react-native';

import { startCall } from '@/features/calls/call-store';
import { openConversationWith } from '@/features/messagerie/api';
import { toUserMessage } from '@/lib/api/errors';

import { phoneDigits } from './api';

export function useDriverContact() {
  const [busy, setBusy] = useState<string | null>(null);

  async function message(id: string) {
    if (busy) return;
    setBusy(`msg:${id}`);
    try {
      const c = await openConversationWith('delivery', id);
      router.push({
        pathname: '/messages/[id]',
        params: { id: c.id, name: c.contactName, logo: c.contactLogo ?? '', online: c.contactOnline ? '1' : '0', userId: c.contactUserId ?? '' },
      });
    } catch (err) {
      Alert.alert('Message', toUserMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function call(id: string, name: string) {
    if (busy) return;
    setBusy(`call:${id}`);
    try {
      const c = await openConversationWith('delivery', id);
      if (!c.contactUserId) throw new Error('Ce livreur ne peut pas être appelé pour le moment.');
      await startCall(c.id, c.contactUserId, name, c.contactLogo ?? null, 'audio');
    } catch (err) {
      Alert.alert('Appel', err instanceof Error && !('status' in err) ? err.message : toUserMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function whatsapp(phone: string | null) {
    const d = phoneDigits(phone);
    if (!d) { Alert.alert('WhatsApp', 'Ce livreur n’a pas renseigné de numéro.'); return; }
    void Linking.openURL(`https://wa.me/${d}`).catch(() => Alert.alert('WhatsApp', 'Impossible d’ouvrir WhatsApp.'));
  }

  function phoneCall(phone: string | null) {
    const d = phoneDigits(phone);
    if (!d) { Alert.alert('Téléphone', 'Ce livreur n’a pas renseigné de numéro.'); return; }
    void Linking.openURL(`tel:+${d}`).catch(() => Alert.alert('Téléphone', 'Impossible de lancer l’appel.'));
  }

  return { message, call, whatsapp, phoneCall, busy };
}
