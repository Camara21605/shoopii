// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/components/ImageUploader.tsx
//
// Sélecteur d'image du catalogue (types d'entreprise, catégories,
// sous-catégories) : le super-admin téléverse lui-même l'image, qui
// remplace l'ancien pictogramme emoji. Envoie le fichier vers
// POST /upload/image/catalogue (Cloudinary, réservé SUPER_ADMIN) et
// remonte l'URL obtenue via onChange ('' = image retirée).
// ─────────────────────────────────────────────────────────────

import { useRef, useState } from 'react';
import { BASE_URL, tokenStorage } from '../../../shared/services/apiFetch';

const MAX_SIZE = 5 * 1024 * 1024;                       // même plafond que le backend
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface Props {
  /** URL actuelle de l'image ('' ou null = aucune). */
  value:    string | null;
  onChange: (url: string) => void;
  /** Taille de l'aperçu en px (défaut 76). */
  size?:    number;
}

export function ImageUploader({ value, onChange, size = 76 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (!ACCEPTED.includes(file.type)) { setError('Format non supporté (JPG, PNG, WebP ou GIF).'); return; }
    if (file.size > MAX_SIZE)          { setError('Image trop lourde (5 Mo maximum).'); return; }

    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${BASE_URL}/upload/image/catalogue`, {
        method:      'POST',
        /* Volontairement SANS credentials:'include' : avec les cookies de
         * session, le middleware CSRF exigerait l'en-tête X-CSRF-Token (403
         * sinon). Le Bearer suffit, comme pour les autres routes /upload. */
        headers:     { Authorization: `Bearer ${tokenStorage.get() ?? ''}` },
        body:        form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(res.status === 401 ? 'Session expirée, reconnectez-vous.' : data.message ?? `Erreur ${res.status}`);
      }
      const data: { url: string } = await res.json();
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec du téléversement.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            background: 'var(--raised)', border: '1px dashed var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--txt-3)', fontSize: size / 3,
          }}
        >
          {busy
            ? <i className="fas fa-circle-notch fa-spin" />
            : value
              ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <i className="fas fa-image" />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 14px' }}
              disabled={busy} onClick={() => inputRef.current?.click()}>
              {value ? "Changer l'image" : 'Ajouter une image'}
            </button>
            {value && !busy && (
              <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 14px' }}
                onClick={() => { setError(''); onChange(''); }}>
                Retirer
              </button>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>
            JPG, PNG, WebP ou GIF · 5 Mo max · image carrée conseillée
          </div>
        </div>

        <input
          ref={inputRef} type="file" accept={ACCEPTED.join(',')} hidden
          onChange={e => pick(e.target.files?.[0])}
        />
      </div>
      {error && <div style={{ color: 'var(--rose)', fontSize: 12, marginTop: 6 }}>⚠️ {error}</div>}
    </div>
  );
}

/**
 * Vignette d'une entité du catalogue dans les listes du super-admin :
 * image téléversée si elle existe, sinon l'ancien emoji (données
 * antérieures aux images), sinon le repli fourni.
 */
export function CatalogueThumb({
  imageUrl, icone, fallback, size = 34, radius = 10,
}: { imageUrl?: string | null; icone?: string | null; fallback: string; size?: number; radius?: number | string }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: 'hidden',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: imageUrl ? 'var(--raised)' : 'transparent', fontSize: size * 0.6, lineHeight: 1,
      }}
    >
      {imageUrl
        ? <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (icone || fallback)}
    </span>
  );
}
