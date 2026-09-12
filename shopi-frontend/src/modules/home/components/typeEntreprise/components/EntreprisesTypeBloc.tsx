/* ================================================================
 * FICHIER : typeEntreprise/components/EntreprisesTypeBloc.tsx
 *
 * Rangées horizontales des entreprises de CE type — même composant/
 * comportement que le bloc "Entreprises" de la home (RandomBloc.tsx
 * EntreprisesBloc : HScrollSection + CardEntreprise), mais filtré sur
 * GET /public/boutiques?companyTypeId=… au lieu de la liste aléatoire,
 * et découpé en blocs de 20 entreprises (même logique que
 * RandomBloc.ProduitsBloc.chunkProduits) — l'ordre est mélangé côté
 * client à chaque chargement de page (le backend trie par note, sans
 * option aléatoire), donc l'ordre affiché change d'une visite à l'autre.
 * ================================================================ */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../../../../shared/services/apiFetch';
import type { BoutiqueCardData } from '../../../data/types';
import CardEntreprise from '../../../cards/CardEntreprise';
import HScrollSection  from '../../ui/HScrollSection';
import SectionHeader   from '../../ui/SectionHeader';

interface Props {
  typeId:  string;
  onToast: (m: string, type?: 's' | 'i' | 'w' | 'e') => void;
}

const BLOCK_SIZE = 20;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

const SkeletonCard = () => (
  <div style={{
    height: 260, borderRadius: 16, flexShrink: 0, width: 220,
    background: 'linear-gradient(90deg,#f1f5f9 25%,#f8fafc 50%,#f1f5f9 75%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
  }} />
);

export default function EntreprisesTypeBloc({ typeId, onToast }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [liste,   setListe]   = useState<BoutiqueCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ data: BoutiqueCardData[] }>('/public/boutiques', {
      public: true,
      params: { companyTypeId: typeId, limit: 100 },
    })
      .then(res => setListe(shuffle(Array.isArray(res?.data) ? res.data : [])))
      .catch(() => setListe([]))
      .finally(() => setLoading(false));
  }, [typeId]);

  /* Aucune entreprise de ce type — section entière masquée, comme
   * RandomBloc.EntreprisesBloc (pas d'état vide bruyant pour un simple
   * bloc secondaire, l'état vide "réel" reste sur la grille produits). */
  if (!loading && liste.length === 0) return null;

  if (loading) {
    return (
      <div style={{ marginBottom: 24 }}>
        <SectionHeader
          kick={t('typeEntreprisePage.entreprises')}
          title=""
          linkText={t('typeEntreprisePage.voirToutesEntreprises')}
          onLink={() => navigate(`/boutiques?type=${typeId}`)}
        />
        <HScrollSection>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </HScrollSection>
        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      </div>
    );
  }

  const blocs = chunk(liste, BLOCK_SIZE);

  return (
    <>
      {blocs.map((bloc, i) => (
        <div key={i} style={{ marginBottom: 24 }}>
          <SectionHeader
            kick={i === 0 ? t('typeEntreprisePage.entreprises') : `${t('typeEntreprisePage.entreprises')} ${i + 1}`}
            title=""
            linkText={i === 0 ? t('typeEntreprisePage.voirToutesEntreprises') : undefined}
            onLink={i === 0 ? () => navigate(`/boutiques?type=${typeId}`) : undefined}
          />
          <HScrollSection>
            {bloc.map(e => (
              <CardEntreprise
                key={e.id} e={e} onToast={onToast}
                onRemoved={id => setListe(prev => prev.filter(b => b.id !== id))}
              />
            ))}
          </HScrollSection>
        </div>
      ))}
    </>
  );
}
