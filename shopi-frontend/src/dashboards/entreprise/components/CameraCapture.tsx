/* ================================================================
 * FICHIER : src/dashboards/entreprise/components/CameraCapture.tsx
 *
 * Fenêtre « Prendre une photo » avec la caméra de l'ordinateur (webcam).
 * Sur téléphone/tablette on ne l'utilise PAS : AjouterPage ouvre
 * directement l'appareil photo natif (plus rapide, meilleure qualité :
 * mise au point, flash, HDR).
 *
 *   - aperçu en direct, caméra arrière préférée quand il y en a une ;
 *   - « Changer de caméra » si plusieurs caméras sont disponibles ;
 *   - capture → aperçu figé → « Reprendre » ou « Utiliser la photo » ;
 *   - caméra coupée dès la fermeture (le voyant s'éteint) ;
 *   - refus d'autorisation / pas de caméra : message clair + repli
 *     « Importer une photo ».
 * ================================================================ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackDismiss } from '../../../shared/hooks/useBackDismiss';
import s from '../styles/CameraCapture.module.css';

interface Props {
  onClose:   () => void;
  /** Photo prise (JPEG). La fenêtre se ferme ensuite. */
  onCapture: (file: File) => void;
  /** Repli quand la caméra est indisponible : ouvre le sélecteur de fichiers. */
  onImport:  () => void;
}

type Phase = 'starting' | 'live' | 'captured' | 'denied' | 'nocamera' | 'error';

export default function CameraCapture({ onClose, onCapture, onImport }: Props) {
  const { t } = useTranslation();
  useBackDismiss(true, onClose);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase,    setPhase]    = useState<Phase>('starting');
  const [devices,  setDevices]  = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [shot,     setShot]     = useState<{ url: string; blob: Blob } | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
  }, []);

  /* ── Démarrage / changement de caméra ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setPhase('nocamera'); return; }
      stop();
      setPhase('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) { stream.getTracks().forEach(tr => tr.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; await v.play().catch(() => {}); }
        setPhase('live');
        /* Liste des caméras : lisible seulement APRÈS l'autorisation */
        const all = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setDevices(all.filter(d => d.kind === 'videoinput'));
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException)?.name;
        setPhase(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
          : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nocamera' : 'error');
      }
    })();
    return () => { cancelled = true; };
  }, [deviceId, stop]);

  /* Caméra coupée à la fermeture ; aperçu figé libéré */
  useEffect(() => () => stop(), [stop]);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    c.toBlob(blob => {
      if (!blob) return;
      setShot({ url: URL.createObjectURL(blob), blob });
      setPhase('captured');
    }, 'image/jpeg', 0.92);
  };

  const retake = () => { setShot(null); setPhase(streamRef.current ? 'live' : 'starting'); };

  const use = () => {
    if (!shot) return;
    const file = new File([shot.blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
    stop();
    onCapture(file);
  };

  const switchCamera = () => {
    if (devices.length < 2) return;
    const current = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId;
    const idx = devices.findIndex(d => d.deviceId === current);
    setDeviceId(devices[(idx + 1) % devices.length].deviceId);
  };

  const problem = phase === 'denied' ? t('ajouter.camera.denied')
    : phase === 'nocamera' ? t('ajouter.camera.noCamera')
    : phase === 'error' ? t('ajouter.camera.error') : null;

  return (
    <div className={s.backdrop} role="dialog" aria-modal="true" aria-labelledby="cam-title"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={s.dialog}>
        <div className={s.head}>
          <h2 id="cam-title" className={s.title}><i className="fas fa-camera" /> {t('ajouter.camera.title')}</h2>
          <button type="button" className={s.close} onClick={onClose} aria-label={t('ajouter.camera.close')}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {problem ? (
          <div className={s.problem}>
            <i className="fas fa-video-slash" />
            <p>{problem}</p>
            <button type="button" className={s.primary} onClick={() => { onClose(); onImport(); }}>
              <i className="fas fa-image" /> {t('ajouter.camera.importInstead')}
            </button>
          </div>
        ) : (
          <>
            <div className={s.stage}>
              {/* La vidéo reste montée pendant l'aperçu figé : « Reprendre » est instantané */}
              <video ref={videoRef} className={s.video} playsInline muted
                style={{ visibility: phase === 'captured' ? 'hidden' : 'visible' }} />
              {phase === 'captured' && shot && <img src={shot.url} alt="" className={s.still} />}
              {phase === 'starting' && (
                <div className={s.overlay}><i className="fas fa-circle-notch fa-spin" /> {t('ajouter.camera.starting')}</div>
              )}
              {phase === 'live' && devices.length > 1 && (
                <button type="button" className={s.switch} onClick={switchCamera} title={t('ajouter.camera.switch')} aria-label={t('ajouter.camera.switch')}>
                  <i className="fas fa-camera-rotate" />
                </button>
              )}
            </div>

            <p className={s.tip}><i className="fas fa-lightbulb" /> {t('ajouter.camera.tip')}</p>

            <div className={s.actions}>
              {phase === 'captured' ? (
                <>
                  <button type="button" className={s.secondary} onClick={retake}>
                    <i className="fas fa-rotate-left" /> {t('ajouter.camera.retake')}
                  </button>
                  <button type="button" className={s.primary} onClick={use}>
                    <i className="fas fa-check" /> {t('ajouter.camera.use')}
                  </button>
                </>
              ) : (
                <button type="button" className={s.shutter} onClick={capture} disabled={phase !== 'live'}
                  aria-label={t('ajouter.camera.capture')} title={t('ajouter.camera.capture')}>
                  <span />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
