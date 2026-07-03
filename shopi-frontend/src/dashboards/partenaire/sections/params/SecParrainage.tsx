/* ================================================================
 * FICHIER : sections/params/SecParrainage.tsx
 * Section "Parrainage" — lien d'invitation personnel, stats, partage.
 * Pas de dirty/save : lecture seule (le lien est généré par le backend).
 * ================================================================ */

import s from '../../styles/ParamsShared.module.css';
import type { PartenaireData } from '../../hooks/usePartenaireParametres';

interface Props {
  data:    PartenaireData | null;
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

export default function SecParrainage({ data, onToast }: Props) {
  /* TODO (backend) : GET /partenaire/parametres → data.referralLink, data.referralStats */
  const firstName = data?.firstName ?? 'Partenaire';
  const slug      = `${firstName.toUpperCase().replace(/\s+/g, '-')}-SHOPI`;
  const refLink   = `https://shopi.gn/rejoindre/${slug}`;

  function copyLink() {
    navigator.clipboard?.writeText(refLink);
    onToast('🔗 Lien de parrainage copié', 's');
  }

  return (
    <div className={s.fc}>
      <div className={s.fcHd}>
        <div>
          <div className={s.fcTtl}><i className="fas fa-share-nodes" /> Votre lien de parrainage</div>
          <div className={s.fcSub}>Partagez ce lien : toute personne qui s'inscrit via lui vous est rattachée automatiquement.</div>
        </div>
      </div>
      <div className={s.fcBody}>
        <div className={s.refBox}>
          <div className={s.refGlow} />
          <div className={s.refIn}>
            <h4>Lien d'invitation personnel</h4>
            <p>En plus des codes de création, ce lien permet de recruter sans saisie de code.</p>
            <div className={s.refLinkRow}>
              <div className={s.refLink}>
                <i className="fas fa-link" />
                <span>{refLink}</span>
              </div>
              <button className={s.refCopy} onClick={copyLink}>
                <i className="fas fa-copy" /> Copier
              </button>
            </div>
            <div className={s.refShare}>
              <button className={`${s.refSbtn} ${s.refWa}`} onClick={() => onToast('📱 Partage WhatsApp', 's')}>
                <i className="fab fa-whatsapp" /> WhatsApp
              </button>
              <button className={`${s.refSbtn} ${s.refFb}`} onClick={() => onToast('📘 Partage Facebook', 's')}>
                <i className="fab fa-facebook-f" /> Facebook
              </button>
              <button className={`${s.refSbtn} ${s.refQr}`} onClick={() => onToast('🔳 QR code généré', 's')}>
                <i className="fas fa-qrcode" /> QR Code
              </button>
            </div>
            {/* TODO (backend) : statistiques réelles de clics / inscriptions */}
            <div className={s.refStats}>
              <div className={s.refStat}><b>248</b><span>Clics</span></div>
              <div className={s.refStat}><b>42</b><span>Inscriptions</span></div>
              <div className={s.refStat}><b>17%</b><span>Conversion</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
