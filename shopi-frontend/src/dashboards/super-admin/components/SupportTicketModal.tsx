/* ================================================================
 * FICHIER : src/dashboards/super-admin/components/SupportTicketModal.tsx
 *
 * Modal détail d'un ticket support — vue super-admin (portée globale).
 * Reprend les contrôles agent existants (réponse, note interne, statut,
 * priorité) et ajoute la réassignation à N'IMPORTE QUEL agent éligible
 * (Admin.permissions.support = true), pas seulement "m'assigner à moi" —
 * c'est la capacité qui manquait pour une vraie gestion multi-zone.
 *
 * Consomme /support/agent/* — portée globale automatique pour SUPER_ADMIN
 * côté backend (SupportPermissionService.resolveVisibleUserIds → null).
 * ================================================================ */

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';
import { useSupportSocket } from '../../../shared/support/useSupportSocket';
import styles from './SupportTicketModal.module.css';

/** Types autorisés (validés côté serveur) et taille max — mêmes règles
 *  que le formulaire client (modules/support/pages/TicketDetailPage.tsx). */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm',
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const FILE_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,video/mp4,video/webm';

function fmtBytes(bytes: number): string {
  if (bytes < 1_024)     return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}
function mimeIcon(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'fa-file-pdf';
  if (mimeType.startsWith('image/'))  return 'fa-file-image';
  if (mimeType.startsWith('video/'))  return 'fa-file-video';
  return 'fa-file';
}

interface AgentOption {
  id:          string;
  name:        string;
  email:       string;
  paysAssigne: string | null;
}

interface Props {
  ticketId:  string;
  agents:    AgentOption[];
  onClose:   () => void;
  toast:     (type: string, msg: string) => void;
  onChanged: () => void; // recharge la liste + stats après une mutation
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Ouvert', in_progress: 'En cours', waiting_user: 'Attente client', resolved: 'Résolu', closed: 'Fermé',
};
const PRIORITY_LABEL: Record<string, string> = { low: 'Basse', normal: 'Normale', high: 'Haute', urgent: 'Urgente' };
const CHANNEL_LABEL: Record<string, string> = {
  client: '🛍️ Client', company: '🏪 Entreprise', partner: '🤝 Partenaire',
  delivery: '🛵 Livreur', internal: '🔒 Interne', anonymous: '👤 Anonyme',
};
const STATUS_OPTIONS = ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'];

