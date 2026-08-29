/**
 * src/shared/messagerie/components/OrderSharePicker.tsx
 * Petit picker ouvert par le bouton "🛒 Partager une commande" du menu
 * pièces jointes — liste les commandes réellement partagées entre les
 * deux participants de CETTE conversation (GET .../commandes), pas
 * n'importe quelle commande de l'utilisateur.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../services/apiFetch';
import s from '../styles/ChatWindow.module.css';

export interface ShareableOrder {
  id:        string;
  numero:    string;
  status:    string;
  total:     number;
  createdAt: string;
}

interface Props {
  convId:   string;
  onSelect: (order: ShareableOrder) => void;
  onClose:  () => void;
  onToast:  (msg: string, type?: string) => void;
}

export default function OrderSharePicker({ convId, onSelect, onClose, onToast }: Props) {
  const { t } = useTranslation();
  const [orders,  setOrders]  = useState<ShareableOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    apiFetch<ShareableOrder[]>(`/messagerie/conversations/${convId}/commandes`)
      .then(data => { if (!ignore) setOrders(Array.isArray(data) ? data : []); })
      .catch(() => { if (!ignore) onToast(t('messagerie.messageInput.commandesEchec'), 'e'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  return (
    <div className={s.orderPicker} data-att onClick={e => e.stopPropagation()}>
      <div className={s.opHd}>
        <span>{t('messagerie.messageInput.attCommande')}</span>
        <button className={s.opClose} onClick={onClose}><i className="fas fa-xmark" /></button>
      </div>
      <div className={s.opList}>
        {loading ? (
          <div className={s.opLoading}>{t('messagerie.messageInput.chargementCommandes')}</div>
        ) : orders.length === 0 ? (
          <div className={s.opEmpty}>{t('messagerie.messageInput.aucuneCommandePartageable')}</div>
        ) : (
          orders.map(o => (
            <button key={o.id} className={s.opItem} onClick={() => onSelect(o)}>
              <div className={s.opItemHd}>
                <span className={s.opNumero}>{o.numero}</span>
                <span className={s.opStatus}>{o.status}</span>
              </div>
              <span className={s.opTotal}>{o.total.toLocaleString('fr-FR')} GNF</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
