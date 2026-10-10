/* ============================================================
 * FICHIER : src/modules/auth/components/QuartierSelect.tsx
 *
 * RÔLE : choix du QUARTIER à l'inscription dans le référentiel géo
 *        renseigné par le super-admin (GET /geo/items) — plus de
 *        saisie libre pour livreur / partenaire / correspondant.
 *
 *        Chaîne : Préfecture / Ville → Commune → Quartier.
 *        Chaque liste est triée et recherchable (SearchableSelect).
 *
 * PRÉREMPLISSAGE :
 *   La ville et la commune détectées par le GPS / la carte
 *   (LocationPermission) sont reprises automatiquement quand elles
 *   existent dans le référentiel (comparaison sans accents ni casse) :
 *   l'utilisateur n'a souvent plus qu'à choisir son quartier.
 *
 * REPLI :
 *   Si le super-admin n'a encore répertorié AUCUN quartier pour la
 *   commune choisie, une saisie manuelle (à confirmer) est proposée —
 *   sinon l'inscription serait bloquée. Dès qu'une liste existe, seul
 *   un quartier de la liste est accepté (contrôlé aussi côté backend,
 *   voir AuthService.resolveRegisterQuartier).
 * ============================================================ */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';
import SearchableSelect from '../../../shared/components/ui/SearchableSelect';

interface GeoItem { id: string; nom: string; parentId: string | null }

export interface QuartierValue {
  villeNom:    string;
  communeNom:  string;
  quartierNom: string;
}

interface Props {
  /** Ville détectée (GPS, carte…) — présélectionnée si elle existe dans le référentiel. */
  defaultVille?:   string;
  /** Commune détectée — présélectionnée si elle existe dans la ville choisie. */
  defaultCommune?: string;
  onComplete: (value: QuartierValue) => void;
  /** Appelé dès que la sélection redevient incomplète. */
  onReset:    () => void;
  error?:     string;
  title?:     string;
}

