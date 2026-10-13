/* ============================================================
 * FICHIER : src/shared/components/CompareFab.tsx
 *
 * RÔLE : Bouton flottant "⚖️ Comparer (N)" — seul point d'accès à
 *        la page /comparer. Sans lui, ajouter un produit à la
 *        comparaison via ProduitInfoSection n'aurait aucune suite
 *        visible tant qu'on ne connaît pas l'URL /comparer par cœur.
 *        Miroir de HelpFab.tsx (mêmes routes cachées, même adaptation
 *        mobile) mais positionné à GAUCHE pour ne jamais se superposer
 *        au "?" d'aide (droite).
 *
 *        TOUJOURS visible sur les pages publiques, même quand la
 *        comparaison est vide : c'est la porte d'entrée de la page
 *        /comparer (qui explique comment l'utiliser). Le badge n'apparaît
 *        que lorsqu'au moins un produit y est.
 * ============================================================ */
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCompare } from '../context/CompareContext';
import s from './CompareFab.module.css';

function shouldHide(pathname: string): boolean {
  const HIDDEN_PREFIXES = [
    '/dashboard/', '/support', '/aide', '/login', '/register',
    '/messagerie', '/comparer',
  ];
  return HIDDEN_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

export default function CompareFab() {
  const { count } = useCompare();
  const location = useLocation();
  const navigate  = useNavigate();
  const { t } = useTranslation();

  if (shouldHide(location.pathname)) return null;

  return (
    <button
      className={`${s.fab} ${count === 0 ? s.fabEmpty : ''}`}
      onClick={() => navigate('/comparer')}
      aria-label={count > 0 ? `${t('compare.titre')} (${count})` : t('compare.titre')}
      title={t('compare.titre')}
    >
      <i className="fas fa-code-compare" />
      <span className={s.label}>{t('compare.titre')}</span>
      {count > 0 && <span className={s.badge}>{count}</span>}
    </button>
  );
}
