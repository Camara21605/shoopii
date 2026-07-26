/*
 * FICHIER : src/modules/home/components/panier/sections/AdresseSection.tsx
 * Connectée au profil client réel et aux adresses enregistrées.
 * Formulaire entièrement contrôlé — remonte les données via onAdresseChange.
 */
import React, { useState, useEffect, useRef } from 'react';
import type { ProfilData, AdresseItem } from '../../settings/api/settings.api';
import { VILLES, COMMUNES } from '../data/panierData';
import styles from '../styles/AdresseSection.module.css';

export interface AdresseFormData {
  prenom:         string;
  nom:            string;
  telephone:      string;
  ville:          string;
  commune:        string;
  adressePrecise: string;
  instructions:   string;
}

interface Props {
  clientProfil:    ProfilData | null;
  savedAddresses:  AdresseItem[];
  loadingClient:   boolean;
  onVilleChange:   (v: string) => void;
  onAdresseChange: (addr: AdresseFormData) => void;
  onToast:         (m: string) => void;
}

const EMPTY: AdresseFormData = {
  prenom:'', nom:'', telephone:'', ville:'conakry',
  commune:'kaloum', adressePrecise:'', instructions:'',
};

function villeToVal(label: string): string {
  return VILLES.find(v => v.label.toLowerCase() === label.toLowerCase())?.value ?? 'conakry';
}

function communeToVal(villeVal: string, raw?: string): string {
  if (!raw) return COMMUNES[villeVal]?.[0]?.value ?? '';
  const r = raw.toLowerCase();
  return COMMUNES[villeVal]?.find(c => c.value === r || c.label.toLowerCase() === r)?.value
    ?? COMMUNES[villeVal]?.[0]?.value ?? '';
}

function etaDest(form: AdresseFormData): string {
  const vl = VILLES.find(v => v.value === form.ville)?.label ?? form.ville;
  const cl = COMMUNES[form.ville]?.find(c => c.value === form.commune)?.label ?? '';
  return cl ? `${cl}, ${vl}` : vl;
}

