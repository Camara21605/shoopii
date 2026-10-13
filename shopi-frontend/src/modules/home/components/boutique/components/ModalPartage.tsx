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
 *   nom      → Nom de la boutique, repris dans le message partagé
 *   onClose  → Ferme la modale
 *   onToast  → Affiche un message de confirmation
 * ============================================================
 */
import { useTranslation } from 'react-i18next';
import { RESEAUX_PARTAGE } from '../data/boutiqueMockData';
import { copyText, shareTo, type ShareNetwork } from '../../../../../shared/utils/share';
import styles from '../styles/ModalPartage.module.css';

interface Props {
  url:     string;
  titre:   string;
  nom?:    string;
  onClose: () => void;
  onToast: (m: string) => void;
}

export default function ModalPartage({ url, titre, nom, onClose, onToast }: Props) {
  const { t } = useTranslation();

  /* ── Gestion du partage par réseau (voir shared/utils/share.ts) ── */
  async function handleReseau(label: string) {
    const sujet   = t('boutiqueDetail.modalPartage.emailSujet');
    const outcome = await shareTo(label as ShareNetwork, {
      url,
      title: nom || sujet,
      text:  nom ? `${sujet} : ${nom}` : sujet,
    });
    if (outcome === 'copied') {
      onToast(label === 'Instagram'
        ? t('boutiqueDetail.modalPartage.instagramCopieToast')
        : t('boutiqueDetail.modalPartage.lienCopiePresseToast'));
    } else if (outcome === 'textCopied') {
      onToast(t('boutiqueDetail.modalPartage.facebookTexteCopieToast'));
    } else if (outcome === 'opened') {
      onToast(t('boutiqueDetail.modalPartage.partageVia', { label }));
    }
  }

  async function handleCopier() {
    if (await copyText(url) === 'copied') onToast(t('boutiqueDetail.modalPartage.lienCopieToast'));
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
            onClick={handleCopier}
          >
            <i className="fas fa-copy" /> {t('boutiqueDetail.modalPartage.copier')}
          </button>
        </div>
      </div>
    </div>
  );
}
