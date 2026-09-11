/* ============================================================
 * FICHIER : src/modules/auth/components/CompanyLocationSelect.tsx
 *
 * RÔLE : Localisation MANUELLE de l'entreprise à l'inscription —
 *        chaîne de sélection Pays → Région → Préfecture → Commune
 *        dans le référentiel géo existant (GET /geo/items?niveau=…),
 *        même mécanisme que SecZone.tsx (partenaire/livreur).
 *
 * POURQUOI PAS LocationPermission (GPS) ICI :
 *   L'adresse professionnelle d'une entreprise ne correspond pas
 *   forcément à l'endroit où la personne s'inscrit physiquement —
 *   demandé explicitement en remplacement de la détection GPS pour
 *   ce rôle uniquement (voir RegisterForm.tsx : renderStep4).
 *
 * SORTIE :
 *   "Ville" désigne une GeoPrefecture dans ce référentiel (convention
 *   déjà utilisée par Company.villeId — voir entreprise-profile.entity
 *   .ts et villesByIndicatif()) : le niveau Commune sélectionné n'est
 *   conservé qu'en texte libre (district), sa préfecture parente
 *   devient la référence structurée villeId.
 * ============================================================ */

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';

interface GeoItem { id: string; nom: string; code: string; parentId: string | null }

export interface CompanyLocationValue {
  paysId:        string;
  paysNom:       string;
  regionNom:     string;
  prefectureId:  string;
  prefectureNom: string;
  communeNom:    string;
}

interface Props {
  onComplete: (value: CompanyLocationValue) => void;
}

export default function CompanyLocationSelect({ onComplete }: Props) {
  const [pays,       setPays]       = useState<GeoItem[]>([]);
  const [regions,    setRegions]    = useState<GeoItem[]>([]);
  const [prefectures, setPrefectures] = useState<GeoItem[]>([]);
  const [communes,   setCommunes]   = useState<GeoItem[]>([]);
  const [loading,    setLoading]    = useState<'pays' | 'region' | 'prefecture' | 'commune' | null>('pays');

  const [paysId,       setPaysId]       = useState('');
  const [regionId,     setRegionId]     = useState('');
  const [prefectureId, setPrefectureId] = useState('');
  const [communeId,    setCommuneId]    = useState('');

  useEffect(() => {
    setLoading('pays');
    apiFetch<GeoItem[]>('/geo/items?niveau=pays')
      .then(d => setPays(d ?? []))
      .catch(() => setPays([]))
      .finally(() => setLoading(null));
  }, []);

  const loadNiveau = useCallback((
    niveau: 'region' | 'prefecture' | 'commune',
    parentId: string,
    setter: (items: GeoItem[]) => void,
  ) => {
    setLoading(niveau);
    apiFetch<GeoItem[]>(`/geo/items?niveau=${niveau}&parentId=${parentId}`)
      .then(d => setter(d ?? []))
      .catch(() => setter([]))
      .finally(() => setLoading(null));
  }, []);

  const handlePays = (id: string) => {
    setPaysId(id);
    setRegionId(''); setPrefectureId(''); setCommuneId('');
    setRegions([]); setPrefectures([]); setCommunes([]);
    if (id) loadNiveau('region', id, setRegions);
  };

  const handleRegion = (id: string) => {
    setRegionId(id);
    setPrefectureId(''); setCommuneId('');
    setPrefectures([]); setCommunes([]);
    if (id) loadNiveau('prefecture', id, setPrefectures);
  };

  const handlePrefecture = (id: string) => {
    setPrefectureId(id);
    setCommuneId('');
    setCommunes([]);
    if (id) loadNiveau('commune', id, setCommunes);
  };

  const handleCommune = (id: string) => {
    setCommuneId(id);
    if (!id) return;
    const p  = pays.find(x => x.id === paysId);
    const r  = regions.find(x => x.id === regionId);
    const pr = prefectures.find(x => x.id === prefectureId);
    const c  = communes.find(x => x.id === id);
    if (!p || !r || !pr || !c) return;
    onComplete({
      paysId:        p.id,  paysNom:       p.nom,
      regionNom:     r.nom,
      prefectureId:  pr.id, prefectureNom: pr.nom,
      communeNom:    c.nom,
    });
  };

  const selStyle: CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid var(--border, #e5e7eb)', background: '#fff',
    fontSize: 13, color: 'var(--navy)', appearance: 'none', cursor: 'pointer',
  };
  const wrapStyle: CSSProperties = { marginBottom: 10 };
  const lblStyle: CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--t2)', marginBottom: 5, display: 'block' };

  return (
    <div style={{
      background: 'var(--sky-2, #f0f4ff)', border: '1.5px solid var(--sky-3, #c7d9f8)',
      borderRadius: 14, padding: '18px', marginBottom: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <i className="fas fa-shop-lock" style={{ color: 'var(--blue,#1A4FC4)', fontSize: 15 }} />
        <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy)' }}>
          Localisation de votre entreprise
        </div>
      </div>

      <div style={wrapStyle}>
        <label style={lblStyle}>Pays *</label>
        <select style={selStyle} value={paysId} onChange={e => handlePays(e.target.value)} disabled={loading === 'pays'}>
          <option value="">{loading === 'pays' ? 'Chargement…' : '— Choisir un pays —'}</option>
          {pays.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
      </div>

      <div style={wrapStyle}>
        <label style={lblStyle}>Région *</label>
        <select style={selStyle} value={regionId} onChange={e => handleRegion(e.target.value)} disabled={!paysId || loading === 'region'}>
          <option value="">{loading === 'region' ? 'Chargement…' : '— Choisir une région —'}</option>
          {regions.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
        </select>
      </div>

      <div style={wrapStyle}>
        <label style={lblStyle}>Préfecture / Ville *</label>
        <select style={selStyle} value={prefectureId} onChange={e => handlePrefecture(e.target.value)} disabled={!regionId || loading === 'prefecture'}>
          <option value="">{loading === 'prefecture' ? 'Chargement…' : '— Choisir une préfecture —'}</option>
          {prefectures.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 0 }}>
        <label style={lblStyle}>Commune *</label>
        <select style={selStyle} value={communeId} onChange={e => handleCommune(e.target.value)} disabled={!prefectureId || loading === 'commune'}>
          <option value="">{loading === 'commune' ? 'Chargement…' : '— Choisir une commune —'}</option>
          {communes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>

      {communeId && (
        <div style={{
          marginTop: 12, padding: '8px 12px', background: '#fff',
          border: '1px solid var(--border,#e5e7eb)', borderRadius: 8,
          fontSize: 11.5, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <i className="fas fa-circle-check" style={{ color: '#047857', fontSize: 12 }} />
          Localisation confirmée
        </div>
      )}
    </div>
  );
}
