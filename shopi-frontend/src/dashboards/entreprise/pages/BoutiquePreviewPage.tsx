/* ============================================================
 * FICHIER : src/dashboards/entreprise/pages/BoutiquePreviewPage.tsx
 *
 * ONGLETS :
 *   Aperçu     → iframe de la boutique publique (comportement original)
 *   Localisation → carte interactive + sauvegarde GPS
 * ============================================================ */

import { useEffect, useState, lazy, Suspense } from 'react';
import { useParametres }  from '../hooks/useParametres';
import { apiFetch }       from '../../../shared/services/apiFetch';
import type { EntreprisePage } from '../types';
import type { LocationPickerValue } from '../../../shared/location/components/LocationPicker';
import '../../../shared/location/styles/location.css';

const LocationPicker = lazy(() => import('../../../shared/location/components/LocationPicker'));

interface Props {
  onNavigate: (page: EntreprisePage) => void;
}

type Tab = 'apercu' | 'localisation';

export default function BoutiquePreviewPage({ onNavigate }: Props) {
  const { data, loading } = useParametres();
  const [iframeKey,     setIframeKey]     = useState(0);
  const [activeTab,     setActiveTab]     = useState<Tab>('apercu');
  const [locationValue, setLocationValue] = useState<LocationPickerValue | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);

  /* Recharge l'iframe si on revient sur la page */
  useEffect(() => { setIframeKey(k => k + 1); }, []);

  /* Initialise la valeur du picker depuis les données API */
  useEffect(() => {
    if (!data) return;
    if (data.latitude && data.longitude) {
      setLocationValue({
        coordinates: { latitude: Number(data.latitude), longitude: Number(data.longitude) },
        address: {
          displayName: [data.adresse, data.commune, data.ville].filter(Boolean).join(', '),
          adresse:     data.adresse   ?? undefined,
          commune:     data.commune   ?? undefined,
          ville:       data.ville     ?? undefined,
          region:      data.region    ?? undefined,
          pays:        data.pays      ?? undefined,
          codePostal:  data.codePostal ?? undefined,
          latitude:    Number(data.latitude),
          longitude:   Number(data.longitude),
        },
      });
    }
  }, [data]);

  /* Sauvegarde la position GPS */
  const handleSave = async () => {
    if (!locationValue || !data?.id) return;
    setSaving(true);
    try {
      await apiFetch(`/location/company/${data.id}`, {
        method: 'PATCH',
        body: {
          latitude:  locationValue.coordinates.latitude,
          longitude: locationValue.coordinates.longitude,
          adresse:   locationValue.address?.adresse  ?? data.adresse  ?? undefined,
          commune:   locationValue.address?.commune  ?? data.commune  ?? undefined,
          ville:     locationValue.address?.ville    ?? data.ville    ?? undefined,
          region:    locationValue.address?.region   ?? data.region   ?? undefined,
          pays:      locationValue.address?.pays     ?? data.pays     ?? 'GN',
          codePostal: locationValue.address?.codePostal ?? data.codePostal ?? undefined,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert(`❌ Erreur : ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'var(--t3)' }}>
      <div style={{ textAlign:'center' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize:28, display:'block', marginBottom:12 }} />
        Chargement de la boutique…
      </div>
    </div>
  );

  const boutiqueUrl = `/boutique/${data.id}?preview=1`;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 72px)' }}>

      {/* ── Bandeau de navigation ─────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 20px', background:'var(--white)',
        borderBottom:'1px solid var(--bdr)', flexShrink:0, gap:12, flexWrap:'wrap',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button
            onClick={() => onNavigate('profil')}
            style={{
              background:'var(--g100)', border:'none', borderRadius:9,
              padding:'7px 14px', cursor:'pointer', color:'var(--t2)',
              fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:7,
            }}
          >
            <i className="fas fa-arrow-left" /> Retour au profil
          </button>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--navy)' }}>
              {data.companyName}
            </div>
            <div style={{ fontSize:11, color:'var(--t3)' }}>
              {activeTab === 'apercu' ? 'Aperçu public de votre boutique' : 'Position GPS de votre boutique'}
            </div>
          </div>
        </div>

        {/* ── Onglets ────────────────────────────────────── */}
        <div style={{ display:'flex', gap:0, background:'var(--g100)', borderRadius:10, padding:3 }}>
          {([
            { key: 'apercu',       label: 'Aperçu',       icon: 'fa-eye' },
            { key: 'localisation', label: 'Localisation', icon: 'fa-map-location-dot' },
          ] as { key: Tab; label: string; icon: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding:      '7px 16px',
                borderRadius: 8,
                border:       'none',
                fontSize:     12,
                fontWeight:   600,
                cursor:       'pointer',
                display:      'flex',
                alignItems:   'center',
                gap:          6,
                transition:   'all .15s',
                background:   activeTab === tab.key ? '#fff' : 'transparent',
                color:        activeTab === tab.key ? 'var(--navy)' : 'var(--t2)',
                boxShadow:    activeTab === tab.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
              }}
            >
              <i className={`fas ${tab.icon}`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Actions droite ─────────────────────────────── */}
        <div style={{ display:'flex', gap:8 }}>
          {activeTab === 'apercu' ? (
            <>
              <button
                onClick={() => setIframeKey(k => k + 1)}
                title="Actualiser"
                style={{
                  background:'var(--g100)', border:'none', borderRadius:9,
                  padding:'7px 12px', cursor:'pointer', color:'var(--t2)', fontSize:13,
                }}
              >
                <i className="fas fa-rotate-right" />
              </button>
              <button
                onClick={() => window.open(`/boutique/${data.id}`, '_blank')}
                style={{
                  background:'var(--navy)', color:'#fff', border:'none',
                  borderRadius:9, padding:'7px 14px',
                  fontSize:12, fontWeight:600, cursor:'pointer',
                  display:'flex', alignItems:'center', gap:7,
                }}
              >
                <i className="fas fa-arrow-up-right-from-square" /> Ouvrir
              </button>
            </>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !locationValue}
              style={{
                background:   saved ? '#047857' : 'var(--blue, #1A4FC4)',
                color:        '#fff',
                border:       'none',
                borderRadius: 9,
                padding:      '7px 18px',
                fontSize:     12,
                fontWeight:   600,
                cursor:       saving || !locationValue ? 'not-allowed' : 'pointer',
                opacity:      !locationValue ? .5 : 1,
                display:      'flex',
                alignItems:   'center',
                gap:          7,
                transition:   'background .3s',
              }}
            >
              {saving ? (
                <><i className="fas fa-circle-notch fa-spin" /> Enregistrement…</>
              ) : saved ? (
                <><i className="fas fa-check" /> Enregistré !</>
              ) : (
                <><i className="fas fa-cloud-arrow-up" /> Sauvegarder</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Contenu ──────────────────────────────────────── */}

      {activeTab === 'apercu' && (
        <iframe
          key={iframeKey}
          src={boutiqueUrl}
          title="Aperçu boutique"
          style={{ flex:1, border:'none', width:'100%', background:'var(--bg)' }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      )}

      {activeTab === 'localisation' && (
        <div style={{ flex:1, overflow:'auto', padding:'24px 20px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>

            {/* Info adresse texte */}
            <div style={{
              display:      'flex',
              gap:          12,
              padding:      '12px 16px',
              background:   'var(--sky-2, #f0f4ff)',
              borderRadius: 12,
              border:       '1.5px solid var(--sky-3, #c7d9f8)',
              marginBottom: 20,
              fontSize:     13,
            }}>
              <i className="fas fa-circle-info" style={{ color: 'var(--blue)', marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, marginBottom: 3 }}>Épinglez votre boutique sur la carte</div>
                <div style={{ color: 'var(--t2)' }}>
                  Cliquez sur la carte ou glissez le marqueur pour positionner exactement votre boutique.
                  Cela améliore la visibilité pour les clients et les livreurs à proximité.
                </div>
                {data.adresse && (
                  <div style={{ marginTop: 6, color: 'var(--navy)', fontWeight: 600 }}>
                    <i className="fas fa-location-dot" style={{ marginRight: 5, color: 'var(--blue)' }} />
                    {[data.adresse, data.commune, data.ville].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            </div>

            {/* Carte interactive */}
            <Suspense fallback={
              <div style={{
                height: '460px', display:'flex', alignItems:'center', justifyContent:'center',
                background:'var(--sky-2,#f0f4ff)', borderRadius:14, border:'1.5px solid var(--sky-3)',
              }}>
                <div style={{ textAlign:'center' }}>
                  <i className="fas fa-circle-notch fa-spin" style={{ fontSize:28, color:'var(--blue)', display:'block', marginBottom:10 }} />
                  Chargement de la carte…
                </div>
              </div>
            }>
              <LocationPicker
                value={locationValue}
                onChange={setLocationValue}
                height="460px"
                placeholder={`Rechercher "${data.companyName}" sur la carte…`}
                showGpsButton={false}
              />
            </Suspense>

            {/* Coordonnées affichées */}
            {locationValue?.coordinates && (
              <div style={{
                marginTop:    14,
                display:      'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap:          10,
              }}>
                {[
                  { label: 'Latitude',  value: locationValue.coordinates.latitude.toFixed(6),  icon: 'fa-arrows-up-down' },
                  { label: 'Longitude', value: locationValue.coordinates.longitude.toFixed(6), icon: 'fa-arrows-left-right' },
                  ...(locationValue.address?.ville     ? [{ label: 'Ville',    value: locationValue.address.ville,     icon: 'fa-city'       }] : []),
                  ...(locationValue.address?.commune   ? [{ label: 'Commune',  value: locationValue.address.commune,   icon: 'fa-map-pin'    }] : []),
                  ...(locationValue.address?.region    ? [{ label: 'Région',   value: locationValue.address.region,    icon: 'fa-map'        }] : []),
                  ...(locationValue.address?.codePostal ? [{ label: 'Code postal', value: locationValue.address.codePostal, icon: 'fa-envelope' }] : []),
                ].map(item => (
                  <div key={item.label} style={{
                    padding:      '10px 14px',
                    background:   '#fff',
                    borderRadius: 10,
                    border:       '1.5px solid var(--border, #e5e7eb)',
                    fontSize:     12.5,
                  }}>
                    <div style={{ color:'var(--t2)', fontSize:11, marginBottom:3, display:'flex', alignItems:'center', gap:5 }}>
                      <i className={`fas ${item.icon}`} style={{ fontSize:10 }} />
                      {item.label}
                    </div>
                    <div style={{ fontWeight:700, color:'var(--navy)', fontFamily:'monospace' }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bouton save bas de page */}
            <div style={{ marginTop: 20, display:'flex', justifyContent:'flex-end' }}>
              <button
                onClick={handleSave}
                disabled={saving || !locationValue}
                style={{
                  padding:      '11px 28px',
                  background:   saved ? '#047857' : 'var(--blue, #1A4FC4)',
                  color:        '#fff',
                  border:       'none',
                  borderRadius: 10,
                  fontSize:     14,
                  fontWeight:   700,
                  cursor:       saving || !locationValue ? 'not-allowed' : 'pointer',
                  opacity:      !locationValue ? .5 : 1,
                  display:      'flex',
                  alignItems:   'center',
                  gap:          9,
                  transition:   'background .3s',
                }}
              >
                {saving ? (
                  <><i className="fas fa-circle-notch fa-spin" /> Enregistrement…</>
                ) : saved ? (
                  <><i className="fas fa-check" /> Position enregistrée !</>
                ) : (
                  <><i className="fas fa-cloud-arrow-up" /> Sauvegarder la position</>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
