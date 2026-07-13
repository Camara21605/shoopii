/**
 * @file   CatalogueTab.tsx
 * @module settings/tabs
 *
 * Onglet 4 — Catalogue
 *
 * Ce fichier gère TOUTE la logique du catalogue d'entreprise :
 *   - Types d'entreprise (ex: Restaurant, Boutique, Pharmacie)
 *   - Catégories par type (ex: Fast-food, Gastronomique pour Restaurant)
 *   - Sous-catégories par catégorie (ex: Pizza, Burger pour Fast-food)
 *
 * Architecture :
 *   - Tout l'état local est ici (types, categories, modales, selects)
 *   - 6 modales gérées : créer type, supprimer type, créer cat,
 *     supprimer cat, créer sous-cat, supprimer sous-cat
 *   - Appels API directs via apiFetch (pas de prop callback)
 *
 * Props reçues du parent :
 *   - isActive : si l'onglet est visible → déclenche le chargement
 *   - toast    : pour les notifications
 */

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch, ApiError }                       from '../../../../shared/services/apiFetch';
import { IconPicker, ColorPicker, iconGroupsForType } from '../../components/EntityPickers';
import { toSlug }                                   from './utils';
import type { TypeLocal, CatLocal, SubLocal }       from './types';

/* ─────────────────────────────────────────────────────────────
 * PROPS
 * ─────────────────────────────────────────────────────────────
 */
interface Props {
  isActive: boolean;
  toast:    (msg: string, type?: 'success' | 'error' | 'info') => void;
}

/* ─────────────────────────────────────────────────────────────
 * SOUS-COMPOSANT : ModalConfirmDel
 * ─────────────────────────────────────────────────────────────
 * Boîte de dialogue de confirmation avant suppression.
 * Réutilisée pour types, catégories et sous-catégories.
 *
 * @param item      L'entité à supprimer (TypeLocal | CatLocal | SubLocal)
 * @param onCancel  Ferme la modale sans rien faire
 * @param onConfirm Déclenche la suppression
 */
