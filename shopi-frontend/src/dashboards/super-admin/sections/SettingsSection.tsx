// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/sections/SettingsSection.tsx
//
// CHANGEMENTS vs version précédente
// ─────────────────────────────────────────────────────────────
//  1. Panneau "Types d'entreprise" ajouté avant les catégories
//     → UI 3 colonnes : Types | Catégories du type | Sous-catégories
//  2. Les catégories sont filtrées par type sélectionné
//     → GET /company-types/:typeId/categories (nouveau endpoint)
//  3. Création d'une catégorie lie automatiquement au type actif
//  4. Slug auto-généré depuis le nom (normalize côté front)
//  5. Tous les types sont chargés au montage du composant
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';
import { apiFetch, ApiError }  from '../../../shared/services/apiFetch';
import { IconPicker, ColorPicker, iconGroupsForType } from '../components/EntityPickers';

// ── Interfaces locales ────────────────────────────────────────

interface TypeLocal {
  id:          string;
  slug:        string;
  nom:         string;
  description: string | null;
  icone:       string | null;
  couleur:     string | null;
  ordre:       number;
  actif:       boolean;
  nbCategories:  number;
  nbEntreprises: number;
}

interface CatLocal {
  id:            string;
  nom:           string;
  slug:          string;
  icone:         string | null;
  couleur:       string | null;
  description:   string | null;
  ordre:         number;
  actif:         boolean;
  companyTypeId: string | null;
  subCategories: SubLocal[];
}

interface SubLocal {
  id:         string;
  nom:        string;
  slug:       string;
  icone:      string | null;
  ordre:      number;
  categoryId: string;
}

