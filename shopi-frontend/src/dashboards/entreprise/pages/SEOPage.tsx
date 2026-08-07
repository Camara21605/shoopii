/*
 * FICHIER: src/dashboards/entreprise/pages/SEOPage.tsx
 * Page SEO & Marketing — aucun moteur d'analyse SEO (score, mots-clés,
 * campagnes publicitaires) n'existe dans le backend. Plutôt que
 * d'afficher des chiffres inventés, cette page reste honnête sur
 * l'état de la fonctionnalité en attendant un vrai chantier dédié.
 */

import { useTranslation } from 'react-i18next';
import './SEOPage.css';

export default function SEOPage() {
  const { t } = useTranslation();
  return (
    <div className="page on" id="p-seo">
      <div className="card">
        <div className="ch">
          <div className="ch-t"><i className="fas fa-magnifying-glass-chart"></i> {t('seo.title')}</div>
        </div>
        <div className="cb" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--t3)' }}>
          <i className="fas fa-magnifying-glass-chart" style={{ fontSize: 32, opacity: .4, marginBottom: 14, display: 'block' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
            {t('seo.comingSoonTitle')}
          </div>
          <div style={{ fontSize: 13, maxWidth: 420, margin: '0 auto' }}>
            {t('seo.comingSoonSub')}
          </div>
        </div>
      </div>
    </div>
  );
}
