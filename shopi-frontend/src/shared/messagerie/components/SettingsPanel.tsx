/**
 * src/shared/messagerie/components/SettingsPanel.tsx
 *
 * "⋮ > Paramètres" — panneau latéral, MÊME présentation que le panneau
 * "Informations" (voir sections/InfoPanel.tsx et InfoPanel.module.css) :
 * colonne à droite sur desktop, plein écran glissant sur mobile — pas
 * une fenêtre modale centrée. Pensé pour accueillir d'autres réglages
 * plus tard sans changer l'emplacement où les utilisateurs vont les
 * chercher ; une seule entrée pour l'instant ("Ajouter un groupe").
 */
import { useTranslation } from 'react-i18next';
import s from '../styles/InfoPanel.module.css';

interface Props {
  onClose:    () => void;
  onAddGroup: () => void;
}

export default function SettingsPanel({ onClose, onAddGroup }: Props) {
  const { t } = useTranslation();

  return (
    <>
      {/* Même overlay mobile que InfoPanel (visible ≤1100px, referme au clic en dehors). */}
      <div className={s.backdrop} onClick={onClose} />
      <div className={s.panel}>
        <div className={s.hd}>
          <div className={s.hdTitle}>{t('messagerie.settingsPanel.titre')}</div>
          <button className={s.hdClose} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>

        <div className={s.section}>
          <div className={s.optionsWrap}>
            <button className={s.optionBtn} onClick={onAddGroup}>
              <i className="fas fa-user-group" />
              {t('messagerie.settingsPanel.ajouterGroupe')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
