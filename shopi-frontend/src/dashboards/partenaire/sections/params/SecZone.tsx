/* ================================================================
 * FICHIER : sections/params/SecZone.tsx
 * Section "Zone d'activité" — ville, commune, quartiers ciblés.
 * API : onSave(dto) → PATCH /partenaire/parametres/zone
 *
 * BUG CORRIGÉ — ville/commune utilisaient des listes en dur (8 villes et
 * les 5 communes de Conakry codées dans ce fichier) totalement déconnectées
 * du référentiel géographique réel administré par le super-admin/admin
 * (/geo, voir GeoReferentielSection.tsx côté super-admin) : un partenaire
 * pouvait se voir proposer — ou même sauvegarder côté backend, avant
 * validation ajoutée dans ProfilPartenaireService.validateZoneGeo() — une
 * ville ou une commune qui n'existe pas dans ce référentiel. Les 3 champs
 * (ville, commune, quartiers) viennent maintenant exclusivement de
 * GET /geo/items?niveau=... (route publique), en cascade parent → enfant
 * via ?parentId=, et n'affichent donc plus que ce qu'un administrateur a
 * réellement configuré.
 * ================================================================ */

import { useState, useEffect } from 'react';
import s from '../../styles/ParamsShared.module.css';
import type { PartenaireData } from '../../hooks/usePartenaireParametres';
import { apiFetch } from '../../../../shared/services/apiFetch';

interface Props {
  data:        PartenaireData | null;
  saving:      boolean;
  dirty:       () => void;
  markClean:   () => void;
  saveTrigger: number;
  onSave:      (body: Partial<PartenaireData>) => Promise<void>;
  onToast:     (msg: string, type?: 's' | 'i' | 'w') => void;
}

interface GeoItem { id: string; nom: string; code: string; }

