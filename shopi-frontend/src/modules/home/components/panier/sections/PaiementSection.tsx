/*
 * ============================================================
 * FICHIER : src/modules/home/components/panier/sections/PaiementSection.tsx
 *
 * RÔLE    : Section "Mode de paiement" — étape 4.
 *           - Grille 6 modes : Orange Money, MTN, Carte, Cash, Virement, Wallet
 *           - Formulaire dynamique selon le mode sélectionné
 *           - Champ code promo avec validation (SHOPI20 = −20%)
 * ============================================================
 */
import React, { useState } from 'react';
import { PAY_MODES } from '../data/panierData';
import styles from '../styles/PaiementSection.module.css';

interface Props {
  payMode:    string;
  promoActif: boolean;
  onPayMode:  (m: string) => void;
  onPromo:    (v: boolean) => void;
  onToast:    (m: string) => void;
}

const PAY_LABELS: Record<string, string> = {
  omo:'Orange Money 🏦', mtn:'MTN Money 💛', card:'Carte bancaire 💳',
  cash:'À la livraison 💵', wire:'Virement 🏛️', wallet:'Wallet Shopi 👛',
};

export default function PaiementSection({ payMode, promoActif, onPayMode, onPromo, onToast }: Props) {
  const [cardNum,    setCardNum]    = useState('');
  const [cardScheme, setCardScheme] = useState('💳');
  const [showCvv,    setShowCvv]    = useState(false);
  const [promoCode,  setPromoCode]  = useState('');

  function handlePay(m: string) {
    onPayMode(m);
    onToast(`💳 Paiement : ${PAY_LABELS[m] || m}`);
  }

  function fmtCard(v: string): string {
    const clean = v.replace(/\D/g, '').substring(0, 16);
    setCardScheme(clean.startsWith('4') ? '💳' : clean.startsWith('5') ? '🟠' : '💳');
    return clean.replace(/(.{4})/g, '$1 ').trim();
  }

  function fmtExp(v: string): string {
    const clean = v.replace(/\D/g, '').substring(0, 4);
    return clean.length >= 3 ? clean.substring(0,2) + '/' + clean.substring(2) : clean;
  }

  function applyPromo() {
    const c = promoCode.trim().toUpperCase();
    if (c === 'SHOPI20' || c === 'TEST') {
      onPromo(true); setPromoCode('');
      onToast('🏷️ Code SHOPI20 appliqué — −20% !');
    } else if (!c) {
      onToast('⚠️ Entrez un code promo');
    } else {
      onToast('❌ Code invalide ou expiré');
    }
  }

  const isMobile = payMode === 'omo' || payMode === 'mtn';
  const mobLabel = payMode === 'omo' ? 'Orange Money' : 'MTN Money';

  return (
    <div className={`${styles.sc} ${styles.lit}`}>

      {/* ── En-tête ── */}
      <div className={styles.scHd}>
        <div className={styles.scNum}>4</div>
        <div>
          <div className={styles.scTitre}>Mode de paiement</div>
          <div className={styles.scSub}>Transactions sécurisées et chiffrées SSL</div>
        </div>
      </div>

      <div className={styles.scBody}>

        {/* ── Grille 6 modes ── */}
        <div className={styles.payGrid}>
          {PAY_MODES.map(p => (
            <div
              key={p.id}
              className={`${styles.payOpt} ${payMode === p.id ? styles.payOptSel : ''}`}
              onClick={() => handlePay(p.id)}
            >
              <div className={styles.payIcon}>{p.icon}</div>
              <div className={styles.payNm}>{p.nm}</div>
              <div className={styles.paySub}>{p.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Formulaire Mobile Money ── */}
        {isMobile && (
          <div className={styles.payForm}>
            <div className={`${styles.fr} ${styles.frFull}`}>
              <div className={styles.fg}>
                <div className={styles.fl}>Numéro {mobLabel} <span>*</span></div>
                <div className={styles.fw}>
                  <div className={styles.dialCode}>🇬🇳 +224</div>
                  <input className={`${styles.fin} ${styles.finTel}`} type="tel" placeholder="620 000 000" />
                </div>
              </div>
            </div>
            <div className={styles.infoBox}>
              <i className="fas fa-circle-info" style={{ color:'#1A4FC4' }} />
              <span>
                Vous recevrez une demande de confirmation sur votre téléphone.
                Entrez votre code PIN <strong>{mobLabel}</strong> pour finaliser.
              </span>
            </div>
          </div>
        )}

        {/* ── Formulaire Carte bancaire ── */}
        {payMode === 'card' && (
          <div className={styles.payForm}>
            {/* Numéro de carte */}
            <div className={`${styles.fr} ${styles.frFull}`}>
              <div className={styles.fg}>
                <div className={styles.fl}>Numéro de carte <span>*</span></div>
                <div className={styles.fw}>
                  <i className={`fas fa-credit-card ${styles.fi}`} />
                  <input
                    className={styles.fin}
                    type="text" placeholder="0000 0000 0000 0000" maxLength={19}
                    value={cardNum}
                    onChange={e => setCardNum(fmtCard(e.target.value))}
                  />
                  <span className={styles.cardScheme}>{cardScheme}</span>
                </div>
              </div>
            </div>
            {/* Titulaire + Expiration */}
            <div className={styles.fr3}>
              <div className={`${styles.fg} ${styles.span2}`}>
                <div className={styles.fl}>Titulaire <span>*</span></div>
                <div className={styles.fw}>
                  <i className={`fas fa-user ${styles.fi}`} />
                  <input className={styles.fin} type="text" placeholder="Prénom NOM" />
                </div>
              </div>
              <div className={styles.fg}>
                <div className={styles.fl}>Expir. <span>*</span></div>
                <div className={styles.fw}>
                  <i className={`fas fa-calendar ${styles.fi}`} />
                  <input
                    className={styles.fin} type="text" placeholder="MM/AA" maxLength={5}
                    onChange={e => { e.target.value = fmtExp(e.target.value); }}
                  />
                </div>
              </div>
            </div>
            {/* CVV + Sauvegarder */}
            <div className={styles.fr}>
              <div className={styles.fg}>
                <div className={styles.fl}>CVV <span>*</span></div>
                <div className={styles.fw}>
                  <i className={`fas fa-lock ${styles.fi}`} />
                  <input className={styles.fin} type={showCvv ? 'text' : 'password'} placeholder="•••" maxLength={4} />
                  <button className={styles.eyeBtn} onClick={() => setShowCvv(s => !s)}>
                    <i className={`fas ${showCvv ? 'fa-eye-slash' : 'fa-eye'}`} />
                  </button>
                </div>
              </div>
              <div className={styles.fg}>
                <div className={styles.fl} style={{ visibility:'hidden' }}>_</div>
                <label className={styles.saveCard}>
                  <input type="checkbox" style={{ accentColor:'#1A4FC4' }} />
                  Sauvegarder cette carte
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── Infos Cash / Wallet ── */}
        {payMode === 'cash' && (
          <div className={styles.infoBox} style={{ marginTop:14 }}>
            <i className="fas fa-circle-info" style={{ color:'#1A4FC4' }} />
            <span>Le paiement en espèces se fait à la réception. Préparez le montant exact.</span>
          </div>
        )}
        {payMode === 'wallet' && (
          <div className={styles.infoBox} style={{ marginTop:14 }}>
            <i className="fas fa-circle-check" style={{ color:'#047857' }} />
            <span>
              Solde disponible : <strong style={{ color:'#047857' }}>85 000 GNF</strong>.
              Le reste sera débité selon un mode secondaire.
            </span>
          </div>
        )}

        {/* ── Code promotionnel ── */}
        <div className={styles.promoBorder}>
          <div className={styles.promoTitle}>Code promotionnel</div>
          <div className={styles.promoRow}>
            <input
              className={styles.promoIn}
              type="text"
              placeholder="Entrez votre code promo"
              value={promoCode}
              disabled={promoActif}
              onChange={e => setPromoCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyPromo()}
            />
            <button className={styles.promoBtn} onClick={applyPromo} disabled={promoActif}>
              Appliquer
            </button>
          </div>

          {/* Badge code actif */}
          {promoActif && (
            <div className={styles.promoOk}>
              <i className="fas fa-tag" style={{ fontSize:13 }} />
              <span>Code <strong>SHOPI20</strong> — Réduction de 20%</span>
              <span
                className={styles.promoRm}
                onClick={() => { onPromo(false); onToast('🗑️ Code promo retiré'); }}
              >✕</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
