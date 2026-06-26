/*
 * FICHIER : src/modules/home/components/produit/components/ModalPartage.tsx
 * RÔLE    : Modale de partage du produit sur les réseaux sociaux.
 */
import React from 'react';
import styles from '../styles/ModalPartage.module.css';

interface Props { url: string; titre: string; onClose: () => void; onToast: (m: string) => void; }

const RESEAUX = [
  { icon:'fab fa-whatsapp',   label:'WhatsApp', color:'#25D366', href:(u:string)=>`https://wa.me/?text=${encodeURIComponent(u)}` },
  { icon:'fab fa-facebook-f', label:'Facebook', color:'#1877F2', href:(u:string)=>`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { icon:'fab fa-instagram',  label:'Instagram',color:'#E1306C', href:()=>'' },
  { icon:'fab fa-x-twitter',  label:'X',        color:'#111',    href:(u:string)=>`https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}` },
  { icon:'fas fa-envelope',   label:'Email',    color:'#6B7280', href:(u:string)=>`mailto:?body=${encodeURIComponent(u)}` },
  { icon:'fas fa-link',       label:'Copier',   color:'#1A4FC4', href:()=>'' },
];

export default function ModalPartage({ url, titre, onClose, onToast }: Props) {
  function handle(label: string, href: string) {
    if (label === 'Copier' || label === 'Instagram') {
      navigator.clipboard.writeText(url).catch(()=>{});
      onToast(label === 'Copier' ? '🔗 Lien copié !' : '📸 Lien copié — collez dans Instagram');
    } else {
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
      onToast(`📲 Partage via ${label}`);
    }
  }
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.box} onClick={e => e.stopPropagation()}>
        <div className={styles.hd}>
          <h3>{titre}</h3>
          <button className={styles.close} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>
        <div className={styles.grid}>
          {RESEAUX.map(r => {
            const href = r.href(url);
            return (
              <button key={r.label} className={styles.btn} onClick={() => handle(r.label, href)}>
                <div className={styles.ico} style={{ background:`${r.color}18`, border:`1.5px solid ${r.color}35` }}>
                  <i className={r.icon} style={{ color: r.color }} />
                </div>
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.lien}>
          <span className={styles.url}>{url}</span>
          <button className={styles.copy} onClick={() => { navigator.clipboard.writeText(url).catch(()=>{}); onToast('🔗 Lien copié !'); }}>
            <i className="fas fa-copy" /> Copier
          </button>
        </div>
      </div>
    </div>
  );
}