export default function SupportTicketModal({ ticketId, agents, onClose, toast, onChanged }: Props) {
  const [loading,  setLoading]  = useState(true);
  const [ticket,   setTicket]   = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [content,  setContent]  = useState('');
  const [internal, setInternal] = useState(false);
  const [sending,  setSending]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachErr,  setAttachErr]  = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ ticket: any; messages: any[] }>(`/support/agent/tickets/${ticketId}`)
      .then(d => { setTicket(d.ticket); setMessages(d.messages ?? []); })
      .catch(() => toast('error', 'Erreur lors du chargement du ticket'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(load, [load]);

  /* Communication instantanée — rejoint la room ticket:{id} tant que
   * ce modal est ouvert ; tout nouveau message (client OU un autre
   * agent) apparaît immédiatement, sans fermer/rouvrir. Déduplique par
   * id : notre propre envoi arrive déjà via reply() → load(), l'écho
   * du socket ne doit pas l'ajouter une seconde fois. */
  useSupportSocket(ticketId, {
    onNewMessage: (d) => {
      if (d.ticketId !== ticketId) return;
      setMessages(prev => prev.some(m => m.id === d.message.id) ? prev : [...prev, d.message]);
      /* Rafraîchit la liste/stats du parent (compteurs, tri par
       * updatedAt) — anodin si notre propre reply() vient déjà de le
       * faire, mais nécessaire quand le message vient d'un tiers. */
      onChanged();
    },
  });

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setAttachErr('Format non autorisé. Formats acceptés : PDF, PNG, JPG, WebP, MP4, WebM.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setAttachErr(`Fichier trop lourd (${fmtBytes(file.size)}). Taille maximale : 10 MB.`);
      return;
    }
    setAttachErr(null);
    setAttachFile(file);
  };

  const reply = async () => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      /* Étape 1 : envoi du texte — récupère l'id du message créé. */
      const msg = await apiFetch<{ id: string }>(
        `/support/agent/tickets/${ticketId}/reply${internal ? '?internal=true' : ''}`,
        { method: 'POST', body: { content: content.trim() } },
      );
      setContent('');
      setInternal(false);

      /* Étape 2 : pièce jointe optionnelle — même flux en 2 temps que
       * le client (modules/support/pages/TicketDetailPage.tsx). */
      if (attachFile) {
        try {
          const form = new FormData();
          form.append('file', attachFile);
          await apiFetch(
            `/support/agent/tickets/${ticketId}/messages/${msg.id}/attachments`,
            { method: 'POST', body: form },
          );
          setAttachFile(null);
        } catch {
          toast('error', "Message envoyé, mais la pièce jointe n'a pas pu être jointe.");
        }
      }

      toast('success', internal ? '📝 Note interne ajoutée' : '✅ Réponse envoyée');
      load();
      onChanged();
    } catch {
      toast('error', "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status: string) => {
    setSaving(true);
    try {
      await apiFetch(`/support/agent/tickets/${ticketId}/status`, { method: 'PATCH', body: { status } });
      setTicket((t: any) => ({ ...t, status }));
      toast('success', 'Statut mis à jour');
      onChanged();
    } catch {
      toast('error', 'Échec de la mise à jour du statut');
    } finally {
      setSaving(false);
    }
  };

  const changePriority = async (level: string) => {
    setSaving(true);
    try {
      await apiFetch(`/support/agent/tickets/${ticketId}/priority/${level}`, { method: 'PATCH' });
      setTicket((t: any) => ({ ...t, priority: level }));
      toast('success', 'Priorité mise à jour');
      onChanged();
    } catch {
      toast('error', 'Échec de la mise à jour de la priorité');
    } finally {
      setSaving(false);
    }
  };

  const reassign = async (agentId: string) => {
    setSaving(true);
    try {
      await apiFetch(`/support/agent/tickets/${ticketId}/assign`, { method: 'PATCH', body: { agentId } });
      setTicket((t: any) => ({ ...t, agentId }));
      const name = agents.find(a => a.id === agentId)?.name ?? 'un agent';
      toast('success', `🙋 Ticket réassigné à ${name}`);
      onChanged();
    } catch {
      toast('error', "Échec de la réassignation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-head">
          <div>
            <div className="modal-title">
              {loading || !ticket ? 'Ticket' : `${ticket.reference} — ${ticket.subject}`}
            </div>
            {ticket && (
              <div className={styles.subMeta}>
                {CHANNEL_LABEL[ticket.channel] ?? ticket.channel} · créé le {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}
              </div>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading || !ticket ? (
          <div className="modal-body" style={{ textAlign: 'center', padding: '3rem' }}>
            <i className="fas fa-spinner fa-spin" style={{ opacity: .4, fontSize: 24 }} />
          </div>
        ) : (
          <>
            {/* ── Contrôles agent ── */}
            <div className={styles.controls}>
              <div className={styles.ctrl}>
                <label>Statut</label>
                <select className="sel" value={ticket.status} disabled={saving} onChange={e => changeStatus(e.target.value)}>
                  {STATUS_OPTIONS.map(st => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}
                </select>
              </div>
              <div className={styles.ctrl}>
                <label>Priorité</label>
                <select className="sel" value={ticket.priority} disabled={saving} onChange={e => changePriority(e.target.value)}>
                  {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                </select>
              </div>
              <div className={styles.ctrl}>
                <label>Assigné à</label>
                <select
                  className="sel"
                  value={ticket.agentId ?? ''}
                  disabled={saving}
                  onChange={e => { if (e.target.value) reassign(e.target.value); }}
                >
                  <option value="" disabled>{ticket.agentId ? '— Non assigné —' : 'Non assigné'}</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.paysAssigne ? ` (${a.paysAssigne})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Thread ── */}
            <div className="modal-body" style={{ paddingTop: 0 }}>
              <div className={styles.thread}>
                {messages.length === 0 && <p style={{ opacity: .5, padding: '1rem' }}>Aucun message.</p>}
                {messages.map(m => (
                  <div key={m.id} className={`${styles.msg} ${m.senderType === 'agent' ? styles.msgAgent : styles.msgUser} ${m.isInternal ? styles.msgInternal : ''}`}>
                    <div className={styles.msgTop}>
                      <b>{m.senderName ?? (m.senderType === 'agent' ? 'Agent' : 'Client')}</b>
                      {m.isInternal && <span className={styles.internalBadge}>Note interne</span>}
                      <span className={styles.msgWhen}>{new Date(m.createdAt).toLocaleString('fr-FR')}</span>
                    </div>
                    <div className={styles.msgBody}>
                      {m.content}
                      {m.attachments && m.attachments.length > 0 && (
                        <div className={styles.attList}>
                          {m.attachments.map((att: any) => (
                            <a key={att.id} href={att.secureUrl} target="_blank" rel="noopener noreferrer" className={styles.attCard}>
                              {att.mimeType?.startsWith('image/') ? (
                                <img src={att.secureUrl} alt={att.originalFilename} className={styles.attThumb} />
                              ) : (
                                <span className={styles.attIconWrap}><i className={`fas ${mimeIcon(att.mimeType)}`} /></span>
                              )}
                              <span className={styles.attBody}>
                                <span className={styles.attName}>{att.originalFilename}</span>
                                <span className={styles.attMeta}>{att.extension?.toUpperCase()} · {fmtBytes(att.sizeBytes)}</span>
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Réponse ── */}
              <div className={styles.replyBox}>
                <textarea
                  placeholder="Écrire une réponse…"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={3}
                />
                <input ref={fileInputRef} type="file" accept={FILE_ACCEPT} onChange={handleFileSelect} style={{ display: 'none' }} disabled={sending} />

                {attachFile && (
                  <div className={styles.fileChip} style={{ marginTop: 8 }}>
                    <i className={`fas ${mimeIcon(attachFile.type)}`} />
                    <span>{attachFile.name}</span>
                    <span style={{ opacity: .6 }}>{fmtBytes(attachFile.size)}</span>
                    <button type="button" onClick={() => setAttachFile(null)}><i className="fas fa-times" /></button>
                  </div>
                )}
                {attachErr && <div style={{ color: 'var(--rose)', fontSize: 11.5, marginTop: 6 }}>{attachErr}</div>}

                <div className={styles.replyRow}>
                  <label className={styles.internalToggle}>
                    <input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} />
                    Note interne (non visible par le client)
                  </label>
                  <button type="button" className={styles.attachBtn} disabled={sending} onClick={() => fileInputRef.current?.click()}>
                    <i className="fas fa-paperclip" /> {attachFile ? 'Changer' : 'Joindre'}
                  </button>
                  <button className="btn btn-primary" disabled={!content.trim() || sending} onClick={reply}>
                    <i className={`fas ${sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} /> Envoyer
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
