/* ================================================================
 * FICHIER : src/shared/components/AuthPromptModal.tsx
 *
 * Modal générique affiché quand un visiteur essaie d'utiliser une
 * fonctionnalité réservée aux clients (panier, favoris, suivre une
 * boutique/un livreur, message...) :
 *
 *   - variant "anonymous"  → visiteur non connecté
 *                            → propose "Se connecter" + "Créer un compte"
 *   - variant "wrong-role" → connecté mais avec un rôle non-client
 *                            (boutique, livreur, correspondant...)
 *                            → propose uniquement "Créer un compte client"
 *                              + rappelle le rôle actuel
 *
 * Reprend le style visuel du modal historique de Header.tsx pour
 * rester cohérent, mais factorisé pour être réutilisé partout
 * (cartes produit, boutique, livreur, correspondant...).
 * ================================================================ */

import { useNavigate } from 'react-router-dom';

interface AuthPromptModalProps {
  open:         boolean;
  onClose:      () => void;
  variant?:     'anonymous' | 'wrong-role';
  currentRole?: string | null;
  icon?:        string;
  title?:       string;
  /** Remplace la navigation par défaut vers /login (sinon navigate('/login')) */
  onLoginClick?:    () => void;
  /** Remplace la navigation par défaut vers /register (sinon navigate('/register')) */
  onRegisterClick?: () => void;
}

export default function AuthPromptModal({
  open,
  onClose,
  variant = 'anonymous',
  currentRole,
  icon = '🔒',
  title,
  onLoginClick,
  onRegisterClick,
}: AuthPromptModalProps) {
  const navigate = useNavigate();
  if (!open) return null;

  const goToLogin    = () => {
    console.log('[AuthPromptModal] goToLogin — onLoginClick=', typeof onLoginClick, onLoginClick);
    onClose();
    (onLoginClick ?? (() => navigate('/login')))();
    console.log('[AuthPromptModal] goToLogin — après appel');
  };
  const goToRegister = () => { onClose(); (onRegisterClick ?? (() => navigate('/register')))(); };

  const isWrongRole = variant === 'wrong-role';

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(11,31,58,.6)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(4px)' }}
      onClick={e => { e.stopPropagation(); onClose(); }}
    >
      <div
        style={{ background:'var(--white)', borderRadius:22, padding:32, maxWidth:420, width:'100%', boxShadow:'0 24px 64px rgba(11,31,58,.3)', textAlign:'center' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width:68, height:68, borderRadius:'50%', background:'linear-gradient(135deg,var(--blue,#1A4FC4),#5B8EF4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, margin:'0 auto 18px' }}>
          {icon}
        </div>

        <div style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:20, color:'var(--navy,#0B1F3A)', marginBottom:10 }}>
          {title ?? (isWrongRole ? 'Fonctionnalité réservée aux clients' : 'Connectez-vous pour continuer')}
        </div>

        <p style={{ fontSize:14, color:'var(--t2)', lineHeight:1.7, marginBottom:24 }}>
          Cette fonctionnalité est réservée aux <strong>comptes clients Shopi</strong>.<br />
          {isWrongRole
            ? 'Créez un compte client gratuit pour accéder à votre panier, vos commandes et vos messages.'
            : 'Connectez-vous ou créez un compte client gratuit pour accéder à votre panier, vos commandes et vos messages.'}
        </p>

        {isWrongRole && currentRole && (
          <div style={{ background:'rgba(26,79,196,.08)', border:'1px solid rgba(26,79,196,.2)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'var(--blue,#1A4FC4)', marginBottom:20, textAlign:'left' }}>
            💡 Vous avez un compte <strong>{currentRole}</strong>. Vous pouvez créer un compte client séparé avec une autre adresse email.
          </div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'center', flexDirection:'column' }}>
          {!isWrongRole && (
            <button
              onClick={goToLogin}
              style={{ background:'none', color:'var(--navy,#0B1F3A)', border:'1.5px solid var(--bdr2)', borderRadius:12, padding:'13px 24px', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
            >
              <i className="fas fa-right-to-bracket" /> Se connecter
            </button>
          )}
          <button
            onClick={goToRegister}
            style={{ background:'linear-gradient(135deg,var(--navy,#0B1F3A),var(--blue,#1A4FC4))', color:'#fff', border:'none', borderRadius:12, padding:'14px 24px', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
          >
            <i className="fas fa-user-plus" /> Créer mon compte client
          </button>
          <button
            onClick={onClose}
            style={{ background:'none', color:'var(--t3)', border:'1px solid var(--bdr2)', borderRadius:12, padding:'12px 24px', fontSize:13, fontWeight:600, cursor:'pointer' }}
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
