/* ================================================================
 * FICHIER : src/dashboards/administrateur/components/TicketDetailModal.tsx
 *
 * Panneau détail d'un ticket support (agent complet) : thread de
 * messages, réponse (+ note interne), statut, priorité, assignation.
 * Consomme les endpoints /support/agent/* déjà scopés zone côté
 * backend (SupportPermissionService) — aucune vérification de portée
 * supplémentaire n'est nécessaire ici.
 * ================================================================ */

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import styles from '../styles/TicketDetailModal.module.css';
import { apiFetch } from '../../../shared/services/apiFetch';
import { useSupportSocket } from '../../../shared/support/useSupportSocket';

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

interface TicketDetailModalProps {
  ticketId: string;
  currentUserId: string;
  onClose: () => void;
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
  onChanged: () => void; // recharge la liste après une mutation
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Ouvert', in_progress: 'En cours', waiting_user: 'Attente client', resolved: 'Résolu', closed: 'Fermé',
};
const PRIORITY_LABEL: Record<string, string> = { low: 'Basse', normal: 'Normale', high: 'Haute', urgent: 'Urgente' };
const STATUS_OPTIONS = ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'];

export default function TicketDetailModal({ ticketId, currentUserId, onClose, onToast, onChanged }: TicketDetailModalProps) {
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
      .catch(() => onToast('Erreur lors du chargement du ticket', 'w'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(load, [load]);

  /* Communication instantanée — voir SupportTicketModal.tsx
   * (super-admin) pour la même logique commentée en détail. */
  useSupportSocket(ticketId, {
    onNewMessage: (d) => {
      if (d.ticketId !== ticketId) return;
      setMessages(prev => prev.some(m => m.id === d.message.id) ? prev : [...prev, d.message]);
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
      const msg = await apiFetch<{ id: string }>(
        `/support/agent/tickets/${ticketId}/reply${internal ? '?internal=true' : ''}`,
        { method: 'POST', body: { content: content.trim() } },
      );
      setContent('');
      setInternal(false);

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
          onToast("Message envoyé, mais la pièce jointe n'a pas pu être jointe.", 'w');
        }
      }

      onToast(internal ? '📝 Note interne ajoutée' : '✅ Réponse envoyée', 's');
      load();
      onChanged();
    } catch {
      onToast('Échec de l\'envoi', 'w');
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (status: string) => {
    setSaving(true);
    try {
      await apiFetch(`/support/agent/tickets/${ticketId}/status`, { method: 'PATCH', body: { status } });
      setTicket((t: any) => ({ ...t, status }));
      onToast('Statut mis à jour', 's');
      onChanged();
    } catch {
      onToast('Échec de la mise à jour du statut', 'w');
    } finally {
      setSaving(false);
    }
  };

  const changePriority = async (level: string) => {
    setSaving(true);
    try {
      await apiFetch(`/support/agent/tickets/${ticketId}/priority/${level}`, { method: 'PATCH' });
      setTicket((t: any) => ({ ...t, priority: level }));
      onToast('Priorité mise à jour', 's');
      onChanged();
    } catch {
      onToast('Échec de la mise à jour de la priorité', 'w');
    } finally {
      setSaving(false);
    }
  };

  const assignToMe = async () => {
    setSaving(true);
    try {
      await apiFetch(`/support/agent/tickets/${ticketId}/assign`, { method: 'PATCH', body: { agentId: currentUserId } });
      setTicket((t: any) => ({ ...t, agentId: currentUserId }));
      onToast('🙋 Ticket assigné', 's');
      onChanged();
    } catch {
      onToast('Échec de l\'assignation', 'w');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.bg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <button className={styles.x} onClick={onClose}><i className="fas fa-xmark" /></button>

        {loading || !ticket ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <i className="fas fa-spinner fa-spin fa-2x" style={{ opacity: .4 }} />
          </div>
        ) : (
          <>
            <div className={styles.head}>
              <div className={styles.ref}>{ticket.reference}</div>
              <div className={styles.subject}>{ticket.subject}</div>
            </div>

            {/* ── Contrôles agent ── */}
            <div className={styles.controls}>
              <div className={styles.ctrl}>
                <label>Statut</label>
                <select value={ticket.status} disabled={saving} onChange={e => changeStatus(e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div className={styles.ctrl}>
                <label>Priorité</label>
                <select value={ticket.priority} disabled={saving} onChange={e => changePriority(e.target.value)}>
                  {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                </select>
              </div>
              <button className={styles.assignBtn} disabled={saving || ticket.agentId === currentUserId} onClick={assignToMe}>
                <i className="fas fa-hand" /> {ticket.agentId === currentUserId ? 'Assigné à moi' : "M'assigner"}
              </button>
            </div>

            {/* ── Thread ── */}
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
              {attachErr && <div style={{ color: 'var(--red, #dc2626)', fontSize: 11.5, marginTop: 6 }}>{attachErr}</div>}

              <div className={styles.replyRow}>
                <label className={styles.internalToggle}>
                  <input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} />
                  Note interne (non visible par le client)
                </label>
                <button type="button" className={styles.attachBtn} disabled={sending} onClick={() => fileInputRef.current?.click()}>
                  <i className="fas fa-paperclip" /> {attachFile ? 'Changer' : 'Joindre'}
                </button>
                <button className={styles.sendBtn} disabled={!content.trim() || sending} onClick={reply}>
                  <i className={`fas ${sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} /> Envoyer
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
