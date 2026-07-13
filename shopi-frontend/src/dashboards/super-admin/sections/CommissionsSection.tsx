/* ================================================================
 * FICHIER : src/dashboards/super-admin/sections/CommissionsSection.tsx
 *
 * Centre de Gestion des Commissions — Super Admin
 * 4 onglets :
 *   1. Entreprises  — commissionType/Value/Min/Max/Brackets + par catégorie
 *   2. Partenaires  — commissionMode/defaultRate + taux par tier
 *   3. Livreurs     — platformCommissionRate
 *   4. Plateforme   — platformCommission global
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch }   from '../../../shared/services/apiFetch';
import './CommissionsSection.css';

/* ── Types importés (réutilisés depuis les services admin) ────── */
import type {
  CommissionType,
  CommissionBracket,
  CategoryRule,
  CategoryItem,
  CompanySettings,
} from '../../administrateur/services/company-settings.service';
import {
  DEFAULT_BRACKETS,
  getSettings   as getCompanySettings,
  updateSettings as updateCompanySettings,
  getCategoriesList,
} from '../../administrateur/services/company-settings.service';

import type {
  PartnerSettings,
  PartnerTier,
} from '../../administrateur/services/partner-settings.service';
import {
  DEFAULT_TIERS as PARTNER_DEFAULT_TIERS,
  getPartnerSettings,
  updatePartnerSettings,
} from '../../administrateur/services/partner-settings.service';

import type {
  DeliverySettings,
} from '../../administrateur/services/delivery-settings.service';
import {
  getDeliverySettings,
  updateDeliverySettings,
} from '../../administrateur/services/delivery-settings.service';

/* ── Interface PlatformSettings (sous-ensemble utilisé ici) ───── */
interface PlatformSettings {
  platformCommission: number;
  [key: string]: unknown;
}

/* ── Props ────────────────────────────────────────────────────── */
interface Props {
  isActive: boolean;
  toast:    (type: string, msg: string) => void;
}

/* ── Onglets ─────────────────────────────────────────────────── */
type TabId = 'entreprises' | 'partenaires' | 'livreurs' | 'plateforme';

const TABS: { id: TabId; icon: string; label: string; color: string }[] = [
  { id: 'entreprises', icon: 'fa-building',     label: 'Entreprises',  color: '#0284C7' },
  { id: 'partenaires', icon: 'fa-handshake',    label: 'Partenaires',  color: '#7C3AED' },
  { id: 'livreurs',    icon: 'fa-motorcycle',   label: 'Livreurs',     color: '#059669' },
  { id: 'plateforme',  icon: 'fa-globe',        label: 'Plateforme',   color: '#D97706' },
];

/* ── Modes de commission entreprises ─────────────────────────── */
const COMP_TYPES: {
  id: CommissionType; icon: string; color: string; bg: string; title: string; desc: string;
}[] = [
  { id: 'percentage', icon: 'fa-percent',    color: '#0284C7', bg: 'rgba(2,132,199,.1)',  title: 'Pourcentage', desc: 'Taux prélevé sur le montant de chaque transaction.' },
  { id: 'fixed',      icon: 'fa-equals',     color: '#059669', bg: 'rgba(5,150,105,.1)',  title: 'Montant fixe', desc: 'Frais fixes prélevés par commande, quelle que soit la valeur.' },
  { id: 'progressive',icon: 'fa-chart-line', color: '#7C3AED', bg: 'rgba(124,58,237,.1)', title: 'Progressif',   desc: 'Taux dégressif selon les tranches de chiffre d\'affaires.' },
];

/* ── Modes de commission partenaires ─────────────────────────── */
const PARTNER_MODES: {
  id: string; icon: string; color: string; bg: string; title: string; desc: string;
}[] = [
  { id: 'tier',        icon: 'fa-layer-group', color: '#0284C7', bg: 'rgba(2,132,199,.1)',  title: 'Par tier',     desc: 'Chaque niveau partenaire a son propre taux.' },
  { id: 'fixed',       icon: 'fa-equals',      color: '#059669', bg: 'rgba(5,150,105,.1)',  title: 'Taux fixe',    desc: 'Un seul taux pour tous les partenaires.' },
  { id: 'progressive', icon: 'fa-chart-line',  color: '#7C3AED', bg: 'rgba(124,58,237,.1)', title: 'Progressif',   desc: 'Taux proportionnel au volume de recrutement.' },
];

/* ================================================================
 * COMPOSANT PRINCIPAL
 * ================================================================ */
