/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/BoutiqueCategoriesCard.tsx
 *
 * "Catégories de mon activité" — les catégories choisies à l'inscription
 * (parmi celles du type d'entreprise) ; ce sont les SEULES proposées pour
 * créer / modifier un produit ou une prestation. Modifiable ici.
 *
 * Backend : GET / PUT /dashboard/entreprise/parametres/boutique/categories
 * (voir BoutiqueParametresService.getMyCategories / updateMyCategories).
 * Retirer une catégorie encore utilisée par un produit/service est refusé
 * par le backend (message affiché tel quel).
 */

import { useCallback, useEffect, useState } from 'react';
import FormCard from '../../components/parametres/FormCard';
import s from '../../styles/parametres/ParametresPage.module.css';
import type { ToastType } from '../../types';
import { apiFetch, ApiError } from '../../../../shared/services/apiFetch';
import { categoryName } from '../../../../shared/utils/catalogueCase';
import CatalogueIcon from '../../../../modules/home/components/ui/CatalogueIcon';

const BASE = '/dashboard/entreprise/parametres/boutique/categories';

interface CategoryOption {
  id: string; nom: string; icone: string | null; imageUrl: string | null; couleur: string | null;
}
interface MyCategories {
  companyTypeId: string | null;
  usingFallback: boolean;
  selectedIds:   string[];
  available:     CategoryOption[];
}

interface Props {
  /** Type d'entreprise actuel — recharge la liste quand il change. */
  companyTypeId: string | null | undefined;
  onToast:       (m: string, t?: ToastType) => void;
}

export default function BoutiqueCategoriesCard({ companyTypeId, onToast }: Props) {
  const [info,     setInfo]     = useState<MyCategories | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<MyCategories>(BASE)
      .then(res => {
        setInfo(res);
        /* Sans sélection enregistrée (entreprise antérieure à la règle) toutes
         * les catégories du type sont utilisables : on les pré-coche, l'entreprise
         * n'a plus qu'à décocher puis enregistrer. */
        setSelected(res.usingFallback ? res.available.map(c => c.id) : res.selectedIds);
      })
      .catch(() => { setInfo(null); onToast('Impossible de charger vos catégories.', 'e'); })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load, companyTypeId]);

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  async function save() {
    setSaving(true);
    try {
      const res = await apiFetch<MyCategories>(BASE, { method: 'PUT', body: { categoryIds: selected } });
      setInfo(res);
      setSelected(res.selectedIds);
      onToast('✅ Catégories enregistrées', 's');
    } catch (e) {
      onToast(e instanceof ApiError ? e.message : 'Erreur lors de l\'enregistrement.', 'e');
    } finally {
      setSaving(false);
    }
  }

  const available = info?.available ?? [];
  const initial   = info ? (info.usingFallback ? available.map(c => c.id) : info.selectedIds) : [];
  const dirty     = info != null && (selected.length !== initial.length || selected.some(id => !initial.includes(id)))
                    || (info?.usingFallback === true);

  return (
    <FormCard
      title="Catégories de mon activité"
      icon="fa-layer-group"
      subtitle="Seules ces catégories sont proposées pour vos produits et services"
    >
      {loading && <div style={{ padding: 16, color: 'var(--t3)', fontSize: 13 }}>Chargement…</div>}

      {!loading && !companyTypeId && (
        <div style={{ padding: 8, fontSize: 13, color: 'var(--t3)' }}>
          Choisissez d&apos;abord votre type d&apos;entreprise ci-dessus, puis enregistrez.
        </div>
      )}

      {!loading && companyTypeId && available.length === 0 && (
        <div style={{ padding: 8, fontSize: 13, color: 'var(--t3)' }}>
          Ce type d&apos;entreprise n&apos;a pas encore de catégorie disponible.
        </div>
      )}

      {!loading && companyTypeId && available.length > 0 && (
        <>
          {info?.usingFallback && (
            <div className={s.hint} style={{ marginBottom: 10 }}>
              <i className="fas fa-circle-info" /> Vous n&apos;avez pas encore choisi vos catégories : toutes celles de votre
              type sont actuellement utilisables. Décochez celles qui ne concernent pas votre activité puis enregistrez.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 10 }}>
            {available.map(c => {
              const on = selected.includes(c.id);
              return (
                <button
                  key={c.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(c.id)}
                  style={{
                    position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '12px 6px 8px', borderRadius: 12, cursor: 'pointer', minWidth: 0,
                    border: `2px solid ${on ? 'var(--blue)' : 'var(--bdr2, #E2E8F0)'}`,
                    background: on ? 'var(--sky-2, #EEF3FD)' : 'transparent',
                  }}
                >
                  {on && (
                    <span style={{
                      position: 'absolute', top: 5, right: 5, width: 18, height: 18, borderRadius: '50%',
                      background: 'var(--blue)', color: '#fff', fontSize: 9,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><i className="fas fa-check" /></span>
                  )}
                  <span style={{
                    width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, fontSize: 20,
                    background: 'var(--g100, #F1F3F6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CatalogueIcon imageUrl={c.imageUrl} icone={c.icone} fallback="📁" />
                  </span>
                  <span style={{
                    width: '100%', textAlign: 'center', fontSize: 11.5, fontWeight: 700, lineHeight: 1.2,
                    minHeight: '2.4em', overflowWrap: 'anywhere', color: 'inherit',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>{categoryName(c.nom)}</span>
                </button>
              );
            })}
          </div>

          <div className={s.hint} style={{ marginTop: 10 }}>
            <i className="fas fa-circle-info" /> {selected.length} catégorie{selected.length > 1 ? 's' : ''} sélectionnée{selected.length > 1 ? 's' : ''}.
            Une catégorie encore utilisée par un produit ou un service ne peut pas être retirée.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button className={s.saveBtn} onClick={save} disabled={saving || selected.length === 0 || !dirty}>
              {saving ? 'Enregistrement…' : 'Enregistrer mes catégories'}
            </button>
          </div>
        </>
      )}
    </FormCard>
  );
}
