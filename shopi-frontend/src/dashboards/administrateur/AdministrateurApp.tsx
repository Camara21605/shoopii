import PortefeuilleStandalone from '../../shared/components/portefeuille/PortefeuilleStandalone';
import { NotificationProvider }   from '../../shared/notifications/NotificationContext';
import NotificationToastStack     from '../../shared/notifications/NotificationToastStack';

export default function AdministrateurApp() {
  return (
    <NotificationProvider>
      <NotificationToastStack />
      <div style={{ padding: 'var(--spacing-lg)' }}>
        <h1>Dashboard Administrateur</h1>
        <PortefeuilleStandalone />
      </div>
    </NotificationProvider>
  );
}
