/* ================================================================
 * FICHIER : src/shared/components/ChoisirLivreurModal.tsx
 *
 * Modal générique de sélection d'un livreur — réutilisé :
 *   - côté client, pour choisir un autre livreur après un refus
 *     (données : GET /suivis/mes-abonnements, livreurs suivis)
 *   - côté entreprise, pour assigner/changer le livreur d'une
 *     commande (données : GET /livreurs, livreurs de l'entreprise)
 *
 * Volontairement "bête" : ne fait aucun appel réseau lui-même — le
 * composant appelant charge la liste et gère l'appel d'assignation.
 * ================================================================ */

export interface LivreurPickerItem {
  id:     string;
  nom:    string;
  sous:   string;   // zone, catégorie…
  emoji:  string;
  note?:  string;
}

interface Props {
  title:         string;
  items:         LivreurPickerItem[];
  loading:       boolean;
  saving:        boolean;
  emptyMessage:  string;
  onClose:       () => void;
  onSelect:      (id: string) => void;
}

export default function ChoisirLivreurModal({
  title, items, loading, saving, emptyMessage, onClose, onSelect,
}: Props) {
  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(11,31,58,.6)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background:'var(--white)', borderRadius:20, padding:26, maxWidth:440, width:'100%', maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(11,31,58,.3)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:16, color:'var(--navy,#0B1F3A)' }}>
            <i className="fas fa-motorcycle" style={{ marginRight:8, color:'var(--blue,#1A4FC4)' }} />{title}
          </div>
          <button onClick={onClose} style={{ background:'var(--g100,#F1F5F9)', border:'none', borderRadius:8, width:30, height:30, cursor:'pointer', color:'var(--t3,#64748B)' }}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:9, marginBottom: items.length ? 4 : 0 }}>
          {loading && (
            <div style={{ textAlign:'center', padding:'30px 0', color:'var(--t3,#64748B)' }}>
              <i className="fas fa-circle-notch fa-spin" style={{ fontSize:20 }} />
            </div>
          )}

          {!loading && items.length === 0 && (
            <div style={{ textAlign:'center', padding:'24px 10px', color:'var(--t3,#64748B)', fontSize:13, lineHeight:1.6 }}>
              {emptyMessage}
            </div>
          )}

          {!loading && items.map(it => (
            <button
              key={it.id}
              disabled={saving}
              onClick={() => onSelect(it.id)}
              style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                background:'var(--g50,#F8FAFC)', border:'1.5px solid var(--bdr2,#E2E8F0)',
                borderRadius:14, cursor: saving ? 'not-allowed' : 'pointer', textAlign:'left',
                opacity: saving ? .6 : 1, width:'100%',
              }}
            >
              <div style={{ width:38, height:38, borderRadius:11, background:'var(--sky,#EEF3FD)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>
                {it.emoji || '🛵'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--navy,#0B1F3A)' }}>{it.nom}</div>
                <div style={{ fontSize:11, color:'var(--t3,#64748B)' }}>{it.sous}</div>
              </div>
              {it.note && (
                <div style={{ fontSize:12, fontWeight:700, color:'var(--amber,#D97706)', display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                  <i className="fas fa-star" /> {it.note}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