export default function CommissionsSection({ isActive, toast }: Props) {

  const [tab, setTab] = useState<TabId>('entreprises');

  /* ── État — Entreprises ────────────────────────────────────── */
  const [compSaved,  setCompSaved]  = useState<CompanySettings | null>(null);
  const [compDraft,  setCompDraft]  = useState<CompanySettings | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [compLoad,   setCompLoad]   = useState(true);
  const [compSaving, setCompSaving] = useState(false);

  /* ── État — Partenaires ────────────────────────────────────── */
  const [partSaved,  setPartSaved]  = useState<PartnerSettings | null>(null);
  const [partDraft,  setPartDraft]  = useState<PartnerSettings | null>(null);
  const [partLoad,   setPartLoad]   = useState(true);
  const [partSaving, setPartSaving] = useState(false);

  /* ── État — Livreurs ──────────────────────────────────────── */
  const [delivSaved,  setDelivSaved]  = useState<DeliverySettings | null>(null);
  const [delivDraft,  setDelivDraft]  = useState<DeliverySettings | null>(null);
  const [delivLoad,   setDelivLoad]   = useState(true);
  const [delivSaving, setDelivSaving] = useState(false);

  /* ── État — Plateforme ────────────────────────────────────── */
  const [platSaved,  setPlatSaved]  = useState<PlatformSettings | null>(null);
  const [platDraft,  setPlatDraft]  = useState<PlatformSettings | null>(null);
  const [platLoad,   setPlatLoad]   = useState(true);
  const [platSaving, setPlatSaving] = useState(false);

  /* ── Dirty detection ─────────────────────────────────────────── */
  const compDirty  = compSaved  !== null && compDraft  !== null && JSON.stringify(compDraft)  !== JSON.stringify(compSaved);
  const partDirty  = partSaved  !== null && partDraft  !== null && JSON.stringify(partDraft)  !== JSON.stringify(partSaved);
  const delivDirty = delivSaved !== null && delivDraft !== null && JSON.stringify(delivDraft) !== JSON.stringify(delivSaved);
  const platDirty  = platSaved  !== null && platDraft  !== null && JSON.stringify(platDraft)  !== JSON.stringify(platSaved);

  /* ── Chargement au montage ────────────────────────────────── */
  const loadAll = useCallback(async () => {
    const [comp, cats, part, deliv, plat] = await Promise.allSettled([
      getCompanySettings(),
      getCategoriesList(),
      getPartnerSettings(),
      getDeliverySettings(),
      apiFetch<PlatformSettings>('/dashboard/super-admin/settings'),
    ]);

    if (comp.status === 'fulfilled') {
      setCompSaved(comp.value);
      setCompDraft(structuredClone(comp.value));
    }
    setCompLoad(false);

    if (cats.status === 'fulfilled') setCategories(cats.value);

    if (part.status === 'fulfilled') {
      setPartSaved(part.value);
      setPartDraft(structuredClone(part.value));
    }
    setPartLoad(false);

    if (deliv.status === 'fulfilled') {
      setDelivSaved(deliv.value);
      setDelivDraft(structuredClone(deliv.value));
    }
    setDelivLoad(false);

    if (plat.status === 'fulfilled') {
      setPlatSaved(plat.value);
      setPlatDraft(structuredClone(plat.value));
    }
    setPlatLoad(false);
  }, []);

  useEffect(() => { if (isActive) void loadAll(); }, [isActive, loadAll]);

  /* ── Sauvegarde — Entreprises ─────────────────────────────── */
  const saveComp = async () => {
    if (!compDraft) return;
    setCompSaving(true);
    try {
      const { commissionType, commissionValue, commissionMin, commissionMax, commissionBrackets, categoryRules } = compDraft;
      const saved = await updateCompanySettings({ commissionType, commissionValue, commissionMin, commissionMax, commissionBrackets, categoryRules });
      setCompSaved(saved);
      setCompDraft(structuredClone(saved));
      toast('success', 'Commission entreprises sauvegardée');
    } catch {
      toast('error', 'Erreur lors de la sauvegarde');
    } finally {
      setCompSaving(false);
    }
  };

  /* ── Sauvegarde — Partenaires ─────────────────────────────── */
  const savePart = async () => {
    if (!partDraft) return;
    setPartSaving(true);
    try {
      const { commissionMode, defaultCommissionRate, tiers, paymentFrequency } = partDraft;
      const saved = await updatePartnerSettings({ commissionMode, defaultCommissionRate, tiers, paymentFrequency });
      setPartSaved(saved);
      setPartDraft(structuredClone(saved));
      toast('success', 'Commission partenaires sauvegardée');
    } catch {
      toast('error', 'Erreur lors de la sauvegarde');
    } finally {
      setPartSaving(false);
    }
  };

  /* ── Sauvegarde — Livreurs ────────────────────────────────── */
  const saveDeliv = async () => {
    if (!delivDraft) return;
    setDelivSaving(true);
    try {
      const { platformCommissionRate, paymentFrequency } = delivDraft;
      const saved = await updateDeliverySettings({ platformCommissionRate, paymentFrequency });
      setDelivSaved(saved);
      setDelivDraft(structuredClone(saved));
      toast('success', 'Commission livreurs sauvegardée');
    } catch {
      toast('error', 'Erreur lors de la sauvegarde');
    } finally {
      setDelivSaving(false);
    }
  };

  /* ── Sauvegarde — Plateforme ──────────────────────────────── */
  const savePlat = async () => {
    if (!platDraft) return;
    setPlatSaving(true);
    try {
      const updated = await apiFetch<PlatformSettings>('/dashboard/super-admin/settings', {
        method: 'PATCH',
        body: { platformCommission: platDraft.platformCommission },
      });
      setPlatSaved(updated);
      setPlatDraft(structuredClone(updated));
      toast('success', 'Commission plateforme sauvegardée');
    } catch {
      toast('error', 'Erreur lors de la sauvegarde');
    } finally {
      setPlatSaving(false);
    }
  };

  /* ── Helpers setCompDraft ─────────────────────────────────── */
  const setComp = <K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) =>
    setCompDraft(d => d ? { ...d, [k]: v } : d);

  const getCatRule = (nom: string): CategoryRule =>
    compDraft?.categoryRules.find((r: CategoryRule) => r.nom === nom) ?? { nom, enabled: true, commission: null };

  const setCatRule = (nom: string, patch: Partial<CategoryRule>) =>
    setCompDraft(d => {
      if (!d) return d;
      const exists = d.categoryRules.some((r: CategoryRule) => r.nom === nom);
      if (exists) {
        return { ...d, categoryRules: d.categoryRules.map((r: CategoryRule) => r.nom === nom ? { ...r, ...patch } : r) };
      }
      return { ...d, categoryRules: [...d.categoryRules, { nom, enabled: true, commission: null, ...patch }] };
    });

  const addBracket = () =>
    setCompDraft(d => {
      if (!d) return d;
      const last = d.commissionBrackets.at(-1);
      const newFrom = last ? (last.to ?? 0) + 1 : 0;
      return { ...d, commissionBrackets: [...d.commissionBrackets, { from: newFrom, to: null, rate: 3 }] };
    });

  const setBracket = (idx: number, patch: Partial<CommissionBracket>) =>
    setCompDraft(d => {
      if (!d) return d;
      const b = [...d.commissionBrackets];
      b[idx] = { ...b[idx], ...patch };
      return { ...d, commissionBrackets: b };
    });

  const removeBracket = (idx: number) =>
    setCompDraft(d => {
      if (!d) return d;
      return { ...d, commissionBrackets: d.commissionBrackets.filter((_, i) => i !== idx) };
    });

  /* ── Helpers setPartDraft ─────────────────────────────────── */
  const setPart = <K extends keyof PartnerSettings>(k: K, v: PartnerSettings[K]) =>
    setPartDraft(d => d ? { ...d, [k]: v } : d);

  const setPartTier = (idx: number, patch: Partial<PartnerTier>) =>
    setPartDraft(d => {
      if (!d) return d;
      const t = [...(d.tiers ?? PARTNER_DEFAULT_TIERS)];
      t[idx] = { ...t[idx], ...patch };
      return { ...d, tiers: t };
    });

  /* ── Save bar générique ──────────────────────────────────── */
  function SaveBar({ dirty, saving, onSave, onDiscard }: {
    dirty: boolean; saving: boolean;
    onSave: () => void; onDiscard: () => void;
  }) {
    if (!dirty) return null;
    return (
      <div className="save-bar">
        <span className="save-bar-msg"><i className="fas fa-circle-dot" /> Modifications non sauvegardées</span>
        <div className="save-bar-actions">
          <button className="btn btn-secondary btn-sm" onClick={onDiscard} disabled={saving}>Annuler</button>
          <button className="btn btn-blue btn-sm" onClick={onSave} disabled={saving}>
            {saving ? <><i className="fas fa-rotate-right fa-spin" /> Sauvegarde…</> : <><i className="fas fa-check" /> Sauvegarder</>}
          </button>
        </div>
      </div>
    );
  }

  /* ── Rendu ────────────────────────────────────────────────── */
  return (
    <div className="section active commissions-wrap">

      {/* En-tête */}
      <div className="page-header">
        <div className="page-header-icon">💸</div>
        <div>
          <div className="page-header-title">Centre de Gestion des Commissions</div>
          <div className="page-header-sub">Configurez les taux de commission pour toutes les entités de la plateforme Shopi.</div>
        </div>
      </div>

      {/* Résumé rapide */}
      <div className="summary-grid" style={{ marginBottom: 24 }}>
        {[
          {
            icon: '🏪', color: '#0284C7', bg: 'rgba(2,132,199,.1)',
            label: 'Commission entreprises',
            value: compDraft ? `${compDraft.commissionValue}${compDraft.commissionType === 'fixed' ? ' GNF' : '%'}` : '—',
          },
          {
            icon: '🤝', color: '#7C3AED', bg: 'rgba(124,58,237,.1)',
            label: 'Commission partenaires (défaut)',
            value: partDraft ? `${partDraft.defaultCommissionRate}%` : '—',
          },
          {
            icon: '🛵', color: '#059669', bg: 'rgba(5,150,105,.1)',
            label: 'Commission livreurs',
            value: delivDraft ? `${delivDraft.platformCommissionRate}%` : '—',
          },
          {
            icon: '🌍', color: '#D97706', bg: 'rgba(217,119,6,.1)',
            label: 'Commission globale plateforme',
            value: platDraft ? `${platDraft.platformCommission}%` : '—',
          },
        ].map(s => (
          <div key={s.label} className="summary-card">
            <div className="summary-icon" style={{ background: s.bg, color: s.color }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
            </div>
            <div className="summary-value" style={{ color: s.color }}>{s.value}</div>
            <div className="summary-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Navigation par onglets */}
      <div className="tab-nav">
        {TABS.map(t => {
          const dirty = t.id === 'entreprises' ? compDirty
            : t.id === 'partenaires' ? partDirty
            : t.id === 'livreurs'    ? delivDirty
            : platDirty;
          return (
            <button
              key={t.id}
              className={`tab-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
              style={tab === t.id ? { color: t.color, borderBottomColor: t.color } : undefined}
            >
              <i className={`fas ${t.icon}`} />
              {t.label}
              <span className={`tab-dot${dirty ? ' dirty' : ''}`} />
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════
          ONGLET 1 — ENTREPRISES
          ══════════════════════════════════════════════════════════ */}
      {tab === 'entreprises' && (
        <>
          <SaveBar
            dirty={compDirty} saving={compSaving}
            onSave={saveComp}
            onDiscard={() => compSaved && setCompDraft(structuredClone(compSaved))}
          />

          {compLoad ? (
            <div className="loading-box">
              <i className="fas fa-rotate-right fa-spin" style={{ fontSize: 22, color: '#0284C7', display: 'block', marginBottom: 10 }} />
              Chargement des commissions entreprises…
            </div>
          ) : !compDraft ? (
            <div className="error-box">
              <i className="fas fa-triangle-exclamation" style={{ fontSize: 28, color: '#dc2626', display: 'block', marginBottom: 10 }} />
              <div style={{ fontWeight: 700, fontSize: 15 }}>Données indisponibles</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted,#6b7280)', margin: '8px 0 16px' }}>Impossible de charger la configuration des commissions entreprises.</div>
              <button className="btn btn-blue btn-sm" onClick={() => { setCompLoad(true); void getCompanySettings().then(d => { setCompSaved(d); setCompDraft(structuredClone(d)); }).finally(() => setCompLoad(false)); }}>
                <i className="fas fa-rotate-right" /> Réessayer
              </button>
            </div>
          ) : (
            <>
              {/* Mode de commission */}
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title"><i className="fas fa-percent" /> Mode de commission</div>
                    <div className="card-sub">Méthode de calcul appliquée à chaque transaction des entreprises de votre réseau</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 10px',
                    borderRadius: 999, background: 'rgba(2,132,199,.1)', color: '#0284C7',
                  }}>
                    {COMP_TYPES.find(c => c.id === compDraft.commissionType)?.title ?? compDraft.commissionType}
                  </span>
                </div>
                <div className="card-body">
                  <div className="mode-grid">
                    {COMP_TYPES.map(m => (
                      <button
                        key={m.id}
                        className={`mode-card${compDraft.commissionType === m.id ? ' active' : ''}`}
                        onClick={() => setComp('commissionType', m.id)}
                      >
                        <div className="mode-icon" style={{ background: m.bg, color: m.color }}>
                          <i className={`fas ${m.icon}`} />
                        </div>
                        <div className="mode-name">{m.title}</div>
                        <div className="mode-desc">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Taux et plafonds */}
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title"><i className="fas fa-sliders" /> Taux et plafonds</div>
                    <div className="card-sub">Paramètres financiers de la commission entreprises</div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="fields-grid">
                    <div className="field-group">
                      <div className="field-label">
                        {compDraft.commissionType === 'fixed' ? 'Montant fixe (GNF)' : 'Taux de commission (%)'}
                      </div>
                      <input
                        type="number"
                        className="field-input"
                        min={0}
                        max={compDraft.commissionType === 'fixed' ? 10_000_000 : 50}
                        step={compDraft.commissionType === 'fixed' ? 100 : 0.5}
                        value={compDraft.commissionValue}
                        onChange={e => setComp('commissionValue', +e.target.value)}
                      />
                      <div className="field-unit">
                        {compDraft.commissionType === 'fixed' ? 'GNF par commande' : '% du montant HT'}
                      </div>
                    </div>
                    <div className="field-group">
                      <div className="field-label">Commission minimale (GNF)</div>
                      <input
                        type="number"
                        className="field-input"
                        min={0}
                        step={100}
                        value={compDraft.commissionMin}
                        onChange={e => setComp('commissionMin', +e.target.value)}
                      />
                      <div className="field-unit">Plancher en GNF</div>
                    </div>
                    <div className="field-group">
                      <div className="field-label">Commission maximale (GNF)</div>
                      <input
                        type="number"
                        className="field-input"
                        min={0}
                        step={1000}
                        value={compDraft.commissionMax}
                        onChange={e => setComp('commissionMax', +e.target.value)}
                      />
                      <div className="field-unit">Plafond en GNF</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tranches progressives */}
              {compDraft.commissionType === 'progressive' && (
                <div className="card">
                  <div className="card-head">
                    <div>
                      <div className="card-title"><i className="fas fa-chart-line" /> Tranches progressives</div>
                      <div className="card-sub">Définissez les paliers de CA et les taux associés</div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => setComp('commissionBrackets', DEFAULT_BRACKETS)}>
                      <i className="fas fa-rotate-left" /> Défaut
                    </button>
                  </div>
                  <div className="card-body">
                    <div className="bracket-list">
                      {(compDraft.commissionBrackets ?? DEFAULT_BRACKETS).map((b, idx) => (
                        <div key={idx} className="bracket-row">
                          <div className="field-group">
                            <div className="field-label">De (GNF)</div>
                            <input type="number" className="field-input" min={0} step={1000}
                              value={b.from}
                              onChange={e => setBracket(idx, { from: +e.target.value })} />
                          </div>
                          <div className="field-group">
                            <div className="field-label">Jusqu'à (GNF)</div>
                            <input type="number" className="field-input" min={0} step={1000}
                              placeholder="Sans limite"
                              value={b.to ?? ''}
                              onChange={e => setBracket(idx, { to: e.target.value === '' ? null : +e.target.value })} />
                          </div>
                          <div className="field-group">
                            <div className="field-label">Taux (%)</div>
                            <input type="number" className="field-input" min={0} max={50} step={0.5}
                              value={b.rate}
                              onChange={e => setBracket(idx, { rate: +e.target.value })} />
                          </div>
                          <button className="bracket-del" onClick={() => removeBracket(idx)} title="Supprimer">
                            <i className="fas fa-xmark" />
                          </button>
                        </div>
                      ))}
                      <button className="bracket-add-btn" onClick={addBracket}>
                        <i className="fas fa-plus" /> Ajouter une tranche
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Commission par catégorie */}
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title"><i className="fas fa-tags" /> Commission par catégorie</div>
                    <div className="card-sub">Définissez un taux spécifique par secteur d'activité (laissez vide pour appliquer le taux par défaut)</div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted,#6b7280)', fontWeight: 600 }}>
                    {categories.length > 0 ? `${categories.length} catégories` : 'Aucune catégorie'}
                  </span>
                </div>
                <div className="card-body">
                  {categories.length === 0 ? (
                    <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--text-muted,#6b7280)', fontSize: 13 }}>
                      <i className="fas fa-tags" style={{ fontSize: 24, display: 'block', marginBottom: 8, opacity: .4 }} />
                      Aucune catégorie disponible — créez-en via le module Catalogue.
                    </div>
                  ) : (
                    <div className="cat-grid">
                      {categories.map((cat: CategoryItem) => {
                        const rule = getCatRule(cat.nom);
                        return (
                          <div key={cat.id} className={`cat-card${rule.enabled ? '' : ' off'}`}>
                            <div className="cat-header">
                              <div className="cat-name">
                                {cat.icone && <span>{cat.icone}</span>}
                                {cat.nom}
                              </div>
                              <div
                                className={`sw${rule.enabled ? ' on' : ''}`}
                                onClick={() => setCatRule(cat.nom, { enabled: !rule.enabled })}
                              />
                            </div>
                            {rule.enabled && (
                              <div className="cat-comm-row">
                                <span className="cat-comm-label">Commission :</span>
                                <input type="number" className="cat-comm-input"
                                  placeholder="Défaut" min={0} max={50} step={0.5}
                                  value={rule.commission ?? ''}
                                  onChange={e => setCatRule(cat.nom, {
                                    commission: e.target.value === '' ? null : +e.target.value,
                                  })} />
                                <span style={{ fontSize: 11, color: 'var(--text-muted,#6b7280)' }}>%</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 2 — PARTENAIRES
          ══════════════════════════════════════════════════════════ */}
      {tab === 'partenaires' && (
        <>
          <SaveBar
            dirty={partDirty} saving={partSaving}
            onSave={savePart}
            onDiscard={() => partSaved && setPartDraft(structuredClone(partSaved))}
          />

          {partLoad ? (
            <div className="loading-box">
              <i className="fas fa-rotate-right fa-spin" style={{ fontSize: 22, color: '#7C3AED', display: 'block', marginBottom: 10 }} />
              Chargement des commissions partenaires…
            </div>
          ) : !partDraft ? (
            <div className="error-box">
              <i className="fas fa-triangle-exclamation" style={{ fontSize: 28, color: '#dc2626', display: 'block', marginBottom: 10 }} />
              <div style={{ fontWeight: 700, fontSize: 15 }}>Données indisponibles</div>
              <button className="btn btn-blue btn-sm" onClick={() => { setPartLoad(true); void getPartnerSettings().then(d => { setPartSaved(d); setPartDraft(structuredClone(d)); }).finally(() => setPartLoad(false)); }}>
                <i className="fas fa-rotate-right" /> Réessayer
              </button>
            </div>
          ) : (
            <>
              {/* Mode de commission partenaires */}
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title"><i className="fas fa-layer-group" /> Mode de commission</div>
                    <div className="card-sub">Méthode de calcul des commissions versées aux partenaires</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '4px 10px',
                    borderRadius: 999, background: 'rgba(124,58,237,.1)', color: '#7C3AED',
                  }}>
                    {PARTNER_MODES.find(m => m.id === partDraft.commissionMode)?.title ?? partDraft.commissionMode}
                  </span>
                </div>
                <div className="card-body">
                  <div className="mode-grid">
                    {PARTNER_MODES.map(m => (
                      <button key={m.id}
                        className={`mode-card${partDraft.commissionMode === m.id ? ' active' : ''}`}
                        onClick={() => setPart('commissionMode', m.id)}
                        style={partDraft.commissionMode === m.id ? { borderColor: '#7C3AED', background: 'rgba(124,58,237,.05)' } : undefined}
                      >
                        <div className="mode-icon" style={{ background: m.bg, color: m.color }}>
                          <i className={`fas ${m.icon}`} />
                        </div>
                        <div className="mode-name">{m.title}</div>
                        <div className="mode-desc">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Taux par défaut */}
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title"><i className="fas fa-percent" /> Taux de commission par défaut</div>
                    <div className="card-sub">Appliqué quand le mode est "Taux fixe" ou comme fallback pour les tiers sans taux propre</div>
                  </div>
                  <span style={{ fontSize: 22, fontWeight: 800, color: '#7C3AED', fontVariantNumeric: 'tabular-nums' }}>
                    {partDraft.defaultCommissionRate}%
                  </span>
                </div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, alignItems: 'center' }}>
                    <div className="field-group">
                      <div className="field-label">Taux (%)</div>
                      <input type="number" className="field-input"
                        min={0} max={50} step={0.5}
                        value={partDraft.defaultCommissionRate}
                        onChange={e => setPart('defaultCommissionRate', +e.target.value)} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted,#6b7280)', lineHeight: 1.5 }}>
                      <i className="fas fa-circle-info" /> Ce taux est versé aux partenaires sur chaque entreprise recrutée
                      active et génératrice de commandes sur la plateforme.
                    </div>
                  </div>
                </div>
              </div>

              {/* Taux par tier */}
              {partDraft.commissionMode === 'tier' && (
                <div className="card">
                  <div className="card-head">
                    <div>
                      <div className="card-title"><i className="fas fa-trophy" /> Taux de commission par tier</div>
                      <div className="card-sub">Personnalisez le taux versé pour chaque niveau de partenaire</div>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="tier-list">
                      {(partDraft.tiers ?? PARTNER_DEFAULT_TIERS).map((tier, idx) => (
                        <div key={tier.id} className="tier-row">
                          <div className="tier-badge">{tier.badge}</div>
                          <div className="tier-info">
                            <div className="tier-label" style={{ color: tier.color }}>{tier.label}</div>
                            <div className="tier-min">
                              Min. {tier.minCompanies} entreprises recrutées
                            </div>
                          </div>
                          <div className="tier-field">
                            <div className="field-label">Commission (%)</div>
                            <input type="number" className="field-input"
                              min={0} max={50} step={0.5}
                              value={tier.commission}
                              onChange={e => setPartTier(idx, { commission: +e.target.value })} />
                          </div>
                          <div className="tier-field">
                            <div className="field-label">Bonus (GNF)</div>
                            <input type="number" className="field-input"
                              min={0} step={1000}
                              value={tier.bonus}
                              onChange={e => setPartTier(idx, { bonus: +e.target.value })} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Fréquence de paiement */}
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title"><i className="fas fa-calendar-check" /> Fréquence de paiement</div>
                    <div className="card-sub">Rythme de versement des commissions aux partenaires</div>
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { id: 'daily',   label: 'Quotidien' },
                      { id: 'weekly',  label: 'Hebdomadaire' },
                      { id: 'monthly', label: 'Mensuel' },
                    ].map(f => (
                      <button key={f.id}
                        className={`mode-card${partDraft.paymentFrequency === f.id ? ' active' : ''}`}
                        style={{ padding: '10px 20px', flexDirection: 'row', alignItems: 'center', gap: 8 }}
                        onClick={() => setPart('paymentFrequency', f.id)}>
                        <i className={`fas ${f.id === 'daily' ? 'fa-sun' : f.id === 'weekly' ? 'fa-calendar-week' : 'fa-calendar'}`} />
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 3 — LIVREURS
          ══════════════════════════════════════════════════════════ */}
      {tab === 'livreurs' && (
        <>
          <SaveBar
            dirty={delivDirty} saving={delivSaving}
            onSave={saveDeliv}
            onDiscard={() => delivSaved && setDelivDraft(structuredClone(delivSaved))}
          />

          {delivLoad ? (
            <div className="loading-box">
              <i className="fas fa-rotate-right fa-spin" style={{ fontSize: 22, color: '#059669', display: 'block', marginBottom: 10 }} />
              Chargement des commissions livreurs…
            </div>
          ) : !delivDraft ? (
            <div className="error-box">
              <i className="fas fa-triangle-exclamation" style={{ fontSize: 28, color: '#dc2626', display: 'block', marginBottom: 10 }} />
              <div style={{ fontWeight: 700, fontSize: 15 }}>Données indisponibles</div>
              <button className="btn btn-blue btn-sm" onClick={() => { setDelivLoad(true); void getDeliverySettings().then(d => { setDelivSaved(d); setDelivDraft(structuredClone(d)); }).finally(() => setDelivLoad(false)); }}>
                <i className="fas fa-rotate-right" /> Réessayer
              </button>
            </div>
          ) : (
            <>
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title"><i className="fas fa-motorcycle" /> Commission plateforme sur les livraisons</div>
                    <div className="card-sub">Pourcentage prélevé par Shopi sur chaque transaction de livraison</div>
                  </div>
                  <span style={{ fontSize: 26, fontWeight: 800, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                    {delivDraft.platformCommissionRate}%
                  </span>
                </div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'center' }}>
                    <div className="field-group">
                      <div className="field-label">Taux de commission (%)</div>
                      <input type="number" className="field-input"
                        min={0} max={50} step={0.5}
                        value={delivDraft.platformCommissionRate}
                        onChange={e => setDelivDraft(d => d ? { ...d, platformCommissionRate: +e.target.value } : d)} />
                    </div>
                    <div style={{
                      background: 'rgba(5,150,105,.06)', border: '1px solid rgba(5,150,105,.2)',
                      borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#059669',
                    }}>
                      <i className="fas fa-circle-info" style={{ marginRight: 6 }} />
                      Cette commission est prélevée par Shopi sur le montant de chaque livraison réalisée par un livreur.
                      Elle s'applique en plus des frais de livraison définis par l'entreprise.
                    </div>
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary,#111827)', marginBottom: 10 }}>
                      Simulateur de commission
                    </div>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10,
                    }}>
                      {[5_000, 10_000, 25_000, 50_000].map(amount => (
                        <div key={amount} style={{
                          background: 'var(--bg-input,#f9fafb)', borderRadius: 9, padding: '12px',
                          textAlign: 'center',
                        }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted,#6b7280)', fontWeight: 600 }}>
                            Livraison {(amount / 1000).toFixed(0)}K GNF
                          </div>
                          <div style={{ fontSize: 17, fontWeight: 800, color: '#059669', marginTop: 4 }}>
                            {Math.round(amount * delivDraft.platformCommissionRate / 100).toLocaleString('fr-FR')} GNF
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted,#6b7280)' }}>Commission Shopi</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fréquence de paiement livreurs */}
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title"><i className="fas fa-calendar-check" /> Fréquence de paiement</div>
                    <div className="card-sub">Rythme de versement des revenus aux livreurs</div>
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { id: 'daily',   label: 'Quotidien' },
                      { id: 'weekly',  label: 'Hebdomadaire' },
                      { id: 'monthly', label: 'Mensuel' },
                    ].map(f => (
                      <button key={f.id}
                        className={`mode-card${delivDraft.paymentFrequency === f.id ? ' active' : ''}`}
                        style={{
                          padding: '10px 20px', flexDirection: 'row', alignItems: 'center', gap: 8,
                          ...(delivDraft.paymentFrequency === f.id ? { borderColor: '#059669', background: 'rgba(5,150,105,.05)' } : {}),
                        }}
                        onClick={() => setDelivDraft(d => d ? { ...d, paymentFrequency: f.id } : d)}>
                        <i className={`fas ${f.id === 'daily' ? 'fa-sun' : f.id === 'weekly' ? 'fa-calendar-week' : 'fa-calendar'}`} />
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 4 — PLATEFORME
          ══════════════════════════════════════════════════════════ */}
      {tab === 'plateforme' && (
        <>
          <SaveBar
            dirty={platDirty} saving={platSaving}
            onSave={savePlat}
            onDiscard={() => platSaved && setPlatDraft(structuredClone(platSaved))}
          />

          {platLoad ? (
            <div className="loading-box">
              <i className="fas fa-rotate-right fa-spin" style={{ fontSize: 22, color: '#D97706', display: 'block', marginBottom: 10 }} />
              Chargement des paramètres plateforme…
            </div>
          ) : !platDraft ? (
            <div className="error-box">
              <i className="fas fa-triangle-exclamation" style={{ fontSize: 28, color: '#dc2626', display: 'block', marginBottom: 10 }} />
              <div style={{ fontWeight: 700, fontSize: 15 }}>Données indisponibles</div>
              <button className="btn btn-blue btn-sm" onClick={() => { setPlatLoad(true); void apiFetch<PlatformSettings>('/dashboard/super-admin/settings').then(d => { setPlatSaved(d); setPlatDraft(structuredClone(d)); }).finally(() => setPlatLoad(false)); }}>
                <i className="fas fa-rotate-right" /> Réessayer
              </button>
            </div>
          ) : (
            <>
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title"><i className="fas fa-globe" /> Commission globale Shopi</div>
                    <div className="card-sub">Taux général prélevé par la plateforme sur toutes les transactions vendeur</div>
                  </div>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#D97706', fontVariantNumeric: 'tabular-nums' }}>
                    {platDraft.platformCommission}%
                  </span>
                </div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'center' }}>
                    <div className="field-group">
                      <div className="field-label">Commission plateforme (%)</div>
                      <input type="number" className="field-input"
                        min={0} max={50} step={0.5}
                        value={platDraft.platformCommission as number}
                        onChange={e => setPlatDraft(d => d ? { ...d, platformCommission: parseFloat(e.target.value) || 0 } : d)} />
                      <div className="field-unit">Appliqué sur toutes les ventes Shopi (0 – 50%)</div>
                    </div>
                    <div style={{
                      background: 'rgba(217,119,6,.06)', border: '1px solid rgba(217,119,6,.2)',
                      borderRadius: 10, padding: '14px 16px', fontSize: 13, color: '#B45309',
                    }}>
                      <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />
                      <strong>Commission globale</strong> — ce taux est utilisé comme référence par tous les modules.
                      Les taux spécifiques (entreprises, partenaires, livreurs) peuvent le remplacer localement.
                      Toute modification prend effet immédiatement sur les nouvelles transactions.
                    </div>
                  </div>

                  {/* Impact simulateur */}
                  <div style={{ marginTop: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary,#111827)', marginBottom: 12 }}>
                      Impact sur les transactions
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                      {[100_000, 500_000, 1_000_000].map(amount => {
                        const commission = Math.round(amount * (platDraft.platformCommission as number) / 100);
                        const net = amount - commission;
                        return (
                          <div key={amount} style={{
                            background: 'var(--bg-input,#f9fafb)', borderRadius: 10, padding: '14px 16px',
                          }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted,#6b7280)', fontWeight: 600, marginBottom: 8 }}>
                              Transaction de {(amount / 1000).toFixed(0)}K GNF
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-muted,#6b7280)' }}>Commission Shopi</span>
                              <span style={{ fontWeight: 700, color: '#D97706' }}>{commission.toLocaleString('fr-FR')} GNF</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span style={{ color: 'var(--text-muted,#6b7280)' }}>Net vendeur</span>
                              <span style={{ fontWeight: 700, color: '#059669' }}>{net.toLocaleString('fr-FR')} GNF</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Récapitulatif de tous les taux */}
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="card-title"><i className="fas fa-table-list" /> Récapitulatif des taux actifs</div>
                    <div className="card-sub">Vue consolidée de toutes les commissions configurées sur la plateforme</div>
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                    {[
                      {
                        label: 'Commission globale (plateforme)',
                        value: `${platDraft.platformCommission}%`,
                        icon: 'fa-globe', color: '#D97706', bg: 'rgba(217,119,6,.1)',
                        source: 'Paramètres globaux',
                      },
                      {
                        label: compDraft ? `Commission entreprises (${COMP_TYPES.find(c => c.id === compDraft.commissionType)?.title ?? ''})` : 'Commission entreprises',
                        value: compDraft ? `${compDraft.commissionValue}${compDraft.commissionType === 'fixed' ? ' GNF' : '%'}` : '—',
                        icon: 'fa-building', color: '#0284C7', bg: 'rgba(2,132,199,.1)',
                        source: 'Module Entreprises',
                      },
                      {
                        label: partDraft ? `Commission partenaires (${PARTNER_MODES.find(m => m.id === partDraft.commissionMode)?.title ?? ''})` : 'Commission partenaires',
                        value: partDraft ? `${partDraft.defaultCommissionRate}%` : '—',
                        icon: 'fa-handshake', color: '#7C3AED', bg: 'rgba(124,58,237,.1)',
                        source: 'Module Partenaires',
                      },
                      {
                        label: 'Commission livreurs (plateforme)',
                        value: delivDraft ? `${delivDraft.platformCommissionRate}%` : '—',
                        icon: 'fa-motorcycle', color: '#059669', bg: 'rgba(5,150,105,.1)',
                        source: 'Module Livreurs',
                      },
                    ].map(r => (
                      <div key={r.label} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: 'var(--bg-input,#f9fafb)', borderRadius: 10, padding: '14px 16px',
                      }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                          background: r.bg, color: r.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 15,
                        }}>
                          <i className={`fas ${r.icon}`} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary,#111827)' }}>{r.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted,#6b7280)' }}>{r.source}</div>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: r.color, fontVariantNumeric: 'tabular-nums' }}>
                          {r.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

    </div>
  );
}
