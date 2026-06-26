// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/components/CodeModal.tsx
//
// Modal de génération de codes d'invitation (multi-génération).
// Gère la quantité, le rôle, l'expiration, les utilisations max.
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';
import { ROLE_LABELS } from '../data/mockDB';

interface Props {
  store: SuperAdminStore;
  toast: (type: string, msg: string) => void;
}

export default function CodeModal({ store, toast }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [role,    setRole]    = useState('company');
  const [expiry,  setExpiry]  = useState('30');
  const [maxUses, setMaxUses] = useState(1);
  const [note,    setNote]    = useState('');
  const [results, setResults] = useState<string[]>([]);

  const { state } = store;

  const getExpiryDate = (days: string) => {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(days));
    return d.toISOString().slice(0, 10);
  };

  const handleGenerate = () => {
    store.generateCodes(role, getExpiryDate(expiry), maxUses, note);
    toast('success', `🎫 ${state.codeQty} code${state.codeQty > 1 ? 's' : ''} générés`);
    setIsOpen(false);
    setResults([]);
  };

  const copyAll = () => {
    navigator.clipboard.writeText(results.join('\n')).catch(() => {});
    toast('success', `📋 ${results.length} codes copiés`);
  };

  if (!isOpen) {
    return (
      <button className="btn btn-primary" onClick={() => setIsOpen(true)}>
        + Générer codes
      </button>
    );
  }

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setIsOpen(false); }}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <div className="modal-title">🎫 Générer des codes d'invitation</div>
          <button className="modal-close" onClick={() => setIsOpen(false)}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Quantité */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Quantité
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => store.setCodeQty(state.codeQty - 1)}>−</button>
              <span style={{ fontFamily: 'var(--font-m)', fontWeight: 700, fontSize: 22, minWidth: 36, textAlign: 'center' }}>
                {state.codeQty}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => store.setCodeQty(state.codeQty + 1)}>+</button>
              <span style={{ fontSize: 12, color: 'var(--txt-2)' }}>
                {state.codeQty} code{state.codeQty > 1 ? 's' : ''} (max 40)
              </span>
            </div>
          </div>

          {/* Rôle */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Rôle cible
            </div>
            <select className="sel" style={{ width: '100%' }} value={role} onChange={e => setRole(e.target.value)}>
              <option value="company">🏪 Entreprise</option>
              <option value="delivery">🛵 Livreur</option>
              <option value="partner">🤝 Partenaire</option>
              <option value="correspondent">📦 Correspondant</option>
              <option value="admin">🛡 Admin</option>
            </select>
          </div>

          {/* Expiration */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Durée de validité
            </div>
            <select className="sel" style={{ width: '100%' }} value={expiry} onChange={e => setExpiry(e.target.value)}>
              <option value="7">7 jours</option>
              <option value="30">30 jours</option>
              <option value="90">90 jours</option>
              <option value="365">1 an</option>
            </select>
          </div>

          {/* Utilisations max */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Utilisations max par code
            </div>
            <input
              className="input-field"
              type="number"
              value={maxUses}
              min={1} max={100}
              onChange={e => setMaxUses(parseInt(e.target.value) || 1)}
              style={{ width: '100%' }}
            />
          </div>

          {/* Note */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Note (optionnelle)
            </div>
            <input
              className="input-field"
              type="text"
              value={note}
              placeholder="Ex : Campagne recrutement livreurs Conakry…"
              onChange={e => setNote(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleGenerate}>
            🎫 Générer {state.codeQty} code{state.codeQty > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}