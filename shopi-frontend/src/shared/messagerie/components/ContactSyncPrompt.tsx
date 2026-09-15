/* ================================================================
 * FICHIER : src/shared/messagerie/components/ContactSyncPrompt.tsx
 *
 * Invite automatique (affichée une seule fois par appareil, à la
 * première visite de la messagerie) à synchroniser les contacts du
 * téléphone. Voir useContactSync.syncFromDevice() pour le détail
 * technique — IMPORTANT : accepter ici ouvre ensuite le sélecteur de
 * contacts NATIF du navigateur (Contact Picker API), une étape que
 * l'app ne peut pas sauter : c'est une restriction volontaire des
 * navigateurs (aucun site ne peut lire silencieusement le carnet
 * d'adresses d'un téléphone), pas une limite de cette implémentation.
 * L'utilisateur choisit "tout sélectionner" en un geste dans cette
 * fenêtre native, puis la synchro et le classement dans "Contacts"
 * se font seuls, sans autre action de sa part.
 * ================================================================ */

interface ContactSyncPromptProps {
  onAccept: () => void;
  onDismiss: () => void;
  title: string;
  description: string;
  acceptLabel: string;
  laterLabel: string;
}

export default function ContactSyncPrompt({
  onAccept, onDismiss, title, description, acceptLabel, laterLabel,
}: ContactSyncPromptProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(11,31,58,.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={e => { e.stopPropagation(); onDismiss(); }}
    >
      <div
        style={{ background: 'var(--white, #fff)', borderRadius: 22, padding: 32, maxWidth: 400, width: '100%', boxShadow: '0 24px 64px rgba(11,31,58,.3)', textAlign: 'center' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>📇</div>
        <div style={{ fontFamily: 'var(--fd, Fraunces, serif)', fontWeight: 800, fontSize: 19, color: 'var(--navy, #0B1F3A)', marginBottom: 8 }}>
          {title}
        </div>
        <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 24 }}>
          {description}
        </p>

        <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
          <button
            onClick={onAccept}
            style={{
              background: 'var(--blue, #2563EB)', color: '#fff',
              border: 'none', borderRadius: 12, padding: '13px 24px', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <i className="fas fa-address-book" /> {acceptLabel}
          </button>
          <button
            onClick={onDismiss}
            style={{ background: 'none', color: 'var(--t3)', border: '1px solid var(--bdr2)', borderRadius: 12, padding: '12px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {laterLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
