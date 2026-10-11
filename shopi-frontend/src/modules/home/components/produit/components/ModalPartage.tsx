/*
 * FICHIER : src/modules/home/components/produit/components/ModalPartage.tsx
 * RÔLE    : Modale de partage du produit sur les réseaux sociaux.
 */
import { useTranslation } from 'react-i18next';
import { copyText, shareTo, type ShareNetwork } from '../../../../../shared/utils/share';
import styles from '../styles/ModalPartage.module.css';

/* nom → nom du produit/service, repris dans le message partagé. */
interface Props { url: string; titre: string; nom?: string; onClose: () => void; onToast: (m: string) => void; }

const RESEAUX: { icon: string; label: ShareNetwork; color: string }[] = [
  { icon:'fab fa-whatsapp',   label:'WhatsApp', color:'#25D366' },
  { icon:'fab fa-facebook-f', label:'Facebook', color:'#1877F2' },
  { icon:'fab fa-instagram',  label:'Instagram',color:'#E1306C' },
  { icon:'fab fa-x-twitter',  label:'X',        color:'#111' },
  { icon:'fas fa-envelope',   label:'Email',    color:'#6B7280' },
  { icon:'fas fa-link',       label:'Copier',   color:'#1A4FC4' },
];

export default function ModalPartage({ url, titre, nom, onClose, onToast }: Props) {
  const { t } = useTranslation();

  function displayLabel(label: string): string {
    return label === 'Copier' ? t('produitDetail.modalPartage.copier') : label;
  }

  /* Voir shared/utils/share.ts — le toast reflète ce qui s'est vraiment passé. */
  async function handle(label: ShareNetwork) {
    const outcome = await shareTo(label, { url, title: nom || titre, text: nom });
    if (outcome === 'copied') {
      onToast(label === 'Instagram' ? t('produitDetail.modalPartage.instagramCopieToast') : t('produitDetail.modalPartage.lienCopieToast'));
    } else if (outcome === 'opened') {
      onToast(t('produitDetail.modalPartage.partageVia', { label }));
    }
  }

  async function handleCopier() {
    if (await copyText(url) === 'copied') onToast(t('produitDetail.modalPartage.lienCopieToast'));
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.box} onClick={e => e.stopPropagation()}>
        <div className={styles.hd}>
          <h3>{titre}</h3>
          <button className={styles.close} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>
        <div className={styles.grid}>
          {RESEAUX.map(r => (
            <button key={r.label} className={styles.btn} onClick={() => handle(r.label)}>
              <div className={styles.ico} style={{ background:`${r.color}18`, border:`1.5px solid ${r.color}35` }}>
                <i className={r.icon} style={{ color: r.color }} />
              </div>
              <span>{displayLabel(r.label)}</span>
            </button>
          ))}
        </div>
        <div className={styles.lien}>
          <span className={styles.url}>{url}</span>
          <button className={styles.copy} onClick={handleCopier}>
            <i className="fas fa-copy" /> {t('produitDetail.modalPartage.copier')}
          </button>
        </div>
      </div>
    </div>
  );
}
