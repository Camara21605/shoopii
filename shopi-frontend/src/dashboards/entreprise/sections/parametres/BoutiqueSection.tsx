/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/BoutiqueSection.tsx
 *
 * CONNECTÉ À L'API — Sections 1 + 2 des paramètres entreprise.
 * ✅ Images logo et cover corrigées avec classes CSS dédiées
 * ✅ Plus de styles inline sur les images
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';
import {
  VILLES_SORTED, getCommunesByVille, getQuartiersByCommune,
} from '../../../../shared/location/data/geo-guinee';

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────

interface Props {
  data:         ParametresData | null;
  saving:       boolean;
  onDirty:      () => void;
  onToast:      (m: string, t?: string) => void;
  saveBoutique: (body: Partial<ParametresData>) => Promise<void>;
  saveContact:  (body: Partial<ParametresData>) => Promise<void>;
  uploadLogo:   (file: File) => Promise<void>;
  uploadCover:  (file: File) => Promise<void>;
  deleteLogo:   () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT
// ─────────────────────────────────────────────────────────────

export default function BoutiqueSection({
  data, saving,
  onDirty, onToast,
  saveBoutique, saveContact,
  uploadLogo, uploadCover, deleteLogo,
}: Props) {
  const { t } = useTranslation();

  // ── État formulaire boutique (section 1) ─────────────────
  const [nomBoutique,   setNomBoutique]   = useState('');
  const [description,   setDescription]  = useState('');
  const [slogan,        setSlogan]        = useState('');
  const [website,       setWebsite]       = useState('');
  const [tags,          setTags]          = useState('');
  const [status,        setStatus]        = useState('active');
  const [companyTypeId, setCompanyTypeId] = useState('');

  // ── État formulaire contact (section 2) ──────────────────
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [whatsapp,      setWhatsapp]      = useState('');
  const [adresse,       setAdresse]       = useState('');
  const [commune,       setCommune]       = useState('');
  const [quartier,      setQuartier]      = useState('');
  const [ville,         setVille]         = useState('');
  const [pays,          setPays]          = useState('GN');
  const [repere,        setRepere]        = useState('');

  /* ── Cascades ville → commune → quartier ── */
  const communes  = useMemo(() => pays === 'GN' ? getCommunesByVille(ville) : [], [ville, pays]);
  const quartiers = useMemo(() => pays === 'GN' && commune ? getQuartiersByCommune(ville, commune) : [], [ville, commune, pays]);

  const handleVilleChange = (v: string) => {
    setVille(v);
    setCommune('');
    setQuartier('');
  };
  const handleCommuneChange = (c: string) => {
    setCommune(c);
    setQuartier('');
  };

  // ── Refs inputs file cachés ───────────────────────────────
  const logoInputRef  = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // ── Pré-remplir depuis l'API ──────────────────────────────
  useEffect(() => {
    if (!data) return;
    setNomBoutique(data.companyName    ?? '');
    setDescription(data.description    ?? '');
    setSlogan(data.slogan               ?? '');
    setWebsite(data.website             ?? '');
    setTags(data.tags                   ?? '');
    setStatus(data.status               ?? 'active');
    setCompanyTypeId(data.companyTypeId ?? '');
    setBusinessPhone(data.businessPhone ?? '');
    setBusinessEmail(data.businessEmail ?? '');
    setWhatsapp(data.whatsapp           ?? '');
    setAdresse(data.adresse             ?? '');
    setCommune(data.commune             ?? '');
    setQuartier((data as any).quartier  ?? '');
    setVille(data.ville                 ?? '');
    setPays(data.pays                   ?? 'GN');
    setRepere(data.repere               ?? '');
  }, [data]);

  const pct = calculerCompletion(data);

  // ─────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────

  async function handleSaveBoutique() {
    try {
      await saveBoutique({
        companyName:   nomBoutique,
        description,
        slogan,
        website,
        tags,
        status:        status as any,
        companyTypeId: companyTypeId || undefined,
      });
      onToast(t('parametres.boutique.savedToast'), 's');
    } catch {
      onToast(t('parametres.boutique.errorToast'), 'e');
    }
  }

  async function handleSaveContact() {
    try {
      await saveContact({ businessPhone, businessEmail, whatsapp, adresse, commune, quartier, ville, pays, repere } as any);
      onToast(t('parametres.boutique.contactSavedToast'), 's');
    } catch {
      onToast(t('parametres.boutique.errorToast'), 'e');
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { onToast(t('parametres.boutique.logoTropLourd'), 'e'); return; }
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      onToast(t('parametres.boutique.formatInvalide'), 'e'); return;
    }
    try {
      onToast(t('parametres.boutique.uploadEnCours'), 'i');
      await uploadLogo(file);
      onToast(t('parametres.boutique.logoMisAJour'), 's');
    } catch {
      onToast(t('parametres.boutique.echecUploadLogo'), 'e');
    }
    e.target.value = ''; // reset pour permettre re-sélection du même fichier
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { onToast(t('parametres.boutique.imageTropLourde'), 'e'); return; }
    try {
      onToast(t('parametres.boutique.uploadEnCours'), 'i');
      await uploadCover(file);
      onToast(t('parametres.boutique.coverMiseAJour'), 's');
    } catch {
      onToast(t('parametres.boutique.echecUploadCover'), 'e');
    }
    e.target.value = '';
  }

  async function handleDeleteLogo() {
    if (!data?.logo) return;
    try {
      await deleteLogo();
      onToast(t('parametres.boutique.logoSupprime'), 'w');
    } catch {
      onToast(t('parametres.boutique.logoSuppressionImpossible'), 'e');
    }
  }

  // ─────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────

  return (
    <>
      {/* ── En-tête ── */}
      <div className={s.sectionHd}>
        <h1><i className="fas fa-store" /> {t('parametres.boutique.title')}</h1>
        <p>{t('parametres.boutique.subtitle')}</p>
      </div>

      {/* ── Barre de complétion ── */}
      <div className={s.completionBar}>
        <div className={s.completionBg} />
        <div className={s.completionInner}>
          <div className={s.completionRing}>
            <div className={s.completionPct}>{pct}%</div>
            <div className={s.completionLbl}>{t('parametres.boutique.profilLbl')}</div>
          </div>
          <div className={s.completionInfo}>
            <div className={s.completionTitle}>
              {t('parametres.boutique.completedAt', { pct })}
              {pct < 100 && ` ${t('parametres.boutique.elementsManquants')}`}
            </div>
            <div className={s.completionBarBg}>
              <div className={s.completionBarFill} style={{ width:`${pct}%` }} />
            </div>
            <div className={s.completionSteps}>
              {getStepsDone(data, t).map(l => (
                <span key={l} className={`${s.completionStep} ${s.done}`}>
                  <i className="fas fa-check-circle" /> {l}
                </span>
              ))}
              {getStepsMissing(data, t).map(l => (
                <span key={l} className={`${s.completionStep} ${s.miss}`}>
                  <i className="fas fa-circle" /> {l}
                </span>
              ))}
            </div>
          </div>
          <div className={s.completionHint}>
            {t('parametres.boutique.profilCompletPart1')} <strong>{t('parametres.boutique.profilCompletBold')}</strong> {t('parametres.boutique.profilCompletPart2')}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
       * LOGO & COUVERTURE
       * ══════════════════════════════════════════════════════ */}
      <FormCard
        title={t('parametres.boutique.logoCoverTitle')}
        icon="fa-image"
        subtitle={t('parametres.boutique.logoCoverSubtitle')}
      >
        <div style={{ display:'flex', alignItems:'flex-start', gap:22, flexWrap:'wrap' }}>

          {/* ── Logo ─────────────────────────────────────── */}
          <div style={{ textAlign:'center', flexShrink:0 }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>
              {t('parametres.boutique.logoBoutique')}
            </div>

            {/*
             * ✅ CORRIGÉ : .logoWrap gère border-radius + overflow:hidden
             * L'image utilise .logoImg → object-fit:cover sur toute la surface
             * Plus de styles inline qui cassaient l'affichage
             */}
            <div
              className={s.logoWrap}
              onClick={() => logoInputRef.current?.click()}
              title={t('parametres.boutique.cliquerChangerLogo')}
            >
              {data?.logo
                ? <img src={data.logo} alt="Logo boutique" className={s.logoImg} />
                : <span className={s.logoEmoji}>🏪</span>
              }
            </div>

            {/* Input file caché */}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display:'none' }}
              onChange={handleLogoChange}
            />

            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={saving}
              style={{
                background:'rgba(0,0,0,.06)', color:'var(--t2)',
                border:'1px solid var(--bdr2)', borderRadius:'var(--pill)',
                padding:'6px 14px', fontSize:11, fontWeight:700,
                display:'block', width:'100%', cursor:'pointer',
                marginTop:10, opacity:saving ? 0.5 : 1,
                fontFamily:'var(--fb)',
              }}
            >
              {saving ? <><i className="fas fa-spinner fa-spin" /> </> : null}
              {t('parametres.boutique.changer')}
            </button>

