/**
 * Accepter / refuser une mission assignée — partagé par la vue d'ensemble et
 * l'écran Missions. Accepter génère le code de validation du livreur et fait
 * passer la mission « à récupérer » ; refuser la libère (motif obligatoire).
 */
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useSnack } from '@/components/snack';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { acceptMission, refuseMission, type Mission } from './api';

export function useMissionActions() {
  const qc = useQueryClient();
  const snack = useSnack();
  const [busy, setBusy] = useState<string | null>(null);
  const [refusing, setRefusing] = useState<Mission | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.livreur.all });
    void qc.invalidateQueries({ queryKey: qk.notifications.unread });
  };

  const accept = async (m: Mission) => {
    setBusy(m.uuid);
    try {
      await acceptMission(m.uuid);
      qc.setQueryData<Mission[]>(qk.livreur.missions, (d) => d?.map((x) => (x.uuid === m.uuid ? { ...x, status: 'prep' } : x)));
      snack.show(`✅ Mission ${m.id} acceptée`);
      refresh();
    } catch (e) {
      snack.show(toUserMessage(e) || '❌ Impossible d’accepter cette mission', true);
    } finally {
      setBusy(null);
    }
  };

  const refuse = async (reason: string) => {
    if (!refusing) return;
    const m = refusing;
    try {
      await refuseMission(m.uuid, reason);
      qc.setQueryData<Mission[]>(qk.livreur.missions, (d) => d?.filter((x) => x.uuid !== m.uuid));
      setRefusing(null);
      snack.show(`✕ Mission ${m.id} refusée`);
      refresh();
    } catch (e) {
      snack.show(toUserMessage(e) || '❌ Impossible de refuser cette mission', true);
    }
  };

  return { busy, refusing, setRefusing, accept, refuse, snack };
}
