/*
 * FICHIER : src/modules/home/components/sections/RandomBloc.tsx
 *
 * Blocs de l'accueil (produits, entreprises, services, vente en gros,
 * livreurs, correspondants), affichés PAR TOURS :
 *   tour 1 → le 1er bloc de chaque catégorie (ordre mélangé, voir HomePage) ;
 *   tour 2 → la SUITE de chaque catégorie qui en a une (entreprises 6 à 10,
 *            produits 21 à 40…) ;
 *   tour 3 → etc.
 * Deux blocs d'une même catégorie ne se suivent jamais : voir planHomeBlocs
 * (l'ordre est calculé à partir des données réellement disponibles).
 *
 * Données : chargées UNE fois par catégorie et partagées par tous les tours
 * (voir createListStore) — le tour 2 ne relance aucune requête.
 */
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';

import type { BoutiqueCardData } from '../../data/types';
import { getRoleFromToken } from '../../../../shared/services/authUtils';
import { tokenStorage }    from '../../../../shared/services/apiFetch';
import { apiFetch }   from '../../../../shared/services/apiFetch';

import type { ProductApi }            from '../../cards/CardProduit';
import type { ServiceApi }            from '../../cards/CardService';
import type { CorrespondantCardData } from '../../cards/CardCorrespondant';
import type { LivreurCardData }       from '../../cards/CardLivreur';

import CardProduit       from '../../cards/CardProduit';
import CardService       from '../../cards/CardService';
import CardEntreprise    from '../../cards/CardEntreprise';
import CardCorrespondant from '../../cards/CardCorrespondant';
import CardLivreur       from '../../cards/CardLivreur';
import HScrollSection    from '../ui/HScrollSection';
import { TypeCard, type CompanyTypeApi } from './TypeEntrepriseSection';
import { CategoryCard, type CategoryApi } from './CategoriesSection';
import SectionHeader     from '../ui/SectionHeader';
import styles from './RandomBloc.module.css';

/* Même origine que BoutiquePage.tsx (VITE_API_URL sans le suffixe /api).
 * Namespace /public : aucune authentification requise. */
const SOCKET_URL =
  ((import.meta as any).env?.VITE_API_URL as string | undefined)?.replace('/api', '') ??
  'http://localhost:3001';

export type BlocKind = 'produits' | 'produits-gros' | 'services' | 'entreprises' | 'types' | 'categories' | 'correspondants' | 'livreurs';

/** Nombre maximal de tours affichés sur l'accueil (voir HomePage). */
export const HOME_ROUNDS = 3;

/* Taille d'un bloc : au-delà, la suite passe au tour suivant. */
const PRODUITS_PAR_BLOC    = 20;
const ENTREPRISES_PAR_BLOC = 5;
/* Vente en gros : rangée horizontale de 10 produits au plus (comme les entreprises) */
const PRODUITS_GROS_PAR_BLOC = 10;
/* Types d'entreprise : petites cartes en rangée horizontale, 10 au plus par bloc */
const TYPES_PAR_BLOC = 10;
/* Catégories : même présentation que les types (10 au plus par bloc) */
const CATEGORIES_PAR_BLOC = 10;

/** Route "voir tout" par bloc — alimente le lien du SectionHeader. */
const BLOC_LINK: Record<BlocKind, string> = {
  produits:        '/explorer',
  'produits-gros': '/explorer',
  /* Pas de scope /explorer dédié aux services — renvoie vers le toggle
   * Produits/Services/Tout de /boutiques (voir BoutiquesPage.tsx). */
  services:        '/boutiques?mode=services',
  entreprises:     '/boutiques',
  types:           '/catalogue',
  categories:      '/boutiques',
  correspondants:  '/correspondants',
  livreurs:        '/livreurs',
};

type Toast = (m: string, type?: 's' | 'i' | 'w' | 'e') => void;

/* ─────────────────────────────────────────────────────────────
 * DONNÉES PARTAGÉES ENTRE LES TOURS
 ───────────────────────────────────────────────────────────── */

interface ListState<T> { data: T[]; loading: boolean; error: boolean }

