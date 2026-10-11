/*
 * FICHIER : src/modules/home/components/sections/ProduitPlusConsulteGallery.tsx
 *
 * Galerie de l'accueil : les images du produit le plus consulté
 * (GET /public/produits/plus-consulte), en grandes cartes verticales
 * arrondies qui défilent horizontalement — sans aucun texte.
 * Un clic sur une image ouvre la fiche détaillée du produit.
 * Rien n'est affiché tant qu'aucun produit (avec images) n'est disponible.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../../shared/services/apiFetch';
import styles from './ProduitPlusConsulteGallery.module.css';

interface ProduitPlusConsulte {
  id:     string;
  nom:    string;
  images: { id: string; url: string; alt: string | null }[];
}

export default function ProduitPlusConsulteGallery() {
  const navigate = useNavigate();
  const [produit, setProduit] = useState<ProduitPlusConsulte | null>(null);

  useEffect(() => {
    let alive = true;
    apiFetch<ProduitPlusConsulte | null>('/public/produits/plus-consulte', { public: true })
      .then(res => { if (alive && res?.images?.length) setProduit(res); })
      .catch(() => { /* section simplement masquée */ });
    return () => { alive = false; };
  }, []);

  if (!produit) return null;

  const ouvrir = () => navigate(`/produit/${produit.id}`);

  return (
    <section className={styles.sec} aria-label={produit.nom}>
      <div className={styles.rail}>
        {produit.images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            className={styles.card}
            onClick={ouvrir}
            aria-label={`${produit.nom} — image ${i + 1}`}
          >
            <img
              src={img.url}
              alt={img.alt ?? produit.nom}
              loading={i < 2 ? 'eager' : 'lazy'}
              draggable={false}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
