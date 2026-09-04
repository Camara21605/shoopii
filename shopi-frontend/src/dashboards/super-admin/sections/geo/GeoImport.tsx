/* ================================================================
 * FICHIER : sections/geo/GeoImport.tsx
 * Import massif du référentiel géographique (CSV / Excel).
 * Drag & drop, prévisualisation, mapping colonnes, validation,
 * téléchargement de templates, historique des imports.
 *
 * L'import est réel — POST /geo/import/:niveau crée effectivement
 * les lignes (mêmes validations que le formulaire standard). Le
 * détail par ligne (créé / erreur) vient de la réponse serveur, pas
 * d'une simulation aléatoire.
 * ================================================================ */

import { useState, useRef, useEffect, useCallback } from 'react';
import s from '../GeoReferentielSection.module.css';
import type { GeoLevel, ImportResult, GeoAuditEntry } from './geo.types';
import { GEO_LEVELS } from './geo.types';
import { geoApi } from './geoApi';

interface GeoImportProps {
  toast: (type: string, msg: string) => void;
}

/* Contenu CSV modèle pour chaque niveau */
const CSV_TEMPLATES: Partial<Record<GeoLevel, string>> = {
  pays:       'code,nom,iso2,iso3,indicatif,devise,description\nGN,Guinée,GN,GIN,+224,GNF,République de Guinée',
  region:     'code,nom,paysCode,chef_lieu,description\nGN-C,Conakry,GN,Conakry,Capitale',
  prefecture: 'code,nom,regionCode,chef_lieu,description\nKA,Kaloum,GN-C,Kaloum,Arrondissement de Kaloum',
  commune:    'code,nom,prefectureCode,type,description\nCKA,Commune de Kaloum,KA,urbaine,Centre des affaires',
  quartier:   'code,nom,communeCode,population,description\nKA-001,Sandervalia,CKA,12500,Centre commercial',
  zone:       'code,nom,communeCode,rayonKm,fraisLivraison,tempsEstime,description\nZ-KA-CENTRE,Kaloum Centre,CKA,3,5000,20,Zone centre',
};