export default function AdresseSection({
  clientProfil, savedAddresses, loadingClient,
  onVilleChange, onAdresseChange, onToast,
}: Props) {
  const [activeAddr, setActiveAddr] = useState('');
  const [form, setForm]             = useState<AdresseFormData>(EMPTY);
  const didInit = useRef(false);

  /* ── Pré-remplissage initial quand les données client arrivent ── */
  useEffect(() => {
    if (didInit.current || !clientProfil) return;
    didInit.current = true;

    const def      = savedAddresses.find(a => a.isDefault) ?? savedAddresses[0] ?? null;
    const villeVal = def ? villeToVal(def.ville) : 'conakry';
    const commVal  = def ? communeToVal(villeVal, def.commune) : (COMMUNES['conakry']?.[0]?.value ?? 'kaloum');
    const rawPhone = (def?.phone || clientProfil.phone || '').replace(/^\+?224\s*/, '').trim();

    const next: AdresseFormData = {
      prenom:         clientProfil.firstName,
      nom:            clientProfil.lastName,
      telephone:      rawPhone,
      ville:          villeVal,
      commune:        commVal,
      adressePrecise: def?.adresse ?? '',
      instructions:   '',
    };
    setForm(next);
    setActiveAddr(def?.id ?? 'new');
    onVilleChange(etaDest(next));
    onAdresseChange(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientProfil, savedAddresses]);

  /* ── Mise à jour d'un ou plusieurs champs ── */
  function update(patch: Partial<AdresseFormData>) {
    const next = { ...form, ...patch };
    if (patch.ville && patch.ville !== form.ville) {
      next.commune = COMMUNES[patch.ville]?.[0]?.value ?? '';
    }
    setForm(next);
    onAdresseChange(next);
    if ('ville' in patch || 'commune' in patch) onVilleChange(etaDest(next));
  }

  /* ── Sélection d'une adresse enregistrée ── */
  function selectAddr(a: AdresseItem) {
    const villeVal = villeToVal(a.ville);
    const commVal  = communeToVal(villeVal, a.commune);
    const next: AdresseFormData = {
      prenom:         form.prenom,
      nom:            form.nom,
      telephone:      form.telephone,
      ville:          villeVal,
      commune:        commVal,
      adressePrecise: a.adresse,
      instructions:   '',
    };
    setForm(next);
    setActiveAddr(a.id);
    onVilleChange(etaDest(next));
    onAdresseChange(next);
    onToast(`📍 ${a.nom}`);
  }

  /* ── Nouvelle adresse (vider les champs d'adresse) ── */
  function newAddr() {
    const next: AdresseFormData = {
      ...form,
      ville: 'conakry', commune: COMMUNES['conakry']?.[0]?.value ?? 'kaloum',
      adressePrecise: '', instructions: '',
    };
    setForm(next);
    setActiveAddr('new');
    onAdresseChange(next);
  }

  const communes = COMMUNES[form.ville] ?? [];

  return (
    <div className={`${styles.sc} ${styles.lit}`}>

      {/* ── En-tête ── */}
      <div className={styles.scHd}>
        <div className={styles.scNum}>2</div>
        <div>
          <div className={styles.scTitre}>Adresse de livraison</div>
          <div className={styles.scSub}>Où souhaitez-vous être livré ?</div>
        </div>
      </div>

      <div className={styles.scBody}>

        {/* ── Chips adresses enregistrées ── */}
        {loadingClient ? (
          <div style={{ height:52, display:'flex', alignItems:'center', gap:8, color:'var(--t3)', fontSize:13 }}>
            <i className="fas fa-spinner fa-spin" /> Chargement de vos adresses…
          </div>
        ) : (
          <div className={styles.addrChips}>
            {savedAddresses.map(a => (
              <div
                key={a.id}
                className={`${styles.addrChip} ${activeAddr === a.id ? styles.addrChipSel : ''}`}
                onClick={() => selectAddr(a)}
              >
                <div className={styles.chipLabel}>
                  <i className={`fas ${a.isDefault ? 'fa-house' : 'fa-briefcase'}`} /> {a.nom}
                </div>
                <div className={styles.chipVille}>{a.ville}</div>
                <div className={styles.chipDetail}>
                  {a.adresse?.length > 32 ? a.adresse.substring(0, 32) + '…' : (a.adresse ?? '')}
                </div>
              </div>
            ))}
            <div
              className={`${styles.addrNew} ${activeAddr === 'new' ? styles.addrChipSel : ''}`}
              onClick={newAddr}
            >
              <i className="fas fa-plus" /> Nouvelle
            </div>
          </div>
        )}

        {/* ── Prénom + Nom ── */}
        <div className={styles.fr}>
          <div className={styles.fg}>
            <div className={styles.fl}>Prénom <span>*</span></div>
            <div className={styles.fw}>
              <i className={`fas fa-user ${styles.fi}`} />
              <input
                className={`${styles.fin} ${form.prenom ? styles.finOk : ''}`}
                type="text" value={form.prenom} placeholder="Votre prénom"
                onChange={e => update({ prenom: e.target.value })}
              />
            </div>
          </div>
          <div className={styles.fg}>
            <div className={styles.fl}>Nom <span>*</span></div>
            <div className={styles.fw}>
              <i className={`fas fa-user ${styles.fi}`} />
              <input
                className={`${styles.fin} ${form.nom ? styles.finOk : ''}`}
                type="text" value={form.nom} placeholder="Votre nom"
                onChange={e => update({ nom: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* ── Téléphone ── */}
        <div className={`${styles.fr} ${styles.frFull}`}>
          <div className={styles.fg}>
            <div className={styles.fl}>Téléphone <span>*</span></div>
            <div className={styles.fw}>
              <div className={styles.dialCode}>🇬🇳 +224</div>
              <input
                className={`${styles.fin} ${styles.finTel} ${form.telephone ? styles.finOk : ''}`}
                type="tel" value={form.telephone} placeholder="6XX XXX XXX"
                onChange={e => update({ telephone: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* ── Ville + Commune ── */}
        <div className={styles.fr}>
          <div className={styles.fg}>
            <div className={styles.fl}>Ville <span>*</span></div>
            <div className={styles.fw}>
              <i className={`fas fa-city ${styles.fi}`} />
              <select
                className={styles.fin}
                value={form.ville}
                onChange={e => update({ ville: e.target.value })}
              >
                {VILLES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.fg}>
            <div className={styles.fl}>Commune <span>*</span></div>
            <div className={styles.fw}>
              <i className={`fas fa-map-pin ${styles.fi}`} />
              <select
                className={styles.fin}
                value={form.commune}
                onChange={e => update({ commune: e.target.value })}
              >
                {communes.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Adresse précise ── */}
        <div className={`${styles.fr} ${styles.frFull}`}>
          <div className={styles.fg}>
            <div className={styles.fl}>Adresse précise <span className={styles.flOpt}>* (rue, repère)</span></div>
            <div className={styles.fw}>
              <i className={`fas fa-location-dot ${styles.fi}`} />
              <input
                className={`${styles.fin} ${form.adressePrecise ? styles.finOk : ''}`}
                type="text" value={form.adressePrecise} placeholder="Quartier, rue, repère…"
                onChange={e => update({ adressePrecise: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* ── Instructions optionnelles ── */}
        <div className={`${styles.fr} ${styles.frFull}`}>
          <div className={styles.fg}>
            <div className={styles.fl}>
              Instructions de livraison
              <span className={styles.flOpt}>optionnel</span>
            </div>
            <div className={styles.fw}>
              <i className={`fas fa-comment ${styles.fi}`} />
              <input
                className={styles.fin}
                type="text" value={form.instructions} placeholder="Ex : Appeler avant d'arriver…"
                onChange={e => update({ instructions: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
