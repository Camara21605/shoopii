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
  /** Quartier — optionnel (aucun quartier n'est peut-être répertorié pour cette commune) */
  quartierNom?:  string;
}

interface Props {
  onComplete: (value: CompanyLocationValue) => void;
}

export default function CompanyLocationSelect({ onComplete }: Props) {
  const [pays,       setPays]       = useState<GeoItem[]>([]);
  const [regions,    setRegions]    = useState<GeoItem[]>([]);
  const [prefectures, setPrefectures] = useState<GeoItem[]>([]);
  const [communes,   setCommunes]   = useState<GeoItem[]>([]);
  const [quartiers,  setQuartiers]  = useState<GeoItem[]>([]);
  const [loading,    setLoading]    = useState<'pays' | 'region' | 'prefecture' | 'commune' | 'quartier' | null>('pays');

  const [paysId,       setPaysId]       = useState('');
  const [regionId,     setRegionId]     = useState('');
  const [prefectureId, setPrefectureId] = useState('');
  const [communeId,    setCommuneId]    = useState('');
  const [quartierId,   setQuartierId]   = useState('');
  /* Quartier absent de la liste (ou aucune liste pour la commune) : saisi à la main, puis confirmé */
  const [quartierLibre, setQuartierLibre] = useState('');
  const [confirmed,     setConfirmed]     = useState(false);

  useEffect(() => {
    setLoading('pays');
    apiFetch<GeoItem[]>('/geo/items?niveau=pays')
      .then(d => setPays(d ?? []))
      .catch(() => setPays([]))
      .finally(() => setLoading(null));
  }, []);

  const loadNiveau = useCallback((
    niveau: 'region' | 'prefecture' | 'commune' | 'quartier',
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
    setPaysId(id); setConfirmed(false); setQuartierLibre('');
    setRegionId(''); setPrefectureId(''); setCommuneId(''); setQuartierId('');
    setRegions([]); setPrefectures([]); setCommunes([]); setQuartiers([]);
    if (id) loadNiveau('region', id, setRegions);
  };

  const handleRegion = (id: string) => {
    setRegionId(id); setConfirmed(false); setQuartierLibre('');
    setPrefectureId(''); setCommuneId(''); setQuartierId('');
    setPrefectures([]); setCommunes([]); setQuartiers([]);
    if (id) loadNiveau('prefecture', id, setPrefectures);
  };

  const handlePrefecture = (id: string) => {
    setPrefectureId(id); setConfirmed(false); setQuartierLibre('');
    setCommuneId(''); setQuartierId('');
    setCommunes([]); setQuartiers([]);
    if (id) loadNiveau('commune', id, setCommunes);
  };

  /* Remonte la localisation complète — le quartier est OBLIGATOIRE : choisi dans la liste
   * (`qId`) ou saisi à la main (`libre`, quartier non répertorié). */
  const emit = (cId: string, qId: string, libre = '') => {
    const p  = pays.find(x => x.id === paysId);
    const r  = regions.find(x => x.id === regionId);
    const pr = prefectures.find(x => x.id === prefectureId);
    const c  = communes.find(x => x.id === cId);
    if (!p || !r || !pr || !c) return;
    onComplete({
      paysId:        p.id,  paysNom:       p.nom,
      regionNom:     r.nom,
      prefectureId:  pr.id, prefectureNom: pr.nom,
      communeNom:    c.nom,
      quartierNom:   libre.trim() || quartiers.find(x => x.id === qId)?.nom,
    });
    setConfirmed(true);
  };

  const handleCommune = (id: string) => {
    setCommuneId(id);
    setQuartierId(''); setQuartierLibre(''); setConfirmed(false);
    setQuartiers([]);
    if (!id) return;
    /* On charge les quartiers de la commune ; le client doit voir où se trouve l'entreprise,
     * donc rien n'est confirmé tant que le quartier n'est pas identifié (liste ou saisie). */
    loadNiveau('quartier', id, setQuartiers);
  };

  const AUTRE = '__autre__';

  const handleQuartier = (id: string) => {
    setQuartierId(id);
    setConfirmed(false);
    if (id && id !== AUTRE) emit(communeId, id);
  };

  const confirmLibre = () => {
    if (quartierLibre.trim().length >= 2) emit(communeId, '', quartierLibre);
  };

  /* Saisie à la main : aucune liste pour cette commune, ou « Autre quartier » choisi */
  const manual = !!communeId && loading !== 'quartier' && (quartiers.length === 0 || quartierId === AUTRE);

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

      {communeId && (quartiers.length > 0 || loading === 'quartier') && (
        <div style={{ marginTop: 10 }}>
          <label style={lblStyle}>Votre quartier * <span style={{ fontWeight: 400, color: 'var(--t3)' }}>— les clients le verront sur votre profil et la carte</span></label>
          <select style={selStyle} value={quartierId} onChange={e => handleQuartier(e.target.value)} disabled={loading === 'quartier'}>
            <option value="">{loading === 'quartier' ? 'Chargement…' : '— Choisir votre quartier —'}</option>
            {quartiers.map(q => <option key={q.id} value={q.id}>{q.nom}</option>)}
            <option value={AUTRE}>Autre quartier (non listé)…</option>
          </select>
        </div>
      )}

      {manual && (
        <div style={{ marginTop: 10 }}>
          <label style={lblStyle}>
            {quartiers.length === 0 ? 'Votre quartier *' : 'Nom de votre quartier *'}
            {quartiers.length === 0 && <span style={{ fontWeight: 400, color: 'var(--t3)' }}> — aucun quartier n'est encore répertorié pour cette commune</span>}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text" maxLength={100} value={quartierLibre}
              placeholder="Ex : Boussoura, Almamya, Madina…"
              onChange={e => { setQuartierLibre(e.target.value); setConfirmed(false); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmLibre(); } }}
              style={{ ...selStyle, cursor: 'text', flex: 1 }}
            />
            <button type="button" onClick={confirmLibre} disabled={quartierLibre.trim().length < 2}
              style={{
                padding: '0 16px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13,
                background: quartierLibre.trim().length < 2 ? '#cbd5e1' : 'var(--blue,#1A4FC4)', color: '#fff',
                cursor: quartierLibre.trim().length < 2 ? 'not-allowed' : 'pointer',
              }}>
              Confirmer
            </button>
          </div>
        </div>
      )}

      {confirmed && (
        <div style={{
          marginTop: 12, padding: '8px 12px', background: '#fff',
          border: '1px solid var(--border,#e5e7eb)', borderRadius: 8,
          fontSize: 11.5, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <i className="fas fa-circle-check" style={{ color: '#047857', fontSize: 12 }} />
          Localisation confirmée — quartier identifié
        </div>
      )}
    </div>
  );
}
