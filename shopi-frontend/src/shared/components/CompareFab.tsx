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

  if (count === 0 || shouldHide(location.pathname)) return null;

  return (
    <button className={s.fab} onClick={() => navigate('/comparer')}>
      <i className="fas fa-code-compare" />
      <span>{t('compare.titre')}</span>
      <span className={s.badge}>{count}</span>
    </button>
  );
}
