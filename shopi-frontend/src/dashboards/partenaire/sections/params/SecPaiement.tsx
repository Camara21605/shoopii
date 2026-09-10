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
import { useTranslation } from 'react-i18next';
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

/* Icônes des méthodes de paiement — Orange Money/MTN Mobile Money sont des
 * noms de marque (non traduits, comme WhatsApp) ; seul "Virement bancaire"
 * (bank) est un libellé générique traduit via t(). */
const PAY_ICON: Record<string, { icon: string; logoCls: string }> = {
  om:   { icon: 'fa-mobile-screen-button', logoCls: s.payLogoOm   },
  mtn:  { icon: 'fa-mobile-screen-button', logoCls: s.payLogoMtn  },
  bank: { icon: 'fa-building-columns',     logoCls: s.payLogoBank },
};
const PAY_BRAND_LABEL: Record<string, string> = { om: 'Orange Money', mtn: 'MTN Mobile Money' };

const FREQUENCE_IDS = ['weekly', 'monthly', 'manual'] as const;
const STATUT_FISCAL_IDS = ['particulier', 'auto-entrepreneur', 'entreprise'] as const;

/* Données demo — seront remplacées par les données API */
const METHODES_DEMO: PaiementMethode[] = [
  { id: '1', type: 'om',   nom: 'Orange Money', numero: '+224 622 •• •• 01', isDefault: true  },
  { id: '2', type: 'mtn',  nom: 'MTN Mobile',   numero: '+224 660 •• •• 45', isDefault: false },
  { id: '3', type: 'bank', nom: 'Ecobank',       numero: 'GN•• •••• 2847',   isDefault: false },
];

