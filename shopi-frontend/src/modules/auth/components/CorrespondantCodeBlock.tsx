/* ================================================================
 * src/modules/auth/components/CorrespondantCodeBlock.tsx
 *
 * FIX DÉFINITIF :
 *   1. Code verrouillé IMMÉDIATEMENT dès que prefilledCode est fourni
 *      (sans attendre la réponse API)
 *   2. Utilise fetch() directement (pas apiFetch) pour éviter
 *      tout problème JWT sur une page publique
 *   3. L'appel API sert uniquement à détecter le senderType
 *      pour griser l'autre bouton — ce n'est plus bloquant
 * ================================================================ */

import { useState, useEffect, useRef } from 'react';
import type { CorrespondantType } from '../types';

interface CodeInfo {
  senderType:  CorrespondantType | null;
  senderName:  string | null;
  targetEmail: string | null;
  valid:       boolean;
  expired:     boolean;
}

interface Props {
  onComplete:     (type: CorrespondantType, code: string) => void;
  prefilledCode?: string;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
const DISPLAY_LEN = 12;

export function CorrespondantCodeBlock({ onComplete, prefilledCode }: Props) {
  const [selectedType, setSelectedType] = useState<CorrespondantType | null>(null);
  const [code,         setCode]         = useState(prefilledCode ?? '');
  const [codeLocked,   setCodeLocked]   = useState(false);
  const [typeLocked,   setTypeLocked]   = useState(false);
  const [senderName,   setSenderName]   = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Détection automatique depuis l'URL ── */
  useEffect(() => {
    if (!prefilledCode) return;
    const cleaned = prefilledCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length < 10) return;

    /*
     * ✅ FIX CLÉ — Verrouiller le code IMMÉDIATEMENT
     * Sans attendre la réponse API.
     * Peu importe ce que retourne le backend,
     * le code pré-rempli depuis l'URL ne peut pas être effacé.
     */
    setCode(prefilledCode);
    setCodeLocked(true);
    setLoading(true);
    setError(null);

    /*
     * ✅ Utilise fetch() directement — pas apiFetch
     * apiFetch peut échouer sur une page publique (pas de token JWT).
     * fetch() natif n'a aucun problème avec les routes @Public().
     */
    fetch(`${BASE_URL}/codes/info/${encodeURIComponent(prefilledCode)}`)
      .then(res => res.json())
      .then((info: CodeInfo) => {
        if (info.expired) {
          setError('Ce code d\'invitation a expiré.');
          return;
        }
        if (!info.valid) {
          setError('Code d\'invitation invalide ou déjà utilisé.');
          return;
        }
        if (info.senderType) {
          /* Sender détecté → verrouiller aussi le type */
          setSelectedType(info.senderType);
          setSenderName(info.senderName);
          setTypeLocked(true);
          onComplete(info.senderType, prefilledCode);
        }
        /* senderType null → code verrouillé, type libre */
      })
      .catch(() => {
        /*
         * En cas d'erreur réseau, le code reste verrouillé
         * mais l'utilisateur peut choisir le type manuellement.
         */
        setError('Impossible de vérifier le code. Choisissez votre type.');
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledCode]);

  /* ── Formatage du code ── */
  function formatCode(raw: string): string {
    const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    if (c.length <= 4)  return c;
    if (c.length <= 8)  return `${c.slice(0, 4)}-${c.slice(4)}`;
    return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
  }

  function handleCodeChange(val: string) {
    if (codeLocked) return;
    const formatted = formatCode(val);
    setCode(formatted);
    setError(null);
    const raw = formatted.replace(/-/g, '');
    if (raw.length === 10 && selectedType) {
      onComplete(selectedType, formatted);
    }
  }

  function handleTypeSelect(type: CorrespondantType) {
    if (typeLocked) return;
    setSelectedType(type);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 100);
    const raw = code.replace(/-/g, '');
    if (raw.length === 10) {
      onComplete(type, code);
    }
  }

  const colors: Record<CorrespondantType, {
    bg: string; border: string; color: string; icon: string;
  }> = {
    company:  { bg:'rgba(26,79,196,.08)',  border:'rgba(26,79,196,.3)',  color:'var(--blue,#1A4FC4)',    icon:'🏪' },
    delivery: { bg:'rgba(5,150,105,.08)',  border:'rgba(5,150,105,.3)',  color:'var(--emerald,#059669)', icon:'🛵' },
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Titre */}
      <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)', display:'flex', alignItems:'center', gap:6 }}>
        <i className="fas fa-key" style={{ color:'var(--blue)' }} />
        Code d'invitation correspondant
      </div>