function ModalConfirmDel({
  title,
  message,
  onCancel,
  onConfirm,
}: {
  title:     string;
  message:   string;
  onCancel:  () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <div className="modal-title">⚠️ {title}</div>
        </div>
        <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--txt-2)', lineHeight: 1.6 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '0 20px 20px', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel}>Annuler</button>
          <button className="btn btn-danger"    onClick={onConfirm}>Supprimer</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT PRINCIPAL
 * ─────────────────────────────────────────────────────────────
 */
export default function CatalogueTab({ isActive, toast }: Props) {

  /* ── État : Types d'entreprise ── */
  const [types,        setTypes]       = useState<TypeLocal[]>([]);
  const [typeLoading,  setTypeLoading] = useState(false);
  const [typeSelId,    setTypeSelId]   = useState('');       // type actuellement sélectionné

  /* ── État : Catégories du type sélectionné ── */
  const [categories,   setCategories]  = useState<CatLocal[]>([]);
  const [catLoading,   setCatLoading]  = useState(false);
  const [catSelId,     setCatSelId]    = useState('');       // catégorie sélectionnée

  /* ── Modales Types ── */
  const [modalType,    setModalType]    = useState(false);          // modale création type
  const [modalDelType, setModalDelType] = useState<TypeLocal | null>(null);  // modale suppression type

  // Champs du formulaire de création de type
  const [newTypeNom,   setNewTypeNom]   = useState('');
  const [newTypeSlug,  setNewTypeSlug]  = useState('');
  const [newTypeIcone, setNewTypeIcone] = useState('');
  const [newTypeCoul,  setNewTypeCoul]  = useState('');
  const [newTypeDesc,  setNewTypeDesc]  = useState('');
  const [newTypeOrdre, setNewTypeOrdre] = useState('');
  const [typeErreur,   setTypeErreur]   = useState('');

  /* ── Modales Catégories ── */
  const [modalCat,    setModalCat]     = useState(false);
  const [modalDelCat, setModalDelCat]  = useState<CatLocal | null>(null);

  const [newCatNom,   setNewCatNom]   = useState('');
  const [newCatSlug,  setNewCatSlug]  = useState('');
  const [newCatIcone, setNewCatIcone] = useState('');
  const [newCatCoul,  setNewCatCoul]  = useState('');
  const [newCatDesc,  setNewCatDesc]  = useState('');
  const [newCatOrdre, setNewCatOrdre] = useState('');
  const [catErreur,   setCatErreur]   = useState('');

  /* ── Modales Sous-catégories ── */
  const [modalSub,    setModalSub]    = useState(false);
  const [modalDelSub, setModalDelSub] = useState<SubLocal | null>(null);

  const [newSubNom,   setNewSubNom]   = useState('');
  const [newSubSlug,  setNewSubSlug]  = useState('');
  const [newSubCatId, setNewSubCatId] = useState('');
  const [newSubIcone, setNewSubIcone] = useState('');
  const [newSubOrdre, setNewSubOrdre] = useState('');
  const [subErreur,   setSubErreur]   = useState('');

  /* ══════════════════════════════════════════════════════════════
   * CHARGEMENTS API
   * ══════════════════════════════════════════════════════════════ */

  // Chargement des types quand l'onglet devient actif
  useEffect(() => {
    if (!isActive) return;
    setTypeLoading(true);
    apiFetch<TypeLocal[]>('/company-types')
      .then(data => setTypes(data ?? []))
      .catch(() => toast('Impossible de charger les types d\'entreprise.', 'error'))
      .finally(() => setTypeLoading(false));
  }, [isActive]);

  // Rechargement des catégories chaque fois qu'un type est sélectionné
  useEffect(() => {
    if (!typeSelId) { setCategories([]); setCatSelId(''); return; }
    setCatLoading(true);
    apiFetch<CatLocal[]>(`/company-types/${typeSelId}/categories`)
      .then(data => setCategories((data ?? []).map(c => ({ ...c, subCategories: c.subCategories ?? [] }))))
      .catch(() => toast('Impossible de charger les catégories.', 'error'))
      .finally(() => setCatLoading(false));
  }, [typeSelId]);

  /* ══════════════════════════════════════════════════════════════
   * HANDLERS TYPES
   * ══════════════════════════════════════════════════════════════ */

  // Auto-génère le slug au fur et à mesure que l'admin tape le nom
  const handleTypeNomChange = useCallback((val: string) => {
    setNewTypeNom(val);
    setNewTypeSlug(toSlug(val));
    setTypeErreur('');
  }, []);

  const handleAjouterType = async () => {
    if (!newTypeNom.trim()) { setTypeErreur('Le nom du type est obligatoire.'); return; }
    try {
      const created = await apiFetch<TypeLocal>('/company-types', {
        method: 'POST',
        body: {
          nom: newTypeNom.trim(),
          slug: newTypeSlug || toSlug(newTypeNom),
          icone: newTypeIcone.trim() || undefined,
          couleur: newTypeCoul.trim() || undefined,
          description: newTypeDesc.trim() || undefined,
          ordre: newTypeOrdre ? parseInt(newTypeOrdre) : undefined,
        },
      });
      // Ajoute le nouveau type en local sans recharger toute la liste
      setTypes(prev => [...prev, { ...created, nbCategories: 0, nbEntreprises: 0 }]);
      // Ferme la modale et réinitialise le formulaire
      setModalType(false);
      setNewTypeNom(''); setNewTypeSlug(''); setNewTypeIcone('');
      setNewTypeCoul(''); setNewTypeDesc(''); setNewTypeOrdre('');
      toast(`✅ Type "${created.nom}" créé`, 'success');
    } catch (err) {
      setTypeErreur(err instanceof ApiError ? err.message : 'Erreur réseau.');
    }
  };

  const handleSupprimerType = async (type: TypeLocal) => {
    try {
      const res = await apiFetch<{ message: string; catsMisesAJour: number }>(`/company-types/${type.id}`, { method: 'DELETE' });
      setTypes(prev => prev.filter(t => t.id !== type.id));
      // Désélectionne si le type supprimé était le type actif
      if (typeSelId === type.id) { setTypeSelId(''); setCategories([]); setCatSelId(''); }
      setModalDelType(null);
      toast(`🗑️ ${res.message}`, 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Erreur lors de la suppression.', 'error');
    }
  };

  /* ══════════════════════════════════════════════════════════════
   * HANDLERS CATÉGORIES
   * ══════════════════════════════════════════════════════════════ */

  const handleCatNomChange = useCallback((val: string) => {
    setNewCatNom(val); setNewCatSlug(toSlug(val)); setCatErreur('');
  }, []);

  const handleAjouterCat = async () => {
    if (!newCatNom.trim()) { setCatErreur('Le nom de la catégorie est obligatoire.'); return; }
    try {
      const created = await apiFetch<CatLocal>('/categories', {
        method: 'POST',
        body: {
          nom: newCatNom.trim(),
          slug: newCatSlug || toSlug(newCatNom),
          icone: newCatIcone.trim() || undefined,
          couleur: newCatCoul.trim() || undefined,
          description: newCatDesc.trim() || undefined,
          ordre: newCatOrdre ? parseInt(newCatOrdre) : undefined,
          companyTypeId: typeSelId || undefined,
        },
      });
      setCategories(prev => [...prev, { ...created, subCategories: created.subCategories ?? [] }]);
      // Met à jour le compteur du type parent
      setTypes(prev => prev.map(t => t.id === typeSelId ? { ...t, nbCategories: t.nbCategories + 1 } : t));
      setModalCat(false);
      setNewCatNom(''); setNewCatSlug(''); setNewCatIcone('');
      setNewCatCoul(''); setNewCatDesc(''); setNewCatOrdre('');
      toast(`✅ Catégorie "${created.nom}" créée`, 'success');
    } catch (err) {
      setCatErreur(err instanceof ApiError ? err.message : 'Erreur réseau.');
    }
  };

  const handleSupprimerCat = async (cat: CatLocal) => {
    try {
      await apiFetch(`/categories/${cat.id}`, { method: 'DELETE' });
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      if (catSelId === cat.id) setCatSelId('');
      setTypes(prev => prev.map(t => t.id === typeSelId ? { ...t, nbCategories: Math.max(0, t.nbCategories - 1) } : t));
      setModalDelCat(null);
      toast(`🗑️ Catégorie "${cat.nom}" supprimée`, 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Erreur lors de la suppression.', 'error');
    }
  };

  /* ══════════════════════════════════════════════════════════════
   * HANDLERS SOUS-CATÉGORIES
   * ══════════════════════════════════════════════════════════════ */

  const handleSubNomChange = useCallback((val: string) => {
    setNewSubNom(val); setNewSubSlug(toSlug(val)); setSubErreur('');
  }, []);

  const handleAjouterSub = async () => {
    const catId = newSubCatId || catSelId;
    if (!newSubNom.trim()) { setSubErreur('Le nom est obligatoire.'); return; }
    if (!catId)            { setSubErreur('Choisissez une catégorie parente.'); return; }
    try {
      const created = await apiFetch<SubLocal>('/sub-categories', {
        method: 'POST',
        body: {
          nom: newSubNom.trim(),
          slug: newSubSlug || toSlug(newSubNom),
          categoryId: catId,
          icone: newSubIcone.trim() || undefined,
          ordre: newSubOrdre ? parseInt(newSubOrdre) : undefined,
        },
      });
      // Injecte la nouvelle sous-catégorie dans la catégorie parente (optimistic update)
      setCategories(prev => prev.map(c =>
        c.id === catId ? { ...c, subCategories: [...(c.subCategories ?? []), created] } : c,
      ));
      setModalSub(false);
      setNewSubNom(''); setNewSubSlug(''); setNewSubIcone('');
      setNewSubOrdre(''); setNewSubCatId('');
      toast(`✅ Sous-catégorie "${created.nom}" créée`, 'success');
    } catch (err) {
      setSubErreur(err instanceof ApiError ? err.message : 'Erreur réseau.');
    }
  };

  const handleSupprimerSub = async (sub: SubLocal) => {
    try {
      await apiFetch(`/sub-categories/${sub.id}`, { method: 'DELETE' });
      setCategories(prev => prev.map(c =>
        c.id === sub.categoryId ? { ...c, subCategories: c.subCategories.filter(s => s.id !== sub.id) } : c,
      ));
      setModalDelSub(null);
      toast(`🗑️ Sous-catégorie "${sub.nom}" supprimée`, 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Erreur lors de la suppression.', 'error');
    }
  };

  /* ──── Dérivés ────────────────────────────────────────────── */
  const typeActive  = types.find(t => t.id === typeSelId) ?? null;
  const catActive   = categories.find(c => c.id === catSelId) ?? null;
  const totalSubs   = categories.reduce((acc, c) => acc + (c.subCategories?.length ?? 0), 0);

  /* ══════════════════════════════════════════════════════════════
   * RENDU
   * ══════════════════════════════════════════════════════════════ */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── BARRE DE STATISTIQUES CATALOGUE ── */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap',
        background: 'var(--gold-dim)',
        border: '1px solid rgba(251,191,36,.2)',
        borderRadius: 12, padding: '12px 18px',
      }}>
        {[
          { label: 'Types d\'entreprise', value: types.length,      icon: '🏷️' },
          { label: 'Catégories',          value: categories.length, icon: '📂' },
          { label: 'Sous-catégories',     value: totalSubs,         icon: '📁' },
        ].map(stat => (
          <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 20, borderRight: '1px solid rgba(251,191,36,.2)' }}>
            <span style={{ fontSize: 18 }}>{stat.icon}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)', fontFamily: 'var(--font-m)' }}>{stat.value}</div>
              <div style={{ fontSize: 10, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── PANNEAU TYPES D'ENTREPRISE ── */}
      <div className="setting-group">
        <div className="sg-head" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="sg-icon" style={{ background: 'var(--gold-dim)' }}>🏷️</div>
            <div className="sg-title">Types d'entreprise</div>
          </div>
          {/* Bouton créer un nouveau type */}
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setModalType(true)}>
            + Nouveau type
          </button>
        </div>

        {typeLoading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--txt-3)' }}>Chargement…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, padding: '12px 16px' }}>
            {types.map(type => (
              <div
                key={type.id}
                onClick={() => setTypeSelId(typeSelId === type.id ? '' : type.id)}
                style={{
                  background: typeSelId === type.id ? `${type.couleur || 'var(--gold)'}15` : 'var(--raised)',
                  border: `1px solid ${typeSelId === type.id ? (type.couleur || 'var(--gold)') + '60' : 'var(--border)'}`,
                  borderRadius: 10, padding: '10px 14px',
                  cursor: 'pointer', transition: 'all .15s',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>{type.icone || '🏢'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--txt-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {type.nom}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 2 }}>
                    {type.nbCategories} cat. · {type.nbEntreprises} entreprise{type.nbEntreprises !== 1 ? 's' : ''}
                  </div>
                </div>
                {/* Bouton suppression — stopPropagation pour éviter la sélection */}
                <button
                  className="btn-ghost"
                  style={{ padding: '4px 6px', fontSize: 13, flexShrink: 0 }}
                  onClick={e => { e.stopPropagation(); setModalDelType(type); }}
                  title="Supprimer ce type"
                >
                  🗑️
                </button>
              </div>
            ))}
            {types.length === 0 && (
              <div style={{ color: 'var(--txt-3)', fontSize: 13, padding: 16 }}>
                Aucun type créé. Commencez par en ajouter un.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── PANNEAU CATÉGORIES (s'affiche seulement si un type est sélectionné) ── */}
      {typeSelId && (
        <div className="setting-group">
          <div className="sg-head" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="sg-icon" style={{ background: 'var(--sky-dim)' }}>📂</div>
              {/* Nom du type sélectionné dans le titre pour le contexte */}
              <div className="sg-title">Catégories — <em style={{ fontWeight: 400, fontSize: 13 }}>{typeActive?.nom}</em></div>
            </div>
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setModalCat(true)}>
              + Nouvelle catégorie
            </button>
          </div>

          {catLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--txt-3)' }}>Chargement…</div>
          ) : (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categories.map(cat => (
                <div key={cat.id}>
                  {/* Ligne catégorie cliquable (sélection) */}
                  <div
                    style={{
                      background: catSelId === cat.id ? `${cat.couleur || 'var(--sky)'}15` : 'var(--raised)',
                      border: `1px solid ${catSelId === cat.id ? (cat.couleur || 'var(--sky)') + '50' : 'var(--border)'}`,
                      borderRadius: 10, padding: '8px 14px',
                      cursor: 'pointer', transition: 'all .15s',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                    onClick={() => setCatSelId(catSelId === cat.id ? '' : cat.id)}
                  >
                    <span style={{ fontSize: 18 }}>{cat.icone || '📂'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--txt-1)' }}>{cat.nom}</div>
                      <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>
                        {(cat.subCategories ?? []).length} sous-catégorie{(cat.subCategories ?? []).length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <button
                      className="btn-ghost"
                      style={{ padding: '4px 6px', fontSize: 13 }}
                      onClick={e => { e.stopPropagation(); setModalDelCat(cat); }}
                      title="Supprimer la catégorie"
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Sous-catégories de cette catégorie (si sélectionnée) */}
                  {catSelId === cat.id && (
                    <div style={{ paddingLeft: 24, paddingTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(cat.subCategories ?? []).map(sub => (
                        <div
                          key={sub.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 8, padding: '4px 10px', fontSize: 11.5,
                          }}
                        >
                          <span>{sub.icone || '•'}</span>
                          <span style={{ color: 'var(--txt-1)', fontWeight: 600 }}>{sub.nom}</span>
                          <button
                            className="btn-ghost"
                            style={{ padding: '2px 4px', fontSize: 11 }}
                            onClick={() => setModalDelSub(sub)}
                            title="Supprimer"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {/* Bouton ajout sous-catégorie rapide */}
                      <button
                        className="btn-ghost"
                        style={{
                          fontSize: 11, padding: '4px 10px', borderRadius: 8,
                          border: '1px dashed var(--border)', color: 'var(--txt-3)',
                        }}
                        onClick={() => { setNewSubCatId(cat.id); setModalSub(true); }}
                      >
                        + sous-cat
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {categories.length === 0 && (
                <div style={{ color: 'var(--txt-3)', fontSize: 13, padding: 8 }}>
                  Aucune catégorie pour ce type. Ajoutez-en une.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── BOUTON AJOUTER SOUS-CATÉGORIE GLOBAL (si une cat est sélectionnée) ── */}
      {catSelId && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12 }}
            onClick={() => { setNewSubCatId(catSelId); setModalSub(true); }}
          >
            + Sous-catégorie dans "{catActive?.nom}"
          </button>
        </div>
      )}


      {/* ════════════════════════════════════════════════════════
          MODALES
          ════════════════════════════════════════════════════════ */}

      {/* ── MODALE : Créer un type d'entreprise ── */}
      {modalType && (
        <div className="modal-overlay" onClick={() => setModalType(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-head">
              <div className="modal-title">🏷️ Nouveau type d'entreprise</div>
              <button className="modal-close" onClick={() => setModalType(false)}>✕</button>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Nom — champ principal */}
              <div>
                <label className="form-label">Nom *</label>
                <input
                  className="input-field"
                  type="text"
                  value={newTypeNom}
                  onChange={e => handleTypeNomChange(e.target.value)}
                  placeholder="Ex: Pharmacie, Restaurant…"
                  autoFocus
                />
                {/* Slug auto-généré (lecture seule visuellement, modifiable) */}
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 4 }}>
                  Slug : <code style={{ fontFamily: 'var(--font-m)' }}>{newTypeSlug || '(généré automatiquement)'}</code>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="form-label">Description (optionnel)</label>
                <input
                  className="input-field"
                  type="text"
                  value={newTypeDesc}
                  onChange={e => setNewTypeDesc(e.target.value)}
                  placeholder="Description courte…"
                />
              </div>

              {/* Sélecteur d'icône */}
              <div>
                <label className="form-label">Icône</label>
                <IconPicker
                  value={newTypeIcone}
                  onChange={setNewTypeIcone}
                  groups={iconGroupsForType}
                />
              </div>

              {/* Sélecteur de couleur */}
              <div>
                <label className="form-label">Couleur</label>
                <ColorPicker value={newTypeCoul} onChange={setNewTypeCoul} />
              </div>

              {/* Ordre d'affichage */}
              <div>
                <label className="form-label">Ordre d'affichage (optionnel)</label>
                <input
                  className="input-field"
                  type="number"
                  value={newTypeOrdre}
                  onChange={e => setNewTypeOrdre(e.target.value)}
                  placeholder="0"
                  style={{ width: 100 }}
                />
              </div>

              {/* Erreur si présente */}
              {typeErreur && <div style={{ color: 'var(--rose)', fontSize: 12 }}>⚠️ {typeErreur}</div>}

            </div>

            <div style={{ display: 'flex', gap: 10, padding: '0 20px 20px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModalType(false)}>Annuler</button>
              <button className="btn btn-primary"   onClick={handleAjouterType}>Créer le type</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALE : Confirmer suppression type ── */}
      {modalDelType && (
        <ModalConfirmDel
          title="Supprimer le type"
          message={`Supprimer "${modalDelType.nom}" ? Les ${modalDelType.nbCategories} catégorie(s) associées seront désassignées. Cette action est irréversible.`}
          onCancel={() => setModalDelType(null)}
          onConfirm={() => handleSupprimerType(modalDelType)}
        />
      )}

      {/* ── MODALE : Créer une catégorie ── */}
      {modalCat && (
        <div className="modal-overlay" onClick={() => setModalCat(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-head">
              <div className="modal-title">📂 Nouvelle catégorie</div>
              <button className="modal-close" onClick={() => setModalCat(false)}>✕</button>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Type parent en lecture seule */}
              {typeActive && (
                <div style={{
                  background: 'var(--raised)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '8px 12px', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 8, color: 'var(--txt-2)',
                }}>
                  <span>{typeActive.icone || '🏢'}</span>
                  Type parent : <strong>{typeActive.nom}</strong>
                </div>
              )}

              <div>
                <label className="form-label">Nom *</label>
                <input
                  className="input-field"
                  type="text"
                  value={newCatNom}
                  onChange={e => handleCatNomChange(e.target.value)}
                  placeholder="Ex: Fast-food, Électronique…"
                  autoFocus
                />
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 4 }}>
                  Slug : <code style={{ fontFamily: 'var(--font-m)' }}>{newCatSlug || '(auto)'}</code>
                </div>
              </div>

              <div>
                <label className="form-label">Description (optionnel)</label>
                <input className="input-field" type="text" value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} placeholder="…" />
              </div>

              <div>
                <label className="form-label">Icône</label>
                <IconPicker value={newCatIcone} onChange={setNewCatIcone} groups={iconGroupsForType} />
              </div>

              <div>
                <label className="form-label">Couleur</label>
                <ColorPicker value={newCatCoul} onChange={setNewCatCoul} />
              </div>

              <div>
                <label className="form-label">Ordre (optionnel)</label>
                <input className="input-field" type="number" value={newCatOrdre} onChange={e => setNewCatOrdre(e.target.value)} placeholder="0" style={{ width: 100 }} />
              </div>

              {catErreur && <div style={{ color: 'var(--rose)', fontSize: 12 }}>⚠️ {catErreur}</div>}
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '0 20px 20px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModalCat(false)}>Annuler</button>
              <button className="btn btn-primary"   onClick={handleAjouterCat}>Créer la catégorie</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALE : Confirmer suppression catégorie ── */}
      {modalDelCat && (
        <ModalConfirmDel
          title="Supprimer la catégorie"
          message={`Supprimer la catégorie "${modalDelCat.nom}" et ses ${(modalDelCat.subCategories ?? []).length} sous-catégorie(s) ? Action irréversible.`}
          onCancel={() => setModalDelCat(null)}
          onConfirm={() => handleSupprimerCat(modalDelCat)}
        />
      )}

      {/* ── MODALE : Créer une sous-catégorie ── */}
      {modalSub && (
        <div className="modal-overlay" onClick={() => { setModalSub(false); setNewSubCatId(''); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <div className="modal-title">📁 Nouvelle sous-catégorie</div>
              <button className="modal-close" onClick={() => { setModalSub(false); setNewSubCatId(''); }}>✕</button>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Sélecteur de catégorie parente */}
              <div>
                <label className="form-label">Catégorie parente *</label>
                <select
                  className="sel"
                  value={newSubCatId || catSelId}
                  onChange={e => setNewSubCatId(e.target.value)}
                >
                  <option value="">-- Choisir --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Nom *</label>
                <input
                  className="input-field"
                  type="text"
                  value={newSubNom}
                  onChange={e => handleSubNomChange(e.target.value)}
                  placeholder="Ex: Pizza, Burger…"
                  autoFocus
                />
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 4 }}>
                  Slug : <code style={{ fontFamily: 'var(--font-m)' }}>{newSubSlug || '(auto)'}</code>
                </div>
              </div>

              <div>
                <label className="form-label">Icône (emoji optionnel)</label>
                <input className="input-field" type="text" value={newSubIcone} onChange={e => setNewSubIcone(e.target.value)} placeholder="🍕" style={{ width: 80 }} />
              </div>

              <div>
                <label className="form-label">Ordre (optionnel)</label>
                <input className="input-field" type="number" value={newSubOrdre} onChange={e => setNewSubOrdre(e.target.value)} placeholder="0" style={{ width: 100 }} />
              </div>

              {subErreur && <div style={{ color: 'var(--rose)', fontSize: 12 }}>⚠️ {subErreur}</div>}
            </div>

            <div style={{ display: 'flex', gap: 10, padding: '0 20px 20px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setModalSub(false); setNewSubCatId(''); }}>Annuler</button>
              <button className="btn btn-primary"   onClick={handleAjouterSub}>Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALE : Confirmer suppression sous-catégorie ── */}
      {modalDelSub && (
        <ModalConfirmDel
          title="Supprimer la sous-catégorie"
          message={`Supprimer "${modalDelSub.nom}" ? Cette action est irréversible.`}
          onCancel={() => setModalDelSub(null)}
          onConfirm={() => handleSupprimerSub(modalDelSub)}
        />
      )}

    </div>
  );
}
