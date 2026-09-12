/* ================================================================
 * FICHIER : typeEntreprise/pages/TypeEntreprisePage.tsx
 *
 * RÔLE : Page publique "/types/:id" — dédiée à UN type d'entreprise
 *        (ex. Restaurant, Pharmacie…). N'affiche QUE :
 *          - les catégories qui appartiennent à ce type
 *            (GET /company-types/:id/categories)
 *          - les produits d'entreprises de ce type
 *            (GET /public/produits?companyTypeId=…&categoryId=…)
 *        Déclenchée depuis TypeEntrepriseSection.tsx (clic sur une carte
 *        type d'entreprise sur la home).
 *
 * ROUTE : /types/:id (voir app/router.tsx)
 * ================================================================ */

import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Header from '../../layout/Header';
import CardProduit from '../../../cards/CardProduit';
import TypeCategoryFilterBar from '../components/TypeCategoryFilterBar';
import EntreprisesTypeBloc from '../components/EntreprisesTypeBloc';
import { useProduitsByType } from '../hooks/useProduitsByType';

import styles from './TypeEntreprisePage.module.css';

interface ToastState { msg: string; type: 's' | 'i' | 'w' | 'e' }

export default function TypeEntreprisePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id: typeId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get('categorie') ?? undefined;

  const [toast, setToast] = useState<ToastState | null>(null);
  const onToast = (msg: string, type: 's' | 'i' | 'w' | 'e' = 'i') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const {
    typeInfo, typeError, categories,
    produits, loading, error, total, hasMore, loadMore, reload,
  } = useProduitsByType(typeId, categoryId);

  const setCategoryId = (id: string | undefined) => {
    const params = new URLSearchParams(searchParams);
    if (id) params.set('categorie', id); else params.delete('categorie');
    setSearchParams(params);
  };

  return (
    <div className={styles.page}>
      <Header
        onToast={onToast}
        onLogin={() => navigate('/login')}
        onRegister={() => navigate('/register')}
      />

      <div className={styles.body}>

        {/* ── En-tête du type d'entreprise ── */}
        {typeInfo && (
          <div className={styles.hero} style={{ '--type-color': typeInfo.couleur ?? 'var(--blue)' } as React.CSSProperties}>
            <div className={styles.heroIco}>{typeInfo.icone ?? '🏢'}</div>
            <div>
              <div className={styles.heroTitle}>{typeInfo.nom}</div>
              <div className={styles.heroSub}>
                {total > 0
                  ? t('typeEntreprisePage.subtitleCount', { count: total })
                  : t('typeEntreprisePage.subtitleDefault')}
              </div>
            </div>
          </div>
        )}
        {typeError && !typeInfo && (
          <div className={styles.empty}>
            <i className="fas fa-triangle-exclamation" />
            <div className={styles.emptyTitle}>{t('typeEntreprisePage.typeErrorTitle')}</div>
            <div className={styles.emptyText}>{typeError}</div>
          </div>
        )}

        {/* ── Catégories de ce type — reste en haut, avant les entreprises ── */}
        <TypeCategoryFilterBar
          categories={categories}
          activeCategoryId={categoryId}
          onSelect={setCategoryId}
        />

        {/* ── Entreprises de ce type — même bloc/comportement que la
         * rangée "Entreprises" de la home (défilement horizontal, ordre
         * mélangé, blocs de 20), filtré sur ce type précis. ── */}
        {typeId && <EntreprisesTypeBloc typeId={typeId} onToast={onToast} />}

        <div className={styles.secRow}>
          <div>
            <div className={styles.secTitle}>{t('typeEntreprisePage.produits')}</div>
            <div className={styles.secSub}>
              {loading && produits.length === 0 ? t('typeEntreprisePage.loading') : t('typeEntreprisePage.resultCount', { count: total })}
            </div>
          </div>
        </div>

        {/* ── État chargement (première page) ── */}
        {loading && produits.length === 0 && (
          <div className={styles.pgrid}>
            {[...Array(8)].map((_, i) => <div key={i} className={styles.skeleton} />)}
          </div>
        )}

        {/* ── État erreur ── */}
        {error && !loading && produits.length === 0 && (
          <div className={styles.empty}>
            <i className="fas fa-triangle-exclamation" />
            <div className={styles.emptyTitle}>{t('typeEntreprisePage.errorTitle')}</div>
            <div className={styles.emptyText}>{error}</div>
            <button className={styles.retryBtn} onClick={reload}>
              <i className="fas fa-rotate-right" /> {t('typeEntreprisePage.retry')}
            </button>
          </div>
        )}

        {/* ── État vide ── */}
        {!loading && !error && produits.length === 0 && (
          <div className={styles.empty}>
            <i className="fas fa-box-open" />
            <div className={styles.emptyTitle}>{t('typeEntreprisePage.emptyTitle')}</div>
            <div className={styles.emptyText}>{t('typeEntreprisePage.emptyText')}</div>
          </div>
        )}

        {/* ── Grille produits ── */}
        {produits.length > 0 && (
          <div className={styles.pgrid}>
            {produits.map(p => <CardProduit key={p.id} p={p} onToast={onToast} />)}
          </div>
        )}

        {/* ── Charger plus ── */}
        {!error && hasMore && produits.length > 0 && (
          <div className={styles.loadMore}>
            <button className={styles.loadMoreBtn} onClick={loadMore} disabled={loading}>
              {loading
                ? <><i className="fas fa-spinner fa-spin" /> {t('typeEntreprisePage.loading')}</>
                : <><i className="fas fa-arrow-down" /> {t('typeEntreprisePage.loadMore')}</>}
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--btn, #111113)', color: '#fff', padding: '10px 20px',
          borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999,
          boxShadow: '0 4px 16px rgba(0,0,0,.2)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
