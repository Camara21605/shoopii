/* ================================================================
 * FICHIER : src/modules/auth/components/RegisterCategoriesStep.tsx
 *
 * Étape "Vos catégories" de l'inscription ENTREPRISE, juste après le choix
 * du type d'entreprise : affiche TOUTES les catégories de ce type ; l'entreprise
 * coche celles de son activité. Ce sont les seules catégories qu'elle pourra
 * ensuite utiliser pour ses produits / prestations (voir backend
 * common/utils/company-categories.util.ts).
 *
 * Liste chargée en ordre catalogue fixe (?tri=ordre) — pas de mélange
 * aléatoire propre aux visiteurs anonymes, ici on veut une liste stable.
 * ================================================================ */

import { useEffect, useState } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';
import { categoryName, typeName as formatTypeName } from '../../../shared/utils/catalogueCase';
import CatalogueIcon from '../../home/components/ui/CatalogueIcon';

interface CategoryOption {
  id:       string;
  nom:      string;
  icone:    string | null;
  imageUrl: string | null;
  actif:    boolean;
}

interface Props {
  typeId:        string;
  typeLabel?:    string;
  selectedIds:   string[];
  onChange:      (ids: string[]) => void;
  error?:        string;
}

export function RegisterCategoriesStep({ typeId, typeLabel, selectedIds, onChange, error }: Props) {
  const [cats,    setCats]    = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed,  setFailed]  = useState(false);
  const [nonce,   setNonce]   = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    apiFetch<CategoryOption[]>(`/company-types/${typeId}/categories?tri=ordre`, { public: true })
      .then(data => {
        if (!alive) return;
        const list = (data ?? []).filter(c => c.actif);
        setCats(list);
        // Retire une éventuelle sélection périmée (ex: retour arrière + autre type).
        const valid = new Set(list.map(c => c.id));
        if (selectedIds.some(id => !valid.has(id))) onChange(selectedIds.filter(id => valid.has(id)));
      })
      .catch(() => { if (alive) { setFailed(true); setCats([]); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId, nonce]);

  const selected = new Set(selectedIds);
  const allSelected = cats.length > 0 && cats.every(c => selected.has(c.id));

  const toggle = (id: string) => {
    onChange(selected.has(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };
  const toggleAll = () => onChange(allSelected ? [] : cats.map(c => c.id));

  return (
    <div className="fields">
      <div className="field-group">
        {typeLabel && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
            padding: '5px 12px', borderRadius: 999, background: 'var(--sky-2, #EEF3FD)',
            color: 'var(--blue)', fontSize: 11, fontWeight: 800, letterSpacing: '.4px',
          }}>
            <i className="fas fa-store" style={{ fontSize: 10 }} /> {formatTypeName(typeLabel)}
          </div>
        )}

        {loading && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            <i className="fas fa-circle-notch fa-spin" /> Chargement des catégories…
          </div>
        )}

        {!loading && failed && (
          <div style={{ padding: '18px 0', textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>
            Impossible de charger les catégories.{' '}
            <button type="button" onClick={() => setNonce(n => n + 1)}
              style={{ border: 'none', background: 'none', color: 'var(--blue)', fontWeight: 700, cursor: 'pointer' }}>
              Réessayer
            </button>
          </div>
        )}

        {!loading && !failed && cats.length === 0 && (
          <div style={{ padding: '18px 0', fontSize: 13, color: 'var(--t3)', lineHeight: 1.5 }}>
            Ce type d&apos;entreprise n&apos;a pas encore de catégorie disponible : le choix d&apos;au moins
            une catégorie est obligatoire. Revenez en arrière et choisissez un autre type d&apos;entreprise.
          </div>
        )}

        {!loading && cats.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
              <div className="field-label" style={{ margin: 0 }}>
                Choisissez vos catégories <span style={{ color: 'var(--rose,red)' }}>*</span>
              </div>
              <button type="button" onClick={toggleAll}
                style={{ border: 'none', background: 'none', color: 'var(--blue)', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 10,
              maxHeight: 'min(46vh, 360px)', overflowY: 'auto', padding: 2,
            }}>
              {cats.map(c => {
                const on = selected.has(c.id);
                return (
                  <button
                    key={c.id} type="button" role="checkbox" aria-checked={on}
                    onClick={() => toggle(c.id)}
                    style={{
                      position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      padding: '12px 6px 8px', borderRadius: 12, cursor: 'pointer', minWidth: 0,
                      border: `2px solid ${on ? 'var(--blue)' : 'var(--bdr2, #E2E8F0)'}`,
                      background: on ? 'var(--sky-2, #EEF3FD)' : 'var(--white, #fff)',
                    }}
                  >
                    {on && (
                      <span style={{
                        position: 'absolute', top: 5, right: 5, width: 18, height: 18, borderRadius: '50%',
                        background: 'var(--blue)', color: '#fff', fontSize: 9,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <i className="fas fa-check" />
                      </span>
                    )}
                    <span style={{
                      width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                      background: 'var(--g100, #F1F3F6)', fontSize: 20,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CatalogueIcon imageUrl={c.imageUrl} icone={c.icone} fallback="📁" />
                    </span>
                    <span style={{
                      width: '100%', textAlign: 'center', fontSize: 11.5, fontWeight: 700, lineHeight: 1.2,
                      color: 'var(--navy)', minHeight: '2.4em', overflowWrap: 'anywhere',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {categoryName(c.nom)}
                    </span>
                  </button>
                );
              })}
            </div>

            <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--t3)' }}>
              {selectedIds.length === 0
                ? 'Sélectionnez au moins une catégorie.'
                : `${selectedIds.length} catégorie${selectedIds.length > 1 ? 's' : ''} sélectionnée${selectedIds.length > 1 ? 's' : ''}`}
              {' '}— vous ne verrez que celles-ci pour vos produits et services (modifiable dans Paramètres).
            </p>
          </>
        )}

        {error && (
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--rose,red)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="fas fa-circle-exclamation" style={{ fontSize: 10 }} />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
