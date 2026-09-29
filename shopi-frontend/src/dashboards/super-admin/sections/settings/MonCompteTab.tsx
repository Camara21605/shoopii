/**
 * @file   MonCompteTab.tsx
 * @module settings/tabs
 *
 * Onglet « Mon compte » — sécurité du compte super-admin lui-même.
 *
 * BUG CORRIGÉ (audit 2026-09) — le super-admin n'avait AUCUN écran pour son propre
 * compte : impossible de changer le mot de passe fourni à la création, ni de voir l'état
 * de sa double authentification.
 *
 *   GET   /dashboard/super-admin/my-securite           → score, dernière connexion, session
 *   PATCH /dashboard/super-admin/my-securite/password  → changement de mot de passe
 *
 * Après un changement de mot de passe, le serveur ferme toutes les sessions : on
 * déconnecte (onLogout) pour se reconnecter avec le nouveau.
 *
 * 2FA : le super-admin n'a pas de fiche Admin (colonnes 2FA) — tant que
 * `twoFaDisponible` est faux, la carte l'annonce « bientôt disponible ».
 */

import React, { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../../../shared/services/apiFetch';
import { SettingGroup, SettingRow } from './components';

interface Securite {
  score:             number;
  scoreItems:        { key: string; label: string; ok: boolean; hint: string }[];
  twoFaEnabled:      boolean;
  twoFaDisponible?:  boolean;
  lastLoginAt:       string | null;
  lastLoginIp:       string | null;
  passwordChangedAt: string | null;
  currentSession:    { browser?: string; os?: string; ipAddress?: string | null; connectedSince?: string } | null;
}

interface Props {
  toast:    (msg: string, type?: 'success' | 'error' | 'info') => void;
  onLogout: () => void;
}

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** Mêmes règles que le serveur (ChangeMyPasswordDto). */
function erreurMotDePasse(actuel: string, nouveau: string, confirmation: string): string | null {
  if (!actuel) return 'Saisissez votre mot de passe actuel.';
  if (nouveau.length < 8) return 'Le nouveau mot de passe doit contenir au moins 8 caractères.';
  if (!/[a-z]/.test(nouveau) || !/[A-Z]/.test(nouveau) || !/\d/.test(nouveau)) {
    return 'Le nouveau mot de passe doit contenir une majuscule, une minuscule et un chiffre.';
  }
  if (nouveau === actuel) return 'Le nouveau mot de passe doit être différent de l’actuel.';
  if (nouveau !== confirmation) return 'Les deux nouveaux mots de passe ne correspondent pas.';
  return null;
}

export default function MonCompteTab({ toast, onLogout }: Props) {
  const [sec, setSec] = useState<Securite | null>(null);
  const [erreurChargement, setErreurChargement] = useState(false);

  const [actuel, setActuel]             = useState('');
  const [nouveau, setNouveau]           = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [envoi, setEnvoi]               = useState(false);

  useEffect(() => {
    let annule = false;
    apiFetch<Securite>('/dashboard/super-admin/my-securite')
      .then(r => { if (!annule) setSec(r); })
      .catch(() => { if (!annule) setErreurChargement(true); });
    return () => { annule = true; };
  }, []);

  async function changerMotDePasse(e: React.FormEvent) {
    e.preventDefault();
    const err = erreurMotDePasse(actuel, nouveau, confirmation);
    if (err) { toast(err, 'error'); return; }
    setEnvoi(true);
    try {
      await apiFetch('/dashboard/super-admin/my-securite/password', {
        method: 'PATCH',
        body:   { currentPassword: actuel, newPassword: nouveau, confirmPassword: confirmation },
      });
      toast('Mot de passe mis à jour. Reconnectez-vous avec le nouveau mot de passe.', 'success');
      setTimeout(onLogout, 1500);
    } catch (e2) {
      toast(e2 instanceof ApiError ? e2.message : 'Échec du changement de mot de passe.', 'error');
    } finally {
      setEnvoi(false);
    }
  }

  const champ = (valeur: string, onChange: (v: string) => void, autoComplete: string) => (
    <input
      className="input-field"
      type="password"
      value={valeur}
      maxLength={72}
      autoComplete={autoComplete}
      onChange={e => onChange(e.target.value)}
      style={{ width: 220 }}
    />
  );

  return (
    <div className="settings-grid">

      {/* ── GROUPE 1 : État du compte ── */}
      <SettingGroup icon="🛡️" iconBg="var(--acid-dim)" title="État de mon compte">
        {erreurChargement ? (
          <SettingRow label="Sécurité du compte" desc="Informations momentanément indisponibles.">
            <span />
          </SettingRow>
        ) : !sec ? (
          <SettingRow label="Chargement…"><span /></SettingRow>
        ) : (
          <>
            {sec.scoreItems.map(item => (
              <SettingRow key={item.key} label={item.label} desc={item.ok ? undefined : item.hint}>
                <span style={{ fontSize: 12, fontWeight: 700, color: item.ok ? 'var(--acid)' : 'var(--rose)' }}>
                  {item.ok ? '✓ OK' : '✗ À faire'}
                </span>
              </SettingRow>
            ))}
            <SettingRow label="Dernière connexion" desc={sec.lastLoginIp ? `Adresse IP : ${sec.lastLoginIp}` : undefined}>
              <span style={{ fontSize: 12.5 }}>{fmtDate(sec.lastLoginAt)}</span>
            </SettingRow>
            <SettingRow label="Mot de passe modifié le">
              <span style={{ fontSize: 12.5 }}>{fmtDate(sec.passwordChangedAt)}</span>
            </SettingRow>
            {sec.currentSession && (
              <SettingRow
                label="Session actuelle"
                desc={[sec.currentSession.browser, sec.currentSession.os].filter(Boolean).join(' · ') || undefined}
              >
                <span style={{ fontSize: 12.5 }}>{fmtDate(sec.currentSession.connectedSince)}</span>
              </SettingRow>
            )}
          </>
        )}
      </SettingGroup>

      {/* ── GROUPE 2 : Mot de passe ── */}
      <SettingGroup icon="🔑" iconBg="var(--rose-dim)" title="Changer mon mot de passe">
        <form onSubmit={changerMotDePasse}>
          <SettingRow label="Mot de passe actuel">
            {champ(actuel, setActuel, 'current-password')}
          </SettingRow>
          <SettingRow label="Nouveau mot de passe" desc="8 caractères minimum, avec une majuscule, une minuscule et un chiffre.">
            {champ(nouveau, setNouveau, 'new-password')}
          </SettingRow>
          <SettingRow label="Confirmer le nouveau mot de passe">
            {champ(confirmation, setConfirmation, 'new-password')}
          </SettingRow>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0 4px' }}>
            <button type="submit" className="btn" disabled={envoi}>
              {envoi ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
            </button>
          </div>
        </form>
      </SettingGroup>

      {/* ── GROUPE 3 : Double authentification ── */}
      <SettingGroup icon="📱" iconBg="var(--violet-dim)" title="Double authentification (2FA)">
        <SettingRow
          label="Application d’authentification"
          desc={sec?.twoFaDisponible === false
            ? undefined
            : 'Un code à 6 chiffres est demandé à chaque connexion.'}
          bientot={sec?.twoFaDisponible === false}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: sec?.twoFaEnabled ? 'var(--acid)' : 'var(--txt-3)' }}>
            {sec?.twoFaEnabled ? 'Activée' : 'Désactivée'}
          </span>
        </SettingRow>
      </SettingGroup>

    </div>
  );
}
