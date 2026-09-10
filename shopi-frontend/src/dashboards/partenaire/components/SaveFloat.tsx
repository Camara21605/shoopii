/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/SaveFloat.tsx
 *
 * Barre flottante "Modifications non sauvegardées".
 * Apparaît dès qu'un champ est modifié (isDirty = true).
 * Le bouton "Sauvegarder" incrémente saveTrigger → section active réagit.
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import s from '../styles/SaveFloat.module.css';

interface Props {
  show:     boolean;   // afficher ou masquer la barre
  saving:   boolean;   // sauvegarde en cours
  onSave:   () => void;
  onCancel: () => void;
}

export default function SaveFloat({ show, saving, onSave, onCancel }: Props) {
  const { t } = useTranslation();
  return (
    <div className={`${s.float} ${show ? s.show : ''}`} role="status" aria-live="polite">
      <span className={s.msg}>
        <i className="fas fa-circle-dot" />
        {t('partenaireParametres.saveFloat.unsaved')}
      </span>

      <button className={s.btnSave} onClick={onSave} disabled={saving}>
        {saving
          ? <><i className="fas fa-spinner fa-spin" /> {t('partenaireParametres.saveFloat.saving')}</>
          : <><i className="fas fa-check" /> {t('partenaireParametres.saveFloat.save')}</>
        }
      </button>

      <button className={s.btnCancel} onClick={onCancel} disabled={saving}>
        {t('partenaireParametres.saveFloat.cancel')}
      </button>
    </div>
  );
}
