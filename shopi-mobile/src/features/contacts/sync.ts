/**
 * Synchronisation du répertoire du téléphone avec Shoneya — comme Telegram :
 * une fois l'accès accordé, l'onglet « Contacts » de la messagerie montre
 * automatiquement qui, parmi vos contacts, est sur Shoneya ; et quand l'un
 * d'eux s'inscrit plus tard, le serveur vous prévient (« X est sur Shoneya »).
 *
 * Comment :
 *   1. lecture du répertoire (numéros + nom) sur le téléphone ;
 *   2. chaque numéro → format international → empreinte SHA-256 (phone.ts) ;
 *   3. on n'envoie QUE la différence avec la dernière fois : nouveaux numéros
 *      par paquets de 300 (sous la limite de 100 Ko par requête du serveur),
 *      numéros supprimés retirés du serveur. Un répertoire de 3 000 fiches
 *      ne repart donc jamais en entier — rapide, peu de données mobiles ;
 *   4. l'état (numéros déjà envoyés) est gardé dans un fichier PRIVÉ de
 *      l'application, par compte : une coupure réseau reprend où elle s'était
 *      arrêtée.
 *
 * Vie privée : aucun numéro en clair n'est envoyé ; seul le nom donné au
 * contact accompagne son empreinte (pour « Votre contact « Tata Awa » est sur
 * Shoneya »). Tout s'efface du serveur en désactivant la synchronisation.
 */
import * as Contacts from 'expo-contacts/legacy';
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

import { ApiError } from '@/lib/api/errors';
import { queryClient } from '@/lib/query-client';
import { qk } from '@/lib/query-keys';

import { deleteAllContacts, removeContacts, uploadContacts } from './api';
import { hashE164, normalizeE164 } from './phone';

const UPLOAD_CHUNK = 300;
const REMOVE_CHUNK = 1000;
const HASH_BATCH = 250;
const NAME_MAX = 60;
/** Synchro automatique (ouverture de la messagerie) au plus toutes les 30 min. */
const AUTO_INTERVAL_MS = 30 * 60_000;

type Saved = { v: 1; enabled: boolean; sent: string[]; lastSyncAt: string | null };
const EMPTY: Saved = { v: 1, enabled: false, sent: [], lastSyncAt: null };

export type SyncPhase = 'idle' | 'reading' | 'sending' | 'error';
export type SyncState = {
  /** Le compte a choisi de synchroniser (accord donné dans l'application) */
  enabled: boolean;
  phase: SyncPhase;
  /** Numéros envoyés / à envoyer pendant l'envoi */
  done: number;
  total: number;
  lastSyncAt: string | null;
  error: string | null;
};

/* ── Fichier d'état (par compte) ───────────────────────────────────── */

const fileFor = (userId: string) => new File(Paths.document, `contacts-sync-${userId.replace(/[^a-zA-Z0-9-]/g, '')}.json`);

function load(userId: string): Saved {
  try {
    const f = fileFor(userId);
    if (!f.exists) return EMPTY;
    const raw = JSON.parse(f.textSync()) as Partial<Saved>;
    return {
      v: 1,
      enabled: raw.enabled === true,
      sent: Array.isArray(raw.sent) ? raw.sent.filter((h): h is string => typeof h === 'string') : [],
      lastSyncAt: typeof raw.lastSyncAt === 'string' ? raw.lastSyncAt : null,
    };
  } catch {
    return EMPTY;
  }
}

function save(userId: string, s: Saved) {
  try {
    const f = fileFor(userId);
    if (!f.exists) f.create();
    f.write(JSON.stringify(s));
  } catch {
    /* espace plein / fichier verrouillé : la prochaine synchro renverra simplement plus */
  }
}

function erase(userId: string) {
  try {
    const f = fileFor(userId);
    if (f.exists) f.delete();
  } catch {
    /* rien à faire */
  }
}

