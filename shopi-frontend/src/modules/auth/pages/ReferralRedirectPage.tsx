/* ================================================================
 * FICHIER : src/modules/auth/pages/ReferralRedirectPage.tsx
 *
 * Page publique /rejoindre/:slug — résout le lien de parrainage d'un
 * partenaire (voir SecParrainage.tsx côté dashboard partenaire).
 *
 * GET /public/rejoindre/:slug (PublicController.resolveReferral) :
 *   - incrémente Partner.referralClicks (clic réel compté une fois)
 *   - renvoie { valid: true, partnerName } si le slug existe et que le
 *     partenaire n'est pas suspendu, sinon 404
 *
 * Succès → redirige vers /login?ref=<slug> : Login.tsx (useReferralParam)
 * ouvre alors directement l'onglet Inscription et transmet le slug tel
 * quel au formulaire (AuthService.register() résout ensuite le
 * partnerId réel côté serveur — voir son commentaire pour le détail).
 * ================================================================ */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../../../shared/services/apiFetch';
import ShoneyaLogo from '../../../shared/components/ShoneyaLogo';

export default function ReferralRedirectPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate  = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setError("Lien de parrainage invalide."); return; }
    let cancelled = false;

    apiFetch<{ valid: true; partnerName: string }>(`/public/rejoindre/${encodeURIComponent(slug)}`, {
      public: true,
    })
      .then(() => {
        if (cancelled) return;
        navigate(`/login?ref=${encodeURIComponent(slug)}`, { replace: true });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof ApiError ? err.message : "Ce lien de parrainage est invalide ou a expiré.";
        setError(msg);
      });

    return () => { cancelled = true; };
  }, [slug, navigate]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
      textAlign: 'center', padding: 24,
    }}>
      <ShoneyaLogo size={40} />
      {error ? (
        <>
          <p style={{ color: 'var(--red, #d33)', maxWidth: 380 }}>{error}</p>
          <Link to="/register" style={{ color: 'var(--navy, #1a2b6b)', fontWeight: 700 }}>
            S'inscrire sans lien de parrainage
          </Link>
        </>
      ) : (
        <p>Redirection en cours…</p>
      )}
    </div>
  );
}
