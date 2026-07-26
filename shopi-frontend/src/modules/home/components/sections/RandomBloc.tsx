/*
 * FICHIER : src/modules/home/components/sections/RandomBloc.tsx
 *
 * ✅ CORRIGÉ :
 *   - Lecture de res.data (l'API renvoie { data, total, page, limit })
 *   - onFollow centralisé (un seul POST) pour livreurs et correspondants
 *   - Plus aucun placeholder /* … 
 */
import { useEffect, useState, useCallback, useMemo } from 'react';

import type { BoutiqueCardData } from '../../data/types';
import { getRoleFromToken } from '../../../../shared/services/authUtils';
import { tokenStorage }    from '../../../../shared/services/apiFetch';
import { apiFetch }   from '../../../../shared/services/apiFetch';
import { toggleFollowLivreur } from '../../../../shared/services/follow';

import type { ProductApi }            from '../../cards/CardProduit';
import type { CorrespondantCardData } from '../../cards/CardCorrespondant';
import type { LivreurCardData }       from '../../cards/CardLivreur';

import CardProduit       from '../../cards/CardProduit';
import CardEntreprise    from '../../cards/CardEntreprise';
import CardCorrespondant from '../../cards/CardCorrespondant';
import CardLivreur       from '../../cards/CardLivreur';
import HScrollSection    from '../ui/HScrollSection';
import SectionHeader     from '../ui/SectionHeader';
import styles from './RandomBloc.module.css';

export type BlocKind = 'produits' | 'produits-gros' | 'entreprises' | 'correspondants' | 'livreurs';

interface Props {
  kind:    BlocKind;
  index:   number;
  onToast: (m: string, type?: 's' | 'i' | 'w' | 'e') => void;
}

const CONFIG: Record<BlocKind, { kick: string; title: string; sub: string; link: string }> = {
  produits:       { kick:'Catalogue',    title:'Produits <em>recommandés</em>',  sub:'Sélectionnés pour vous',                  link:'Voir tout le catalogue'  },
  'produits-gros':{ kick:'Vente en gros',title:'Acheter en <em>gros</em>',       sub:'Prix dégressifs · commande minimum',      link:'Voir tous les produits en gros' },
  entreprises:    { kick:'Boutiques',    title:'Boutiques <em>à la une</em>',     sub:'Abonnez-vous à vos boutiques favorites', link:'Toutes les boutiques'    },
  correspondants: { kick:'Réseau local', title:'Nos <em>Correspondants</em>',     sub:'Des relais locaux dans chaque région',   link:'Tous les correspondants' },
  livreurs:       { kick:'Logistique',   title:'Livreurs <em>disponibles</em>',   sub:'Professionnels vérifiés près de vous',   link:'Tous les livreurs'       },
};

const SkeletonCard = ({ height = 280 }: { height?: number }) => (
  <div style={{
    height, borderRadius:16, flexShrink:0, width:220,
    background:'linear-gradient(90deg,#f1f5f9 25%,#f8fafc 50%,#f1f5f9 75%)',
    backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite',
  }} />
);

/* ─────────────────────────────────────────────────────────────
 * BLOC PRODUITS
 ───────────────────────────────────────────────────────────── */