/* ── État observable (écrans) ──────────────────────────────────────── */

let currentUser: string | null = null;
let state: SyncState = { enabled: false, phase: 'idle', done: 0, total: 0, lastSyncAt: null, error: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

/**
 * Charge l'état du compte connecté (appelé par les écrans qui en ont besoin,
 * pendant le rendu : mise à jour SANS prévenir les abonnés — l'écran qui
 * appelle lit aussitôt le nouvel état).
 */
export function bindUser(userId: string | null | undefined) {
  if (!userId || userId === currentUser) return;
  currentUser = userId;
  const s = load(userId);
  state = { enabled: s.enabled, phase: 'idle', done: 0, total: 0, lastSyncAt: s.lastSyncAt, error: null };
}

export function useContactsSyncState(): SyncState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
  );
}

/* ── Permission ────────────────────────────────────────────────────── */

export type Permission = 'granted' | 'undetermined' | 'blocked';

export async function contactsPermission(): Promise<Permission> {
  try {
    const p = await Contacts.getPermissionsAsync();
    if (p.granted) return 'granted';
    return p.canAskAgain ? 'undetermined' : 'blocked';
  } catch {
    return 'blocked';
  }
}

/* ── Lecture du répertoire ─────────────────────────────────────────── */

/** Empreinte → nom local, pour tous les numéros valides du téléphone. */
async function readDevice(): Promise<Map<string, string | undefined>> {
  const byNumber = new Map<string, string | undefined>();
  let offset = 0;
  for (;;) {
    const page = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      pageSize: 500,
      pageOffset: offset,
    });
    for (const c of page.data) {
      const name = c.name?.trim().slice(0, NAME_MAX) || undefined;
      for (const p of c.phoneNumbers ?? []) {
        const e164 = normalizeE164(p.number ?? p.digits ?? '');
        if (e164 && !byNumber.get(e164)) byNumber.set(e164, name);
      }
    }
    offset += page.data.length;
    if (!page.hasNextPage || page.data.length === 0) break;
  }

  const entries = [...byNumber.entries()];
  const out = new Map<string, string | undefined>();
  for (let i = 0; i < entries.length; i += HASH_BATCH) {
    const slice = entries.slice(i, i + HASH_BATCH);
    const hashes = await Promise.all(slice.map(([e164]) => hashE164(e164)));
    hashes.forEach((h, j) => out.set(h.toLowerCase(), slice[j][1]));
  }
  return out;
}

/* ── Synchronisation ───────────────────────────────────────────────── */

let running: Promise<void> | null = null;

function messageOf(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) return 'Beaucoup de contacts envoyés récemment — la suite partira automatiquement plus tard.';
  return err instanceof Error ? err.message : 'Synchronisation impossible pour le moment.';
}

/**
 * Envoie les changements du répertoire. Une seule synchro à la fois ;
 * `force: false` (ouverture de l'écran) ne fait rien si la dernière date de
 * moins de 30 min. Ne lève jamais : l'erreur est dans l'état.
 */
