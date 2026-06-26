// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/components/UserModal.tsx
// ─────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';
import { AV_COLORS, FLAGS, ROLE_LABELS } from '../data/mockDB';

interface Props {
  store: SuperAdminStore;
  toast: (type: string, msg: string) => void;
}

type ModalTab = 'info' | 'security' | 'activity';

export default function UserModal({ store, toast }: Props) {
  const [activeTab, setActiveTab] = useState<ModalTab>('info');

  const { state, closeUserModal, toggleBlockUser, suspendUser, verifyUser, deleteUser, navigate } = store;
  const u = state.currentUser;

  if (!u) return null;

  const [fg, bg] = AV_COLORS[u.role] || ['#607898', '#0F1824'];
  const initials = u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const handleBlock = () => {
    toggleBlockUser(u.id);
    const wasBlocked = u.status === 'blocked';
    toast(wasBlocked ? 'success' : 'warn', `${wasBlocked ? '🔓' : '🚫'} Compte ${u.name} ${wasBlocked ? 'débloqué' : 'bloqué'}`);
    closeUserModal();
  };

  const handleSuspend = async () => {
    try {
      await suspendUser(u.id);
      toast('warn', `⏸ ${u.name} suspendu`);
      closeUserModal();
    } catch (e: any) {
      toast('error', `❌ ${e?.message ?? 'Erreur'}`);
    }
  };

  const handleVerify = async () => {
    try {
      await verifyUser(u.id);
      toast('success', `✅ ${u.name} vérifié`);
      closeUserModal();
    } catch (e: any) {
      toast('error', `❌ ${e?.message ?? 'Erreur'}`);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Supprimer définitivement ${u.name} ?`)) {
      try {
        await deleteUser(u.id);
        toast('error', `🗑 Compte ${u.name} supprimé`);
      } catch (e: any) {
        toast('error', `❌ ${e?.message ?? 'Erreur lors de la suppression'}`);
      }
    }
  };

  const handleMessage = () => {
    closeUserModal();
    navigate('messaging');
  };

  const ACTIVITIES = [
    'Connexion depuis mobile',
    `Commande #${Math.floor(1000 + Math.random() * 9000)} passée`,
    'Profil mis à jour',
    'Email vérifié',
  ];

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) closeUserModal(); }}>
      <div className="modal" style={{ maxWidth: 520 }}>

        {/* En-tête */}
        <div className="modal-head">
          <div className="modal-title">Détails utilisateur</div>
          <button className="modal-close" onClick={closeUserModal}>✕</button>
        </div>

        {/* Identité */}
        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            className="u-av"
            style={{ background: bg, color: fg, width: 56, height: 56, borderRadius: 14, fontSize: 20, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-h)', fontWeight: 900, fontSize: 16 }}>{u.name}</div>
            <div style={{ fontSize: 12, color: 'var(--txt-2)', marginTop: 2 }}>{u.email}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <span className={`role-pill rp-${u.role}`}>{ROLE_LABELS[u.role] || u.role}</span>
              <span className={`status-dot sd-${u.status}`}>● {u.status}</span>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 4, padding: '16px 20px 0', borderBottom: '1px solid var(--border)' }}>
          {(['info', 'security', 'activity'] as ModalTab[]).map(tab => (
            <button
              key={tab}
              className={`modal-tab${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {{ info: '📋 Infos', security: '🔐 Sécurité', activity: '📜 Activité' }[tab]}
            </button>
          ))}
        </div>

        {/* Corps */}
        <div className="modal-body" style={{ padding: 20 }}>

          {/* ── Infos ── */}
          {activeTab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Téléphone',    val: u.phone },
                { label: 'Pays',         val: `${FLAGS[u.country] || ''} ${u.country}` },
                { label: 'Inscrit le',   val: new Date(u.date).toLocaleDateString('fr-FR') },
                { label: 'Vérifié',      val: u.verified ? '✅ Oui' : '❌ Non' },
                { label: 'Rôle',         val: ROLE_LABELS[u.role] || u.role },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--txt-3)', fontWeight: 600 }}>{row.label}</span>
                  <span style={{ fontWeight: 600 }}>{row.val}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Sécurité ── */}
          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: '2FA',                val: '❌ Non' },
                { label: 'Tentatives échouées',val: String(Math.floor(Math.random() * 5)) },
                { label: 'Compte verrouillé',  val: Math.random() > 0.8 ? '⚠️ Oui' : '✅ Non' },
                { label: 'Sessions actives',   val: String(Math.floor(1 + Math.random() * 3)) },
                { label: 'Dernière IP',        val: `41.202.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` },
                { label: 'Dernière connexion', val: `Il y a ${Math.floor(Math.random() * 48)}h` },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--txt-3)', fontWeight: 600 }}>{row.label}</span>
                  <span style={{ fontWeight: 600 }}>{row.val}</span>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={() => toast('success', '🔒 Toutes les sessions révoquées')}>
                🔒 Révoquer toutes les sessions
              </button>
            </div>
          )}

          {/* ── Activité ── */}
          {activeTab === 'activity' && (
            <div>
              {ACTIVITIES.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>▸</span>
                  <span>{a}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={handleMessage}>💬 Message</button>
          <button
            className={`btn btn-sm ${u.status === 'blocked' ? 'btn-primary' : 'btn-danger'}`}
            onClick={handleBlock}
          >
            {u.status === 'blocked' ? '🔓 Débloquer' : '🚫 Bloquer'}
          </button>
          {(u.status === 'active' || u.status === 'pending') && (
            <button
              className="btn btn-sm"
              style={{ background: 'rgba(217,119,6,.15)', color: 'var(--amber,#d97706)', border: '1px solid rgba(217,119,6,.3)' }}
              onClick={handleSuspend}
            >
              ⏸ Suspendre
            </button>
          )}
          {!u.verified && (
            <button
              className="btn btn-sm"
              style={{ background: 'rgba(5,150,105,.15)', color: 'var(--emerald,#059669)', border: '1px solid rgba(5,150,105,.3)' }}
              onClick={handleVerify}
            >
              ✔ Vérifier
            </button>
          )}
          <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={handleDelete}>
            🗑 Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}