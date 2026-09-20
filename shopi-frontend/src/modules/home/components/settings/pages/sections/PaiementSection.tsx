/* ================================================================
 * src/modules/home/components/settings/sections/PaiementSection.tsx
 * CONNECTÉ — moyens de paiement du PORTEFEUILLE (/wallet/payment-methods)
 *
 * BUG CORRIGÉ — cette page avait sa propre liste JSON, séparée du
 * portefeuille, sans aucun moyen d'ajouter quoi que ce soit (les boutons
 * « Ajouter » ne faisaient qu'afficher un message) ; le numéro était masqué
 * en laissant 8 chiffres en clair. Elle utilise maintenant les moyens de
 * paiement RÉELS du portefeuille (mêmes types, mêmes formulaires, mêmes
 * règles de masquage : jamais le numéro complet, jamais le CVV) : ajouter,
 * définir par défaut, supprimer.
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import {
  fetchWalletSummary, addWalletPaymentMethod, setDefaultWalletPaymentMethod, removeWalletPaymentMethod,
  getWalletMethodMeta, getWalletMethodFormFields, isWalletMethodFormValid, composeWalletMethodPayload,
  type WalletPaymentMethod, type WalletPaymentMethodType,
} from '../../../../../../shared/services/walletApi';

interface Props { onToast: (msg: string) => void; }

/** Types ajoutables ici (le cash n'est pas un moyen de paiement enregistrable). */
const ADDABLE: WalletPaymentMethodType[] = ['orange_money', 'mtn_money', 'kulu', 'card', 'paycard', 'bank'];

/** Contrôles de forme propres à chaque type — au-delà du simple « champ rempli ». */
function formError(type: WalletPaymentMethodType, v: Record<string, string>, t: (k: string) => string): string | null {
  const digits = (x?: string) => (x ?? '').replace(/\D/g, '');
  if (type === 'orange_money' || type === 'mtn_money' || type === 'kulu') {
    const n = digits(v.phone);
    return n.length < 8 || n.length > 9 ? t('settingsPage.paiement.errors.telephone') : null;
  }
  if (type === 'card' || type === 'paycard') {
    const n = digits(v.cardNumber);
    if (n.length < 12 || n.length > 19) return t('settingsPage.paiement.errors.carte');
    if (type === 'card') {
      const m = /^(\d{2})\/(\d{2})$/.exec((v.expiry ?? '').trim());
      if (!m || +m[1] < 1 || +m[1] > 12) return t('settingsPage.paiement.errors.expiration');
      const end = new Date(2000 + +m[2], +m[1], 1);   // 1er jour du mois suivant : la carte vaut jusqu'à la fin du mois
      if (end.getTime() <= Date.now()) return t('settingsPage.paiement.errors.expiree');
    }
  }
  return null;
}