            {data?.logo && (
              <button
                onClick={handleDeleteLogo}
                disabled={saving}
                style={{
                  background:'none', border:'none',
                  color:'var(--t3)', fontSize:11, marginTop:6,
                  cursor:'pointer', display:'block', width:'100%',
                }}
              >
                {t('parametres.boutique.supprimer')}
              </button>
            )}
          </div>

          {/* ── Cover ────────────────────────────────────── */}
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>
              {t('parametres.boutique.imageCouverture')}
            </div>

            {/* Input file caché */}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display:'none' }}
              onChange={handleCoverChange}
            />

            {/*
             * ✅ CORRIGÉ : .coverWrap → position:relative + aspect-ratio:3/1 + overflow:hidden
             * .coverImg  → position:absolute + inset:0 + object-fit:cover (image prend tout l'espace)
             * .coverOverlay → overlay sombre au hover avec icône caméra
             * .coverPlaceholder → contenu quand pas d'image
             */}
            <div
              className={s.coverWrap}
              onClick={() => coverInputRef.current?.click()}
            >
              {data?.coverImage && (
                <img
                  src={data.coverImage}
                  alt="Image de couverture"
                  className={s.coverImg}
                />
              )}

              {/* Overlay hover — visible uniquement quand image présente */}
              <div className={s.coverOverlay}>
                <i className="fas fa-camera" style={{ fontSize:22 }} />
                <span style={{ fontSize:12, fontWeight:700 }}>{t('parametres.boutique.changerCouverture')}</span>
              </div>

              {/* Placeholder — visible quand pas d'image */}
              {!data?.coverImage && (
                <div className={s.coverPlaceholder}>
                  <i className="fas fa-panorama" />
                  <strong>{t('parametres.boutique.couvertureBoutique')}</strong>
                  <span>{t('parametres.boutique.couvertureDims')}</span>
                </div>
              )}
            </div>

            {/* Lien discret pour changer la cover quand elle existe */}
            {data?.coverImage && (
              <button
                onClick={() => coverInputRef.current?.click()}
                style={{
                  background:'none', border:'none',
                  color:'var(--t3)', fontSize:11, marginTop:7,
                  cursor:'pointer', display:'flex', alignItems:'center', gap:5,
                }}
              >
                <i className="fas fa-arrows-rotate" style={{ fontSize:10 }} />
                {t('parametres.boutique.changerImageCouverture')}
              </button>
            )}
          </div>

        </div>
      </FormCard>

      {/* ══════════════════════════════════════════════════════
       * INFORMATIONS DE LA BOUTIQUE
       * ══════════════════════════════════════════════════════ */}
      <FormCard
        title={t('parametres.boutique.infosTitle')}
        icon="fa-id-badge"
        subtitle={t('parametres.boutique.infosSubtitle')}
      >
        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.boutique.nomBoutique')} <span className={s.flOpt}>*</span></div>
          <div className={s.fw}>
            <i className={`fas fa-store ${s.fi}`} />
            <input className={s.fin} value={nomBoutique}
              onChange={e => { setNomBoutique(e.target.value); onDirty(); }}
              placeholder={t('parametres.boutique.nomBoutiquePlaceholder')} />
          </div>
          <div className={s.hint}>
            <i className="fas fa-circle-info" /> {t('parametres.boutique.nomBoutiqueHint')}
          </div>
        </div>

        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.boutique.description')} <span className={s.flOpt}>{t('parametres.boutique.descriptionVisiblePublique')}</span></div>
          <div className={s.fw}>
            <i className={`fas fa-pen-to-square ${s.fi}`} style={{ top:13, bottom:'auto' }} />
            <textarea
              className={`${s.fin} ${s.finTextarea}`}
              style={{ paddingLeft:38 }}
              value={description}
              onChange={e => { setDescription(e.target.value); onDirty(); }}
              placeholder={t('parametres.boutique.descriptionPlaceholder')}
              maxLength={1000}
            />
          </div>
          <div className={s.hint}><i className="fas fa-circle-info" /> {t('parametres.boutique.descriptionHint')}</div>
        </div>

        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.typeEntreprise')}</div>
            <div className={s.fw}>
              <i className={`fas fa-tag ${s.fi}`} />
              <select className={`${s.fin} ${s.finSelect}`}
                value={companyTypeId}
                onChange={e => { setCompanyTypeId(e.target.value); onDirty(); }}>
                <option value="">{t('parametres.boutique.selectionnerType')}</option>
                {data?.companyType && (
                  <option value={data.companyType.id}>{data.companyType.nom}</option>
                )}
              </select>
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.statutLabel')}</div>
            <div className={s.fw}>
              <i className={`fas fa-circle-dot ${s.fi}`} />
              <select className={`${s.fin} ${s.finSelect}`}
                value={status}
                onChange={e => { setStatus(e.target.value); onDirty(); }}>
                <option value="active">{t('parametres.boutique.statutActive')}</option>
                <option value="suspended">{t('parametres.boutique.statutPause')}</option>
                <option value="pending">{t('parametres.boutique.statutPrivee')}</option>
              </select>
            </div>
          </div>
        </div>

        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.slogan')} <span className={s.flOpt}>{t('parametres.boutique.optionnel')}</span></div>
            <div className={s.fw}>
              <i className={`fas fa-quote-left ${s.fi}`} />
              <input className={s.fin} value={slogan}
                onChange={e => { setSlogan(e.target.value); onDirty(); }}
                placeholder={t('parametres.boutique.sloganPlaceholder')} />
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.siteWeb')}</div>
            <div className={s.fw}>
              <i className={`fas fa-globe ${s.fi}`} />
              <input className={s.fin} type="url" value={website}
                onChange={e => { setWebsite(e.target.value); onDirty(); }}
                placeholder={t('parametres.boutique.siteWebPlaceholder')} />
            </div>
          </div>
        </div>

        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.boutique.tagsMotsCles')}</div>
          <div className={s.fw}>
            <i className={`fas fa-hashtag ${s.fi}`} />
            <input className={s.fin} value={tags}
              onChange={e => { setTags(e.target.value); onDirty(); }}
              placeholder={t('parametres.boutique.tagsPlaceholder')} />
          </div>
          <div className={s.hint}><i className="fas fa-circle-info" /> {t('parametres.boutique.tagsHint')}</div>
        </div>

        <div className={s.saveRow}>
          <button className={s.saveBtn} onClick={handleSaveBoutique} disabled={saving}>
            {saving
              ? <><i className="fas fa-spinner fa-spin" /> {t('parametres.boutique.sauvegardeEnCours')}</>
              : <><i className="fas fa-cloud-arrow-up" /> {t('parametres.boutique.sauvegarderBoutique')}</>
            }
          </button>
        </div>
      </FormCard>

      {/* ══════════════════════════════════════════════════════
       * CONTACT & LOCALISATION
       * ══════════════════════════════════════════════════════ */}
      <FormCard
        title={t('parametres.boutique.contactTitle')}
        icon="fa-map-location-dot"
        subtitle={t('parametres.boutique.contactSubtitle')}
      >
        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.telephonePrincipal')}</div>
            <div className={s.fw}>
              <div className={s.phonePfx}>🇬🇳 +224</div>
              <input className={s.fin} type="tel" value={businessPhone}
                onChange={e => { setBusinessPhone(e.target.value); onDirty(); }}
                style={{ paddingLeft:90 }} placeholder="620 00 00 00" />
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.emailBoutique')}</div>
            <div className={s.fw}>
              <i className={`fas fa-envelope ${s.fi}`} />
              <input className={s.fin} type="email" value={businessEmail}
                onChange={e => { setBusinessEmail(e.target.value); onDirty(); }}
                placeholder="boutique@example.com" />
            </div>
          </div>
        </div>

        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.boutique.whatsappLabel')}</div>
          <div className={s.fw}>
            <i className={`fab fa-whatsapp ${s.fi}`} style={{ color:'var(--t2)' }} />
            <input className={s.fin} type="tel" value={whatsapp}
              onChange={e => { setWhatsapp(e.target.value); onDirty(); }}
              placeholder={t('parametres.boutique.whatsappPlaceholder')} />
          </div>
        </div>

        {/* ── VILLE ── */}
        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.boutique.ville')} <span style={{ color: 'var(--t2)' }}>*</span></div>
          <div className={s.fw}>
            <i className={`fas fa-map-location-dot ${s.fi}`} />
            {pays === 'GN' ? (
              <select className={`${s.fin} ${s.finSelect}`}
                value={ville}
                onChange={e => { handleVilleChange(e.target.value); onDirty(); }}>
                <option value="">{t('parametres.boutique.choisirVille')}</option>
                {VILLES_SORTED.map(v => (
                  <option key={v.slug} value={v.nom}>{v.nom} ({v.region})</option>
                ))}
              </select>
            ) : (
              <input className={s.fin} value={ville}
                onChange={e => { setVille(e.target.value); onDirty(); }}
                placeholder={t('parametres.boutique.villePlaceholder')} />
            )}
          </div>
        </div>

        {/* ── COMMUNE (si ville sélectionnée et pays = GN) ── */}
        {pays === 'GN' && communes.length > 0 && (
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.commune')} <span style={{ color: 'var(--t2)' }}>*</span></div>
            <div className={s.fw}>
              <i className={`fas fa-city ${s.fi}`} />
              <select className={`${s.fin} ${s.finSelect}`}
                value={commune}
                onChange={e => { handleCommuneChange(e.target.value); onDirty(); }}>
                <option value="">{t('parametres.boutique.choisirCommune')}</option>
                {communes.map(c => (
                  <option key={c.nom} value={c.nom}>{c.nom}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── QUARTIER (si commune sélectionnée) ── */}
        {pays === 'GN' && quartiers.length > 0 && (
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.quartier')} <span style={{ color: 'var(--t2)' }}>*</span></div>
            <div className={s.fw}>
              <i className={`fas fa-map-pin ${s.fi}`} />
              <select className={`${s.fin} ${s.finSelect}`}
                value={quartier}
                onChange={e => { setQuartier(e.target.value); onDirty(); }}>
                <option value="">{t('parametres.boutique.choisirQuartier')}</option>
                {quartiers.map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Résumé localisation */}
        {ville && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: 'rgba(0,0,0,.06)', borderRadius: 9, padding: '7px 12px', marginBottom: 4 }}>
            <i className="fas fa-map-pin" style={{ color: 'var(--t2)', fontSize: 11 }} />
            <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>
              {[quartier, commune, ville].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}

        {/* ── ADRESSE PHYSIQUE ── */}
        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.boutique.adressePhysique')} <span style={{ fontWeight: 400, color: 'var(--t3)' }}>{t('parametres.boutique.adresseHintRue')}</span></div>
          <div className={s.fw}>
            <i className={`fas fa-location-dot ${s.fi}`} />
            <input className={s.fin} value={adresse}
              onChange={e => { setAdresse(e.target.value); onDirty(); }}
              placeholder={t('parametres.boutique.adressePlaceholder')} />
          </div>
        </div>

        {/* ── REPÈRE ── */}
        <div className={s.fg}>
          <div className={s.fl}>{t('parametres.boutique.repereLivreurs')}</div>
          <div className={s.fw}>
            <i className={`fas fa-comment-dots ${s.fi}`} />
            <input className={s.fin} value={repere}
              onChange={e => { setRepere(e.target.value); onDirty(); }}
              placeholder={t('parametres.boutique.repereLivreursPlaceholder')} />
          </div>
        </div>

        <div className={s.saveRow}>
          <button className={s.saveBtn} onClick={handleSaveContact} disabled={saving}>
            {saving
              ? <><i className="fas fa-spinner fa-spin" /> {t('parametres.boutique.sauvegardeContactEnCours')}</>
              : <><i className="fas fa-cloud-arrow-up" /> {t('parametres.boutique.sauvegarderContact')}</>
            }
          </button>
        </div>
      </FormCard>

      {/* ══════════════════════════════════════════════════════
       * RESPONSABLE & PROPRIÉTAIRE
       * ══════════════════════════════════════════════════════ */}
      <FormCard
        title={t('parametres.boutique.responsableTitle')}
        icon="fa-user-tie"
        subtitle={t('parametres.boutique.responsableSubtitle')}
      >
        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.prenom')} <span className={s.flOpt}>*</span></div>
            <div className={s.fw}>
              <i className={`fas fa-user ${s.fi}`} />
              <input className={s.fin}
                defaultValue={data ? '' : ''}
                placeholder={t('parametres.boutique.prenomPlaceholder')}
                readOnly
                style={{ background:'var(--g100)', cursor:'not-allowed', color:'var(--t3)' }}
              />
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>{t('parametres.boutique.nom')} <span className={s.flOpt}>*</span></div>
            <div className={s.fw}>
              <i className={`fas fa-user ${s.fi}`} />
              <input className={s.fin}
                defaultValue={data ? '' : ''}
                placeholder={t('parametres.boutique.nomPlaceholder')}
                readOnly
                style={{ background:'var(--g100)', cursor:'not-allowed', color:'var(--t3)' }}
              />
            </div>
          </div>
        </div>
        <div className={s.hint}>
          <i className="fas fa-circle-info" /> {t('parametres.boutique.responsableHintPart1')} <strong>{t('parametres.boutique.responsableHintBold')}</strong>{t('parametres.boutique.responsableHintPart2')}
        </div>
      </FormCard>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS — calcul du % de complétion du profil
// ─────────────────────────────────────────────────────────────

function getStepsLabels(t: TFunction): Record<string, string> {
  return {
    logo:         t('parametres.boutique.steps.logo'),
    companyName:  t('parametres.boutique.steps.companyName'),
    contact:      t('parametres.boutique.steps.contact'),
    products:     t('parametres.boutique.steps.products'),
    coverImage:   t('parametres.boutique.steps.coverImage'),
    returnPolicy: t('parametres.boutique.steps.returnPolicy'),
  };
}

function getStepsDone(data: ParametresData | null, t: TFunction): string[] {
  if (!data) return [];
  const labels = getStepsLabels(t);
  const done: string[] = [];
  if (data.logo)                                    done.push(labels.logo);
  if (data.companyName)                             done.push(labels.companyName);
  if (data.businessPhone || data.businessEmail)     done.push(labels.contact);
  if ((data.totalOrders ?? 0) > 0)                  done.push(labels.products);
  return done;
}

function getStepsMissing(data: ParametresData | null, t: TFunction): string[] {
  if (!data) return [];
  const labels = getStepsLabels(t);
  const miss: string[] = [];
  if (!data.coverImage)   miss.push(labels.coverImage);
  if (!data.returnPolicy) miss.push(labels.returnPolicy);
  return miss;
}

function calculerCompletion(data: ParametresData | null): number {
  if (!data) return 0;
  const checks = [
    !!data.logo,
    !!data.companyName,
    !!(data.businessPhone || data.businessEmail),
    (data.totalOrders ?? 0) > 0,
    !!data.coverImage,
    !!data.returnPolicy,
  ];
  const score = checks.filter(Boolean).length;
  return Math.round((score / checks.length) * 100);
}