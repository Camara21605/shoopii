/*
 * ============================================================
 * FICHIER : src/dashboards/entreprise/pages/FournisseursPage.tsx
 *
 * RÔLE    : Connexion à des fournisseurs — d'autres entreprises
 *           Shopi qui vendent en gros (venteEnGros=true). Permet
 *           de rechercher/connecter une entreprise fournisseur,
 *           consulter son catalogue de vente en gros (paliers de
 *           prix dégressifs, MOQ), et se déconnecter.
 *
 * Pas d'intégration API tierce (Alibaba, Amazon…) — le fournisseur
 * est ici une autre entreprise déjà présente sur la plateforme.
 * Connecté à l'API réelle GET/POST/DELETE /fournisseurs.
 * ============================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../shared/context/ToastContext';
import { useTeamPermissions } from '../hooks/useTeamPermissions';
import styles from './FournisseursPage.module.css';

// ─────────────────────────────────────────────────────────────
// TYPES — correspondent à FournisseursService (backend)
// ─────────────────────────────────────────────────────────────

interface Fournisseur {
  linkId:            string;
  companyId:         string;
  nom:               string;
  logo:              string | null;
  description:       string | null;
  produitsGrosCount: number;
  connecteLe:        string;
}

interface Candidat {
  id:                string;
  nom:               string;
  logo:              string | null;
  description:       string | null;
  produitsGrosCount: number;
  dejaConnecte:      boolean;
}

interface WholesaleTier {
  quantiteMin:  number;
  quantiteMax:  number | null;
  prixUnitaire: number;
}

interface CatalogueProduit {
  id:              string;
  nom:             string;
  prix:            number;
  moq:             number | null;
  conditionnement: number | null;
  image:           string | null;
  wholesaleTiers:  WholesaleTier[];
}

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
const token = () => localStorage.getItem('shopi_access_token') ?? '';

function fmt(n: number) {
  return n.toLocaleString('fr-FR');
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL — FournisseursPage
// ─────────────────────────────────────────────────────────────
export default function FournisseursPage() {
  const { pop } = useToast();
  const { t } = useTranslation();
  const { can, isOwner, loading: permLoading } = useTeamPermissions();
  const canConnect = isOwner || can('fournisseurs', 'connect');
  const canDisconnect = isOwner || can('fournisseurs', 'disconnect');

  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading,      setLoading]      = useState(true);

  // ── Modale de recherche/connexion ─────────────────────────────
  const [modalRecherche,   setModalRecherche]   = useState(false);
  const [search,           setSearch]           = useState('');
  const [candidats,        setCandidats]        = useState<Candidat[]>([]);
  const [loadingCandidats, setLoadingCandidats] = useState(false);
  const [connecting,       setConnecting]       = useState<string | null>(null);

  // ── Modale catalogue fournisseur ──────────────────────────────
  const [catalogueOuvert,  setCatalogueOuvert]  = useState<Fournisseur | null>(null);
  const [catalogue,        setCatalogue]        = useState<CatalogueProduit[]>([]);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);

  // ── Chargement des fournisseurs connectés ─────────────────────
  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/fournisseurs`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      setFournisseurs(await res.json());
    } catch {
      pop(t('fournisseurs.loadError'), 'e');
    } finally {
      setLoading(false);
    }
  }, [pop, t]);

  useEffect(() => { charger(); }, [charger]);

  // ── Recherche d'entreprises vendant en gros ───────────────────
  const rechercher = useCallback(async (q: string) => {
    setLoadingCandidats(true);
    try {
      const url = new URL(`${API}/fournisseurs/recherche`);
      if (q.trim()) url.searchParams.set('search', q.trim());
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      setCandidats(await res.json());
    } catch {
      pop(t('fournisseurs.searchError'), 'e');
    } finally {
      setLoadingCandidats(false);
    }
  }, [pop, t]);

  function ouvrirRecherche() {
    setSearch('');
    setModalRecherche(true);
    rechercher('');
  }

  // Recherche différée (debounce) pendant la frappe
  useEffect(() => {
    if (!modalRecherche) return;
    const id = setTimeout(() => rechercher(search), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, modalRecherche]);

  // ── Connexion à un fournisseur ─────────────────────────────────
  async function connecter(candidat: Candidat) {
    setConnecting(candidat.id);
    try {
      const res = await fetch(`${API}/fournisseurs`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token()}`,
        },
        body: JSON.stringify({ supplierCompanyId: candidat.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? `Erreur ${res.status}`);
      }
      const nouveau: Fournisseur = await res.json();
      setFournisseurs(prev => [nouveau, ...prev]);
      setCandidats(prev => prev.map(c => c.id === candidat.id ? { ...c, dejaConnecte: true } : c));
      pop(t('fournisseurs.connectSuccess', { nom: nouveau.nom }), 's');
    } catch (e: any) {
      pop(`❌ ${e.message}`, 'e');
    } finally {
      setConnecting(null);
    }
  }

  // ── Déconnexion d'un fournisseur ───────────────────────────────
  async function deconnecter(f: Fournisseur) {
    try {
      const res = await fetch(`${API}/fournisseurs/${f.linkId}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      setFournisseurs(prev => prev.filter(x => x.linkId !== f.linkId));
      pop(t('fournisseurs.disconnectSuccess', { nom: f.nom }), 's');
    } catch {
      pop(t('fournisseurs.disconnectError'), 'e');
    }
  }

  // ── Ouverture du catalogue d'un fournisseur ─────────────────────
  async function voirCatalogue(f: Fournisseur) {
    setCatalogueOuvert(f);
    setLoadingCatalogue(true);
    try {
      const res = await fetch(`${API}/fournisseurs/${f.companyId}/catalogue`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      setCatalogue(await res.json());
    } catch {
      pop(t('fournisseurs.catalogueError'), 'e');
    } finally {
      setLoadingCatalogue(false);
    }
  }

  // Un collaborateur sans fournisseurs.view ne doit jamais voir cette page —
  // mise à jour instantanée si la permission est révoquée pendant qu'il y
  // est déjà (voir useTeamPermissions : socket team:permissions_changed).
  if (!permLoading && !isOwner && !can('fournisseurs', 'view')) {
    return (
      <div className={styles.page} style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
        <div style={{ textAlign:'center', color:'var(--t2)' }}>
          <i className="fas fa-lock" style={{ fontSize:28, opacity:.5, marginBottom:12, display:'block' }} />
          <strong>{t('fournisseurs.accessDenied.title')}</strong>
          <div style={{ fontSize:13, marginTop:6 }}>{t('fournisseurs.accessDenied.message')}</div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── En-tête ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.titre}>{t('fournisseurs.header.title')}</h1>
          <p className={styles.sousTitre}>{t('fournisseurs.header.subtitle')}</p>
        </div>
        {canConnect && (
          <button className={styles.btnPrimary} onClick={ouvrirRecherche}>
            <i className="fas fa-plus" /> {t('fournisseurs.header.connecter')}
          </button>
        )}
      </div>

      {/* ── Liste des fournisseurs connectés ── */}
      {loading ? (
        <div className={styles.stateBox}>
          <i className="fas fa-spinner fa-spin" />
          <span>{t('fournisseurs.loading')}</span>
        </div>
      ) : fournisseurs.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIco}>🏭</span>
          <strong>{t('fournisseurs.empty.title')}</strong>
          <p>{t('fournisseurs.empty.sub')}</p>
          {canConnect && (
            <button className={styles.btnPrimary} onClick={ouvrirRecherche}>
              <i className="fas fa-plus" /> {t('fournisseurs.header.connecter')}
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {fournisseurs.map(f => (
            <div key={f.linkId} className={styles.card}>
              <div className={styles.cardHead}>
                {f.logo ? (
                  <img src={f.logo} alt={f.nom} className={styles.logo} />
                ) : (
                  <div className={styles.logoEmpty}><i className="fas fa-industry" /></div>
                )}
                <div className={styles.cardHeadInfo}>
                  <div className={styles.nom}>{f.nom}</div>
                  <div className={styles.meta}>{t('fournisseurs.card.produitsGros', { count: f.produitsGrosCount })}</div>
                </div>
              </div>
              {f.description && <p className={styles.description}>{f.description}</p>}
              <div className={styles.cardActions}>
                <button className={styles.btnSecondary} onClick={() => voirCatalogue(f)}>
                  <i className="fas fa-boxes-stacked" /> {t('fournisseurs.card.voirCatalogue')}
                </button>
                {canDisconnect && (
                  <button
                    className={styles.btnDanger}
                    onClick={() => deconnecter(f)}
                    title={t('fournisseurs.card.deconnecter')}
                  >
                    <i className="fas fa-link-slash" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODALE — Rechercher / connecter un fournisseur
          ════════════════════════════════════════════════════════ */}
      {modalRecherche && (
        <div className={styles.overlay} onClick={() => setModalRecherche(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <i className="fas fa-magnifying-glass" /> {t('fournisseurs.searchModal.title')}
              </div>
              <button className={styles.closeBtn} onClick={() => setModalRecherche(false)}>
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.searchWrap}>
                <i className="fas fa-magnifying-glass" />
                <input
                  autoFocus
                  className={styles.searchInput}
                  placeholder={t('fournisseurs.searchModal.placeholder')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className={styles.candidatList}>
                {loadingCandidats ? (
                  <div className={styles.stateBoxInline}><i className="fas fa-spinner fa-spin" /></div>
                ) : candidats.length === 0 ? (
                  <div className={styles.emptyInline}>{t('fournisseurs.searchModal.noResults')}</div>
                ) : candidats.map(c => (
                  <div key={c.id} className={styles.candidatItem}>
                    {c.logo ? (
                      <img src={c.logo} alt={c.nom} className={styles.candidatLogo} />
                    ) : (
                      <div className={styles.candidatLogoEmpty}><i className="fas fa-industry" /></div>
                    )}
                    <div className={styles.candidatInfo}>
                      <div className={styles.candidatNom}>{c.nom}</div>
                      <div className={styles.candidatMeta}>{t('fournisseurs.card.produitsGros', { count: c.produitsGrosCount })}</div>
                    </div>
                    <button
                      className={c.dejaConnecte ? styles.btnConnected : styles.btnConnect}
                      onClick={() => !c.dejaConnecte && connecter(c)}
                      disabled={c.dejaConnecte || connecting === c.id}
                    >
                      {c.dejaConnecte
                        ? <><i className="fas fa-check" /> {t('fournisseurs.searchModal.connecte')}</>
                        : connecting === c.id
                          ? <i className="fas fa-spinner fa-spin" />
                          : t('fournisseurs.searchModal.connecter')
                      }
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODALE — Catalogue de vente en gros du fournisseur
          ════════════════════════════════════════════════════════ */}
      {catalogueOuvert && (
        <div className={styles.overlay} onClick={() => setCatalogueOuvert(null)}>
          <div className={`${styles.modal} ${styles.modalLarge}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>
                  <i className="fas fa-boxes-stacked" /> {catalogueOuvert.nom}
                </div>
                <div className={styles.modalSub}>{t('fournisseurs.catalogueModal.subtitle')}</div>
              </div>
              <button className={styles.closeBtn} onClick={() => setCatalogueOuvert(null)}>
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className={styles.modalBody}>
              {loadingCatalogue ? (
                <div className={styles.stateBoxInline}><i className="fas fa-spinner fa-spin" /></div>
              ) : catalogue.length === 0 ? (
                <div className={styles.emptyInline}>{t('fournisseurs.catalogueModal.empty')}</div>
              ) : (
                <div className={styles.catalogueGrid}>
                  {catalogue.map(p => (
                    <div key={p.id} className={styles.produitCard}>
                      {p.image ? (
                        <img src={p.image} alt={p.nom} className={styles.produitImg} />
                      ) : (
                        <div className={styles.produitImgEmpty}><i className="fas fa-image" /></div>
                      )}
                      <div className={styles.produitNom}>{p.nom}</div>
                      <div className={styles.produitPrix}>{fmt(p.prix)} GNF</div>
                      {p.moq !== null && (
                        <div className={styles.produitMoq}>{t('fournisseurs.catalogueModal.moq', { count: p.moq })}</div>
                      )}
                      {p.wholesaleTiers.length > 0 && (
                        <div className={styles.tiersList}>
                          {p.wholesaleTiers.map((tier, i) => (
                            <div key={i} className={styles.tierRow}>
                              <span>{tier.quantiteMax ? `${tier.quantiteMin}–${tier.quantiteMax}` : `${tier.quantiteMin}+`}</span>
                              <span>{fmt(tier.prixUnitaire)} GNF</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
