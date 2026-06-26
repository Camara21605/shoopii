// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/components/NewMessageModal.tsx
//
// Modal d'envoi d'un nouveau message à un utilisateur.
// Crée une conversation si elle n'existe pas encore.
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';
import { ROLE_LABELS } from '../data/mockDB';

interface Props {
  store: SuperAdminStore;
  toast: (type: string, msg: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function NewMessageModal({ store, toast, isOpen, onClose }: Props) {
  const [recipientId, setRecipientId] = useState('');
  const [subject,     setSubject]     = useState('');
  const [body,        setBody]        = useState('');

  const { users, conversations, sendMessage, navigate, setActiveConv } = store;

  if (!isOpen) return null;

  const handleSend = () => {
    const id = parseInt(recipientId);
    if (!id) { toast('warn', '⚠️ Choisissez un destinataire'); return; }
    if (!body.trim()) { toast('warn', '⚠️ Écrivez un message'); return; }

    const user = users.find(u => u.id === id);
    const existingConv = conversations.find(c => c.userId === id);
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // Trouver ou créer la conversation via sendMessage
    // (En prod : appel API qui retourne l'ID conv créée)
    const convId = existingConv?.id ?? (conversations.length + 1);

    if (subject) sendMessage(convId, `📌 Objet : ${subject}`);
    sendMessage(convId, body.trim());

    toast('success', `📤 Message envoyé à ${user?.name || '?'}`);
    setRecipientId('');
    setSubject('');
    setBody('');
    onClose();
    navigate('messaging');
    if (existingConv) setActiveConv(existingConv.id);
  };

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <div className="modal-title">✉️ Nouveau message</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Destinataire */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Destinataire
            </div>
            <select
              className="sel"
              style={{ width: '100%' }}
              value={recipientId}
              onChange={e => setRecipientId(e.target.value)}
            >
              <option value="">— Choisir un utilisateur —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({(ROLE_LABELS[u.role] || u.role).replace(/[^ ]+ /, '')})
                </option>
              ))}
            </select>
          </div>

          {/* Objet */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Objet (optionnel)
            </div>
            <input
              className="input-field"
              type="text"
              value={subject}
              placeholder="Ex : Mise à jour de votre boutique…"
              onChange={e => setSubject(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          {/* Message */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Message
            </div>
            <textarea
              className="input-field"
              value={body}
              placeholder="Votre message…"
              rows={4}
              onChange={e => setBody(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={onClose}>
              Annuler
            </button>
            <button className="btn btn-primary btn-sm" style={{ flex: 2, justifyContent: 'center' }} onClick={handleSend}>
              📤 Envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}