import PortefeuilleStandalone from '../../shared/components/portefeuille/PortefeuilleStandalone';

export default function AdministrateurApp() {
  return (
    <div style={{ padding: 'var(--spacing-lg)' }}>
      <h1>Dashboard Administrateur</h1>
      <PortefeuilleStandalone />
    </div>
  )
}