interface ListStore<T> {
  reload:    (silent?: boolean) => Promise<void>;
  ensure:    () => void;
  update:    (fn: (data: T[]) => T[]) => void;
  subscribe: (l: () => void) => () => void;
  snapshot:  () => ListState<T>;
}

/**
 * Liste chargée une seule fois et lue par tous les tours d'une catégorie.
 * reload(silent) : rechargement (ex. catalogue modifié) — silencieux = sans
 * repasser par l'état « chargement ».
 */
function createListStore<T>(loader: () => Promise<T[]>): ListStore<T> {
  let state: ListState<T> = { data: [], loading: true, error: false };
  let started = false;
  const listeners = new Set<() => void>();
  const set = (next: Partial<ListState<T>>) => { state = { ...state, ...next }; listeners.forEach(l => l()); };

  const reload = (silent = false) => {
    started = true;
    if (!silent) set({ loading: true, error: false });
    return loader()
      .then(data => set({ data, loading: false, error: false }))
      .catch(() => set(silent ? { loading: false } : { loading: false, error: true }));
  };

  return {
    reload,
    /** Charge au premier affichage ; recharge en silence quand l'accueil est rouvert. */
    ensure: () => { void reload(started); },
    update: (fn) => set({ data: fn(state.data) }),
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    snapshot: () => state,
  };
}

