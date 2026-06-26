/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/BoutiqueSection.tsx
 *
 * CONNECTÉ À L'API — Sections 1 + 2 des paramètres entreprise.
 * ✅ Images logo et cover corrigées avec classes CSS dédiées
 * ✅ Plus de styles inline sur les images
 */

import React, { useState, useRef, useEffect } from 'react';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';

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
  const [ville,         setVille]         = useState('');
  const [pays,          setPays]          = useState('GN');
  const [repere,        setRepere]        = useState('');

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
      onToast('✅ Boutique sauvegardée avec succès', 's');
    } catch {
      onToast('❌ Erreur lors de la sauvegarde', 'e');
    }
  }

  async function handleSaveContact() {
    try {
      await saveContact({ businessPhone, businessEmail, whatsapp, adresse, commune, ville, pays, repere });
      onToast('✅ Contact sauvegardé avec succès', 's');
    } catch {
      onToast('❌ Erreur lors de la sauvegarde', 'e');
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { onToast('❌ Logo trop lourd (max 5 MB)', 'e'); return; }
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      onToast('❌ Format invalide (JPG, PNG, WebP)', 'e'); return;
    }
    try {
      onToast('⏳ Upload en cours…', 'i');
      await uploadLogo(file);
      onToast('✅ Logo mis à jour', 's');
    } catch {
      onToast("❌ Échec de l'upload du logo", 'e');
    }
    e.target.value = ''; // reset pour permettre re-sélection du même fichier
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { onToast('❌ Image trop lourde (max 8 MB)', 'e'); return; }
    try {
      onToast('⏳ Upload en cours…', 'i');
      await uploadCover(file);
      onToast('✅ Image de couverture mise à jour', 's');
    } catch {
      onToast("❌ Échec de l'upload de la couverture", 'e');
    }
    e.target.value = '';
  }

  async function handleDeleteLogo() {
    if (!data?.logo) return;
    try {
      await deleteLogo();
      onToast('🗑️ Logo supprimé', 'w');
    } catch {
      onToast('❌ Impossible de supprimer le logo', 'e');
    }
  }

  // ─────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────

  return (
    <>
      {/* ── En-tête ── */}
      <div className={s.sectionHd}>
        <h1><i className="fas fa-store" /> Boutique &amp; Identité</h1>
        <p>Informations publiques de votre boutique. Elles sont visibles par tous les clients sur la plateforme Shopi.</p>
      </div>

      {/* ── Barre de complétion ── */}
      <div className={s.completionBar}>
        <div className={s.completionBg} />
        <div className={s.completionInner}>
          <div className={s.completionRing}>
            <div className={s.completionPct}>{pct}%</div>
            <div className={s.completionLbl}>Profil</div>
          </div>
          <div className={s.completionInfo}>
            <div className={s.completionTitle}>
              Boutique complétée à {pct}%
              {pct < 100 && ' — Quelques éléments manquants'}
            </div>
            <div className={s.completionBarBg}>
              <div className={s.completionBarFill} style={{ width:`${pct}%` }} />
            </div>
            <div className={s.completionSteps}>
              {getStepsDone(data).map(l => (
                <span key={l} className={`${s.completionStep} ${s.done}`}>
                  <i className="fas fa-check-circle" /> {l}
                </span>
              ))}
              {getStepsMissing(data).map(l => (
                <span key={l} className={`${s.completionStep} ${s.miss}`}>
                  <i className="fas fa-circle" /> {l}
                </span>
              ))}
            </div>
          </div>
          <div className={s.completionHint}>
            Un profil complet génère <strong>3× plus</strong> de ventes
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
       * LOGO & COUVERTURE
       * ══════════════════════════════════════════════════════ */}
      <FormCard
        title="Logo & Image de couverture"
        icon="fa-image"
        subtitle="Identité visuelle de votre boutique sur Shopi"
      >
        <div style={{ display:'flex', alignItems:'flex-start', gap:22, flexWrap:'wrap' }}>

          {/* ── Logo ─────────────────────────────────────── */}
          <div style={{ textAlign:'center', flexShrink:0 }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>
              Logo boutique
            </div>

            {/*
             * ✅ CORRIGÉ : .logoWrap gère border-radius + overflow:hidden
             * L'image utilise .logoImg → object-fit:cover sur toute la surface
             * Plus de styles inline qui cassaient l'affichage
             */}
            <div
              className={s.logoWrap}
              onClick={() => logoInputRef.current?.click()}
              title="Cliquer pour changer le logo"
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
                background:'rgba(26,79,196,.09)', color:'var(--blue)',
                border:'1px solid var(--bdrb)', borderRadius:'var(--pill)',
                padding:'6px 14px', fontSize:11, fontWeight:700,
                display:'block', width:'100%', cursor:'pointer',
                marginTop:10, opacity:saving ? 0.5 : 1,
                fontFamily:'var(--fb)',
              }}
            >
              {saving ? <><i className="fas fa-spinner fa-spin" /> </> : null}
              Changer
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
                Supprimer
              </button>
            )}
          </div>

          {/* ── Cover ────────────────────────────────────── */}
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>
              Image de couverture
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
                <span style={{ fontSize:12, fontWeight:700 }}>Changer la couverture</span>
              </div>

              {/* Placeholder — visible quand pas d'image */}
              {!data?.coverImage && (
                <div className={s.coverPlaceholder}>
                  <i className="fas fa-panorama" />
                  <strong>Image de couverture de la boutique</strong>
                  <span>1200×400px · JPG, PNG · max 8 MB</span>
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
                Changer l'image de couverture
              </button>
            )}
          </div>

        </div>
      </FormCard>

      {/* ══════════════════════════════════════════════════════
       * INFORMATIONS DE LA BOUTIQUE
       * ══════════════════════════════════════════════════════ */}
      <FormCard
        title="Informations de la boutique"
        icon="fa-id-badge"
        subtitle="Données affichées sur votre page boutique publique"
      >
        <div className={s.fg}>
          <div className={s.fl}>Nom de la boutique <span className={s.flOpt}>*</span></div>
          <div className={s.fw}>
            <i className={`fas fa-store ${s.fi}`} />
            <input className={s.fin} value={nomBoutique}
              onChange={e => { setNomBoutique(e.target.value); onDirty(); }}
              placeholder="Ex : TechStore Conakry" />
          </div>
          <div className={s.hint}>
            <i className="fas fa-circle-info" /> Ce nom apparaît dans la recherche et sur votre URL publique shopi.gn/boutique/...
          </div>
        </div>

        <div className={s.fg}>
          <div className={s.fl}>Description <span className={s.flOpt}>visible publiquement</span></div>
          <div className={s.fw}>
            <i className={`fas fa-pen-to-square ${s.fi}`} style={{ top:13, bottom:'auto' }} />
            <textarea
              className={`${s.fin} ${s.finTextarea}`}
              style={{ paddingLeft:38 }}
              value={description}
              onChange={e => { setDescription(e.target.value); onDirty(); }}
              placeholder="Décrivez votre boutique en quelques lignes…"
              maxLength={1000}
            />
          </div>
          <div className={s.hint}><i className="fas fa-circle-info" /> 500 caractères max</div>
        </div>

        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>Type d'entreprise</div>
            <div className={s.fw}>
              <i className={`fas fa-tag ${s.fi}`} />
              <select className={`${s.fin} ${s.finSelect}`}
                value={companyTypeId}
                onChange={e => { setCompanyTypeId(e.target.value); onDirty(); }}>
                <option value="">Sélectionner un type…</option>
                {data?.companyType && (
                  <option value={data.companyType.id}>{data.companyType.nom}</option>
                )}
              </select>
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>Statut</div>
            <div className={s.fw}>
              <i className={`fas fa-circle-dot ${s.fi}`} />
              <select className={`${s.fin} ${s.finSelect}`}
                value={status}
                onChange={e => { setStatus(e.target.value); onDirty(); }}>
                <option value="active">🟢 Active — Visible</option>
                <option value="suspended">🟡 En pause</option>
                <option value="pending">🔴 Privée</option>
              </select>
            </div>
          </div>
        </div>

        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>Slogan <span className={s.flOpt}>optionnel</span></div>
            <div className={s.fw}>
              <i className={`fas fa-quote-left ${s.fi}`} />
              <input className={s.fin} value={slogan}
                onChange={e => { setSlogan(e.target.value); onDirty(); }}
                placeholder="Ex : Fraîcheur garantie depuis 2019" />
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>Site web</div>
            <div className={s.fw}>
              <i className={`fas fa-globe ${s.fi}`} />
              <input className={s.fin} type="url" value={website}
                onChange={e => { setWebsite(e.target.value); onDirty(); }}
                placeholder="https://votre-site.com" />
            </div>
          </div>
        </div>

        <div className={s.fg}>
          <div className={s.fl}>Tags & Mots-clés</div>
          <div className={s.fw}>
            <i className={`fas fa-hashtag ${s.fi}`} />
            <input className={s.fin} value={tags}
              onChange={e => { setTags(e.target.value); onDirty(); }}
              placeholder="restaurant, livraison rapide, Conakry…" />
          </div>
          <div className={s.hint}><i className="fas fa-circle-info" /> Séparés par des virgules</div>
        </div>

        <div className={s.saveRow}>
          <button className={s.saveBtn} onClick={handleSaveBoutique} disabled={saving}>
            {saving
              ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde en cours…</>
              : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder la boutique</>
            }
          </button>
        </div>
      </FormCard>

      {/* ══════════════════════════════════════════════════════
       * CONTACT & LOCALISATION
       * ══════════════════════════════════════════════════════ */}
      <FormCard
        title="Contact & Localisation"
        icon="fa-map-location-dot"
        subtitle="Coordonnées affichées sur votre page publique"
      >
        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>Téléphone principal</div>
            <div className={s.fw}>
              <div className={s.phonePfx}>🇬🇳 +224</div>
              <input className={s.fin} type="tel" value={businessPhone}
                onChange={e => { setBusinessPhone(e.target.value); onDirty(); }}
                style={{ paddingLeft:90 }} placeholder="620 00 00 00" />
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>Email boutique</div>
            <div className={s.fw}>
              <i className={`fas fa-envelope ${s.fi}`} />
              <input className={s.fin} type="email" value={businessEmail}
                onChange={e => { setBusinessEmail(e.target.value); onDirty(); }}
                placeholder="boutique@example.com" />
            </div>
          </div>
        </div>

        <div className={s.fg}>
          <div className={s.fl}>WhatsApp</div>
          <div className={s.fw}>
            <i className={`fab fa-whatsapp ${s.fi}`} style={{ color:'#25D366' }} />
            <input className={s.fin} type="tel" value={whatsapp}
              onChange={e => { setWhatsapp(e.target.value); onDirty(); }}
              placeholder="620 00 00 00 (sans +224)" />
          </div>
        </div>

        <div className={s.fg}>
          <div className={s.fl}>Adresse physique</div>
          <div className={s.fw}>
            <i className={`fas fa-location-dot ${s.fi}`} />
            <input className={s.fin} value={adresse}
              onChange={e => { setAdresse(e.target.value); onDirty(); }}
              placeholder="Ex : Avenue de la République, Kaloum" />
          </div>
        </div>

        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>Commune</div>
            <div className={s.fw}>
              <i className={`fas fa-city ${s.fi}`} />
              <select className={`${s.fin} ${s.finSelect}`}
                value={commune}
                onChange={e => { setCommune(e.target.value); onDirty(); }}>
                <option value="">Sélectionner…</option>
                {['Kaloum','Dixinn','Ratoma','Matam','Matoto'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>Ville</div>
            <div className={s.fw}>
              <i className={`fas fa-building ${s.fi}`} />
              <input className={s.fin} value={ville}
                onChange={e => { setVille(e.target.value); onDirty(); }}
                placeholder="Ex : Conakry" />
            </div>
          </div>
        </div>

        <div className={s.fg}>
          <div className={s.fl}>Repère / indication pour les livreurs</div>
          <div className={s.fw}>
            <i className={`fas fa-comment-dots ${s.fi}`} />
            <input className={s.fin} value={repere}
              onChange={e => { setRepere(e.target.value); onDirty(); }}
              placeholder="Ex : Bâtiment rouge à côté de la pharmacie" />
          </div>
        </div>

        <div className={s.saveRow}>
          <button className={s.saveBtn} onClick={handleSaveContact} disabled={saving}>
            {saving
              ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</>
              : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder le contact</>
            }
          </button>
        </div>
      </FormCard>

      {/* ══════════════════════════════════════════════════════
       * RESPONSABLE & PROPRIÉTAIRE
       * ══════════════════════════════════════════════════════ */}
      <FormCard
        title="Responsable & Propriétaire"
        icon="fa-user-tie"
        subtitle="Informations du gérant principal"
      >
        <div className={s.grid2}>
          <div className={s.fg}>
            <div className={s.fl}>Prénom <span className={s.flOpt}>*</span></div>
            <div className={s.fw}>
              <i className={`fas fa-user ${s.fi}`} />
              <input className={s.fin}
                defaultValue={data ? '' : ''}
                placeholder="Prénom du responsable"
                readOnly
                style={{ background:'var(--g100)', cursor:'not-allowed', color:'var(--t3)' }}
              />
            </div>
          </div>
          <div className={s.fg}>
            <div className={s.fl}>Nom <span className={s.flOpt}>*</span></div>
            <div className={s.fw}>
              <i className={`fas fa-user ${s.fi}`} />
              <input className={s.fin}
                defaultValue={data ? '' : ''}
                placeholder="Nom du responsable"
                readOnly
                style={{ background:'var(--g100)', cursor:'not-allowed', color:'var(--t3)' }}
              />
            </div>
          </div>
        </div>
        <div className={s.hint}>
          <i className="fas fa-circle-info" /> Le prénom et le nom se modifient dans les <strong>paramètres de votre compte</strong>.
        </div>
      </FormCard>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS — calcul du % de complétion du profil
// ─────────────────────────────────────────────────────────────

const STEPS_LABELS: Record<string, string> = {
  logo:         'Logo',
  companyName:  'Nom & description',
  contact:      'Contact',
  products:     'Produits',
  coverImage:   'Photo de couverture',
  returnPolicy: 'Politique retour',
};

function getStepsDone(data: ParametresData | null): string[] {
  if (!data) return [];
  const done: string[] = [];
  if (data.logo)                                    done.push(STEPS_LABELS.logo);
  if (data.companyName)                             done.push(STEPS_LABELS.companyName);
  if (data.businessPhone || data.businessEmail)     done.push(STEPS_LABELS.contact);
  if ((data.totalOrders ?? 0) > 0)                  done.push(STEPS_LABELS.products);
  return done;
}

function getStepsMissing(data: ParametresData | null): string[] {
  if (!data) return [];
  const miss: string[] = [];
  if (!data.coverImage)   miss.push(STEPS_LABELS.coverImage);
  if (!data.returnPolicy) miss.push(STEPS_LABELS.returnPolicy);
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