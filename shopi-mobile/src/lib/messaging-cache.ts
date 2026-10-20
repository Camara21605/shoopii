/**
 * Messagerie disponible TOUT DE SUITE, comme WhatsApp : la liste des
 * discussions, les groupes et les derniers messages de chaque discussion sont
 * gardés sur le téléphone. À l'ouverture de « Messages », ils s'affichent sans
 * attendre le réseau, puis le serveur les met à jour en arrière-plan (les
 * données remises en cache sont datées : react-query les sait périmées et les
 * rafraîchit — rien n'est figé).
 *
 *   - un fichier PRIVÉ par compte (Paths.document, jamais sauvegardé dans le
 *     cloud : allowBackup=false) — effacé à la déconnexion ;
 *   - seulement la page la plus récente de chaque fil (taille limitée), 40
 *     fils au plus, jamais les messages en cours d'envoi ou en échec ;
 *   - écriture regroupée (2 s après le dernier changement).
 */
import { File, Paths } from 'expo-file-system';
import type { Query, QueryClient, QueryKey } from '@tanstack/react-query';

/** Clés gardées (mêmes valeurs que les écrans de la messagerie). */
const ROOTS = new Set(['conversations', 'groups', 'messages', 'group-messages', 'unread']);
const MAX_THREADS = 40;
const SAVE_DELAY_MS = 2000;
/** Au-delà, le cache ne sert plus à rien (et pourrait montrer des fils supprimés). */
const MAX_AGE_MS = 14 * 24 * 3_600_000;

type Entry = { key: QueryKey; data: unknown; at: number };
type Snapshot = { v: 1; savedAt: number; entries: Entry[] };

const fileFor = (userId: string) => new File(Paths.document, `messagerie-${userId.replace(/[^a-zA-Z0-9-]/g, '')}.json`);

const isKept = (key: QueryKey) => typeof key[0] === 'string' && ROOTS.has(key[0]);

/** Pages infinies : on ne garde que la plus récente, sans les messages temporaires (envoi en cours). */
function trim(data: unknown): unknown {
  if (!data || typeof data !== 'object' || !('pages' in data)) return data;
  const d = data as { pages: unknown[]; pageParams: unknown[] };
  const first = d.pages[0] as Record<string, unknown> | undefined;
  if (!first) return data;
  const clean = (list: unknown) =>
    Array.isArray(list) ? list.filter((m) => !(typeof (m as { id?: unknown })?.id === 'string' && (m as { id: string }).id.startsWith('tmp-'))) : list;
  const page = { ...first };
  if (Array.isArray(page.data)) page.data = clean(page.data);
  if (Array.isArray(page.messages)) page.messages = clean(page.messages);
  return { pages: [page], pageParams: d.pageParams.slice(0, 1) };
}

let stop: (() => void) | null = null;

/** Remet le cache du compte en mémoire puis l'enregistre au fil des changements. */
export function startMessagingCache(qc: QueryClient, userId: string): () => void {
  stop?.();
  const file = fileFor(userId);

  /* 1. Restauration (synchrone : les écrans trouvent les données dès leur premier rendu) */
  try {
    if (file.exists) {
      const snap = JSON.parse(file.textSync()) as Snapshot;
      if (snap?.v === 1 && Date.now() - snap.savedAt < MAX_AGE_MS) {
        for (const e of snap.entries) {
          if (isKept(e.key) && qc.getQueryData(e.key) === undefined) qc.setQueryData(e.key, e.data, { updatedAt: e.at });
        }
      }
    }
  } catch {
    /* fichier abîmé : on repart du serveur */
  }

  /* 2. Enregistrement regroupé */
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    timer = null;
    try {
      const queries = qc.getQueryCache().findAll({ predicate: (q: Query) => isKept(q.queryKey) && q.state.data !== undefined });
      const threads = queries
        .filter((q) => q.queryKey[0] === 'messages' || q.queryKey[0] === 'group-messages')
        .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
        .slice(0, MAX_THREADS);
      const lists = queries.filter((q) => q.queryKey[0] !== 'messages' && q.queryKey[0] !== 'group-messages');
      const entries: Entry[] = [...lists, ...threads].map((q) => ({ key: q.queryKey, data: trim(q.state.data), at: q.state.dataUpdatedAt }));
      if (!file.exists) file.create();
      file.write(JSON.stringify({ v: 1, savedAt: Date.now(), entries } satisfies Snapshot));
    } catch {
      /* espace plein : sans gravité, le serveur reste la source */
    }
  };
  const unsubscribe = qc.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || !isKept(event.query.queryKey)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  });

  stop = () => {
    unsubscribe();
    if (timer) { clearTimeout(timer); save(); }
    stop = null;
  };
  return stop;
}

/** Déconnexion : rien ne reste du compte sur le téléphone. */
export function clearMessagingCache(userId: string | null | undefined) {
  stop?.();
  if (!userId) return;
  try {
    const f = fileFor(userId);
    if (f.exists) f.delete();
  } catch {
    /* rien à effacer */
  }
}
