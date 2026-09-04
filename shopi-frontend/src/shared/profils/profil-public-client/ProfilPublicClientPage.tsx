/* ================================================================
 * FICHIER : profil-public-client/ProfilPublicClientPage.tsx
 *
 * Page profil public d'UN client (/clients/:id), telle que consultée
 * par un autre visiteur (connecté ou anonyme). Toutes les données
 * proviennent de GET /client/profils/:id, qui respecte déjà les
 * réglages "Confidentialité du profil" du client visité — cette page
 * n'a donc rien à filtrer elle-même, elle affiche ce que l'API renvoie.
 *
 * Réutilise les styles de profil-client (même famille visuelle) plutôt
 * que d'en dupliquer un jeu complet pour une page plus simple.
 * ================================================================ */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import Header from '../../../modules/home/components/layout/Header';
import { fetchClientPublicProfil } from '../../services/clientPublicProfil.api';
import type { ClientPublicProfilApi } from '../../services/clientPublicProfil.api';
import type { Favori } from '../profil-client/data/profilClientData';

import styles from '../profil-client/styles/ProfilClient.module.css';

function mapWishlist(api: NonNullable<ClientPublicProfilApi['wishlist']>): Favori[] {
  return api.map(f => ({
    id: f.productId,
    emoji: f.emoji,
    nom: f.nom,
    prix: f.prix,
    prixAncien: f.prixAncien != null ? f.prixAncien.toLocaleString('fr-FR') + ' GNF' : undefined,
    imageUrl: f.imageUrl,
  }));
}

export default function ProfilPublicClientPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [profil, setProfil] = useState<ClientPublicProfilApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onToast = useCallback((msg: string) => {
    window.dispatchEvent(new CustomEvent('shoneya-toast', { detail: msg }));
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchClientPublicProfil(id)
      .then(setProfil)
      .catch(e => setError(e?.message ?? 'Profil introuvable.'))
      .finally(() => setLoading(false));
  }, [id]);

  const header = (
    <Header
      onToast={onToast}
      onLogin={() => navigate('/login')}
      onRegister={() => navigate('/register')}
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <div className={styles.page}>
          <div className={styles.state}><i className="fas fa-spinner fa-spin" /> Chargement du profil…</div>
        </div>
      </>
    );
  }

  if (error || !profil) {
    return (
      <>
        {header}
        <div className={styles.page}>
          <div className={styles.state}>
            <i className="fas fa-triangle-exclamation" />
            {error ?? 'Profil introuvable.'}
            <div style={{ marginTop: 16 }}>
              <button className={styles.abEdit} style={{ padding: '10px 18px', borderRadius: 9 }}
                onClick={() => navigate(-1)}>
                <i className="fas fa-arrow-left" /> Retour
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const wishlist = profil.wishlist ? mapWishlist(profil.wishlist) : null;

  return (
    <>
      {header}

      <div className={styles.page}>
        {/* Cover + identité */}
        <div className={styles.cover}>
          <div className={styles.coverBg} />
          <div className={styles.coverDots} />
        </div>

        <div className={styles.idBar}>
          <div className={styles.idWrap}>
            <div className={styles.avaZone}>
              <div className={styles.ava}>
                {profil.avatar
                  ? <img
                      src={profil.avatar}
                      alt={profil.nom}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    />
                  : profil.initiales}
              </div>
            </div>

            <div className={styles.idRow}>
              <div>
                <div className={styles.idName}>{profil.nom}</div>
                <div className={styles.idMeta}>
                  <span><i className="fas fa-calendar" /> {profil.membreDepuis}</span>
                </div>
              </div>

              <div className={styles.idActs}>
                <button className={styles.btn} onClick={() => onToast('🔗 Lien du profil copié')}>
                  <i className="fas fa-share-nodes" /> Partager
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* KPI — uniquement ce que l'API a bien voulu renvoyer */}
        {profil.commandesCount != null && (
          <div className={styles.kpi}>
            <div className={styles.kpiIn}>
              <div className={styles.ki}>
                <div className={styles.kiV}>{profil.commandesCount}</div>
                <div className={styles.kiL}>Commandes livrées</div>
              </div>
            </div>
          </div>
        )}

        <div className={styles.pw} style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
          <main>
            {profil.bio && (
              <div className={styles.card}>
                <div className={styles.ch}>
                  <div className={styles.ct}><i className="fas fa-user" /> À propos</div>
                </div>
                <div className={styles.cb} style={{ padding: '16px 18px', fontSize: 13.5, lineHeight: 1.6 }}>
                  {profil.bio}
                </div>
              </div>
            )}

            {wishlist && (
              <div className={styles.card} style={{ marginTop: 16 }}>
                <div className={styles.ch}>
                  <div className={styles.ct}><i className="fas fa-bookmark" /> Liste de souhaits ({wishlist.length})</div>
                </div>
                {wishlist.length === 0 ? (
                  <div className={styles.cb}>
                    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--t3)' }}>
                      <i className="fas fa-bookmark" style={{ fontSize: 28, display: 'block', marginBottom: 10, opacity: 0.3 }} />
                      Liste de souhaits vide
                    </div>
                  </div>
                ) : (
                  <div className={styles.favG}>
                    {wishlist.map(f => (
                      <div key={f.id} className={styles.favC} onClick={() => navigate(`/produit/${f.id}`)}>
                        <div className={styles.favImg}>
                          {f.imageUrl
                            ? <img src={f.imageUrl} alt={f.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : f.emoji}
                        </div>
                        <div className={styles.favBd}>
                          <div className={styles.favNm2}>{f.nom}</div>
                          <div className={styles.favPr}>
                            {f.prix.toLocaleString('fr-FR')} GNF
                            {f.prixAncien && <span className={styles.favOld}>{f.prixAncien}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!profil.bio && !wishlist && profil.commandesCount == null && (
              <div className={styles.card}>
                <div className={styles.cb} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--t3)' }}>
                  Ce membre n'a rendu aucune information publique.
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
