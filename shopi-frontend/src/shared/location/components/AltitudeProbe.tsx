/* ================================================================
 * FICHIER : src/shared/location/components/AltitudeProbe.tsx
 *
 * Mode Relief : un clic sur la carte indique l'altitude du point
 * (modèle numérique de terrain Copernicus via Open-Meteo, sans clé d'API).
 * Un seul appel par clic ; échec silencieux (message d'indisponibilité).
 * ================================================================ */

import { useEffect, useRef, useState } from 'react';
import { Popup, useMapEvents } from 'react-leaflet';

interface Probe { lat: number; lng: number; alt: number | null; failed: boolean }

export default function AltitudeProbe() {
  const [probe, setProbe] = useState<Probe | null>(null);
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => () => ctl.current?.abort(), []);

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      ctl.current?.abort();
      const c = (ctl.current = new AbortController());
      setProbe({ lat, lng, alt: null, failed: false });
      fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(5)}&longitude=${lng.toFixed(5)}`, { signal: c.signal })
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j: { elevation?: number[] }) => {
          const alt = j.elevation?.[0];
          setProbe({ lat, lng, alt: typeof alt === 'number' ? Math.round(alt) : null, failed: typeof alt !== 'number' });
        })
        .catch(err => { if ((err as Error).name !== 'AbortError') setProbe({ lat, lng, alt: null, failed: true }); });
    },
  });

  if (!probe) return null;
  return (
    <Popup position={[probe.lat, probe.lng]} eventHandlers={{ remove: () => setProbe(null) }}>
      <div className="am-alt">
        <i className="fas fa-mountain" aria-hidden="true" />
        {probe.failed ? <span>Altitude indisponible</span>
          : probe.alt == null ? <span>Mesure de l'altitude…</span>
          : <span>Altitude : <b>{probe.alt.toLocaleString('fr-FR')} m</b></span>}
        <small>{probe.lat.toFixed(5)}, {probe.lng.toFixed(5)}</small>
      </div>
    </Popup>
  );
}
