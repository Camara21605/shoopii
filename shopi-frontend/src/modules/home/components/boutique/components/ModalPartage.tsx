/*
 * ============================================================
 * FICHIER : src/modules/home/components/boutique/components/ModalPartage.tsx
 *
 * RÔLE    : Modale de partage de la boutique sur les réseaux sociaux.
 *           Réutilisable pour une boutique ou un produit.
 *
 * PROPS :
 *   url      → URL à partager
 *   titre    → Titre affiché dans la modale
 *   onClose  → Ferme la modale
 *   onToast  → Affiche un message de confirmation
 * ============================================================
 */
import { useTranslation } from 'react-i18next';
import { RESEAUX_PARTAGE } from '../data/boutiqueMockData';
import styles from '../styles/ModalPartage.module.css';

interface Props {
  url:     string;
  titre:   string;
  onClose: () => void;
  onToast: (m: string) => void;
}

export default function ModalPartage({ url, titre, onClose, onToast }: Props) {
  const { t } = useTranslation();

  /* ── Gestion du partage par réseau ── */
  function handleReseau(label: string) {
    if (label === 'Copier') {
      navigator.clipboard.writeText(url).catch(() => {});
      onToast(t('boutiqueDetail.modalPartage.lienCopiePresseToast'));
      return;
    }
    if (label === 'Instagram') {
      navigator.clipboard.writeText(url).catch(() => {});
      onToast(t('boutiqueDetail.modalPartage.instagramCopieToast'));
      return;
    }
    const LIENS: Record<string, string> = {
      WhatsApp: `https://wa.me/?text=${encodeURIComponent(url)}`,
      Facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      X:        `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`,
      Email:    `mailto:?subject=${encodeURIComponent(t('boutiqueDetail.modalPartage.emailSujet'))}&body=${encodeURIComponent(url)}`,
    };
    if (LIENS[label]) window.open(LIENS[label], '_blank', 'noopener,noreferrer');
    onToast(t('boutiqueDetail.modalPartage.partageVia', { label }));
  }

  /* ── Libellé affiché : "Copier" reste la clé interne (comparaisons ci-dessus),
   *    seul l'affichage est traduit ── */
  function displayLabel(label: string): string {
    return label === 'Copier' ? t('boutiqueDetail.modalPartage.copier') : label;
  }

  return (
    /* Overlay sombre — clic dessus ferme la modale */
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.box} onClick={e => e.stopPropagation()}>

        {/* En-tête */}
        <div className={styles.hd}>
          <h3 className={styles.hdTitle}>{titre}</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('boutiqueDetail.modalPartage.fermer')}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Grille des réseaux sociaux */}
        <div className={styles.grid}>
          {RESEAUX_PARTAGE.map(r => (
            <button
              key={r.label}
              className={styles.btn}
              onClick={() => handleReseau(r.label)}
              title={displayLabel(r.label)}
            >
              {/* Icône dans un rond coloré */}
              <div
                className={styles.btnIco}
                style={{ background: `${r.color}18`, border: `1.5px solid ${r.color}35` }}
              >
                <i className={r.icon} style={{ color: r.color }} />
              </div>
              <span className={styles.btnLabel}>{displayLabel(r.label)}</span>
            </button>
          ))}
        </div>

        {/* Lien copiable */}
        <div className={styles.lienRow}>
          <span className={styles.lienUrl}>{url}</span>
          <button
            className={styles.lienBtn}
            onClick={() => { navigator.clipboard.writeText(url).catch(() => {}); onToast(t('boutiqueDetail.modalPartage.lienCopieToast')); }}
          >
            <i className="fas fa-copy" /> {t('boutiqueDetail.modalPartage.copier')}
          </button>
        </div>
      </div>
    </div>
  );
}