      {/* Sélecteur de type */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {(['company', 'delivery'] as CorrespondantType[]).map(type => {
          const cfg      = colors[type];
          const isActive = selectedType === type;
          /* Griser seulement si typeLocked ET c'est l'autre bouton */
          const isOther  = typeLocked && selectedType !== null && selectedType !== type;

          return (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeSelect(type)}
              disabled={isOther}
              style={{
                background:    isActive ? cfg.bg : 'var(--surface,#f5f7fa)',
                border:        `2px solid ${isActive ? cfg.border : 'var(--bdr,#e5e7eb)'}`,
                borderRadius:  12,
                padding:       '12px 14px',
                cursor:        isOther ? 'not-allowed' : 'pointer',
                opacity:       isOther ? 0.35 : 1,
                transition:    'all .2s',
                textAlign:     'left',
                display:       'flex',
                flexDirection: 'column',
                gap:           4,
              }}
            >
              <div style={{ fontSize:20 }}>{cfg.icon}</div>
              <div style={{ fontSize:12, fontWeight:700, color: isActive ? cfg.color : 'var(--t2)' }}>
                {type === 'company' ? 'Entreprise' : 'Livreur'}
              </div>
              {typeLocked && isActive && senderName && (
                <div style={{ fontSize:10, color:cfg.color, fontWeight:600 }}>{senderName}</div>
              )}
              {typeLocked && isActive && (
                <div style={{ fontSize:10, color:cfg.color }}>🔒 Verrouillé</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Message sender détecté */}
      {typeLocked && selectedType && (
        <div style={{ background:colors[selectedType].bg, border:`1px solid ${colors[selectedType].border}`, borderRadius:10, padding:'10px 14px', fontSize:12, color:colors[selectedType].color, display:'flex', alignItems:'center', gap:8 }}>
          <i className="fas fa-circle-check" />
          <span>
            Invitation de{' '}
            <strong>{senderName ?? (selectedType === 'company' ? 'une entreprise' : 'un livreur')}</strong>
            {' '}— type et code verrouillés.
          </span>
        </div>
      )}

      {/* Message code verrouillé mais type libre */}
      {codeLocked && !typeLocked && !loading && (
        <div style={{ background:'rgba(26,79,196,.06)', border:'1px solid rgba(26,79,196,.2)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'var(--blue)', display:'flex', alignItems:'center', gap:8 }}>
          <i className="fas fa-lock" />
          <span>Code vérifié et verrouillé — choisissez qui vous a invité.</span>
        </div>
      )}

      {/* Champ code — visible uniquement si type sélectionné */}
      {selectedType && (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={{ fontSize:12, fontWeight:600, color:'var(--t2)' }}>
            Code d'invitation {selectedType === 'company' ? 'entreprise' : 'livreur'}
            <span style={{ color:'var(--rose,red)' }}> *</span>
          </label>
          <div style={{ position:'relative' }}>
            <i className="fas fa-key" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:colors[selectedType].color, fontSize:13, zIndex:1 }} />
            <input
              ref={inputRef}
              type="text"
              className="field-input"
              placeholder="XXXX-XXXX-XX"
              value={code}
              onChange={e => handleCodeChange(e.target.value)}
              readOnly={codeLocked}
              maxLength={DISPLAY_LEN}
              style={{
                paddingLeft:   36,
                paddingRight:  codeLocked ? 38 : 12,
                fontFamily:    'monospace',
                fontSize:      15,
                fontWeight:    700,
                letterSpacing: '0.08em',
                border:        `2px solid ${error ? 'var(--rose,red)' : colors[selectedType].border}`,
                background:    codeLocked ? colors[selectedType].bg : undefined,
                cursor:        codeLocked ? 'not-allowed' : 'text',
              }}
            />
            {codeLocked && (
              <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:14 }}>🔒</span>
            )}
          </div>

          {loading && (
            <div style={{ fontSize:11, color:'var(--t3)', display:'flex', alignItems:'center', gap:5 }}>
              <i className="fas fa-circle-notch fa-spin" /> Vérification en cours…
            </div>
          )}
          {error && (
            <div style={{ fontSize:11, color:'var(--rose,red)', display:'flex', alignItems:'center', gap:5 }}>
              <i className="fas fa-circle-exclamation" /> {error}
            </div>
          )}
        </div>
      )}

      {/* Instruction si aucun type sélectionné */}
      {!selectedType && (
        <div style={{ fontSize:12, color:'var(--t3)', textAlign:'center', padding:'8px 0' }}>
          {codeLocked
            ? '👆 Sélectionnez qui vous a invité'
            : 'Sélectionnez d\'abord qui vous a invité'
          }
        </div>
      )}
    </div>
  );
}