/* ── Bloc Entreprises — GET /public/boutiques ───────────────── */
function EntreprisesBloc({ onToast }: { onToast:(m:string)=>void }) {
  const [liste,      setListe]      = useState<BoutiqueCardData[]>([]);
  const [suiviIds,   setSuiviIds]   = useState<Set<string>>(new Set());
  const [loading,    setLoading]    = useState(true);

  /* Vérifier si l'utilisateur connecté est un client */
  const isClient = useMemo(
    () => !!tokenStorage.get() && getRoleFromToken() === 'client',
    [],
  );

  useEffect(() => {
    const fetchBoutiques = apiFetch<{ data: BoutiqueCardData[] }>(
      '/public/boutiques',
      { public: true, params: { limit: 12 } },
    ).then(res => Array.isArray(res?.data) ? res.data : []);

    /* Si client connecté : charger aussi ses boutiques suivies */
    const fetchSuivis = isClient
      ? apiFetch<{ boutiques: { id: string }[] }>('/suivis/mes-abonnements')
          .then(res => new Set((res?.boutiques ?? []).map(b => b.id)))
          .catch(() => new Set<string>())
      : Promise.resolve(new Set<string>());

    Promise.all([fetchBoutiques, fetchSuivis])
      .then(([boutiques, ids]) => {
        setSuiviIds(ids);
        setListe(boutiques);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isClient]);

  /* Enrichir chaque boutique avec son statut isSuivi */
  const listeEnrichie = useMemo(
    () => liste.map(b => ({ ...b, isSuivi: suiviIds.has(b.id) })),
    [liste, suiviIds],
  );

  if (loading) return (
    <HScrollSection>
      {[...Array(4)].map((_,i) => <SkeletonCard key={i} height={260} />)}
    </HScrollSection>
  );

  if (listeEnrichie.length === 0) return (
    <div style={{ padding:'40px 0', textAlign:'center', color:'var(--t3)', fontSize:14 }}>
      Aucune boutique disponible pour le moment.
    </div>
  );

  return (
    <HScrollSection>
      {listeEnrichie.map(e => <CardEntreprise key={e.id} e={e} onToast={onToast} />)}
    </HScrollSection>
  );
}

function ProduitsBloc({ onToast }: { onToast:(m:string, t?:'s'|'i'|'w'|'e')=>void }) {
  const [produits, setProduits] = useState<ProductApi[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  useEffect(() => {
    apiFetch<{ data: ProductApi[] }>('/public/produits', { public:true, params:{ limit:12, type:'detail' } })
      .then(res => setProduits(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className={styles.pgrid}>
      {[...Array(8)].map((_,i) => (
        <div key={i} style={{ height:320, borderRadius:16,
          background:'linear-gradient(90deg,#f1f5f9 25%,#f8fafc 50%,#f1f5f9 75%)',
          backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite' }} />
      ))}
    </div>
  );

  if (error || produits.length === 0) return (
    <div style={{ padding:'40px 0', textAlign:'center', color:'var(--t3)', fontSize:14 }}>
      {error ? '⚠️ Impossible de charger les produits.' : 'Aucun produit disponible.'}
    </div>
  );

  return (
    <div className={styles.pgrid}>
      {produits.map(p => <CardProduit key={p.id} p={p} onToast={onToast} />)}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * BLOC PRODUITS EN GROS
 ───────────────────────────────────────────────────────────── */
function ProduitsGrosBloc({ onToast }: { onToast:(m:string, t?:'s'|'i'|'w'|'e')=>void }) {
  const [produits, setProduits] = useState<ProductApi[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  useEffect(() => {
    apiFetch<{ data: ProductApi[] }>('/public/produits', { public:true, params:{ limit:12, type:'gros' } })
      .then(res => setProduits(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className={styles.pgrid}>
      {[...Array(8)].map((_,i) => (
        <div key={i} style={{ height:320, borderRadius:16,
          background:'linear-gradient(90deg,#f1f5f9 25%,#f8fafc 50%,#f1f5f9 75%)',
          backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite' }} />
      ))}
    </div>
  );

  if (error || produits.length === 0) return (
    <div style={{ padding:'40px 0', textAlign:'center', color:'var(--t3)', fontSize:14 }}>
      {error ? '⚠️ Impossible de charger les produits en gros.' : 'Aucun produit en gros disponible pour le moment.'}
    </div>
  );

  return (
    <div className={styles.pgrid}>
      {produits.map(p => (
        <div key={p.id} style={{ position:'relative' }}>
          {p.moq && (
            <div style={{
              position:'absolute', top:10, left:10, zIndex:2,
              background:'#0B1F3A', color:'#fff',
              fontSize:10, fontWeight:800, padding:'3px 9px',
              borderRadius:99, letterSpacing:.4, lineHeight:1.4,
            }}>
              MOQ {p.moq} unités
            </div>
          )}
          <CardProduit p={p} onToast={onToast} />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * BLOC LIVREURS
 ───────────────────────────────────────────────────────────── */
function LivreursBloc({ onToast }: { onToast:(m:string, t?:'s'|'i'|'w'|'e')=>void }) {
  const [liste,   setListe]   = useState<LivreurCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    /* L'API renvoie { data, total, page, limit } → on lit res.data */
    apiFetch<{ data: LivreurCardData[] }>('/suivis/livreurs')
      .then(res => setListe(Array.isArray(res?.data) ? res.data : []))
      .catch(e  => setError(e?.message ?? 'Erreur réseau'))
      .finally(() => setLoading(false));
  }, []);

  /* Un seul appel API, optimistic + rollback */
  const onFollow = useCallback(async (id: string, next: boolean) => {
    setListe(prev => prev.map(l => l.id === id ? { ...l, isSuivi: next } : l));
    try {
      const confirmed = await toggleFollowLivreur(id);
      setListe(prev => prev.map(l => l.id === id ? { ...l, isSuivi: confirmed } : l));
    } catch (e) {
      setListe(prev => prev.map(l => l.id === id ? { ...l, isSuivi: !next } : l));
      throw e;
    }
  }, []);

  if (loading) return (
    <HScrollSection>
      {[...Array(4)].map((_,i) => <SkeletonCard key={i} height={260} />)}
    </HScrollSection>
  );

  if (error) return (
    <div style={{ padding:'40px 0', textAlign:'center', color:'var(--t3)', fontSize:14 }}>
      ⚠️ {error}
    </div>
  );

  if (liste.length === 0) return (
    <div style={{ padding:'40px 0', textAlign:'center', color:'var(--t3)', fontSize:14 }}>
      Aucun livreur disponible.
    </div>
  );

  return (
    <HScrollSection>
      {liste.map(l => (
        <CardLivreur key={l.id} l={l} onToast={onToast} onFollow={onFollow} />
      ))}
    </HScrollSection>
  );
}

/* ─────────────────────────────────────────────────────────────
 * BLOC CORRESPONDANTS
 ───────────────────────────────────────────────────────────── */
function CorrespondantsBloc({ onToast }: { onToast:(m:string, t?:'s'|'i'|'w'|'e')=>void }) {
  const [liste,   setListe]   = useState<CorrespondantCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    /* L'API renvoie soit un tableau direct, soit { data: [...] } : on gère les deux */
    type CorrespondantsResponse = CorrespondantCardData[] | { data?: CorrespondantCardData[] };

    apiFetch<CorrespondantsResponse>('/suivis/correspondants')
      .then(res => {
        const cards = Array.isArray(res) ? res
                    : Array.isArray(res?.data) ? res.data
                    : [];
        setListe(cards);
      })
      .catch(e  => setError(e?.message ?? 'Erreur réseau'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <HScrollSection>
      {[...Array(4)].map((_,i) => <SkeletonCard key={i} height={280} />)}
    </HScrollSection>
  );

  if (error) return (
    <div style={{ padding:'40px 0', textAlign:'center', color:'var(--t3)', fontSize:14 }}>
      ⚠️ {error}
    </div>
  );

  if (liste.length === 0) return (
    <div style={{ padding:'40px 0', textAlign:'center', color:'var(--t3)', fontSize:14 }}>
      Aucun correspondant disponible.
    </div>
  );

  return (
    <HScrollSection>
      {liste.map(c => (
        <CardCorrespondant key={c.id} c={c} onToast={onToast} />
      ))}
    </HScrollSection>
  );
}

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT PRINCIPAL
 ───────────────────────────────────────────────────────────── */
export default function RandomBloc({ kind, index, onToast }: Props) {
  const cfg   = CONFIG[kind];
  const bgCls = index % 2 === 0 ? styles.bgWhite : styles.bgGray;

  return (
    <section className={`${styles.sec} ${bgCls}`} id={index === 0 ? 'blocs' : undefined}>
      <div className={styles.wrap}>
        <SectionHeader
          kick={cfg.kick} title={cfg.title} sub={cfg.sub}
          linkText={cfg.link} onLink={() => onToast(`📄 ${cfg.link}`)}
        />
        {kind === 'produits'       && <ProduitsBloc       onToast={onToast} />}
        {kind === 'produits-gros'  && <ProduitsGrosBloc   onToast={onToast} />}
        {kind === 'correspondants' && <CorrespondantsBloc onToast={onToast} />}
        {kind === 'livreurs'       && <LivreursBloc       onToast={onToast} />}
        {kind === 'entreprises'    && <EntreprisesBloc    onToast={onToast} />}
      </div>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </section>
  );
}
