/*
 * FICHIER : src/modules/home/components/sections/ProduitPlusConsulteGallery.tsx
 *
 * Galerie de l'accueil : les images du produit le plus consulté
 * (GET /public/produits/plus-consulte), en grandes cartes verticales
 * arrondies qui défilent horizontalement — sans aucun texte.
 * Un clic sur une image ouvre la fiche détaillée du produit.
 * Les images défilent toutes seules (une carte toutes les AUTO_DELAI ms, retour
 * au début en fin de rangée) ; l'utilisateur peut aussi faire défiler à la
 * main — le défilement automatique se met alors en pause un moment.
 * Tant qu'aucun produit n'a de vues, c'est le dernier produit ajouté.
 * Si l'API ne connaît pas encore cet endpoint (backend pas redéployé),
 * repli sur le dernier produit de /public/produits.
 * Rien n'est affiché tant qu'aucun produit (avec images) n'est disponible.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../../shared/services/apiFetch';
import styles from './ProduitPlusConsulteGallery.module.css';

interface ProduitPlusConsulte {
  id:     string;
  nom:    string;
  images: { id: string; url: string; alt: string | null }[];
}

/* Défilement automatique : intervalle, et pause après une action de l'utilisateur */
const AUTO_DELAI = 3000;
const PAUSE_APRES_INTERACTION = 6000;

type ImageApi = { id: string; url: string; alt?: string | null; type?: string };

/** Dernier produit ajouté ayant au moins une image (repli). */
async function dernierProduit(): Promise<ProduitPlusConsulte | null> {
  const res = await apiFetch<{ data: { id: string; nom: string; images?: ImageApi[] }[] }>(
    '/public/produits', { public: true, params: { limit: 10 } });
  for (const p of res?.data ?? []) {
    const images = (p.images ?? []).filter(i => !i.type || i.type === 'image');
    if (images.length) {
      return { id: p.id, nom: p.nom, images: images.map(i => ({ id: i.id, url: i.url, alt: i.alt ?? null })) };
    }
  }
  return null;
}

export default function ProduitPlusConsulteGallery() {
  const navigate = useNavigate();
  const [produit, setProduit] = useState<ProduitPlusConsulte | null>(null);

  useEffect(() => {
    let alive = true;
    apiFetch<ProduitPlusConsulte | null>('/public/produits/plus-consulte', { public: true })
      .then(res => res?.images?.length ? res : dernierProduit())
      .catch(() => dernierProduit())
      .then(res => { if (alive && res) setProduit(res); })
      .catch(() => { /* section simplement masquée */ });
    return () => { alive = false; };
  }, []);

  /* Défilement automatique horizontal */
  const railRef  = useRef<HTMLDivElement>(null);
  const pauseRef = useRef(0);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !produit || produit.images.length < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const pause = () => { pauseRef.current = Date.now() + PAUSE_APRES_INTERACTION; };
    const evts = ['pointerdown', 'touchstart', 'wheel'] as const;
    evts.forEach(e => rail.addEventListener(e, pause, { passive: true }));

    const id = window.setInterval(() => {
      if (Date.now() < pauseRef.current || document.hidden) return;
      const card = rail.firstElementChild as HTMLElement | null;
      if (!card) return;
      const pas = card.offsetWidth + parseFloat(getComputedStyle(rail).columnGap || '0');
      const fin = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
      rail.scrollTo({ left: fin ? 0 : rail.scrollLeft + pas, behavior: 'smooth' });
    }, AUTO_DELAI);

    return () => {
      window.clearInterval(id);
      evts.forEach(e => rail.removeEventListener(e, pause));
    };
  }, [produit]);

  if (!produit) return null;

  const ouvrir = () => navigate(`/produit/${produit.id}`);

  return (
    <section className={styles.sec} aria-label={produit.nom}>
      <div className={styles.rail} ref={railRef}>
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
