/* ================================================================
 * FICHIER : src/modules/home/components/notifications/pages/NotificationsPage.tsx
 *
 * RÔLE : Page publique "/notifications" — enveloppe le Header du site
 *        autour du contenu partagé (shared/notifications/NotificationsPage),
 *        réutilisé tel quel dans chaque dashboard interne. Remplace le
 *        dropdown de la cloche comme destination principale ("Voir tout").
 *
 * ROUTE : /notifications (voir app/router.tsx) — protégée (PrivateRoute)
 * ================================================================ */

import { useNavigate } from 'react-router-dom';
import Header from '../../layout/Header';
import { NotificationProvider } from '../../../../../shared/notifications/NotificationContext';
import SharedNotificationsPage from '../../../../../shared/notifications/NotificationsPage';
import styles from './NotificationsPage.module.css';

export default function NotificationsPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <Header
        onToast={() => {}}
        onLogin={() => navigate('/login')}
        onRegister={() => navigate('/register')}
      />
      {/* Header instancie déjà son propre NotificationProvider en interne
       * (pour sa cloche) — celui-ci est un second contexte indépendant,
       * scopé uniquement au contenu de cette page (useNotifications() n'est
       * utilisé nulle part ailleurs sur le site public en dehors de Header). */}
      <NotificationProvider>
        <SharedNotificationsPage />
      </NotificationProvider>
    </div>
  );
}
