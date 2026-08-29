/**
 * src/shared/messagerie/components/ProductSharePicker.tsx
 * Petit picker ouvert par le bouton "📦 Partager un produit" du menu
 * pièces jointes — liste le catalogue public de la boutique participant
 * à CETTE conversation (GET .../produits), pas n'importe quel produit.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../services/apiFetch';
import s from '../styles/ChatWindow.module.css';

export interface ShareableProduct {
  id:    string;
  nom:   string;
  prix:  number;
  image: string | null;
}

interface Props {
  convId:   string;
  onSelect: (product: ShareableProduct) => void;
  onClose:  () => void;
  onToast:  (msg: string, type?: string) => void;
}

export default function ProductSharePicker({ convId, onSelect, onClose, onToast }: Props) {
  const { t } = useTranslation();
  const [products, setProducts] = useState<ShareableProduct[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    let ignore = false;
    apiFetch<ShareableProduct[]>(`/messagerie/conversations/${convId}/produits`)
      .then(data => { if (!ignore) setProducts(Array.isArray(data) ? data : []); })
      .catch(() => { if (!ignore) onToast(t('messagerie.messageInput.produitsEchec'), 'e'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  return (
    <div className={s.orderPicker} data-att onClick={e => e.stopPropagation()}>
      <div className={s.opHd}>
        <span>{t('messagerie.messageInput.attProduit')}</span>
        <button className={s.opClose} onClick={onClose}><i className="fas fa-xmark" /></button>
      </div>
      <div className={s.opList}>
        {loading ? (
          <div className={s.opLoading}>{t('messagerie.messageInput.chargementProduits')}</div>
        ) : products.length === 0 ? (
          <div className={s.opEmpty}>{t('messagerie.messageInput.aucunProduitPartageable')}</div>
        ) : (
          products.map(p => (
            <button key={p.id} className={s.ppItem} onClick={() => onSelect(p)}>
              <div className={s.ppThumb}>
                {p.image
                  ? <img src={p.image} alt={p.nom} />
                  : <i className="fas fa-box" />
                }
              </div>
              <div className={s.ppBody}>
                <span className={s.ppNom}>{p.nom}</span>
                <span className={s.ppPrix}>{p.prix.toLocaleString('fr-FR')} GNF</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