export function syncContacts(userId: string, opts: { force?: boolean } = {}): Promise<void> {
  bindUser(userId);
  if (running) return running;
  running = (async () => {
    const saved = load(userId);
    if (!saved.enabled) return;
    if (!opts.force && saved.lastSyncAt && Date.now() - new Date(saved.lastSyncAt).getTime() < AUTO_INTERVAL_MS) return;
    if ((await contactsPermission()) !== 'granted') {
      setState({ phase: 'error', error: 'L’accès aux contacts est désactivé dans les réglages du téléphone.' });
      return;
    }

    setState({ phase: 'reading', error: null, done: 0, total: 0 });
    try {
      const device = await readDevice();
      const sent = new Set(saved.sent);
      const added = [...device.keys()].filter((h) => !sent.has(h));
      const removed = saved.sent.filter((h) => !device.has(h));

      setState({ phase: 'sending', done: 0, total: added.length });
      for (let i = 0; i < added.length; i += UPLOAD_CHUNK) {
        const chunk = added.slice(i, i + UPLOAD_CHUNK);
        await uploadContacts(chunk.map((hash) => ({ hash, displayName: device.get(hash) })));
        chunk.forEach((h) => sent.add(h));
        save(userId, { ...saved, sent: [...sent] });
        setState({ done: Math.min(added.length, i + chunk.length) });
      }
      for (let i = 0; i < removed.length; i += REMOVE_CHUNK) {
        const chunk = removed.slice(i, i + REMOVE_CHUNK);
        await removeContacts(chunk);
        chunk.forEach((h) => sent.delete(h));
      }

      const now = new Date().toISOString();
      save(userId, { v: 1, enabled: true, sent: [...sent], lastSyncAt: now });
      setState({ phase: 'idle', lastSyncAt: now, done: 0, total: 0 });
    } catch (err) {
      setState({ phase: 'error', error: messageOf(err) });
    } finally {
      void queryClient.invalidateQueries({ queryKey: qk.contacts.all });
    }
  })().finally(() => { running = null; });
  return running;
}

/**
 * Accord de l'utilisateur (après l'écran d'explication) : demande la
 * permission Android puis lance la première synchro.
 * @returns false si la permission est refusée.
 */
export async function enableContactsSync(userId: string): Promise<boolean> {
  bindUser(userId);
  const p = await Contacts.requestPermissionsAsync().catch(() => null);
  if (!p?.granted) return false;
  save(userId, { ...load(userId), enabled: true });
  setState({ enabled: true, error: null });
  void syncContacts(userId, { force: true });
  return true;
}

/** Arrête la synchro ET efface du serveur tout ce qui a été envoyé. */
export async function disableContactsSync(userId: string): Promise<void> {
  bindUser(userId);
  if (running) await running.catch(() => undefined);
  await deleteAllContacts();
  erase(userId);
  setState({ enabled: false, phase: 'idle', done: 0, total: 0, lastSyncAt: null, error: null });
  queryClient.removeQueries({ queryKey: qk.contacts.all });
}

/* ── Proposition à la première connexion ───────────────────────────── */

/* Fichier à part (pas dans l'état de synchro) : désactiver la synchro ne
 * doit pas faire reproposer. « Plus tard » : reproposé une seule fois, 7 jours après. */
const MAX_OFFERS = 2;
const REOFFER_MS = 7 * 24 * 3_600_000;
type Offered = { count: number; lastAt: number };

const offerFile = (userId: string) => new File(Paths.document, `contacts-offer-${userId.replace(/[^a-zA-Z0-9-]/g, '')}.json`);

function loadOffered(userId: string): Offered {
  try {
    const f = offerFile(userId);
    if (!f.exists) return { count: 0, lastAt: 0 };
    const raw = JSON.parse(f.textSync()) as Partial<Offered>;
    return { count: Number(raw.count) || 0, lastAt: Number(raw.lastAt) || 0 };
  } catch {
    return { count: 0, lastAt: 0 };
  }
}

/** Faut-il proposer la synchronisation des contacts à ce compte maintenant ? */
export function shouldOfferContactsSync(userId: string): boolean {
  if (load(userId).enabled) return false;
  const o = loadOffered(userId);
  if (o.count >= MAX_OFFERS) return false;
  return o.count === 0 || Date.now() - o.lastAt > REOFFER_MS;
}

/** La proposition vient d'être affichée (quelle que soit la réponse). */
export function markContactsOffered(userId: string, final = false) {
  try {
    const f = offerFile(userId);
    const o = loadOffered(userId);
    if (!f.exists) f.create();
    f.write(JSON.stringify({ count: final ? MAX_OFFERS : o.count + 1, lastAt: Date.now() } satisfies Offered));
  } catch {
    /* sans gravité : au pire, la question revient une fois */
  }
}