const norm = (s?: string | null) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export default function QuartierSelect({
  defaultVille, defaultCommune, onComplete, onReset, error,
  title = 'Votre quartier',
}: Props) {
  const [villes,    setVilles]    = useState<GeoItem[]>([]);
  const [communes,  setCommunes]  = useState<GeoItem[]>([]);
  const [quartiers, setQuartiers] = useState<GeoItem[]>([]);
  const [loading,   setLoading]   = useState<'ville' | 'commune' | 'quartier' | null>('ville');

  const [villeId,    setVilleId]    = useState('');
  const [communeId,  setCommuneId]  = useState('');
  const [quartierId, setQuartierId] = useState('');
  const [libre,      setLibre]      = useState('');
  const [confirmed,  setConfirmed]  = useState(false);

  /* Valeurs détectées, lues une seule fois (le parent réécrit city/district
   * à partir de ce composant : il ne faut pas réagir à nos propres sorties). */
  const defaults = useRef({ ville: norm(defaultVille), commune: norm(defaultCommune) });

  const load = (niveau: 'commune' | 'quartier', parentId: string) =>
    apiFetch<GeoItem[]>(`/geo/items?niveau=${niveau}&parentId=${parentId}`)
      .then(d => d ?? [])
      .catch(() => [] as GeoItem[]);

  /* ── Communes (+ présélection éventuelle de la commune détectée) ── */
  const selectVille = async (id: string, autoCommune = '') => {
    setVilleId(id); setCommuneId(''); setQuartierId(''); setLibre('');
    setCommunes([]); setQuartiers([]); setConfirmed(false); onReset();
    if (!id) return;
    setLoading('commune');
    const list = await load('commune', id);
    setCommunes(list);
    setLoading(null);
    const match = autoCommune && list.find(c => norm(c.nom) === autoCommune);
    if (match) void selectCommune(match.id);
  };

  /* ── Quartiers de la commune ── */
  const selectCommune = async (id: string) => {
    setCommuneId(id); setQuartierId(''); setLibre('');
    setQuartiers([]); setConfirmed(false); onReset();
    if (!id) return;
    setLoading('quartier');
    setQuartiers(await load('quartier', id));
    setLoading(null);
  };

  /* ── Chargement initial des villes (préfectures) ── */
  useEffect(() => {
    let cancelled = false;
    apiFetch<GeoItem[]>('/geo/items?niveau=prefecture')
      .then(d => {
        if (cancelled) return;
        const list = d ?? [];
        setVilles(list);
        setLoading(null);
        const { ville, commune } = defaults.current;
        const match = ville && list.find(v => norm(v.nom) === ville);
        if (match) void selectVille(match.id, commune);
      })
      .catch(() => { if (!cancelled) { setVilles([]); setLoading(null); } });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = (quartierNom: string) => {
    const v = villes.find(x => x.id === villeId);
    const c = communes.find(x => x.id === communeId);
    if (!v || !c || !quartierNom.trim()) return;
    onComplete({ villeNom: v.nom, communeNom: c.nom, quartierNom: quartierNom.trim() });
    setConfirmed(true);
  };

  const handleQuartier = (id: string) => {
    setQuartierId(id);
    setConfirmed(false);
    if (!id) { onReset(); return; }
    const q = quartiers.find(x => x.id === id);
    if (q) emit(q.nom);
  };

  const confirmLibre = () => { if (libre.trim().length >= 2) emit(libre); };

  /* Aucun quartier répertorié pour cette commune → saisie manuelle */
  const manual = !!communeId && loading !== 'quartier' && quartiers.length === 0;

  const fieldStyle: CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1.5px solid var(--border, #e5e7eb)', background: '#fff',
    fontSize: 13, color: 'var(--navy)', cursor: 'text',
  };
  const lblStyle: CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--t2)', marginBottom: 5, display: 'block' };

  return (
    <div style={{
      background: 'var(--sky-2, #f0f4ff)', border: '1.5px solid var(--sky-3, #c7d9f8)',
      borderRadius: 14, padding: 18, marginBottom: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <i className="fas fa-house-flag" style={{ color: 'var(--blue,#1A4FC4)', fontSize: 15 }} />
        <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--navy)' }}>{title}</div>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 11.5, color: 'var(--t3)' }}>
        Les clients verront ce quartier sur votre carte et votre profil.
      </p>

      <div style={{ marginBottom: 10 }}>
        <label style={lblStyle}>Préfecture / Ville *</label>
        <SearchableSelect
          icon="fa-city" inputStyle={fieldStyle}
          options={villes.map(v => ({ value: v.id, label: v.nom }))}
          value={villeId} onChange={id => void selectVille(id)}
          loading={loading === 'ville'}
          placeholder="Rechercher ou choisir votre ville…"
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={lblStyle}>Commune *</label>
        <SearchableSelect
          icon="fa-location-dot" inputStyle={fieldStyle}
          options={communes.map(c => ({ value: c.id, label: c.nom }))}
          value={communeId} onChange={id => void selectCommune(id)}
          disabled={!villeId} loading={loading === 'commune'}
          placeholder="Rechercher ou choisir votre commune…"
          disabledHint="Choisissez d'abord une ville"
        />
      </div>

      {!manual && (
        <div>
          <label style={lblStyle}>Quartier *</label>
          <SearchableSelect
            icon="fa-house-flag" inputStyle={fieldStyle}
            options={quartiers.map(q => ({ value: q.id, label: q.nom }))}
            value={quartierId} onChange={handleQuartier}
            disabled={!communeId} loading={loading === 'quartier'}
            placeholder="Rechercher ou choisir votre quartier…"
            disabledHint="Choisissez d'abord une commune"
          />
        </div>
      )}

      {manual && (
        <div>
          <label style={lblStyle}>
            Quartier *{' '}
            <span style={{ fontWeight: 400, color: 'var(--t3)' }}>
              — aucun quartier n'est encore répertorié pour cette commune
            </span>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text" maxLength={100} value={libre}
              placeholder="Nom de votre quartier"
              onChange={e => { setLibre(e.target.value); if (confirmed) { setConfirmed(false); onReset(); } }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmLibre(); } }}
              style={{ ...fieldStyle, flex: 1 }}
            />
            <button type="button" onClick={confirmLibre} disabled={libre.trim().length < 2}
              style={{
                padding: '0 16px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13,
                background: libre.trim().length < 2 ? '#cbd5e1' : 'var(--blue,#1A4FC4)', color: '#fff',
                cursor: libre.trim().length < 2 ? 'not-allowed' : 'pointer',
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
          Quartier enregistré
        </div>
      )}

      {error && !confirmed && (
        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--rose,red)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="fas fa-circle-exclamation" style={{ fontSize: 10 }} />
          {error}
        </p>
      )}
    </div>
  );
}
