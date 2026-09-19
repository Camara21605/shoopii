/* ================================================================
 * FICHIER : src/modules/home/components/ui/CatalogueIcon.tsx
 *
 * Visuel d'un type d'entreprise / d'une catégorie / d'une sous-catégorie :
 * l'image téléversée par le super-admin si elle existe, sinon l'ancien
 * emoji (données antérieures aux images), sinon le repli fourni.
 * L'image remplit son conteneur (à lui de fournir taille + arrondi).
 * ================================================================ */

interface Props {
  imageUrl?: string | null;
  icone?:    string | null;
  fallback:  string;
  /** Puce de filtre : petite pastille ronde (px) alignée avec le texte,
   *  au lieu de remplir un conteneur. */
  inline?:   number;
}

/* Une icône peut aussi être une classe FontAwesome ("fa-store"). */
const FA_RE = /^fa[srlbd]?[ -]/;

export default function CatalogueIcon({ imageUrl, icone, fallback, inline }: Props) {
  if (imageUrl && inline) {
    return (
      <img
        src={imageUrl} alt="" loading="lazy" draggable={false}
        style={{ width: inline, height: inline, objectFit: 'cover', borderRadius: '50%', verticalAlign: 'middle', marginRight: 5 }}
      />
    );
  }
  if (imageUrl) {
    return (
      <img
        src={imageUrl} alt="" loading="lazy" draggable={false}
        style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', minWidth: 0, minHeight: 0, objectFit: 'cover', borderRadius: 'inherit', display: 'block' }}
      />
    );
  }
  const v = icone?.trim();
  if (v && FA_RE.test(v)) return <i className={v.startsWith('fa-') ? `fas ${v}` : v} />;
  return <>{v || fallback}{inline ? ' ' : ''}</>;
}
