/* ================================================================
 * FICHIER : src/modules/home/components/explorer/pages/ExplorerPage.tsx
 *
 * RÔLE : Page publique "/explorer" — même wrapper Header/toast que
 *        BoutiquesPage.tsx et OffresPage.tsx (pas de Footer, comme
 *        ces deux pages). Le contenu réel (recherche, filtres,
 *        sections intelligentes, grille) vit dans ExplorerSection.tsx,
 *        réutilisé tel quel.
 *
 * ROUTE : /explorer (voir app/router.tsx)
 * ================================================================ */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Header from '../../layout/Header';
import ExplorerSection from '../ExplorerSection';

import styles from './ExplorerPage.module.css';

interface ToastState { msg: string; type: 's' | 'i' | 'w' | 'e' }

export default function ExplorerPage() {
  const navigate = useNavigate();

  const [toast, setToast] = useState<ToastState | null>(null);
  const onToast = (msg: string, type: 's' | 'i' | 'w' | 'e' = 'i') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className={styles.page}>
      <Header
        onToast={onToast}
        onLogin={() => navigate('/login')}
        onRegister={() => navigate('/register')}
      />

      <div className={styles.body}>
        <ExplorerSection onToast={onToast} />
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
