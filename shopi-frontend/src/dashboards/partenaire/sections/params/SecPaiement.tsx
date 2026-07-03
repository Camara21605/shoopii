/* ================================================================
 * FICHIER : sections/params/SecPaiement.tsx
 *
 * Section "Paiement" — coordonnées de versement des commissions.
 *
 * Note : les champs de paiement (méthodes, virement, NIF…) ne sont
 * pas encore dans l'entité Partner. Cette section fonctionne en mode
 * local pour l'instant ; elle sera connectée au backend quand les
 * colonnes correspondantes seront ajoutées à la table `partenaires`.
 * ================================================================ */

import { useState } from 'react';
import s from '../../styles/ParamsShared.module.css';
import type { PartenaireData } from '../../hooks/usePartenaireParametres';

interface Props {
  data:        PartenaireData | null;
  saving:      boolean;
  dirty:       () => void;
  markClean:   () => void;
  saveTrigger: number;
  onSave:      (body: Partial<PartenaireData>) => Promise<void>;
  onToast:     (msg: string, type?: 's' | 'i' | 'w') => void;
}

/* Type local — sera importé du hook quand le backend sera branché */
interface PaiementMethode {
  id:        string;
  type:      'om' | 'mtn' | 'bank';
  nom:       string;
  numero:    string;
  isDefault: boolean;
}

/* Libellés et icônes des méthodes de paiement */
const PAY_META: Record<string, { label: string; icon: string; logoCls: string }> = {
  om:   { label: 'Orange Money',      icon: 'fa-mobile-screen-button', logoCls: s.payLogoOm   },
  mtn:  { label: 'MTN Mobile Money',  icon: 'fa-mobile-screen-button', logoCls: s.payLogoMtn  },
  bank: { label: 'Virement bancaire', icon: 'fa-building-columns',     logoCls: s.payLogoBank },
};

const FREQUENCES = [
  { val: 'weekly',  label: 'Hebdomadaire' },
  { val: 'monthly', label: 'Mensuelle' },
  { val: 'manual',  label: 'Manuelle (à la demande)' },
];

const STATUTS_FISCAUX = [
  { val: 'particulier',       label: 'Particulier' },
  { val: 'auto-entrepreneur', label: 'Auto-entrepreneur' },
  { val: 'entreprise',        label: 'Entreprise' },
];

/* Données demo — seront remplacées par les données API */
const METHODES_DEMO: PaiementMethode[] = [
  { id: '1', type: 'om',   nom: 'Orange Money', numero: '+224 622 •• •• 01', isDefault: true  },
  { id: '2', type: 'mtn',  nom: 'MTN Mobile',   numero: '+224 660 •• •• 45', isDefault: false },
  { id: '3', type: 'bank', nom: 'Ecobank',       numero: 'GN•• •••• 2847',   isDefault: false },
];

