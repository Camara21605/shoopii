/* ============================================================
 * FICHIER : src/modules/auth/components/LoginForm.tsx
 * ============================================================ */

import React from 'react';
import { FieldInput } from '../../../shared/components/ui/FieldInput';
import type { LoginFormData, FormErrors, Role } from '../types';

interface LoginFormProps {
  data:              LoginFormData;
  errors:            FormErrors;
  selectedRole:      Role;        // gardé pour compatibilité mais non affiché
  isLoading:         boolean;
  onDataChange:      (data: Partial<LoginFormData>) => void;
  onRoleSelect:      (role: Role, icon: string) => void; // gardé pour compatibilité
  onSubmit:          () => void;
  onForgot:          () => void;
  onSwitchToRegister:() => void;
  onSocialToast:     (msg: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  data,
  errors,
  isLoading,
  onDataChange,
  onSubmit,
  onForgot,
  onSwitchToRegister,
  onSocialToast,
}) => {
  return (
    <div id="loginForm">

      {/* ── Erreur encadrée (une seule, peu importe la combinaison) ── */}
      {/* Affichée quand le backend retourne "identifiants incorrects",
          ou quand email/mot de passe sont manquants ou invalides */}
      {(errors.general || errors.email || errors.password) && (
        <div style={{
          background:   'var(--rose-dim, #fff0f0)',
          border:       '1.5px solid var(--rose, #e55)',
          borderRadius: '10px',
          padding:      '12px 16px',
          marginBottom: '16px',
          display:      'flex',
          alignItems:   'flex-start',
          gap:          '10px',
        }}>
          <span style={{ fontSize: '18px', flexShrink: 0 }}>{errors.general ? '⚠️' : '🔐'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--rose, #c33)', marginBottom: '2px' }}>
              {errors.general ? 'Identifiants incorrects' : 'Connexion impossible'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--rose, #c33)', opacity: 0.85 }}>
              {errors.general || errors.email || errors.password}
            </div>
          </div>
        </div>
      )}

      {/* ── Champs ── */}
      <div className="fields">
        <FieldInput
          id="loginEmail"
          label="Email ou téléphone"
          icon="fas fa-envelope"
          placeholder="votre@email.com ou +224…"
          value={data.email}
          onChange={val => onDataChange({ email: val })}
          error={undefined} // on gère l'erreur globalement au-dessus
        />

        <FieldInput
          id="loginPwd"
          label="Mot de passe"
          labelRight={
            <a href="#" onClick={e => { e.preventDefault(); onForgot(); }} className="forgot-link">
              Mot de passe oublié ?
            </a>
          }
          icon="fas fa-lock"
          type="password"
          placeholder="Votre mot de passe"
          value={data.password}
          onChange={val => onDataChange({ password: val })}
          error={undefined} // on gère l'erreur globalement au-dessus
        />
      </div>

      {/* ── Se souvenir de moi ── */}
      <div className="remember-row" style={{ marginTop: '14px' }}>
        <label className="remember-label">
          <input
            type="checkbox"
            id="rememberMe"
            checked={data.rememberMe}
            onChange={e => onDataChange({ rememberMe: e.target.checked })}
          />
          Se souvenir de moi
        </label>
      </div>

      {/* ── Bouton connexion ── */}
      <button
        className={`btn-submit${isLoading ? ' loading' : ''}`}
        id="loginBtn"
        onClick={onSubmit}
        disabled={isLoading}
        style={{ marginTop: '16px' }}
      >
        {isLoading ? (
          <><i className="fas fa-circle-notch spin" />{' '}Connexion…</>
        ) : (
          <><i className="fas fa-right-to-bracket" />{' '}Se connecter</>
        )}
      </button>

      {/* ── Séparateur ── */}
      <div className="or-div">ou continuer avec</div>

      {/* ── Boutons sociaux ── */}
      <div className="social-btns">
        <button className="s-btn" onClick={() => onSocialToast('📲 Connexion Orange Money')}>
          <span style={{ fontSize: '16px' }}>🏦</span> Orange Money
        </button>
        <button className="s-btn" onClick={() => onSocialToast('📘 Connexion Google')}>
          <img src="https://www.google.com/favicon.ico" width={14} height={14} alt="" />
          {' '}Google
        </button>
        <button className="s-btn" onClick={() => onSocialToast('📱 Connexion par SMS')}>
          <i className="fas fa-mobile-screen" style={{ color: 'var(--blue)' }} />
          {' '}SMS OTP
        </button>
      </div>

      {/* ── Lien inscription ── */}
      <div className="form-bottom">
        Pas encore de compte ?{' '}
        <a href="#" onClick={e => { e.preventDefault(); onSwitchToRegister(); }}>
          S'inscrire gratuitement
        </a>
      </div>

    </div>
  );
};