export default function PaiementSection({ onToast }: Props) {
  const { t } = useTranslation();
  const meta   = getWalletMethodMeta(t);
  const fields = getWalletMethodFormFields(t);

  const [methods,  setMethods]  = useState<WalletPaymentMethod[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  /* Formulaire d'ajout */
  const [adding, setAdding] = useState(false);
  const [type,   setType]   = useState<WalletPaymentMethodType>('orange_money');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(false);
    try { setMethods((await fetchWalletSummary()).paymentMethods ?? []); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd()  { setAdding(true); setType('orange_money'); setValues({}); setFormErr(null); }
  function closeAdd() { setAdding(false); setValues({}); setFormErr(null); }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!isWalletMethodFormValid(type, values)) { setFormErr(t('settingsPage.paiement.errors.champsRequis')); return; }
    const err = formError(type, values, t);
    if (err) { setFormErr(err); return; }

    const payload = composeWalletMethodPayload(type, values, t);
    setSaving(true);
    try {
      setMethods(await addWalletPaymentMethod({ type, ...payload }));
      closeAdd();
      onToast(t('settingsPage.paiement.toastAjoute'));
    } catch (er: any) { setFormErr(er.message ?? t('settingsPage.paiement.errors.ajout')); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setActionId(id);
    try {
      setMethods(await removeWalletPaymentMethod(id));
      setConfirmId(null);
      onToast(t('settingsPage.paiement.toastSupprime'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setActionId(null); }
  }

  async function handleSetDefault(id: string) {
    setActionId(id);
    try {
      setMethods(await setDefaultWalletPaymentMethod(id));
      onToast(t('settingsPage.paiement.toastDefiniParDefaut'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setActionId(null); }
  }

  if (loading) return (
    <div className={s.card}>
      <div style={{ padding:'48px 24px', textAlign:'center', color:'var(--t3)' }}>
        <i className="fas fa-circle-notch fa-spin" style={{ fontSize:24 }} />
      </div>
    </div>
  );

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoViolet}`}><i className="fas fa-credit-card" /></div>
          <div>
            <div className={s.cardH}>{t('settingsPage.paiement.titre')}</div>
            <div className={s.cardSub}>{t('settingsPage.paiement.subtitle')}</div>
          </div>
        </div>
        {!adding && (
          <button className={s.cardAction} onClick={openAdd}>
            <i className="fas fa-plus" /> {t('settingsPage.paiement.ajouter')}
          </button>
        )}
      </div>

      <div className={s.cardBody} style={{ paddingBottom: 4 }}>
        {error && (
          <div style={{ padding:'24px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
            {t('settingsPage.paiement.loadError')}{' '}
            <button type="button" className={s.linkBtn} onClick={() => { setLoading(true); load(); }}>{t('settingsPage.paiement.reessayer')}</button>
          </div>
        )}

        {!error && methods.length === 0 && !adding && (
          <div style={{ padding:'24px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
            {t('settingsPage.paiement.aucunMoyen')}
          </div>
        )}

        {methods.map(m => {
          const mm = meta[m.type];
          return (
            <div key={m.id} className={s.payCard}>
              <div className={s.payLeft}>
                <div className={s.payIco} style={{ color: mm?.color }}>
                  {mm?.icon ? <i className={`fas ${mm.icon}`} /> : <strong style={{ fontSize: 12 }}>{mm?.badge ?? '💳'}</strong>}
                </div>
                <div>
                  <div className={s.payInfoTitle}>
                    {m.label || mm?.label || m.type}
                    {m.isDefault && <span className={s.payDefault}><i className="fas fa-check" /> {t('settingsPage.paiement.parDefaut')}</span>}
                  </div>
                  <div className={s.payInfoSub}>{mm?.label}{m.number ? ` · ${m.number}` : ''}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                {confirmId === m.id ? (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)' }}>{t('settingsPage.paiement.confirmSuppr')}</span>
                    <button className={`${s.addrAct} ${s.addrActDanger}`} onClick={() => handleDelete(m.id)} disabled={actionId === m.id} aria-label={t('settingsPage.paiement.supprimer')}>
                      {actionId === m.id ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-check" />}
                    </button>
                    <button className={s.addrAct} onClick={() => setConfirmId(null)} aria-label={t('settingsPage.paiement.annuler')}><i className="fas fa-xmark" /></button>
                  </>
                ) : (
                  <>
                    {!m.isDefault && (
                      <button className={s.addrAct} onClick={() => handleSetDefault(m.id)} disabled={actionId === m.id} title={t('settingsPage.paiement.definirParDefautTitle')} aria-label={t('settingsPage.paiement.definirParDefautTitle')}>
                        {actionId === m.id ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-star" />}
                      </button>
                    )}
                    <button className={`${s.addrAct} ${s.addrActDanger}`} onClick={() => setConfirmId(m.id)} aria-label={t('settingsPage.paiement.supprimer')}>
                      <i className="fas fa-trash" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {adding && (
          <form className={`${s.editForm} ${s.editFormOpen}`} onSubmit={handleAdd} style={{ margin: '4px 24px 16px' }}>
            <div className={s.editGrid}>
              <div className={`${s.field} ${s.fieldFull}`}>
                <label htmlFor="pm-type">{t('settingsPage.paiement.typeLabel')}</label>
                <select id="pm-type" value={type} onChange={e => { setType(e.target.value as WalletPaymentMethodType); setValues({}); setFormErr(null); }}>
                  {ADDABLE.map(k => <option key={k} value={k}>{meta[k].label}</option>)}
                </select>
              </div>
              {fields[type].map(f => (
                <div key={f.key} className={`${s.field} ${s.fieldFull}`}>
                  <label htmlFor={`pm-${f.key}`}>{f.label}</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {f.prefix && <span style={{ fontWeight: 700, color: 'var(--t2)', fontSize: 13 }}>{f.prefix}</span>}
                    <input
                      id={`pm-${f.key}`} type="text" inputMode={f.inputMode} maxLength={f.maxLength} placeholder={f.placeholder}
                      autoComplete={f.key === 'cardNumber' ? 'off' : undefined}
                      value={values[f.key] ?? ''} onChange={e => { setValues(v => ({ ...v, [f.key]: e.target.value })); setFormErr(null); }}
                    />
                  </div>
                </div>
              ))}
              <div className={`${s.field} ${s.fieldFull}`}>
                <span className={s.fieldHint}><i className="fas fa-lock" /> {t('settingsPage.paiement.securite')}</span>
                {formErr && <span className={s.fieldErr} role="alert"><i className="fas fa-circle-exclamation" /> {formErr}</span>}
              </div>
              <div className={s.fieldActions}>
                <button type="submit" className={s.btnSave} disabled={saving}>
                  {saving ? <><i className="fas fa-circle-notch fa-spin" /> {t('settingsPage.paiement.enregistrement')}</> : t('settingsPage.paiement.enregistrer')}
                </button>
                <button type="button" className={s.btnCancel} onClick={closeAdd} disabled={saving}>{t('settingsPage.paiement.annuler')}</button>
              </div>
            </div>
          </form>
        )}

        {!adding && !error && (
          <div style={{ margin:'0 24px 20px' }}>
            <button className={s.addrAdd} onClick={openAdd}>
              <i className="fas fa-plus" /> {t('settingsPage.paiement.ajouterNouveau')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
