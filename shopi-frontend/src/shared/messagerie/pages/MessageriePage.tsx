/**
 * src/shared/messagerie/pages/MessageriePage.tsx
 *
 * Page wrapper de la messagerie pour le site public (/messagerie).
 * Affiche le Header principal + MessagerieCore sous-jacent.
 *
 * Utilisée par tous les rôles (client, livreur, vendeur…)
 * qui accèdent à /messagerie depuis le site home.
 */
import { useNavigate } from 'react-router-dom';
import Header         from '../../../modules/home/components/layout/Header';
import MessagerieCore from '../MessagerieCore';

export default function MessageriePage() {
  const navigate = useNavigate();

  return (
    <>
      {/* Header fixe 66px */}
      <Header
        onToast={() => {}}
        onLogin={() => navigate('/login')}
        onRegister={() => navigate('/register')}
      />

      {/* MessagerieCore positionné exactement sous le Header */}
      <div style={{
        paddingTop: 66,
        height:     '100vh',
        overflow:   'hidden',
        boxSizing:  'border-box',
      }}>
        <MessagerieCore />
      </div>
    </>
  );
}
