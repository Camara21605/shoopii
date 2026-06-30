/*
 * FICHIER : src/dashboards/entreprise/pages/RetoursPage.tsx
 *
 * Module professionnel de gestion des Retours & SAV.
 * Données 100% dynamiques depuis l'API NestJS — plus aucune mock data.
 */

import React, { useState } from 'react';
import { useToast }       from '../../../shared/context/ToastContext';
import { useRetours }     from '../hooks/useRetours';
import { useSav }         from '../hooks/useSav';

import RetourStats       from './retours/RetourStats';
import RetoursList       from './retours/RetoursList';
import RetourDetailModal from './retours/RetourDetailModal';
import SavPanel          from './retours/SavPanel';

import s from './retours/RetoursPage.module.css';

type MainTab = 'retours' | 'sav';

export default function RetoursPage() {
  const { pop } = useToast();
  const [tab, setTab] = useState<MainTab>('retours');

  /* ── Retours hook ── */
  const {
    returns, stats, total, loading, statsLoading, error,
    filters, setPage, applyFilter,
    accept, refuse, refund, addNote,
    reload,
  } = useRetours();

  /* ── SAV hook ── */
  const {
    tickets, stats: savStats, total: savTotal,
    loading: savLoading, filters: savFilters,
    setPage: setSavPage, applyFilter: applySavFilter,
    reply, close, resolve, reload: reloadSav,
  } = useSav();

  /* ── Retour sélectionné pour la modale détail ── */
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);

  const handleAccept = async (id: string, montant: number, note?: string) => {
    try {
      await accept(id, montant, note);
      pop('✅ Retour accepté — client notifié', 's');
      setSelectedReturnId(null);
    } catch (e: any) {
      pop(`❌ ${e?.message ?? 'Erreur lors de l\'acceptation'}`, 'e');
    }
  };

  const handleRefuse = async (id: string, note?: string) => {
    try {
      await refuse(id, note);
      pop('Retour refusé — client notifié', 'i');
      setSelectedReturnId(null);
    } catch (e: any) {
      pop(`❌ ${e?.message ?? 'Erreur'}`, 'e');
    }
  };

  const handleRefund = async (id: string, montant?: number) => {
    try {
      await refund(id, montant);
      pop('💸 Remboursement enregistré', 's');
      setSelectedReturnId(null);
    } catch (e: any) {
      pop(`❌ ${e?.message ?? 'Erreur'}`, 'e');
    }
  };

  return (
    <div className={`page on ${s.page}`} id="p-retours">

      {/* ── En-tête ── */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <div className="ph-title">Retours &amp; <mark>SAV</mark></div>
          <div className="ph-sub">Gestion des demandes de retour et du service après-vente</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => { reload(); reloadSav(); }}>
            <i className="fas fa-rotate-right" /> Actualiser
          </button>
        </div>
      </div>

      {/* ── Onglets principaux ── */}
      <div className={s.tabs}>
        <button
          className={`${s.tab} ${tab === 'retours' ? s.tabActive : ''}`}
          onClick={() => setTab('retours')}
        >
          <i className="fas fa-rotate-left" />
          Retours
          {stats && stats.pending > 0 && (
            <span className={`${s.tabBadge} ${tab === 'retours' ? s.tabActiveBadge : s.tabInactiveBadge}`}>
              {stats.pending}
            </span>
          )}
        </button>
        <button
          className={`${s.tab} ${tab === 'sav' ? s.tabActive : ''}`}
          onClick={() => setTab('sav')}
        >
          <i className="fas fa-headset" />
          SAV
          {savStats && savStats.open > 0 && (
            <span className={`${s.tabBadge} ${tab === 'sav' ? s.tabActiveBadge : s.tabInactiveBadge}`}>
              {savStats.open}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════ ONGLET RETOURS ══════════════ */}
      {tab === 'retours' && (
        <>
          <RetourStats stats={stats} loading={statsLoading} />
          <RetoursList
            returns={returns}
            total={total}
            loading={loading}
            error={error}
            filters={filters}
            onFilterChange={applyFilter}
            onPageChange={setPage}
            onSelect={setSelectedReturnId}
          />
        </>
      )}

      {/* ══════════════ ONGLET SAV ══════════════════ */}
      {tab === 'sav' && (
        <SavPanel
          tickets={tickets}
          stats={savStats}
          total={savTotal}
          loading={savLoading}
          filters={savFilters}
          onFilterChange={applySavFilter}
          onPageChange={setSavPage}
          onReply={reply}
          onClose={close}
          onResolve={resolve}
          onPop={pop}
        />
      )}

      {/* ── Modale détail retour ── */}
      {selectedReturnId && (
        <RetourDetailModal
          returnId={selectedReturnId}
          onClose={() => setSelectedReturnId(null)}
          onAccept={handleAccept}
          onRefuse={handleRefuse}
          onRefund={handleRefund}
          onAddNote={async (id: string, content: string) => {
            try { await addNote(id, content); pop('📝 Note ajoutée', 's'); }
            catch { pop('❌ Erreur', 'e'); }
          }}
          onPop={pop}
        />
      )}
    </div>
  );
}
