// src/dashboards/entreprise/sections/parametres/DangerSection.tsx
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props { onDirty: () => void; onToast: (m: string, t?: string) => void; }

export default function DangerSection({ onDirty, onToast }: Props) {
  const { t } = useTranslation();
  const ACTIONS = [
    { ttl:t('parametres.danger.actions.pause.ttl'), sub:t('parametres.danger.actions.pause.sub'), btn:t('parametres.danger.actions.pause.btn') },
    { ttl:t('parametres.danger.actions.disable.ttl'), sub:t('parametres.danger.actions.disable.sub'), btn:t('parametres.danger.actions.disable.btn') },
    { ttl:t('parametres.danger.actions.transfer.ttl'), sub:t('parametres.danger.actions.transfer.sub'), btn:t('parametres.danger.actions.transfer.btn') },
    { ttl:t('parametres.danger.actions.delete.ttl'), sub:t('parametres.danger.actions.delete.sub'), btn:t('parametres.danger.actions.delete.btn') },
  ];
  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-triangle-exclamation" style={{ color:'var(--red)' }} /> {t('parametres.danger.title')}</h1>
        <p>{t('parametres.danger.subtitle')}</p>
      </div>
      <FormCard title={t('parametres.danger.irreversiblesTitle')} icon="fa-skull-crossbones" subtitle={t('parametres.danger.irreversiblesSubtitle')} danger>
        {ACTIONS.map(a => (
          <div key={a.ttl} className={s.dangerRow}>
            <div>
              <div className={s.dangerTtl}>{a.ttl}</div>
              <div className={s.dangerSub}>{a.sub}</div>
            </div>
            <button className={s.dangerBtn} onClick={() => onToast(t('parametres.danger.confirmationRequise', { action: a.btn }), 'w')}>{a.btn}</button>
          </div>
        ))}
      </FormCard>
    </>
  );
}
