/*
 * FICHIER: src/dashboards/entreprise/pages/ServicesPage.tsx
 * Page catalogue services — miroir de ProduitsPage.tsx, sans stories
 * (hors scope MVP pour Service, voir service.entity.ts en-tête) et avec
 * des champs adaptés (tarification/durée/mode de prestation au lieu de
 * stock/marque/variantes).
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../shared/context/ToastContext';
import { useTeamPermissions } from '../hooks/useTeamPermissions';
import type { EntreprisePage } from '../types';
import styles from './ProduitsPage.module.css';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface ServicesPageProps {
  onNavigate: (page: EntreprisePage, serviceId?: string) => void;
}

interface ServiceItem {
  id:          string;
  nom:         string;
  description: string | null;
  tags:        string | null;
  visibilite:  'public' | 'draft' | 'private';
  pricingType: 'fixe' | 'horaire' | 'sur_devis';
  prix:        number | null;
  prixAncien:  number | null;
  dureeMinMinutes: number | null;
  dureeMaxMinutes: number | null;
  capaciteMax:     number | null;
  surPlaceEntreprise: boolean;
  aDomicile:          boolean;
  aDistance:          boolean;
  reservationRequise: boolean;
  category:    { id: string; nom: string; icone: string | null };
  subCategory: { id: string; nom: string } | null;
  media:       { id: string; url: string; ordre: number; alt: string | null; type: string }[];
  specs:       { id: string; cle: string; valeur: string; ordre: number }[];
  companyId:   string;
  createdAt:   string;
  updatedAt:   string;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const API   = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
const token = () => localStorage.getItem('shopi_access_token') ?? '';

function fmt(n: number | string) {
  return Number(n).toLocaleString('fr-FR');
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function visibiliteLabel(v: string, t: (k: string) => string) {
  if (v === 'public')  return { label: t('services.visibilite.public'),  cls: styles.badgePublic  };
  if (v === 'draft')   return { label: t('services.visibilite.draft'),   cls: styles.badgeDraft   };
  return                      { label: t('services.visibilite.private'), cls: styles.badgePrivate };
}

function prixLabel(s: ServiceItem, t: (k: string) => string): string {
  if (s.pricingType === 'sur_devis') return t('services.pricingType.sur_devis');
  const suffix = s.pricingType === 'horaire' ? '/h' : '';
  return s.prix != null ? `${fmt(s.prix)} GNF${suffix}` : t('services.modalVoir.nonRenseigne');
}

// ─────────────────────────────────────────────────────────────
// MODALE — VOIR LE SERVICE
// ─────────────────────────────────────────────────────────────

function ModalVoir({ service, onClose, onEdit, onArchive, onDelete, can, commissionPct }: {
  service:       ServiceItem;
  onClose:       () => void;
  onEdit:        () => void;
  onArchive:     () => void;
  onDelete:      () => void;
  can:           (group: string, action: string) => boolean;
  commissionPct: number;
}) {
  const { t } = useTranslation();
  const [imgIdx, setImgIdx] = useState(0);
  const vis = visibiliteLabel(service.visibilite, t);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>
              {service.category.icone && <span>{service.category.icone}</span>}
              {service.nom}
            </div>
            <div className={styles.modalMeta}>
              <span className={`${styles.badge} ${vis.cls}`}>{vis.label}</span>
              <span className={styles.metaItem}>
                <i className="fas fa-tag" /> {service.category.nom}
                {service.subCategory && ` › ${service.subCategory.nom}`}
              </span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>

          {/* Galerie médias */}
          {service.media.length > 0 ? (
            <div className={styles.galerie}>
              <div className={styles.galerieMain}>
                {service.media[imgIdx]?.type === 'video' ? (
                  <video src={service.media[imgIdx]?.url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <img src={service.media[imgIdx]?.url} alt={service.media[imgIdx]?.alt ?? service.nom} />
                )}
              </div>
              {service.media.length > 1 && (
                <div className={styles.galerieThumbs}>
                  {service.media.map((m, i) => (
                    <div
                      key={m.id}
                      className={`${styles.galerieThumb} ${i === imgIdx ? styles.galerieThumbActive : ''}`}
                      onClick={() => setImgIdx(i)}
                    >
                      <img src={m.url} alt={m.alt ?? `Média ${i + 1}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.noImage}>
              <i className="fas fa-image" />
              <span>{t('services.modalVoir.noImage')}</span>
            </div>
          )}

          {/* Infos principales */}
          <div className={styles.infoGrid}>

            {/* Tarif */}
            <div className={styles.infoCard}>
              <div className={styles.infoCardTitle}><i className="fas fa-tag" /> {t('services.modalVoir.prix')}</div>
              <div className={styles.prixMain}>{prixLabel(service, t)}</div>
              {service.pricingType !== 'sur_devis' && service.prix != null && (
                <>
                  <div className={styles.commission}>
                    <span>{t('services.modalVoir.commission')}</span>
                    <span>-{fmt(Math.round(service.prix * commissionPct / 100))} GNF</span>
                  </div>
                  <div className={styles.revenuNet}>
                    <span>{t('services.modalVoir.revenuNet')}</span>
                    <strong>{fmt(Math.round(service.prix * (1 - commissionPct / 100)))} GNF</strong>
                  </div>
                </>
              )}
            </div>

            {/* Durée */}
            <div className={styles.infoCard}>
              <div className={styles.infoCardTitle}><i className="fas fa-clock" /> {t('services.modalVoir.duree')}</div>
              <div className={styles.prixMain}>
                {service.dureeMinMinutes || service.dureeMaxMinutes
                  ? `${service.dureeMinMinutes ?? '?'}${service.dureeMaxMinutes && service.dureeMaxMinutes !== service.dureeMinMinutes ? `-${service.dureeMaxMinutes}` : ''} ${t('services.modalVoir.minutes')}`
                  : t('services.modalVoir.nonRenseigne')}
              </div>
              {service.capaciteMax && (
                <div className={styles.seuilInfo}>
                  <i className="fas fa-users" /> {service.capaciteMax}
                </div>
              )}
            </div>

            {/* Mode de prestation */}
            <div className={styles.infoCard}>
              <div className={styles.infoCardTitle}><i className="fas fa-location-dot" /> {t('services.modalVoir.modePrestation')}</div>
              <div className={styles.detailsList}>
                {service.surPlaceEntreprise && (
                  <div className={styles.detailRow}><span>{t('services.modalVoir.surPlace')}</span></div>
                )}
                {service.aDomicile && (
                  <div className={styles.detailRow}><span>{t('services.modalVoir.domicile')}</span></div>
                )}
                {service.aDistance && (
                  <div className={styles.detailRow}><span>{t('services.modalVoir.distance')}</span></div>
                )}
                <div className={styles.detailRow}>
                  <span>{t('services.modalVoir.reservation')}</span>
                  <strong>{service.reservationRequise ? t('services.modalVoir.reservationRequise') : t('services.modalVoir.sansRendezVous')}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {service.description && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}><i className="fas fa-align-left" /> {t('services.modalVoir.description')}</div>
              <p className={styles.description}>{service.description}</p>
            </div>
          )}

          {/* Specs */}
          {service.specs.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}><i className="fas fa-list-check" /> {t('services.modalVoir.inclus')}</div>
              <div className={styles.specsTable}>
                {service.specs.map(s => (
                  <div key={s.id} className={styles.specRow}>
                    <span className={styles.specCle}>{s.cle}</span>
                    <span className={styles.specVal}>{s.valeur}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {service.tags && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}><i className="fas fa-hashtag" /> {t('services.modalVoir.tags')}</div>
              <div className={styles.tagsList}>
                {service.tags.split(',').map(tag => (
                  <span key={tag.trim()} className={styles.tag}>{tag.trim()}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className={styles.modalFooter}>
          {can('services', 'delete') && (
            <button className={styles.btnDanger} onClick={onDelete}>
              <i className="fas fa-trash" /> {t('services.modalVoir.supprimer')}
            </button>
          )}
          {can('services', 'edit') && (
            <>
              <button className={styles.btnSecondary} onClick={onArchive}>
                <i className="fas fa-archive" /> {t('services.modalVoir.archiver')}
              </button>
              <button className={styles.btnPrimary} onClick={onEdit}>
                <i className="fas fa-pen" /> {t('services.modalVoir.modifier')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODALE — MODIFIER RAPIDE (visibilité)
// ─────────────────────────────────────────────────────────────

function ModalModifier({ service, onClose, onSaved }: {
  service:  ServiceItem;
  onClose:  () => void;
  onSaved:  (s: ServiceItem) => void;
}) {
  const { t } = useTranslation();
  const { pop } = useToast();
  const [visibilite, setVisibilite] = useState(service.visibilite);
  const [loading,    setLoading]    = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/prestations/${service.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ visibilite }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? t('services.toasts.genericError'));
      const updated = await res.json();
      onSaved(updated);
      pop(t('services.toasts.updated'), 's');
      onClose();
    } catch (e: any) {
      pop(`❌ ${e.message}`, 'e');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalSm}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <i className="fas fa-pen" /> {t('services.modalModifier.title')}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.prodNomResume}>
            {service.media[0] && (
              <img src={service.media[0].url} alt={service.nom} className={styles.miniThumb} />
            )}
            <div>
              <div className={styles.prodNom}>{service.nom}</div>
              <div className={styles.prodRef}>{service.category.nom}</div>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>{t('services.modalModifier.visibilite')}</label>
            <select
              className={styles.formSelect}
              value={visibilite}
              onChange={e => setVisibilite(e.target.value as any)}
            >
              <option value="public">{t('services.modalModifier.optPublic')}</option>
              <option value="draft">{t('services.modalModifier.optDraft')}</option>
              <option value="private">{t('services.modalModifier.optPrivate')}</option>
            </select>
          </div>

          <div className={styles.infoBox}>
            <i className="fas fa-circle-info" />
            {t('services.modalModifier.info')}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>
            {t('services.modalModifier.annuler')}
          </button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={loading}>
            {loading ? <><i className="fas fa-spinner fa-spin" /> {t('services.modalModifier.saving')}</> : <><i className="fas fa-check" /> {t('services.modalModifier.save')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODALE — CONFIRMER SUPPRESSION
// ─────────────────────────────────────────────────────────────

function ModalDelete({ service, onClose, onDeleted }: {
  service:   ServiceItem;
  onClose:   () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const { pop } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/prestations/${service.id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error((await res.json()).message ?? t('services.toasts.genericError'));
      onDeleted();
      pop(t('services.toasts.deleted'), 's');
      onClose();
    } catch (e: any) {
      pop(`❌ ${e.message}`, 'e');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalXs}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={`${styles.modalTitle} ${styles.dangerTitle}`}>
            <i className="fas fa-triangle-exclamation" /> {t('services.modalDelete.title')}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.deleteWarning}>
            <div className={styles.deleteIcon}>🗑️</div>
            <p>{t('services.modalDelete.confirm', { nom: service.nom })}</p>
            <p className={styles.deleteNote}>{t('services.modalDelete.irreversible')}</p>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>
            {t('services.modalDelete.annuler')}
          </button>
          <button className={styles.btnDanger} onClick={handleDelete} disabled={loading}>
            {loading ? <><i className="fas fa-spinner fa-spin" /> {t('services.modalDelete.deleting')}</> : <><i className="fas fa-trash" /> {t('services.modalDelete.confirmBtn')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function ServicesPage({ onNavigate }: ServicesPageProps) {
  const { t } = useTranslation();
  const { pop } = useToast();
  const { can } = useTeamPermissions();

  const [services,  setServices]  = useState<ServiceItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [erreur,    setErreur]    = useState<string | null>(null);
  const [search,    setSearch]    = useState('');
  const [filtreVis, setFiltreVis] = useState('tous');

  const [commissionPct, setCommissionPct] = useState<number>(3);

  const [modalVoir,   setModalVoir]   = useState<ServiceItem | null>(null);
  const [modalModif,  setModalModif]  = useState<ServiceItem | null>(null);
  const [modalDelete, setModalDelete] = useState<ServiceItem | null>(null);

  useEffect(() => {
    fetch(`${API}/dashboard/entreprise/commission-rate`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { percentage: number } | null) => {
        if (data?.percentage != null) setCommissionPct(data.percentage);
      })
      .catch(() => {});
  }, []);

  const charger = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      const res = await fetch(`${API}/prestations`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setServices(data.data ?? []);
    } catch (e: any) {
      setErreur(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const servicesFiltres = services.filter(s => {
    const matchSearch = !search.trim() ||
      s.nom.toLowerCase().includes(search.toLowerCase()) ||
      (s.tags ?? '').toLowerCase().includes(search.toLowerCase());
    const matchVis = filtreVis === 'tous' || s.visibilite === filtreVis;
    return matchSearch && matchVis;
  });

  function handleSaved(updated: ServiceItem) {
    setServices(prev => prev.map(s => s.id === updated.id ? updated : s));
  }
  function handleDeleted(id: string) {
    setServices(prev => prev.filter(s => s.id !== id));
  }
  async function handleArchive(service: ServiceItem) {
    try {
      const res = await fetch(`${API}/prestations/${service.id}/archive`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      setServices(prev => prev.map(s =>
        s.id === service.id ? { ...s, visibilite: 'private' } : s
      ));
      pop(t('services.toasts.archived'), 's');
      setModalVoir(null);
    } catch {
      pop(`❌ ${t('services.toasts.archiveError')}`, 'e');
    }
  }

  const stats = {
    total:      services.length,
    publics:    services.filter(s => s.visibilite === 'public').length,
    brouillons: services.filter(s => s.visibilite === 'draft').length,
  };

  // ─────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.titre}>{t('services.header.title')}</h1>
          <p className={styles.sousTitre}>{t('services.header.subtitle')}</p>
        </div>
        {can('services', 'create') && (
          <button className={styles.btnAjouter} onClick={() => onNavigate('ajouter-service')}>
            <i className="fas fa-plus" /> {t('services.header.nouveau')}
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      <div className={styles.statsRow}>
        {[
          { label: t('services.stats.total'),      val: stats.total,      icon: 'fa-concierge-bell', cls: styles.statBlue  },
          { label: t('services.stats.publies'),    val: stats.publics,    icon: 'fa-globe',          cls: styles.statGreen },
          { label: t('services.stats.brouillons'), val: stats.brouillons, icon: 'fa-file-pen',       cls: styles.statAmber },
        ].map(s => (
          <div key={s.label} className={`${styles.statCard} ${s.cls}`}>
            <div className={styles.statIcon}><i className={`fas ${s.icon}`} /></div>
            <div className={styles.statVal}>{s.val}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filtres ── */}
      <div className={styles.filtres}>
        <div className={styles.searchWrap}>
          <i className="fas fa-magnifying-glass" />
          <input
            className={styles.searchInput}
            placeholder={t('services.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => setSearch('')}>
              <i className="fas fa-xmark" />
            </button>
          )}
        </div>
        <div className={styles.filtresBtns}>
          {[
            { val: 'tous',    label: t('services.filters.tous') },
            { val: 'public',  label: t('services.filters.publics') },
            { val: 'draft',   label: t('services.filters.brouillons') },
            { val: 'private', label: t('services.filters.prives') },
          ].map(f => (
            <button
              key={f.val}
              className={`${styles.filtreBtn} ${filtreVis === f.val ? styles.filtreBtnActive : ''}`}
              onClick={() => setFiltreVis(f.val)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div className={styles.loading}>
          <i className="fas fa-spinner fa-spin" />
          <span>{t('services.loading')}</span>
        </div>
      ) : erreur ? (
        <div className={styles.erreur}>
          <i className="fas fa-triangle-exclamation" />
          <span>{erreur}</span>
          <button onClick={charger} className={styles.btnReessayer}>{t('services.retry')}</button>
        </div>
      ) : servicesFiltres.length === 0 ? (
        <div className={styles.vide}>
          <div className={styles.videIco}>🛠️</div>
          <div className={styles.videTitle}>
            {services.length === 0 ? t('services.empty.noneTitle') : t('services.empty.noResultsTitle')}
          </div>
          <div className={styles.videSub}>
            {services.length === 0
              ? t('services.empty.noneSub')
              : t('services.empty.noResultsSub')}
          </div>
          {services.length === 0 && can('services', 'create') && (
            <button className={styles.btnAjouter} onClick={() => onNavigate('ajouter-service')}>
              <i className="fas fa-plus" /> {t('services.empty.addFirst')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className={styles.compteur}>
            {t('services.count', { count: servicesFiltres.length })}
            {search && ` ${t('services.countFor', { search })}`}
          </div>
          <div className={styles.gridRows}>
            {chunk(servicesFiltres, 10).map((ligne, ligneIdx) => (
              <div key={ligneIdx} className={styles.gridRow}>
                {ligne.map(s => {
                  const vis = visibiliteLabel(s.visibilite, t);

                  return (
                    <div key={s.id} className={styles.card}>

                      {/* Image */}
                      <div className={styles.cardImg} onClick={() => setModalVoir(s)}>
                        {s.media.length > 0 ? (
                          s.media[0].type === 'video' ? (
                            <video src={s.media[0].url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <img src={s.media[0].url} alt={s.nom} />
                          )
                        ) : (
                          <div className={styles.noImgPlaceholder}>
                            <i className="fas fa-image" />
                          </div>
                        )}
                        <div className={styles.cardBadges}>
                          <span className={`${styles.badge} ${vis.cls}`}>{vis.label}</span>
                        </div>
                        <div className={styles.cardOverlay}>
                          <span><i className="fas fa-eye" /> {t('services.card.voir')}</span>
                        </div>
                      </div>

                      {/* Body */}
                      <div className={styles.cardBody}>
                        {s.category && (
                          <div className={styles.cardCat}>
                            {s.category.icone} {s.category.nom}
                            {s.subCategory && <span> › {s.subCategory.nom}</span>}
                          </div>
                        )}
                        <div className={styles.cardNom}>{s.nom}</div>

                        <div className={styles.cardPrix}>
                          <span className={styles.prixVal}>{prixLabel(s, t)}</span>
                        </div>

                        {(s.dureeMinMinutes || s.dureeMaxMinutes) && (
                          <div className={styles.cardStock}>
                            <i className="fas fa-clock" style={{ marginRight: 5 }} />
                            <span className={styles.stockTxt}>
                              {s.dureeMinMinutes ?? '?'}{s.dureeMaxMinutes && s.dureeMaxMinutes !== s.dureeMinMinutes ? `-${s.dureeMaxMinutes}` : ''} {t('services.modalVoir.minutes')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className={styles.cardActions}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => setModalVoir(s)}
                          title={t('services.card.voirDetail')}
                        >
                          <i className="fas fa-eye" />
                        </button>
                        {can('services', 'edit') && (
                          <>
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                              onClick={() => setModalModif(s)}
                              title={t('services.card.modifRapide')}
                            >
                              <i className="fas fa-pen" />
                            </button>
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnFull}`}
                              onClick={() => onNavigate('ajouter-service', s.id)}
                              title={t('services.card.modifComplet')}
                            >
                              <i className="fas fa-sliders" /> {t('services.card.modifier')}
                            </button>
                          </>
                        )}
                        {can('services', 'delete') && (
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            onClick={() => setModalDelete(s)}
                            title={t('services.card.supprimer')}
                          >
                            <i className="fas fa-trash" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Modales ── */}
      {modalVoir && (
        <ModalVoir
          service={modalVoir}
          onClose={() => setModalVoir(null)}
          onEdit={() => { setModalVoir(null); onNavigate('ajouter-service', modalVoir.id); }}
          onArchive={() => handleArchive(modalVoir)}
          onDelete={() => { setModalDelete(modalVoir); setModalVoir(null); }}
          can={can}
          commissionPct={commissionPct}
        />
      )}
      {modalModif && (
        <ModalModifier
          service={modalModif}
          onClose={() => setModalModif(null)}
          onSaved={handleSaved}
        />
      )}
      {modalDelete && (
        <ModalDelete
          service={modalDelete}
          onClose={() => setModalDelete(null)}
          onDeleted={() => handleDeleted(modalDelete.id)}
        />
      )}
    </div>
  );
}
