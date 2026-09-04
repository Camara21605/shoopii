/*
 * FICHIER : src/dashboards/entreprise/pages/CrmCampaignModal.tsx
 *
 * RÔLE : Modale de confirmation pour les 3 actions CRM qui envoient un
 *        message (Newsletter VIP, Offre fidélité, Relance inactifs).
 *        Charge un aperçu (nombre + échantillon de destinataires, sujet/
 *        message suggérés) — AUCUN envoi tant que l'utilisateur n'a pas
 *        cliqué "Envoyer" sur du contenu qu'il a pu relire/modifier.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CrmCampaignType } from '../hooks/useClients';

interface Props {
  type:      CrmCampaignType;
  title:     string;
  onClose:   () => void;
  onPreview: (type: CrmCampaignType) => Promise<{ count: number; sample: { fullName: string; email: string }[]; suggestedSubject: string; suggestedMessage: string }>;
  onSend:    (type: CrmCampaignType, subject: string, message: string) => Promise<{ sent: number; failed: number; total: number }>;
  onPop:     (m: string, t?: string) => void;
}

export default function CrmCampaignModal({ type, title, onClose, onPreview, onSend, onPop }: Props) {
  const { t } = useTranslation();
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const [count,    setCount]    = useState(0);
  const [sample,   setSample]   = useState<{ fullName: string; email: string }[]>([]);
  const [subject,  setSubject]  = useState('');
  const [message,  setMessage]  = useState('');
  const [result,   setResult]   = useState<{ sent: number; failed: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    onPreview(type)
      .then(p => {
        if (cancelled) return;
        setCount(p.count);
        setSample(p.sample);
        setSubject(p.suggestedSubject);
        setMessage(p.suggestedMessage);
      })
      .catch(() => { if (!cancelled) onPop(t('clients.crm.erreurApercu'), 'e'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function handleSend() {
    setSending(true);
    try {
      const r = await onSend(type, subject, message);
      setResult(r);
      onPop(t('clients.crm.envoye', { count: r.sent }), 's');
    } catch (e: any) {
      onPop(e?.message ?? t('clients.crm.erreurEnvoi'), 'e');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(11,31,58,.5)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--white)', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(11,31,58,.25)', overflow: 'hidden' }}>

        {/* ── HEADER ── */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--fd,"Fraunces",serif)', fontSize: 17, fontWeight: 800, color: 'var(--navy)' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'var(--g50)', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', color: 'var(--t3)' }}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* ── BODY ── */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--t3)' }}>
              <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 20 }} />
            </div>
          ) : result ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
                {t('clients.crm.resultatTitre', { sent: result.sent, total: result.total })}
              </div>
              {result.failed > 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--t3)' }}>
                  {t('clients.crm.resultatEchecs', { count: result.failed })}
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 12, padding: '12px 16px', marginBottom: 18, fontSize: 12.5, color: 'var(--t2)' }}>
                <i className="fas fa-users" style={{ marginRight: 7 }} />
                {t('clients.crm.destinataires', { count })}
                {sample.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--t3)' }}>
                    {sample.slice(0, 5).map(s => s.fullName).join(', ')}
                    {count > 5 ? '…' : ''}
                  </div>
                )}
              </div>

              {count === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--t3)', fontSize: 13 }}>
                  {t('clients.crm.aucunDestinataire')}
                </div>
              ) : (
                <>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--t3)', marginBottom: 5 }}>
                    {t('clients.crm.sujet')}
                  </label>
                  <input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    maxLength={150}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--bdr)', fontSize: 13.5, marginBottom: 14, fontFamily: 'inherit' }}
                  />

                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--t3)', marginBottom: 5 }}>
                    {t('clients.crm.message')}
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    maxLength={5000}
                    rows={7}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--bdr)', fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        {!loading && !result && count > 0 && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--bdr)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
            <button onClick={onClose} style={{ background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 'var(--pill)', padding: '9px 18px', fontSize: 12.5, fontWeight: 700, color: 'var(--navy)', cursor: 'pointer' }}>
              {t('clients.crm.annuler')}
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || message.trim().length < 10}
              style={{ background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 'var(--pill)', padding: '9px 20px', fontSize: 12.5, fontWeight: 700, cursor: sending ? 'default' : 'pointer', opacity: sending ? .6 : 1 }}
            >
              {sending ? <i className="fas fa-circle-notch fa-spin" /> : t('clients.crm.envoyerA', { count })}
            </button>
          </div>
        )}

        {result && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--bdr)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
            <button onClick={onClose} style={{ background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 'var(--pill)', padding: '9px 20px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              {t('clients.crm.fermer')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