// ── Utilitaire : génère un slug depuis un nom ─────────────────
function toSlug(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

// ── Props ─────────────────────────────────────────────────────
interface Props {
  store:    SuperAdminStore;
  toast:    (type: string, msg: string) => void;
  isActive: boolean;
}

// ═════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═════════════════════════════════════════════════════════════

export default function SettingsSection({ store, toast, isActive }: Props) {
  const { state, toggleTheme } = store;

  // ── Settings plateforme ────────────────────────────────────
  const [emailVerif,   setEmailVerif]   = useState(true);
  const [twoFA,        setTwoFA]        = useState(true);
  const [maxAttempts,  setMaxAttempts]  = useState(5);
  const [openSignup,   setOpenSignup]   = useState(true);
  const [codeRequired, setCodeRequired] = useState(true);
  const [kycRequired,  setKycRequired]  = useState(false);
  const [maintenance,  setMaintenance]  = useState(false);
  const [commission,   setCommission]   = useState(6);
  const [timezone,     setTimezone]     = useState('Africa/Conakry');

  // ── État types d'entreprise ────────────────────────────────
  const [types,       setTypes]      = useState<TypeLocal[]>([]);
  const [typeLoading, setTypeLoading]= useState(false);
  const [typeSelId,   setTypeSelId]  = useState<string>('');

  // ── État catégories ────────────────────────────────────────
  // On ne charge que les catégories du type sélectionné
  const [categories,  setCategories] = useState<CatLocal[]>([]);
  const [catLoading,  setCatLoading] = useState(false);
  const [catSelId,    setCatSelId]   = useState<string>('');

  // ── Modales — types ────────────────────────────────────────
  const [modalType,    setModalType]    = useState(false);
  const [modalDelType, setModalDelType] = useState<TypeLocal | null>(null);

  // ── Formulaire type ────────────────────────────────────────
  const [newTypeNom,   setNewTypeNom]   = useState('');
  const [newTypeSlug,  setNewTypeSlug]  = useState('');  // auto-calculé
  const [newTypeIcone, setNewTypeIcone] = useState('');
  const [newTypeCoul,  setNewTypeCoul]  = useState('');
  const [newTypeDesc,  setNewTypeDesc]  = useState('');
  const [newTypeOrdre, setNewTypeOrdre] = useState('');
  const [typeErreur,   setTypeErreur]   = useState('');

  // ── Modales — catégories ───────────────────────────────────
  const [modalCat,    setModalCat]    = useState(false);
  const [modalDelCat, setModalDelCat] = useState<CatLocal | null>(null);

  // ── Formulaire catégorie ───────────────────────────────────
  const [newCatNom,   setNewCatNom]   = useState('');
  const [newCatSlug,  setNewCatSlug]  = useState('');  // auto-calculé
  const [newCatIcone, setNewCatIcone] = useState('');
  const [newCatCoul,  setNewCatCoul]  = useState('');
  const [newCatDesc,  setNewCatDesc]  = useState('');
  const [newCatOrdre, setNewCatOrdre] = useState('');
  const [catErreur,   setCatErreur]   = useState('');

  // ── Modales — sous-catégories ──────────────────────────────
  const [modalSub,    setModalSub]    = useState(false);
  const [modalDelSub, setModalDelSub] = useState<SubLocal | null>(null);

  // ── Formulaire sous-catégorie ──────────────────────────────
  const [newSubNom,   setNewSubNom]   = useState('');
  const [newSubSlug,  setNewSubSlug]  = useState('');  // auto-calculé
  const [newSubCatId, setNewSubCatId] = useState('');
  const [newSubIcone, setNewSubIcone] = useState('');
  const [newSubOrdre, setNewSubOrdre] = useState('');
  const [subErreur,   setSubErreur]   = useState('');

  // ── Chargement initial : types ─────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    setTypeLoading(true);
    apiFetch<TypeLocal[]>('/company-types')
      .then(data => setTypes(data ?? []))
      .catch(() => toast('error', 'Impossible de charger les types d\'entreprise.'))
      .finally(() => setTypeLoading(false));
  }, [isActive]);

  // ── Chargement des catégories quand un type est sélectionné ──
  useEffect(() => {
    if (!typeSelId) { setCategories([]); setCatSelId(''); return; }

    setCatLoading(true);
    apiFetch<CatLocal[]>(`/company-types/${typeSelId}/categories`)
      .then(data => {
        const normalized = (data ?? []).map(c => ({
          ...c,
          subCategories: c.subCategories ?? [],
        }));
        setCategories(normalized);
      })
      .catch(() => toast('error', 'Impossible de charger les catégories.'))
      .finally(() => setCatLoading(false));
  }, [typeSelId]);

  // ── Slug auto depuis le nom ────────────────────────────────
  const handleTypeNomChange = (val: string) => {
    setNewTypeNom(val);
    setNewTypeSlug(toSlug(val));
    setTypeErreur('');
  };
  const handleCatNomChange = (val: string) => {
    setNewCatNom(val);
    setNewCatSlug(toSlug(val));
    setCatErreur('');
  };
  const handleSubNomChange = (val: string) => {
    setNewSubNom(val);
    setNewSubSlug(toSlug(val));
    setSubErreur('');
  };

  // ── Handlers plateforme ────────────────────────────────────
  const handleSave = () => toast('success', '💾 Paramètres sauvegardés');
  const handleMaintenance = (val: boolean) => {
    setMaintenance(val);
    if (val) toast('error', '⚠️ MODE MAINTENANCE ACTIVÉ');
    else     toast('success', '✅ Maintenance désactivée');
  };

  // ── Handlers types d'entreprise ────────────────────────────

  const handleAjouterType = async () => {
    if (!newTypeNom.trim()) { setTypeErreur('Le nom du type est obligatoire.'); return; }
    try {
      const created = await apiFetch<TypeLocal>('/company-types', {
        method: 'POST',
        body: {
          nom:         newTypeNom.trim(),
          slug:        newTypeSlug || toSlug(newTypeNom),
          icone:       newTypeIcone.trim()  || undefined,
          couleur:     newTypeCoul.trim()   || undefined,
          description: newTypeDesc.trim()   || undefined,
          ordre:       newTypeOrdre ? parseInt(newTypeOrdre) : undefined,
        },
      });
      setTypes(prev => [...prev, { ...created, nbCategories: 0, nbEntreprises: 0 }]);
      setModalType(false);
      setNewTypeNom(''); setNewTypeSlug(''); setNewTypeIcone('');
      setNewTypeCoul(''); setNewTypeDesc(''); setNewTypeOrdre('');
      toast('success', `✅ Type "${created.nom}" créé`);
    } catch (err) {
      setTypeErreur(err instanceof ApiError ? err.message : 'Erreur réseau.');
    }
  };

  const handleSupprimerType = async (type: TypeLocal) => {
    try {
      const res = await apiFetch<{ message: string; catsMisesAJour: number }>(
        `/company-types/${type.id}`, { method: 'DELETE' },
      );
      setTypes(prev => prev.filter(t => t.id !== type.id));
      if (typeSelId === type.id) { setTypeSelId(''); setCategories([]); setCatSelId(''); }
      setModalDelType(null);
      toast('success', `🗑️ ${res.message}`);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erreur lors de la suppression.');
    }
  };

  // ── Handlers catégories ────────────────────────────────────

  const handleAjouterCat = async () => {
    if (!newCatNom.trim()) { setCatErreur('Le nom de la catégorie est obligatoire.'); return; }
    try {
      const created = await apiFetch<CatLocal>('/categories', {
        method: 'POST',
        body: {
          nom:           newCatNom.trim(),
          slug:          newCatSlug || toSlug(newCatNom),
          icone:         newCatIcone.trim()  || undefined,
          couleur:       newCatCoul.trim()   || undefined,
          description:   newCatDesc.trim()   || undefined,
          ordre:         newCatOrdre ? parseInt(newCatOrdre) : undefined,
          companyTypeId: typeSelId || undefined,
        },
      });
      const normalized = { ...created, subCategories: created.subCategories ?? [] };
      setCategories(prev => [...prev, normalized]);
      // Met à jour le compteur dans la liste des types
      setTypes(prev => prev.map(t =>
        t.id === typeSelId ? { ...t, nbCategories: t.nbCategories + 1 } : t
      ));
      setModalCat(false);
      setNewCatNom(''); setNewCatSlug(''); setNewCatIcone('');
      setNewCatCoul(''); setNewCatDesc(''); setNewCatOrdre('');
      toast('success', `✅ Catégorie "${created.nom}" créée`);
    } catch (err) {
      setCatErreur(err instanceof ApiError ? err.message : 'Erreur réseau.');
    }
  };

  const handleSupprimerCat = async (cat: CatLocal) => {
    try {
      await apiFetch(`/categories/${cat.id}`, { method: 'DELETE' });
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      if (catSelId === cat.id) setCatSelId('');
      setTypes(prev => prev.map(t =>
        t.id === typeSelId ? { ...t, nbCategories: Math.max(0, t.nbCategories - 1) } : t
      ));
      setModalDelCat(null);
      toast('success', `🗑️ Catégorie "${cat.nom}" supprimée`);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erreur lors de la suppression.');
    }
  };

  // ── Handlers sous-catégories ───────────────────────────────

  const handleAjouterSub = async () => {
    const catId = newSubCatId || catSelId;
    if (!newSubNom.trim()) { setSubErreur('Le nom est obligatoire.'); return; }
    if (!catId)            { setSubErreur('Choisissez une catégorie parente.'); return; }
    try {
      const created = await apiFetch<SubLocal>('/sub-categories', {
        method: 'POST',
        body: {
          nom:        newSubNom.trim(),
          slug:       newSubSlug || toSlug(newSubNom),
          categoryId: catId,
          icone:      newSubIcone.trim() || undefined,
          ordre:      newSubOrdre ? parseInt(newSubOrdre) : undefined,
        },
      });
      setCategories(prev => prev.map(c =>
        c.id === catId
          ? { ...c, subCategories: [...(c.subCategories ?? []), created] }
          : c
      ));
      setModalSub(false);
      setNewSubNom(''); setNewSubSlug(''); setNewSubIcone('');
      setNewSubOrdre(''); setNewSubCatId('');
      toast('success', `✅ Sous-catégorie "${created.nom}" créée`);
    } catch (err) {
      setSubErreur(err instanceof ApiError ? err.message : 'Erreur réseau.');
    }
  };

  const handleSupprimerSub = async (sub: SubLocal) => {
    try {
      await apiFetch(`/sub-categories/${sub.id}`, { method: 'DELETE' });
      setCategories(prev => prev.map(c =>
        c.id === sub.categoryId
          ? { ...c, subCategories: c.subCategories.filter(s => s.id !== sub.id) }
          : c
      ));
      setModalDelSub(null);
      toast('success', `🗑️ Sous-catégorie "${sub.nom}" supprimée`);
    } catch (err) {
      toast('error', err instanceof ApiError ? err.message : 'Erreur lors de la suppression.');
    }
  };

  // ── Guard d'affichage ──────────────────────────────────────
  if (!isActive) return null;

  const typeActive = types.find(t => t.id === typeSelId)  ?? null;
  const catActive  = categories.find(c => c.id === catSelId) ?? null;

  const totalSubs = categories.reduce((acc, c) => acc + (c.subCategories?.length ?? 0), 0);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="section active">

      {/* ── En-tête ── */}
      <div className="page-header">
        <div>
          <div className="ph-title">Paramètres <mark>Plateforme</mark></div>
          <div className="ph-sub">Configuration globale de Shopi Africa</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-primary" onClick={handleSave}>💾 Sauvegarder</button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          PANNEAU CATALOGUE — 3 COLONNES
          ════════════════════════════════════════════════════ */}
      <div className="cat-section">

        {/* Titre du bloc catalogue */}
        <div className="cat-section-head">
          <div className="cat-section-title">
            <span className="cat-section-ico">🗂️</span>
            Catalogue Produits — Types, Catégories &amp; Sous-catégories
          </div>
          <div className="cat-section-sub">
            {types.length} type{types.length > 1 ? 's' : ''} ·{' '}
            {categories.length} catégorie{categories.length > 1 ? 's' : ''} ·{' '}
            {totalSubs} sous-catégorie{totalSubs > 1 ? 's' : ''}
          </div>
        </div>

        <div className="cat-split cat-split--3">

          {/* ── COLONNE 1 : Types d'entreprise ── */}
          <div className="cat-panel">
            <div className="cat-panel-head">
              <span className="cat-panel-label">Types d'entreprise</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setTypeErreur(''); setModalType(true); }}
              >
                + Ajouter
              </button>
            </div>
            <div className="cat-list">
              {typeLoading ? (
                <div className="cat-empty">⏳ Chargement…</div>
              ) : types.length === 0 ? (
                <div className="cat-empty">Aucun type. Cliquez sur "+ Ajouter".</div>
              ) : types.map(type => (
                <div
                  key={type.id}
                  className={`cat-item cat-item--type ${typeSelId === type.id ? 'active' : ''}`}
                  onClick={() => {
                    setTypeSelId(type.id === typeSelId ? '' : type.id);
                    setCatSelId('');
                  }}
                >
                  <div className="cat-item-left">
                    <span className="cat-item-ico" style={{ fontSize: 20 }}>
                      {type.icone ?? '🏢'}
                    </span>
                    <div>
                      <div className="cat-item-nom">{type.nom}</div>
                      <div className="cat-item-sub-count">
                        {type.nbCategories} catégorie{type.nbCategories > 1 ? 's' : ''}
                        {type.nbEntreprises > 0 && (
                          <> · {type.nbEntreprises} entreprise{type.nbEntreprises > 1 ? 's' : ''}</>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="cat-item-right">
                    {type.couleur && (
                      <span
                        className="type-couleur-dot"
                        style={{ background: type.couleur }}
                        title={type.couleur}
                      />
                    )}
                    <span className="cat-ordre-badge">#{type.ordre}</span>
                    <button
                      className="cat-del-btn"
                      onClick={e => { e.stopPropagation(); setModalDelType(type); }}
                      title="Supprimer"
                    >🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── COLONNE 2 : Catégories du type sélectionné ── */}
          <div className="cat-panel">
            <div className="cat-panel-head">
              <span className="cat-panel-label">
                {typeActive
                  ? `Catégories — ${typeActive.icone ?? '🏢'} ${typeActive.nom}`
                  : 'Catégories'}
              </span>
              <button
                className="btn btn-primary btn-sm"
                disabled={!typeSelId}
                onClick={() => { setCatErreur(''); setModalCat(true); }}
                title={!typeSelId ? 'Sélectionnez un type d\'abord' : undefined}
              >
                + Ajouter
              </button>
            </div>
            <div className="cat-list">
              {!typeActive ? (
                <div className="cat-empty cat-empty--hint">
                  👈 Sélectionnez un type pour voir ses catégories
                </div>
              ) : catLoading ? (
                <div className="cat-empty">⏳ Chargement…</div>
              ) : categories.length === 0 ? (
                <div className="cat-empty">
                  Aucune catégorie pour "{typeActive.nom}". Cliquez sur "+ Ajouter".
                </div>
              ) : categories.map(cat => (
                <div
                  key={cat.id}
                  className={`cat-item ${catSelId === cat.id ? 'active' : ''}`}
                  onClick={() => setCatSelId(cat.id === catSelId ? '' : cat.id)}
                >
                  <div className="cat-item-left">
                    <span className="cat-item-ico">{cat.icone ?? '📁'}</span>
                    <div>
                      <div className="cat-item-nom">{cat.nom}</div>
                      <div className="cat-item-sub-count">
                        {cat.subCategories?.length ?? 0} sous-cat{(cat.subCategories?.length ?? 0) > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="cat-item-right">
                    {cat.couleur && (
                      <span
                        className="type-couleur-dot"
                        style={{ background: cat.couleur }}
                        title={cat.couleur}
                      />
                    )}
                    <span className="cat-ordre-badge">#{cat.ordre}</span>
                    <button
                      className="cat-del-btn"
                      onClick={e => { e.stopPropagation(); setModalDelCat(cat); }}
                      title="Supprimer"
                    >🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── COLONNE 3 : Sous-catégories ── */}
          <div className="cat-panel">
            <div className="cat-panel-head">
              <span className="cat-panel-label">
                {catActive
                  ? `Sous-catégories — ${catActive.icone ?? '📁'} ${catActive.nom}`
                  : 'Sous-catégories'}
              </span>
              <button
                className="btn btn-sky btn-sm"
                disabled={!catSelId}
                onClick={() => {
                  setSubErreur('');
                  setNewSubCatId(catSelId || '');
                  setModalSub(true);
                }}
                title={!catSelId ? 'Sélectionnez une catégorie d\'abord' : undefined}
              >
                + Ajouter
              </button>
            </div>
            <div className="cat-list">
              {!catActive ? (
                <div className="cat-empty cat-empty--hint">
                  👆 Sélectionnez une catégorie pour voir ses sous-catégories
                </div>
              ) : catActive.subCategories?.length === 0 ? (
                <div className="cat-empty">
                  Aucune sous-catégorie pour "{catActive.nom}".
                </div>
              ) : catActive.subCategories?.map(sub => (
                <div key={sub.id} className="cat-item cat-item--sub">
                  <div className="cat-item-left">
                    <span className="cat-sub-dot" />
                    <div>
                      <div className="cat-item-nom">
                        {sub.icone && <span style={{ marginRight: 5 }}>{sub.icone}</span>}
                        {sub.nom}
                      </div>
                      <div className="cat-item-sub-count">Ordre #{sub.ordre}</div>
                    </div>
                  </div>
                  <div className="cat-item-right">
                    <button
                      className="cat-del-btn"
                      onClick={() => setModalDelSub(sub)}
                      title="Supprimer"
                    >🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>{/* /cat-split--3 */}
      </div>{/* /cat-section */}

      {/* ════════════════════════════════════════════════════
          PARAMÈTRES PLATEFORME
          ════════════════════════════════════════════════════ */}
      <div className="settings-grid">

        <SettingGroup icon="🔐" iconBg="var(--rose-dim)" title="Sécurité & Authentification">
          <SettingRow label="Vérification email obligatoire" desc="Les utilisateurs doivent vérifier leur email">
            <Toggle checked={emailVerif} onChange={setEmailVerif} />
          </SettingRow>
          <SettingRow label="2FA pour les admins" desc="Obligatoire pour les administrateurs">
            <Toggle checked={twoFA} onChange={setTwoFA} />
          </SettingRow>
          <SettingRow label="Tentatives max avant blocage">
            <input
              className="input-field" type="number"
              value={maxAttempts} min={1} max={20}
              onChange={e => setMaxAttempts(parseInt(e.target.value) || 1)}
              style={{ width: 70 }}
            />
          </SettingRow>
        </SettingGroup>

        <SettingGroup icon="👤" iconBg="var(--acid-dim)" title="Inscriptions & Accès">
          <SettingRow label="Inscription ouverte (Clients)" desc="Inscription libre sans code">
            <Toggle checked={openSignup} onChange={setOpenSignup} />
          </SettingRow>
          <SettingRow label="Code requis (Entreprises)">
            <Toggle checked={codeRequired} onChange={setCodeRequired} />
          </SettingRow>
          <SettingRow label="Validation KYC obligatoire">
            <Toggle checked={kycRequired} onChange={setKycRequired} />
          </SettingRow>
        </SettingGroup>

        <SettingGroup icon="🌓" iconBg="var(--sky-dim)" title="Apparence">
          <SettingRow label="Mode sombre" desc="Basculer entre thème clair et sombre">
            <Toggle checked={state.theme === 'dark'} onChange={() => toggleTheme()} />
          </SettingRow>
        </SettingGroup>

        <SettingGroup icon="🌍" iconBg="var(--gold-dim)" title="Plateforme">
          <SettingRow label="Mode maintenance" desc="⚠️ Désactive l'accès à tous les utilisateurs">
            <Toggle checked={maintenance} onChange={handleMaintenance} />
          </SettingRow>
          <SettingRow label="Commission plateforme (%)">
            <input
              className="input-field" type="number"
              value={commission} min={0} max={50}
              onChange={e => setCommission(parseInt(e.target.value) || 0)}
              style={{ width: 70 }}
            />
          </SettingRow>
          <SettingRow label="Fuseau horaire">
            <select className="sel" value={timezone} onChange={e => setTimezone(e.target.value)}>
              <option>Africa/Conakry</option>
              <option>Africa/Dakar</option>
              <option>Africa/Bamako</option>
              <option>Africa/Abidjan</option>
            </select>
          </SettingRow>
        </SettingGroup>

      </div>

      {/* ════════════════════════════════════════════════════
          MODALES — TYPES D'ENTREPRISE
          ════════════════════════════════════════════════════ */}

      {/* Modal : Ajouter un type */}
      {modalType && (
        <div className="modal-overlay open" onClick={() => setModalType(false)}>
          <div className="modal cat-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="card-title">🏢 Nouveau type d'entreprise</div>
                <div className="card-sub">
                  Définit la nature globale d'une entreprise Shopi
                  (ex : Restaurant, Boutique, Pharmacie…)
                </div>
              </div>
              <button className="modal-close" onClick={() => setModalType(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="mf">
                <label>Nom du type *</label>
                <input
                  className="input-field"
                  placeholder="Ex: Restaurant"
                  value={newTypeNom}
                  onChange={e => handleTypeNomChange(e.target.value)}
                  autoFocus
                />
              </div>
              {/* Slug auto-calculé — affiché en lecture pour transparence */}
              {newTypeSlug && (
                <div className="mf">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Slug généré
                    <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 400 }}>
                      (identifiant technique)
                    </span>
                  </label>
                  <input
                    className="input-field"
                    value={newTypeSlug}
                    onChange={e => setNewTypeSlug(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--blue)' }}
                  />
                </div>
              )}
              <div className="cat-modal-row">
                <div className="mf" style={{ flex: 1 }}>
                  <label>Icône</label>
                  <IconPicker value={newTypeIcone} onChange={setNewTypeIcone} placeholder="🏪" />
                </div>
                <div className="mf" style={{ flex: 1.4 }}>
                  <label>Couleur</label>
                  <ColorPicker value={newTypeCoul} onChange={setNewTypeCoul} />
                </div>
                <div className="mf" style={{ flex: 1 }}>
                  <label>Ordre</label>
                  <input
                    className="input-field" type="number"
                    placeholder={String(types.length + 1)}
                    value={newTypeOrdre} min={1}
                    onChange={e => setNewTypeOrdre(e.target.value)}
                  />
                </div>
              </div>
              <div className="mf">
                <label>Description <span style={{ fontWeight: 400, color: 'var(--t3)' }}>(facultative)</span></label>
                <textarea
                  className="input-field"
                  placeholder="Courte description visible dans le formulaire d'inscription"
                  value={newTypeDesc}
                  rows={2}
                  onChange={e => { setNewTypeDesc(e.target.value); setTypeErreur(''); }}
                />
              </div>
              {/* Aperçu */}
              {newTypeNom.trim() && (
                <div className="cat-preview">
                  <div className="cat-preview-label">Aperçu</div>
                  <div className="cat-preview-item" style={{ gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{newTypeIcone.trim() || '🏢'}</span>
                    <div>
                      <div className="cat-preview-nom">{newTypeNom.trim()}</div>
                      {newTypeCoul && (
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: newTypeCoul, marginTop: 4 }} />
                      )}
                    </div>
                  </div>
                </div>
              )}
              {typeErreur && <div className="cat-erreur">{typeErreur}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModalType(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleAjouterType}>
                ✅ Créer le type
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Confirmer suppression type */}
      {modalDelType && (
        <div className="modal-overlay open" onClick={() => setModalDelType(null)}>
          <div className="modal cat-modal cat-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="card-title">🗑️ Supprimer le type d'entreprise</div>
              <button className="modal-close" onClick={() => setModalDelType(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="cat-del-confirm">
                <div className="cat-del-ico">⚠️</div>
                <div>
                  <div className="cat-del-title">
                    Supprimer <strong>"{modalDelType.nom}"</strong> ?
                  </div>
                  <div className="cat-del-desc">
                    {modalDelType.nbEntreprises > 0 ? (
                      <>
                        ⛔ <strong>{modalDelType.nbEntreprises} entreprise(s)</strong> utilisent
                        encore ce type. Vous devez d'abord les réassigner.
                      </>
                    ) : (
                      <>
                        Les {modalDelType.nbCategories} catégorie(s) liées seront détachées
                        (pas supprimées). Cette action est irréversible.
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModalDelType(null)}>Annuler</button>
              <button
                className="btn btn-danger"
                disabled={modalDelType.nbEntreprises > 0}
                onClick={() => handleSupprimerType(modalDelType)}
              >
                🗑️ Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          MODALES — CATÉGORIES
          ════════════════════════════════════════════════════ */}

      {/* Modal : Ajouter une catégorie */}
      {modalCat && (
        <div className="modal-overlay open" onClick={() => setModalCat(false)}>
          <div className="modal cat-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="card-title">🗂️ Nouvelle catégorie</div>
                <div className="card-sub">
                  Sera ajoutée au type{typeActive ? ` "${typeActive.nom}"` : ''} et visible
                  dans les formulaires produit
                </div>
              </div>
              <button className="modal-close" onClick={() => setModalCat(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="mf">
                <label>Nom de la catégorie *</label>
                <input
                  className="input-field"
                  placeholder="Ex: Électronique"
                  value={newCatNom}
                  onChange={e => handleCatNomChange(e.target.value)}
                  autoFocus
                />
              </div>
              {newCatSlug && (
                <div className="mf">
                  <label>Slug généré</label>
                  <input
                    className="input-field"
                    value={newCatSlug}
                    onChange={e => setNewCatSlug(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--blue)' }}
                  />
                </div>
              )}
              <div className="cat-modal-row">
                <div className="mf" style={{ flex: 1 }}>
                  <label>Icône</label>
                  <IconPicker
                    value={newCatIcone}
                    onChange={setNewCatIcone}
                    placeholder="📦"
                    groups={iconGroupsForType(typeActive)}
                  />
                </div>
                <div className="mf" style={{ flex: 1.4 }}>
                  <label>Couleur</label>
                  <ColorPicker value={newCatCoul} onChange={setNewCatCoul} />
                </div>
                <div className="mf" style={{ flex: 1 }}>
                  <label>Ordre d'affichage</label>
                  <input
                    className="input-field" type="number"
                    placeholder={String(categories.length + 1)}
                    value={newCatOrdre} min={1}
                    onChange={e => setNewCatOrdre(e.target.value)}
                  />
                </div>
              </div>
              <div className="mf">
                <label>Description <span style={{ fontWeight: 400, color: 'var(--t3)' }}>(facultative)</span></label>
                <input
                  className="input-field"
                  placeholder="Ex: Produits électroniques et high-tech"
                  value={newCatDesc}
                  onChange={e => setNewCatDesc(e.target.value)}
                />
              </div>
              {newCatNom.trim() && (
                <div className="cat-preview">
                  <div className="cat-preview-label">Aperçu</div>
                  <div className="cat-preview-item">
                    <span className="cat-item-ico">{newCatIcone.trim() || '📦'}</span>
                    <div>
                      <div className="cat-preview-nom">{newCatNom.trim()}</div>
                      {newCatCoul && (
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: newCatCoul, marginTop: 4 }} />
                      )}
                    </div>
                  </div>
                </div>
              )}
              {catErreur && <div className="cat-erreur">{catErreur}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModalCat(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleAjouterCat}>
                ✅ Créer la catégorie
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Confirmer suppression catégorie */}
      {modalDelCat && (
        <div className="modal-overlay open" onClick={() => setModalDelCat(null)}>
          <div className="modal cat-modal cat-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="card-title">🗑️ Supprimer la catégorie</div>
              <button className="modal-close" onClick={() => setModalDelCat(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="cat-del-confirm">
                <div className="cat-del-ico">⚠️</div>
                <div>
                  <div className="cat-del-title">
                    Supprimer <strong>"{modalDelCat.nom}"</strong> ?
                  </div>
                  <div className="cat-del-desc">
                    Cette action supprimera aussi les{' '}
                    <strong>
                      {modalDelCat.subCategories?.length ?? 0} sous-catégorie
                      {(modalDelCat.subCategories?.length ?? 0) > 1 ? 's' : ''}
                    </strong>{' '}
                    associées. Cette action est irréversible.
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModalDelCat(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={() => handleSupprimerCat(modalDelCat)}>
                🗑️ Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          MODALES — SOUS-CATÉGORIES
          ════════════════════════════════════════════════════ */}

      {/* Modal : Ajouter une sous-catégorie */}
      {modalSub && (
        <div className="modal-overlay open" onClick={() => setModalSub(false)}>
          <div className="modal cat-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="card-title">➕ Nouvelle sous-catégorie</div>
                <div className="card-sub">Liée à une catégorie parente</div>
              </div>
              <button className="modal-close" onClick={() => setModalSub(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="mf">
                <label>Catégorie parente *</label>
                <select
                  className="sel" style={{ width: '100%' }}
                  value={newSubCatId}
                  onChange={e => { setNewSubCatId(e.target.value); setSubErreur(''); }}
                >
                  <option value="">Choisir une catégorie…</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.icone ?? '📁'} {c.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mf">
                <label>Nom de la sous-catégorie *</label>
                <input
                  className="input-field"
                  placeholder="Ex: Smartphones Android"
                  value={newSubNom}
                  onChange={e => handleSubNomChange(e.target.value)}
                  autoFocus
                />
              </div>
              {newSubSlug && (
                <div className="mf">
                  <label>Slug généré</label>
                  <input
                    className="input-field"
                    value={newSubSlug}
                    onChange={e => setNewSubSlug(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--blue)' }}
                  />
                </div>
              )}
              <div className="cat-modal-row">
                <div className="mf" style={{ flex: 1 }}>
                  <label>Icône (emoji)</label>
                  <input
                    className="input-field cat-icone-input"
                    placeholder="📱"
                    value={newSubIcone}
                    onChange={e => setNewSubIcone(e.target.value)}
                  />
                </div>
                <div className="mf" style={{ flex: 1 }}>
                  <label>Ordre d'affichage</label>
                  <input
                    className="input-field" type="number"
                    placeholder="1"
                    value={newSubOrdre} min={1}
                    onChange={e => setNewSubOrdre(e.target.value)}
                  />
                </div>
              </div>
              {subErreur && <div className="cat-erreur">{subErreur}</div>}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModalSub(false)}>Annuler</button>
              <button className="btn btn-sky" onClick={handleAjouterSub}>
                ✅ Créer la sous-catégorie
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Confirmer suppression sous-catégorie */}
      {modalDelSub && (
        <div className="modal-overlay open" onClick={() => setModalDelSub(null)}>
          <div className="modal cat-modal cat-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="card-title">🗑️ Supprimer la sous-catégorie</div>
              <button className="modal-close" onClick={() => setModalDelSub(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="cat-del-confirm">
                <div className="cat-del-ico">⚠️</div>
                <div>
                  <div className="cat-del-title">
                    Supprimer <strong>"{modalDelSub.nom}"</strong> ?
                  </div>
                  <div className="cat-del-desc">
                    Les produits associés conserveront leur catégorie principale.
                    Cette action est irréversible.
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModalDelSub(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={() => handleSupprimerSub(modalDelSub)}>
                🗑️ Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANTS
// ─────────────────────────────────────────────────────────────

function SettingGroup({ icon, iconBg, title, children }: {
  icon: string; iconBg: string; title: string; children: React.ReactNode;
}) {
  return (
    <div className="setting-group">
      <div className="sg-head">
        <div className="sg-icon" style={{ background: iconBg }}>{icon}</div>
        <div className="sg-title">{title}</div>
      </div>
      <div className="sg-body">{children}</div>
    </div>
  );
}

function SettingRow({ label, desc, children }: {
  label: string; desc?: string; children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-info">
        <div className="setting-label">{label}</div>
        {desc && <div className="setting-desc">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: {
  checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="toggle-track" />
      <div className="toggle-thumb" />
    </label>
  );
}