export default function SecPaiement({
  data: _data, saving, dirty, markClean, saveTrigger, onSave, onToast
}: Props) {
  /* État entièrement local — pas encore stocké dans l'entité Partner */
  const [selectedMethod, setSelectedMethod] = useState<string | null>('om');
  const [frequence,  setFrequence]  = useState('monthly');
  const [seuil,      setSeuil]      = useState('');
  const [virAuto,    setVirAuto]    = useState(true);
  const [nif,        setNif]        = useState('');
  const [statutFisc, setStatutFisc] = useState('particulier');

  /* SaveFloat trigger — stub (sera branché quand les colonnes existent) */
  /* useEffect(() => {
       if (saveTrigger > 0) handleSave();
     }, [saveTrigger]); */

  async function handleSave() {
    /* TODO (backend) : quand l'entité Partner aura les champs paiement */
    markClean();
    onToast('⚠️ Paiement : fonctionnalité en cours d\'implémentation backend', 'w');
  }

  return (
    <>
      {/* ── Méthodes de versement ── */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div>
            <div className={s.fcTtl}><i className="fas fa-wallet" /> Coordonnées de versement</div>
            <div className={s.fcSub}>Choisissez la méthode par défaut pour recevoir vos commissions.</div>
          </div>
        </div>
        <div className={s.fcBody}>
          {METHODES_DEMO.map(m => {
            const meta = PAY_META[m.type] ?? PAY_META.om;
            const isOn = selectedMethod === m.type;
            return (
              <div
                key={m.id}
                className={`${s.payMethod} ${isOn ? s.payMethodOn : ''}`}
                onClick={() => { setSelectedMethod(m.type); dirty(); }}
              >
                <div className={`${s.payLogo} ${meta.logoCls}`}><i className={`fas ${meta.icon}`} /></div>
                <div className={s.payMain}>
                  <div className={s.payNm}>{m.nom || meta.label}</div>
                  <div className={s.payNum}>{m.numero}</div>
                </div>
                {m.isDefault && <span className={s.payDefault}>Par défaut</span>}
                <div className={s.payRadio} />
              </div>
            );
          })}
          <button className={s.addMethod} onClick={() => onToast('➕ Ajouter une méthode de versement', 'i')}>
            <i className="fas fa-plus" /> Ajouter une méthode de versement
          </button>
        </div>
      </div>

      {/* ── Préférences de retrait ── */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div className={s.fcTtl}><i className="fas fa-money-bill-transfer" /> Préférences de retrait</div>
        </div>
        <div className={s.fcBody}>
          <div className={s.grid2}>
            <div className={s.fg}>
              <label className={s.fl}>Seuil de retrait automatique</label>
              <input
                className={s.fin}
                type="number"
                value={seuil}
                onChange={e => { setSeuil(e.target.value); dirty(); }}
                placeholder="Ex: 500000 GNF"
              />
              <span className={s.hint}>Versement auto dès que ce solde est atteint.</span>
            </div>
            <div className={s.fg}>
              <label className={s.fl}>Fréquence</label>
              <select className={s.fin} value={frequence} onChange={e => { setFrequence(e.target.value); dirty(); }}>
                {FREQUENCES.map(f => <option key={f.val} value={f.val}>{f.label}</option>)}
              </select>
            </div>
          </div>

          <div className={s.trow} style={{ borderTop: '1px solid var(--bdr)', paddingTop: 14 }}>
            <div className={s.trowIc}><i className="fas fa-bolt" /></div>
            <div className={s.trowMain}>
              <div className={s.trowT}>Versement automatique</div>
              <div className={s.trowD}>Recevez vos commissions sans demande manuelle.</div>
            </div>
            <div
              className={`${s.toggle} ${virAuto ? s.toggleOn : ''}`}
              onClick={() => { setVirAuto(v => !v); dirty(); }}
              role="switch" aria-checked={virAuto}
            />
          </div>
        </div>
      </div>

      {/* ── Informations fiscales ── */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div>
            <div className={s.fcTtl}><i className="fas fa-file-invoice-dollar" /> Informations fiscales</div>
            <div className={s.fcSub}>Nécessaires pour la facturation de vos commissions.</div>
          </div>
        </div>
        <div className={s.fcBody}>
          <div className={s.grid2}>
            <div className={s.fg}>
              <label className={s.fl}>NIF <span className={s.flOpt}>optionnel</span></label>
              <input
                className={s.fin}
                value={nif}
                onChange={e => { setNif(e.target.value); dirty(); }}
                placeholder="Ex. 123456789"
              />
              <span className={s.hint}>Requis au-delà d'un certain volume de commissions.</span>
            </div>
            <div className={s.fg}>
              <label className={s.fl}>Statut</label>
              <select className={s.fin} value={statutFisc} onChange={e => { setStatutFisc(e.target.value); dirty(); }}>
                {STATUTS_FISCAUX.map(st => <option key={st.val} value={st.val}>{st.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Derniers retraits (demo) ── */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div className={s.fcTtl}><i className="fas fa-clock-rotate-left" /> Derniers retraits</div>
        </div>
        <div className={s.fcBody}>
          <div className={s.wdItem}>
            <div className={s.wdIc}><i className="fas fa-arrow-up" /></div>
            <div className={s.wdMain}>
              <div className={s.wdNm}>Orange Money</div>
              <div className={s.wdMeta}>12 jan. 2025 · 14:32</div>
            </div>
            <div><span className={s.wdAmt}>1 200 000 GNF</span><span className={`${s.wdSt} ${s.wdDone}`}>Versé</span></div>
          </div>
          <div className={s.wdItem}>
            <div className={s.wdIc} style={{ background: 'var(--am-bg)', color: 'var(--amber)' }}><i className="fas fa-hourglass-half" /></div>
            <div className={s.wdMain}>
              <div className={s.wdNm}>MTN Mobile Money</div>
              <div className={s.wdMeta}>Aujourd'hui · en traitement</div>
            </div>
            <div><span className={s.wdAmt}>650 000 GNF</span><span className={`${s.wdSt} ${s.wdPend}`}>En cours</span></div>
          </div>
        </div>
      </div>
    </>
  );
}