export default function GeoImport({ toast }: GeoImportProps) {
  const [niveau,   setNiveau]   = useState<GeoLevel>('quartier');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview,  setPreview]  = useState<string[][]>([]);
  const [allRows,  setAllRows]  = useState<Record<string, string>[]>([]);
  const [result,   setResult]   = useState<ImportResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [historique, setHistorique] = useState<GeoAuditEntry[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const cfg = GEO_LEVELS.find(l => l.level === niveau)!;

  const loadHistorique = useCallback(() => {
    geoApi.audit({ action: 'import' }).then(setHistorique).catch(() => {});
  }, []);
  useEffect(() => { loadHistorique(); }, [loadHistorique]);

  /* ── Parse CSV complet (en-tête + toutes les lignes) ── */
  const parseCSVFull = (text: string): string[][] =>
    text.trim().split('\n').map(l => l.split(',').map(c => c.replace(/^"|"$/g, '').trim()));

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      toast('error', 'Format non supporté. Utilisez CSV ou Excel (.xlsx/.xls).');
      return;
    }
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = e => {
      const full = parseCSVFull(e.target?.result as string);
      setPreview(full.slice(0, 6));
      const [header, ...dataRows] = full;
      setAllRows(dataRows
        .filter(r => r.some(c => c.length > 0))
        .map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))),
      );
    };
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const lancerImport = async () => {
    if (!fileName || allRows.length === 0) return;
    setLoading(true);
    try {
      const res = await geoApi.importRows(niveau, allRows);
      setResult(res);
      toast(res.errors.length ? 'info' : 'success',
        res.errors.length ? `Import terminé avec ${res.errors.length} erreur(s)` : `Import réussi — ${res.created} élément(s) créé(s)`);
      loadHistorique();
    } catch (err: any) {
      toast('error', err?.message ?? "Échec de l'import");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const content = CSV_TEMPLATES[niveau] ?? `code,nom,description\nexemple,Nom exemple,Description`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv' }));
    a.download = `template-${niveau}.csv`;
    a.click();
    toast('info', `Template CSV pour ${cfg.label} téléchargé`);
  };

  return (
    <div className={s.body}>

      {/* ── Sélection du niveau ── */}
      <div className={s.card}>
        <div className={s.cardHead}>
          <div>
            <div className={s.cardTitle}><i className="fas fa-file-import" style={{ color: 'var(--acid)' }} /> Import massif</div>
            <div className={s.cardSub}>Importez des données géographiques depuis un fichier CSV ou Excel</div>
          </div>
          <button className={`${s.btnSecondary} ${s.btnSm}`} onClick={downloadTemplate}>
            <i className="fas fa-download" /> Template CSV
          </button>
        </div>
        <div className={s.cardBody}>
          {/* Choix du niveau */}
          <div className={s.fld} style={{ marginBottom: 20, maxWidth: 340 }}>
            <label className={s.fldL}>Niveau géographique cible</label>
            <select className={s.fldSel} value={niveau} onChange={e => { setNiveau(e.target.value as GeoLevel); setFileName(null); setPreview([]); setAllRows([]); setResult(null); }}>
              {GEO_LEVELS.map(l => <option key={l.level} value={l.level}>{l.label}</option>)}
            </select>
          </div>

          {/* Zone drag & drop */}
          <div className={`${s.dropZone} ${dragging ? s.over : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}>
            <i className={`fas ${fileName ? 'fa-file-csv' : 'fa-cloud-arrow-up'}`} />
            {fileName
              ? <><div className={s.dropTitle}>{fileName}</div><div className={s.dropSub}>{allRows.length} ligne{allRows.length > 1 ? 's' : ''} détectée{allRows.length > 1 ? 's' : ''} — prêt à importer</div></>
              : <><div className={s.dropTitle}>Déposez votre fichier ici</div><div className={s.dropSub}>CSV ou Excel · Colonnes : {CSV_TEMPLATES[niveau]?.split('\n')[0]}</div></>
            }
          </div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
        </div>
      </div>

      {/* ── Prévisualisation ── */}
      {preview.length > 0 && (
        <div className={s.card}>
          <div className={s.cardHead}>
            <div>
              <div className={s.cardTitle}><i className="fas fa-eye" style={{ color: 'var(--sky)' }} /> Prévisualisation (5 premières lignes)</div>
              <div className={s.cardSub}>{preview[0]?.length ?? 0} colonnes détectées</div>
            </div>
            <button className={s.btnPrimary} onClick={lancerImport}
              disabled={loading} style={{ opacity: loading ? .6 : 1 }}>
              <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-upload'}`} />
              {loading ? 'Import en cours…' : 'Lancer l\'import'}
            </button>
          </div>
          <div className={s.cardBody}>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>{preview[0]?.map((h, i) => <th key={i}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.slice(1).map((row, ri) => (
                    <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Résultat ── */}
      {result && (
        <div className={s.card} style={{ borderColor: result.errors.length ? 'rgba(245,166,35,.3)' : 'rgba(0,200,138,.3)' }}>
          <div className={s.cardHead}>
            <div className={s.cardTitle}>
              <i className={`fas ${result.errors.length ? 'fa-triangle-exclamation' : 'fa-circle-check'}`}
                style={{ color: result.errors.length ? 'var(--gold)' : 'var(--acid)' }} />
              Résultats de l&apos;import
            </div>
          </div>
          <div className={s.cardBody}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12, marginBottom: result.errors.length ? 16 : 0 }}>
              {[
                { l: 'Total traités',   v: result.total,   c: 'var(--txt-2)' },
                { l: 'Créés',          v: result.created, c: 'var(--acid)' },
                { l: 'Mis à jour',     v: result.updated, c: 'var(--sky)' },
                { l: 'Ignorés / Err.', v: result.skipped, c: 'var(--rose)' },
              ].map(({ l, v, c }) => (
                <div key={l} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-h)', fontSize: 22, fontWeight: 800, color: c }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div style={{ background: 'var(--gold-dim)', border: '1px solid rgba(245,166,35,.2)', borderRadius: 'var(--r-sm)', padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--gold)', marginBottom: 8 }}>
                  <i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }} />
                  {result.errors.length} avertissement{result.errors.length > 1 ? 's' : ''}
                </div>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--txt-2)', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-m)', color: 'var(--gold)' }}>Ligne {e.ligne}</span>
                    {' '}— {e.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Historique des imports ── */}
      <div className={s.card}>
        <div className={s.cardHead}>
          <div className={s.cardTitle}><i className="fas fa-history" style={{ color: 'var(--violet)' }} /> Historique des imports</div>
        </div>
        <div className={s.cardBody}>
          {historique.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--txt-3)', padding: '20px 0', fontSize: 13 }}>
              Aucun import effectué pour l&apos;instant
            </p>
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr><th>Détails</th><th>Niveau</th><th>Auteur</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {historique.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontSize: 12 }}>{h.details}</td>
                      <td><span className={`${s.bdg} ${s.bdgSky}`}>{h.niveau}</span></td>
                      <td style={{ fontSize: 11 }}>{h.auteur}</td>
                      <td style={{ color: 'var(--txt-3)', fontSize: 11 }}>{h.quand}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
