/* ============================================================
 * FICHIER : src/modules/app-download/DownloadAppPage.tsx
 * ROUTE   : /telecharger (publique)
 *
 * Télécharger l'application mobile Shoneya (Android, native) :
 *   - téléphone Android : Google Play (ouvre l'appli si déjà installée) et,
 *     si configuré, le fichier APK direct avec les 3 étapes d'installation ;
 *   - ordinateur : QR code à scanner avec le téléphone ;
 *   - iPhone : pas encore d'application — le site reste utilisable.
 * ============================================================ */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';

import {
  APK_URL, DOWNLOAD_PAGE, PLAY_STORE_URL, isAndroidPhone, isIos, isMobileDevice, openOrInstallUrl,
} from '../../shared/pwa/nativeApp';
import s from './DownloadAppPage.module.css';

const FEATURES = [
  { icon: 'fa-phone-volume', title: 'Appels audio et vidéo', text: 'Ça sonne même application fermée, comme un vrai appel.' },
  { icon: 'fa-bell', title: 'Notifications instantanées', text: 'Commandes, livraisons, paiements, messages : tout de suite à l’écran.' },
  { icon: 'fa-comments', title: 'Messagerie complète', text: 'Vocaux, photos, position — et répondre depuis la notification.' },
  { icon: 'fa-bolt', title: 'Rapide et léger', text: 'S’ouvre instantanément, pensé pour la 3G/4G de Guinée.' },
];

export default function DownloadAppPage() {
  const android = isAndroidPhone();
  const ios = isIos();
  const desktop = !isMobileDevice();
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Télécharger l’application — Shoneya';
    if (!desktop) return;
    QRCode.toDataURL(`${window.location.origin}${DOWNLOAD_PAGE}`, { width: 360, margin: 1, color: { dark: '#111111', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [desktop]);

  return (
    <main className={s.page}>
      <section className={s.hero}>
        <img src="/pwa-512x512.png" alt="Shoneya" className={s.logo} width={96} height={96} />
        <h1 className={s.title}>Shoneya dans votre poche</h1>
        <p className={s.lead}>
          L’application mobile Shoneya : achetez, vendez, livrez, appelez et discutez — plus vite que sur le site.
        </p>

        <div className={s.ctas}>
          {!ios && (
            <a className={s.play} href={android ? openOrInstallUrl() : PLAY_STORE_URL} target={android ? undefined : '_blank'} rel="noopener noreferrer">
              <i className="fab fa-google-play" aria-hidden="true" />
              <span><small>Disponible sur</small>Google Play</span>
            </a>
          )}
          {APK_URL && !ios && (
            <a className={s.apk} href={APK_URL} download>
              <i className="fas fa-download" aria-hidden="true" />
              <span><small>Sans Play Store</small>Fichier APK</span>
            </a>
          )}
        </div>

        {ios && (
          <p className={s.notice}>
            <i className="fab fa-apple" aria-hidden="true" /> L’application iPhone arrive bientôt. En attendant, Shoneya
            fonctionne entièrement depuis ce site.
          </p>
        )}
        <p className={s.compat}>Android 7 ou plus récent · Gratuit</p>
      </section>

      {desktop && qr && (
        <section className={s.qrCard}>
          <img src={qr} alt="QR code pour télécharger l’application" width={180} height={180} />
          <div>
            <h2>Sur votre téléphone</h2>
            <p>Scannez ce code avec l’appareil photo de votre téléphone Android pour installer Shoneya.</p>
          </div>
        </section>
      )}

      <section className={s.features}>
        {FEATURES.map(f => (
          <article key={f.title} className={s.feature}>
            <span className={s.featureIcon}><i className={`fas ${f.icon}`} aria-hidden="true" /></span>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </article>
        ))}
      </section>

      {APK_URL && !ios && (
        <section className={s.steps}>
          <h2>Installer avec le fichier APK</h2>
          <ol>
            <li><strong>Téléchargez</strong> le fichier avec le bouton « Fichier APK ».</li>
            <li><strong>Ouvrez-le</strong> depuis les notifications ou le dossier Téléchargements.</li>
            <li>Si Android le demande, <strong>autorisez l’installation</strong> pour ce navigateur, puis touchez « Installer ».</li>
          </ol>
          <p className={s.small}>Déjà installée depuis le Play Store ? Gardez celle-ci : elle se met à jour toute seule.</p>
        </section>
      )}

      <p className={s.back}><Link to="/">Continuer sur le site</Link></p>
    </main>
  );
}
