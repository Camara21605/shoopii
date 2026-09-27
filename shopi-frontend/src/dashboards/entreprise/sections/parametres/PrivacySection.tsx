/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/PrivacySection.tsx
 * Section 11 — Confidentialité
 *
 * BUG CORRIGÉ — 7 interrupteurs enregistrés mais lus nulle part. Ne restent que
 * les 3 réellement appliqués par le serveur (voir PrivacyParametresService) :
 *   - apparaître dans la recherche (recherche par nom + carte) ;
 *   - afficher le nombre de ventes sur la page boutique ;
 *   - accepter de nouveaux abonnés.
 * Chaque interrupteur s'enregistre aussitôt (seule la ligne touchée est envoyée).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';
import type { ToastType } from '../../types';

interface Props {
  data: ParametresData | null; saving: boolean;
  onDirty: () => void; onToast: (m: string, t?: ToastType) => void;
  savePrivacy: (b: Record<string, boolean>) => Promise<void>;
}

const KEYS = ['showInSearch', 'showSalesStats', 'allowFollow'] as const;
type Key = typeof KEYS[number];

export default function PrivacySection({ data, onToast, savePrivacy }: Props) {
  const { t } = useTranslation();
  /* Valeur affichée = celle du serveur (absente = activée), sauf pendant un
   * enregistrement où l'on montre déjà la nouvelle valeur (affichage optimiste). */
  const [override, setOverride] = useState<Partial<Record<Key, boolean>>>({});
  const [pending,  setPending]  = useState<Key | null>(null);
  const raw = data?.privacySettings as Record<string, boolean> | null | undefined;
  const valeur = (key: Key) => override[key] ?? (raw?.[key] !== false);
  const privacy = { showInSearch: valeur('showInSearch'), showSalesStats: valeur('showSalesStats'), allowFollow: valeur('allowFollow') };

  async function toggle(key: Key) {
    const v = !privacy[key];
    setOverride({ [key]: v });
    setPending(key);
    try {
      await savePrivacy({ [key]: v });          // met à jour data.privacySettings
      onToast(t('parametres.privacy.savedToast'), 's');
    } catch {
      onToast(t('parametres.privacy.errorToast'), 'e');
    } finally { setOverride({}); setPending(null); }
  }

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-eye-slash" /> {t('parametres.privacy.title')}</h1>
        <p>{t('parametres.privacy.subtitle')}</p>
      </div>

      <FormCard title={t('parametres.privacy.prefsTitle')} icon="fa-lock" subtitle={t('parametres.privacy.prefsSubtitle')}>
        {KEYS.map((key, idx) => (
          <div key={key} style={{
            display:'flex', alignItems:'center', gap:16, padding:'12px 0',
            borderBottom: idx < KEYS.length - 1 ? '1px solid var(--bdr)' : 'none',
          }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--navy)' }}>{t(`parametres.privacy.items.${key}.label`)}</div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{t(`parametres.privacy.effet.${key}.${privacy[key] ? 'on' : 'off'}`)}</div>
            </div>
            <button type="button" role="switch" aria-checked={privacy[key]} aria-label={t(`parametres.privacy.items.${key}.label`)}
              onClick={() => toggle(key)} disabled={pending === key}
              style={{ width:44, height:24, borderRadius:12, cursor:'pointer', flexShrink:0, border:'none', padding:0,
                background: privacy[key] ? 'var(--t2)' : 'var(--g300)', position:'relative', transition:'background .2s' }}>
              <span style={{ position:'absolute', top:3, width:18, height:18, borderRadius:'50%',
                background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)', left: privacy[key] ? 22 : 3 }} />
            </button>
          </div>
        ))}
      </FormCard>
    </>
  );
}