export default function SecZone({
  data, saving, dirty, markClean, saveTrigger, onSave, onToast
}: Props) {
  const [ville,     setVille]     = useState('');
  const [commune,   setCommune]   = useState('');
  const [quartiers, setQuartiers] = useState<string[]>([]);

  const [villes,          setVilles]          = useState<GeoItem[]>([]);
  const [villesLoading,   setVillesLoading]   = useState(true);
  const [communes,        setCommunes]        = useState<GeoItem[]>([]);
  const [communesLoading, setCommunesLoading] = useState(false);
  const [quartierOpts,      setQuartierOpts]      = useState<GeoItem[]>([]);
  const [quartierOptsLoading, setQuartierOptsLoading] = useState(false);

  /* ── Init depuis les données du partenaire ── */
  useEffect(() => {
    if (!data) return;
    setVille(data.ville ?? '');
    setCommune(data.commune ?? '');
    setQuartiers(data.zone ? data.zone.split(',').map(z => z.trim()).filter(Boolean) : []);
  }, [data]);

  /* ── Villes = préfectures actives du référentiel géo (niveau super-admin/admin) ── */
  useEffect(() => {
    let cancelled = false;
    setVillesLoading(true);
    apiFetch<GeoItem[]>('/geo/items?niveau=prefecture')
      .then(d  => { if (!cancelled) setVilles(d ?? []); })
      .catch(() => { if (!cancelled) setVilles([]); })
      .finally(() => { if (!cancelled) setVillesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /* ── Communes = enfants actifs de la ville sélectionnée ── */
  useEffect(() => {
    const v = villes.find(x => x.nom === ville);
    if (!v) { setCommunes([]); return; }
    let cancelled = false;
    setCommunesLoading(true);
    apiFetch<GeoItem[]>(`/geo/items?niveau=commune&parentId=${v.id}`)
      .then(d  => { if (!cancelled) setCommunes(d ?? []); })
      .catch(() => { if (!cancelled) setCommunes([]); })
      .finally(() => { if (!cancelled) setCommunesLoading(false); });
    return () => { cancelled = true; };
  }, [ville, villes]);

  /* ── Quartiers proposés = enfants actifs de la commune sélectionnée ── */
  useEffect(() => {
    const c = communes.find(x => x.nom === commune);
    if (!c) { setQuartierOpts([]); return; }
    let cancelled = false;
    setQuartierOptsLoading(true);
    apiFetch<GeoItem[]>(`/geo/items?niveau=quartier&parentId=${c.id}`)
      .then(d  => { if (!cancelled) setQuartierOpts(d ?? []); })
      .catch(() => { if (!cancelled) setQuartierOpts([]); })
      .finally(() => { if (!cancelled) setQuartierOptsLoading(false); });
    return () => { cancelled = true; };
  }, [commune, communes]);

  useEffect(() => {
    if (saveTrigger > 0) handleSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveTrigger]);

  function handleVilleChange(nom: string) {
    setVille(nom);
    setCommune('');
    setQuartiers([]);
    dirty();
  }

  function handleCommuneChange(nom: string) {
    setCommune(nom);
    setQuartiers([]);
    dirty();
  }

  function toggleQuartier(nom: string) {
    setQuartiers(prev => prev.includes(nom) ? prev.filter(q => q !== nom) : [...prev, nom]);
    dirty();
  }

  async function handleSave() {
    try {
      await onSave({ ville, commune, zone: quartiers.join(', ') });
      markClean();
      onToast("✅ Zone d'activité sauvegardée", 's');
    } catch (err: any) {
      onToast(err?.message ?? '❌ Erreur lors de la sauvegarde', 'w');
    }
  }

  return (
    <div className={s.fc}>
      <div className={s.fcHd}>
        <div>
          <div className={s.fcTtl}><i className="fas fa-location-dot" /> Zone d'activité</div>
          <div className={s.fcSub}>Les zones où vous recrutez des acteurs pour Shoneya.</div>
        </div>
      </div>
      <div className={s.fcBody}>
        <div className={s.grid2}>
          <div className={s.fg}>
            <label className={s.fl}>Ville principale</label>
            <select
              className={s.fin}
              value={ville}
              disabled={villesLoading}
              onChange={e => handleVilleChange(e.target.value)}
            >
              <option value="">— Sélectionner —</option>
              {villes.map(v => <option key={v.id} value={v.nom}>{v.nom}</option>)}
            </select>
            {villesLoading && <span className={s.hint}>Chargement…</span>}
            {!villesLoading && villes.length === 0 && (
              <span className={s.hint}>Aucune ville configurée par un administrateur pour le moment.</span>
            )}
          </div>
          <div className={s.fg}>
            <label className={s.fl}>Commune</label>
            <select
              className={s.fin}
              value={commune}
              onChange={e => handleCommuneChange(e.target.value)}
              disabled={!ville || communesLoading}
            >
              <option value="">— Sélectionner —</option>
              {communes.map(c => <option key={c.id} value={c.nom}>{c.nom}</option>)}
            </select>
            {ville && !communesLoading && communes.length === 0 && (
              <span className={s.hint}>Aucune commune configurée pour "{ville}".</span>
            )}
          </div>
        </div>
        <div className={s.fg} style={{ marginBottom: 0 }}>
          <label className={s.fl}>Quartiers / marchés ciblés</label>
          {!commune ? (
            <span className={s.hint}>Sélectionnez une commune pour voir ses quartiers.</span>
          ) : quartierOptsLoading ? (
            <span className={s.hint}>Chargement…</span>
          ) : quartierOpts.length === 0 ? (
            <span className={s.hint}>Aucun quartier configuré pour "{commune}".</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {quartierOpts.map(q => {
                const active = quartiers.includes(q.nom);
                return (
                  <button
                    type="button"
                    key={q.id}
                    onClick={() => toggleQuartier(q.nom)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--pill, 999px)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: `1.5px solid ${active ? 'var(--pri, #6C5CE7)' : 'var(--bdr)'}`,
                      background: active ? 'var(--pri, #6C5CE7)' : 'var(--white)',
                      color: active ? '#fff' : 'var(--t2)',
                    }}
                  >
                    {active && <i className="fas fa-check" style={{ marginRight: 5 }} />}
                    {q.nom}
                  </button>
                );
              })}
            </div>
          )}
          <span className={s.hint}>Aide Shoneya à vous proposer des prospects proches.</span>
        </div>
      </div>
    </div>
  );
}
