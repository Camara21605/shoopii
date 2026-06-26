import PortefeuilleStandalone from '../../shared/components/portefeuille/PortefeuilleStandalone';

export default function ClientApp() {
  return (
    <div style={{ padding: 'var(--spacing-lg)' }}>
      <h1>Dashboard Client</h1>
      <PortefeuilleStandalone />
    </div>
  )
}