function useListStore<T>(store: ListStore<T>): ListState<T> {
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

const produitsStore = createListStore<ProductApi>(() =>
  apiFetch<{ data: ProductApi[] }>('/public/produits', { public: true, params: { limit: PRODUITS_PAR_BLOC * HOME_ROUNDS, type: 'detail' } })
    .then(res => Array.isArray(res?.data) ? res.data : []));

const produitsGrosStore = createListStore<ProductApi>(() =>
  apiFetch<{ data: ProductApi[] }>('/public/produits', { public: true, params: { limit: PRODUITS_GROS_PAR_BLOC * HOME_ROUNDS, type: 'gros' } })
    .then(res => Array.isArray(res?.data) ? res.data : []));

const servicesStore = createListStore<ServiceApi>(() =>
  apiFetch<{ data: ServiceApi[] }>('/public/services', { public: true, params: { limit: PRODUITS_PAR_BLOC * HOME_ROUNDS } })
    .then(res => Array.isArray(res?.data) ? res.data : []));

/* Entreprises + « suivie » pour un client connecté */
const entreprisesStore = createListStore<BoutiqueCardData>(async () => {
  const isClient = !!tokenStorage.get() && getRoleFromToken() === 'client';
  const [boutiques, suivis] = await Promise.all([
    apiFetch<{ data: BoutiqueCardData[] }>('/public/boutiques', { public: true, params: { limit: ENTREPRISES_PAR_BLOC * HOME_ROUNDS } })
      .then(res => Array.isArray(res?.data) ? res.data : []),
    isClient
      ? apiFetch<{ boutiques: { id: string }[] }>('/suivis/mes-abonnements')
          .then(res => new Set((res?.boutiques ?? []).map(b => b.id)))
          .catch(() => new Set<string>())
      : Promise.resolve(new Set<string>()),
  ]);
  return boutiques.map(b => ({ ...b, isSuivi: suivis.has(b.id) }));
});

/* Types d'entreprise actifs (catalogue public) */
const typesStore = createListStore<CompanyTypeApi>(() =>
  apiFetch<CompanyTypeApi[]>('/company-types', { public: true })
    .then(list => (list ?? []).filter(t => t.actif)));

/* Catégories actives */
const categoriesStore = createListStore<CategoryApi>(() =>
  apiFetch<CategoryApi[]>('/categories', { public: true })
    .then(list => (list ?? []).filter(c => c.actif)));

/** Catégories découpées par tours : leur liste partagée et leur taille de bloc. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PAGED: Partial<Record<BlocKind, { store: ListStore<any>; size: number }>> = {
  produits:        { store: produitsStore,     size: PRODUITS_PAR_BLOC },
  'produits-gros': { store: produitsGrosStore, size: PRODUITS_GROS_PAR_BLOC },
  services:        { store: servicesStore,     size: PRODUITS_PAR_BLOC },
  entreprises:     { store: entreprisesStore,  size: ENTREPRISES_PAR_BLOC },
  types:           { store: typesStore,        size: TYPES_PAR_BLOC },
  categories:      { store: categoriesStore,   size: CATEGORIES_PAR_BLOC },
};

/* ─────────────────────────────────────────────────────────────
 * ORDRE D'AFFICHAGE
 ───────────────────────────────────────────────────────────── */

/** Nombre de blocs disponibles par catégorie (1 tant que les données chargent). */
export function useBlocCounts(): Record<BlocKind, number> {
  const p  = useListStore(produitsStore);
  const g  = useListStore(produitsGrosStore);
  const sv = useListStore(servicesStore);
  const e  = useListStore(entreprisesStore);
  const ty = useListStore(typesStore);
  const ca = useListStore(categoriesStore);
  const n = (st: ListState<unknown>, size: number) =>
    st.loading || st.error ? 1 : Math.max(1, Math.ceil(st.data.length / size));
  return {
    produits:        n(p,  PRODUITS_PAR_BLOC),
    'produits-gros': n(g,  PRODUITS_GROS_PAR_BLOC),
    services:        n(sv, PRODUITS_PAR_BLOC),
    entreprises:     n(e,  ENTREPRISES_PAR_BLOC),
    types:           n(ty, TYPES_PAR_BLOC),
    categories:      n(ca, CATEGORIES_PAR_BLOC),
    correspondants:  1,
    livreurs:        1,
  };
}

/** Un ordre mélangé par vague (tirés une fois à l'ouverture de l'accueil). */
export function shuffledOrders(kinds: BlocKind[], rounds = HOME_ROUNDS): BlocKind[][] {
  return Array.from({ length: rounds }, () => {
    const a = [...kinds];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  });
}

/**
 * Suite des blocs de l'accueil : vague 1 = le 1er bloc de chaque catégorie, vague 2 =
 * la suite de chaque catégorie qui en a une, etc. — chaque vague dans SON ordre
 * aléatoire (orders[vague]).
 * Règle : deux blocs d'une même catégorie ne se suivent JAMAIS. Un bloc qui
 * tomberait juste après un bloc de sa catégorie est décalé après le suivant ;
 * s'il ne reste que des blocs d'une seule catégorie, ils ne sont pas affichés
 * (accessibles par « voir tout »).
 */
export function planHomeBlocs(orders: BlocKind[][], counts: Record<BlocKind, number>): { kind: BlocKind; round: number }[] {
  const queue: { kind: BlocKind; round: number }[] = [];
  orders.forEach((order, round) => {
    for (const kind of order) if (counts[kind] > round) queue.push({ kind, round });
  });
  const plan: { kind: BlocKind; round: number }[] = [];
  while (queue.length > 0) {
    const last = plan[plan.length - 1];
    const i = queue.findIndex(b => b.kind !== last?.kind);
    if (i === -1) break;                       // il ne reste qu'une catégorie : on s'arrête
    plan.push(queue.splice(i, 1)[0]);
  }
  return plan;
}

/* ─────────────────────────────────────────────────────────────
 * RENDUS
 ───────────────────────────────────────────────────────────── */

const SkeletonCard = ({ height = 280 }: { height?: number }) => (
  <div style={{
    height, borderRadius:16, flexShrink:0, width:220,
    background:'linear-gradient(90deg,#f1f5f9 25%,#f8fafc 50%,#f1f5f9 75%)',
    backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite',
  }} />
);

const SkeletonGrid = () => (
  <div className={styles.pgrid}>
    {[...Array(8)].map((_,i) => (
      <div key={i} style={{ height:320, borderRadius:16,
        background:'linear-gradient(90deg,#f1f5f9 25%,#f8fafc 50%,#f1f5f9 75%)',
        backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite' }} />
    ))}
  </div>
);

const Message = ({ children }: { children: ReactNode }) => (
  <div style={{ padding:'40px 0', textAlign:'center', color:'var(--t3)', fontSize:14 }}>{children}</div>
);

/** Contenu d'un bloc découpé (produits, gros, services, entreprises) pour UN tour. */
function PagedContent({ kind, round, onToast }: { kind: BlocKind; round: number; onToast: Toast }) {
  const { t } = useTranslation();
  const paged = PAGED[kind]!;
  const { data, loading, error } = useListStore(paged.store);
  const bloc = chunk(data, paged.size)[round] ?? [];

  const petites = kind === 'types' || kind === 'categories';
  if (loading) return kind === 'entreprises' || kind === 'produits-gros' || petites
    ? <HScrollSection>{[...Array(petites ? 8 : 4)].map((_,i) => <SkeletonCard key={i} height={kind === 'entreprises' ? 190 : petites ? 78 : 300} />)}</HScrollSection>
    : <SkeletonGrid />;

  if (kind === 'types' && (error || bloc.length === 0)) {
    return <Message>{error ? `⚠️ ${t('home.typeEntreprise.loadError')}` : t('home.typeEntreprise.empty')}</Message>;
  }

  if (kind === 'categories' && (error || bloc.length === 0)) {
    return <Message>{error ? `⚠️ ${t('home.categories.loadError')}` : '—'}</Message>;
  }

  /* Catégories : petites cartes en rangée horizontale */
  if (kind === 'categories') return (
    <HScrollSection>
      {(bloc as CategoryApi[]).map(c => <CategoryCard key={c.id} c={c} />)}
    </HScrollSection>
  );

  /* Types d'entreprise : petites cartes en rangée horizontale */
  if (kind === 'types') return (
    <HScrollSection>
      {(bloc as CompanyTypeApi[]).map(ct => <TypeCard key={ct.id} ct={ct} />)}
    </HScrollSection>
  );

  if (error || bloc.length === 0) {
    const key = kind === 'entreprises' ? 'Boutiques' : kind === 'services' ? 'Services' : kind === 'produits-gros' ? 'ProduitsGros' : 'Produits';
    return <Message>{error && kind !== 'entreprises' ? `⚠️ ${t(`home.randomBloc.error${key}`)}` : t(`home.randomBloc.empty${key}`)}</Message>;
  }

  if (kind === 'entreprises') return (
    <HScrollSection>
      {(bloc as BoutiqueCardData[]).map(e => (
        <CardEntreprise
          key={e.id} e={e} onToast={onToast}
          onRemoved={id => entreprisesStore.update(list => list.filter(b => b.id !== id))}
        />
      ))}
    </HScrollSection>
  );

  if (kind === 'services') return (
    <div className={styles.pgrid}>
      {(bloc as ServiceApi[]).map(s => <CardService key={s.id} s={s} onToast={onToast} />)}
    </div>
  );

  /* Vente en gros : rangée horizontale (10 au plus, suite au tour suivant) */
  if (kind === 'produits-gros') return (
    <HScrollSection>
      {(bloc as ProductApi[]).map(p => (
        <div key={p.id} className={styles.hItem}>
          {p.moq && (
            <div style={{
              position:'absolute', top:10, left:10, zIndex:2,
              background:'#0B1F3A', color:'#fff',
              fontSize:10, fontWeight:800, padding:'3px 9px',
              borderRadius:99, letterSpacing:.4, lineHeight:1.4,
            }}>
              {t('home.randomBloc.moqUnites', { moq: p.moq })}
            </div>
          )}
          <CardProduit p={p} onToast={onToast} />
        </div>
      ))}
    </HScrollSection>
  );

  return (
    <div className={styles.pgrid}>
      {(bloc as ProductApi[]).map(p => <CardProduit key={p.id} p={p} onToast={onToast} />)}
    </div>
  );
}

/* ── Bloc Livreurs (un seul tour) ── */
function LivreursBloc({ onToast }: { onToast: Toast }) {
  const { t } = useTranslation();
  const [liste,   setListe]   = useState<LivreurCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    /* L'API renvoie { data, total, page, limit } → on lit res.data */
    apiFetch<{ data: LivreurCardData[] }>('/suivis/livreurs')
      .then(res => setListe(Array.isArray(res?.data) ? res.data : []))
      .catch(e  => setError(e?.message ?? t('home.randomBloc.errorReseau')))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <HScrollSection>{[...Array(4)].map((_,i) => <SkeletonCard key={i} height={260} />)}</HScrollSection>;
  if (error) return <Message>⚠️ {error}</Message>;
  if (liste.length === 0) return <Message>{t('home.randomBloc.emptyLivreurs')}</Message>;

  return (
    <HScrollSection>
      {liste.map(l => (
        <CardLivreur key={l.id} l={l} onToast={onToast} onRemoved={id => setListe(prev => prev.filter(x => x.id !== id))} />
      ))}
    </HScrollSection>
  );
}

/* ── Bloc Correspondants (un seul tour) ── */
function CorrespondantsBloc({ onToast }: { onToast: Toast }) {
  const { t } = useTranslation();
  const [liste,   setListe]   = useState<CorrespondantCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    /* L'API renvoie soit un tableau direct, soit { data: [...] } : on gère les deux */
    type CorrespondantsResponse = CorrespondantCardData[] | { data?: CorrespondantCardData[] };
    apiFetch<CorrespondantsResponse>('/suivis/correspondants')
      .then(res => setListe(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
      .catch(e  => setError(e?.message ?? t('home.randomBloc.errorReseau')))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <HScrollSection>{[...Array(4)].map((_,i) => <SkeletonCard key={i} height={280} />)}</HScrollSection>;
  if (error) return <Message>⚠️ {error}</Message>;
  if (liste.length === 0) return <Message>{t('home.randomBloc.emptyCorrespondants')}</Message>;

  return (
    <HScrollSection>
      {liste.map(c => (
        <CardCorrespondant key={c.id} c={c} onToast={onToast} onRemoved={id => setListe(prev => prev.filter(x => x.id !== id))} />
      ))}
    </HScrollSection>
  );
}

/** Catalogue modifié par une entreprise : UNE écoute pour tout l'accueil (diffusion
 *  globale, voir PublicBroadcastService.emitGlobal côté backend). */
function CatalogueRealtime() {
  useEffect(() => {
    const socket = io(`${SOCKET_URL}/public`, { transports: ['websocket', 'polling'] });
    socket.on('catalogue:changed', () => {
      void produitsStore.reload(true);
      void produitsGrosStore.reload(true);
      void servicesStore.reload(true);
    });
    return () => { socket.disconnect(); };
  }, []);
  return null;
}

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT PRINCIPAL
 ───────────────────────────────────────────────────────────── */

interface Props {
  kind:    BlocKind;
  /** Tour d'affichage (0 = premier tour). */
  round?:  number;
  index:   number;
  onToast: Toast;
}

export default function RandomBloc({ kind, round = 0, index, onToast }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const paged = PAGED[kind];

  /* Premier tour : lance (ou rafraîchit en silence) le chargement partagé */
  useEffect(() => {
    if (round === 0) paged?.store.ensure();
  }, [round, paged]);

  /* Tours suivants : n'existent que s'il reste des éléments pour ce tour */
  const state = useListStore(paged?.store ?? entreprisesStore);
  const hasRound = useMemo(() => {
    if (round === 0) return true;
    if (!paged || state.loading || state.error) return false;
    return state.data.length > round * paged.size;
  }, [round, paged, state]);

  if (!hasRound) return null;

  const key = kind === 'produits-gros' ? 'produitsGros' : kind;
  const bgCls = index % 2 === 0 ? styles.bgWhite : styles.bgGray;

  return (
    <section className={`${styles.sec} ${bgCls}`}>
      <div className={styles.wrap}>
        {/* Petit label ("kick") + « voir tout » ; aux tours suivants : « Boutiques 2 »… */}
        <SectionHeader
          kick={round === 0 ? t(`home.randomBloc.${key}.kick`) : `${t(`home.randomBloc.${key}.kick`)} ${round + 1}`}
          title=""
          linkText={t(`home.randomBloc.${key}.link`)}
          onLink={() => navigate(BLOC_LINK[kind])}
        />
        {paged                     && <PagedContent kind={kind} round={round} onToast={onToast} />}
        {kind === 'correspondants' && <CorrespondantsBloc onToast={onToast} />}
        {kind === 'livreurs'       && <LivreursBloc       onToast={onToast} />}
      </div>
      {round === 0 && kind === 'produits' && <CatalogueRealtime />}
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </section>
  );
}