export default function SecPaiement({
  data: _data, saving, dirty, markClean, saveTrigger, onSave, onToast
}: Props) {
  const { t } = useTranslation();
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
    onToast(t('partenaireParametres.secPaiement.backendToast'), 'w');
  }

  function payLabel(type: string): string {
    return PAY_BRAND_LABEL[type] ?? t('partenaireParametres.secPaiement.methodesCard.virementBancaire');
  }

  return (
    <>
      {/* ── Méthodes de versement ── */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div>
            <div className={s.fcTtl}><i className="fas fa-wallet" /> {t('partenaireParametres.secPaiement.methodesCard.title')}</div>
            <div className={s.fcSub}>{t('partenaireParametres.secPaiement.methodesCard.sub')}</div>
          </div>
        </div>
        <div className={s.fcBody}>
          {METHODES_DEMO.map(m => {
            const meta = PAY_ICON[m.type] ?? PAY_ICON.om;
            const isOn = selectedMethod === m.type;
            return (
              <div
                key={m.id}
                className={`${s.payMethod} ${isOn ? s.payMethodOn : ''}`}
                onClick={() => { setSelectedMethod(m.type); dirty(); }}
              >
                <div className={`${s.payLogo} ${meta.logoCls}`}><i className={`fas ${meta.icon}`} /></div>
                <div className={s.payMain}>
                  <div className={s.payNm}>{m.nom || payLabel(m.type)}</div>
                  <div className={s.payNum}>{m.numero}</div>
                </div>
                {m.isDefault && <span className={s.payDefault}>{t('partenaireParametres.secPaiement.methodesCard.parDefaut')}</span>}
                <div className={s.payRadio} />
              </div>
            );
          })}
          <button className={s.addMethod} onClick={() => onToast(t('partenaireParametres.secPaiement.methodesCard.ajouterToast'), 'w')}>
            <i className="fas fa-plus" /> {t('partenaireParametres.secPaiement.methodesCard.ajouterBtn')}
          </button>
        </div>
      </div>

      {/* ── Préférences de retrait ── */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div className={s.fcTtl}><i className="fas fa-money-bill-transfer" /> {t('partenaireParametres.secPaiement.preferencesCard.title')}</div>
        </div>
        <div className={s.fcBody}>
          <div className={s.grid2}>
            <div className={s.fg}>
              <label className={s.fl}>{t('partenaireParametres.secPaiement.preferencesCard.seuilLabel')}</label>
              <input
                className={s.fin}
                type="number"
                value={seuil}
                onChange={e => { setSeuil(e.target.value); dirty(); }}
                placeholder={t('partenaireParametres.secPaiement.preferencesCard.seuilPlaceholder')}
              />
              <span className={s.hint}>{t('partenaireParametres.secPaiement.preferencesCard.seuilHint')}</span>
            </div>
            <div className={s.fg}>
              <label className={s.fl}>{t('partenaireParametres.secPaiement.preferencesCard.frequenceLabel')}</label>
              <select className={s.fin} value={frequence} onChange={e => { setFrequence(e.target.value); dirty(); }}>
                {FREQUENCE_IDS.map(id => <option key={id} value={id}>{t(`partenaireParametres.secPaiement.preferencesCard.frequences.${id}`)}</option>)}
              </select>
            </div>
          </div>

          <div className={s.trow} style={{ borderTop: '1px solid var(--bdr)', paddingTop: 14 }}>
            <div className={s.trowIc}><i className="fas fa-bolt" /></div>
            <div className={s.trowMain}>
              <div className={s.trowT}>{t('partenaireParametres.secPaiement.preferencesCard.virAutoTitle')}</div>
              <div className={s.trowD}>{t('partenaireParametres.secPaiement.preferencesCard.virAutoDesc')}</div>
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
            <div className={s.fcTtl}><i className="fas fa-file-invoice-dollar" /> {t('partenaireParametres.secPaiement.fiscalCard.title')}</div>
            <div className={s.fcSub}>{t('partenaireParametres.secPaiement.fiscalCard.sub')}</div>
          </div>
        </div>
        <div className={s.fcBody}>
          <div className={s.grid2}>
            <div className={s.fg}>
              <label className={s.fl}>{t('partenaireParametres.secPaiement.fiscalCard.nifLabel')} <span className={s.flOpt}>{t('partenaireParametres.secPaiement.fiscalCard.optionnel')}</span></label>
              <input
                className={s.fin}
                value={nif}
                onChange={e => { setNif(e.target.value); dirty(); }}
                placeholder={t('partenaireParametres.secPaiement.fiscalCard.nifPlaceholder')}
              />
              <span className={s.hint}>{t('partenaireParametres.secPaiement.fiscalCard.nifHint')}</span>
            </div>
            <div className={s.fg}>
              <label className={s.fl}>{t('partenaireParametres.secPaiement.fiscalCard.statutLabel')}</label>
              <select className={s.fin} value={statutFisc} onChange={e => { setStatutFisc(e.target.value); dirty(); }}>
                {STATUT_FISCAL_IDS.map(id => <option key={id} value={id}>{t(`partenaireParametres.secPaiement.fiscalCard.statuts.${id}`)}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Derniers retraits (demo) ── */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div className={s.fcTtl}><i className="fas fa-clock-rotate-left" /> {t('partenaireParametres.secPaiement.retraitsCard.title')}</div>
        </div>
        <div className={s.fcBody}>
          <div className={s.wdItem}>
            <div className={s.wdIc}><i className="fas fa-arrow-up" /></div>
            <div className={s.wdMain}>
              <div className={s.wdNm}>Orange Money</div>
              <div className={s.wdMeta}>12 jan. 2025 · 14:32</div>
            </div>
            <div><span className={s.wdAmt}>1 200 000 GNF</span><span className={`${s.wdSt} ${s.wdDone}`}>{t('partenaireParametres.secPaiement.retraitsCard.verse')}</span></div>
          </div>
          <div className={s.wdItem}>
            <div className={s.wdIc} style={{ background: 'var(--am-bg)', color: 'var(--amber)' }}><i className="fas fa-hourglass-half" /></div>
            <div className={s.wdMain}>
              <div className={s.wdNm}>MTN Mobile Money</div>
              <div className={s.wdMeta}>{t('partenaireParametres.secPaiement.retraitsCard.aujourdhui')}</div>
            </div>
            <div><span className={s.wdAmt}>650 000 GNF</span><span className={`${s.wdSt} ${s.wdPend}`}>{t('partenaireParametres.secPaiement.retraitsCard.enCours')}</span></div>
          </div>
        </div>
      </div>
    </>
  );
}
