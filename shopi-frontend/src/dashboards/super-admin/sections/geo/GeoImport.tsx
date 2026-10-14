/* ================================================================
 * FICHIER : sections/geo/GeoImport.tsx
 * Import massif du référentiel géographique (CSV).
 *
 * Parcours :
 *   1. Choix du niveau (détecté automatiquement d'après les colonnes
 *      du fichier si besoin).
 *   2. Rattachement en cascade : Pays → Région → Préfecture → Commune,
 *      jusqu'au parent direct du niveau importé. Le parent choisi est
 *      appliqué à toutes les lignes qui n'ont pas de colonne
 *      "code parent" (paysCode, regionCode…).
 *   3. Prévisualisation ligne par ligne : chemin complet de
 *      rattachement (Pays › Région › …), éléments déjà présents,
 *      parents introuvables — AVANT d'envoyer quoi que ce soit.
 *   4. Import réel — POST /geo/import/:niveau { rows, parentId }.
 *
 * Le CSV est lu de façon tolérante : séparateur « , » ou « ; »
 * (Excel FR), guillemets, BOM, fins de ligne Windows, encodage
 * UTF-8 ou Windows-1252, en-têtes sans tenir compte de la casse.
 * ================================================================ */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import s from '../GeoReferentielSection.module.css';
import type { GeoLevel, ImportResult, GeoAuditEntry, GeoItem } from './geo.types';
import { GEO_LEVELS } from './geo.types';
import { geoApi, type GeoAllResponse } from './geoApi';

interface GeoImportProps {
  toast: (type: string, msg: string) => void;
}

/* ── Modèles CSV par niveau (la colonne parent est facultative :
 *    le parent peut être choisi dans la page) ── */
const CSV_TEMPLATES: Record<GeoLevel, string> = {
  pays:       'code,nom,iso2,iso3,indicatif,devise,description\nGN,Guinée,GN,GIN,+224,GNF,République de Guinée',
  region:     'code,nom,paysCode,chef_lieu,description\nGN-C,Conakry,GN,Conakry,Zone spéciale de Conakry',
  prefecture: 'code,nom,regionCode,chef_lieu,description\nGN-CK,Conakry,GN-C,Conakry,Préfecture',
  commune:    'code,nom,prefectureCode,type,description\nCKA,Kaloum,GN-CK,urbaine,Centre des affaires',
  quartier:   'code,nom,communeCode,population,description\nKA-001,Sandervalia,CKA,12500,Centre commercial',
  zone:       'code,nom,communeCode,rayonKm,fraisLivraison,tempsEstime,description\nZ-KA-CENTRE,Kaloum Centre,CKA,3,5000,20,Zone centre',
};

/* ── Colonne "code parent" par niveau (miroir de IMPORT_PARENT_COLUMNS côté API) ── */
const PARENT_COL: Partial<Record<GeoLevel, string>> = {
  region: 'paysCode', prefecture: 'regionCode', commune: 'prefectureCode', quartier: 'communeCode', zone: 'communeCode',
};

/* ── Chaîne des ancêtres à choisir pour chaque niveau ── */
type AncestorKey = 'pays' | 'region' | 'prefecture' | 'commune';
const ANCESTORS: Record<GeoLevel, AncestorKey[]> = {
  pays:       [],
  region:     ['pays'],
  prefecture: ['pays', 'region'],
  commune:    ['pays', 'region', 'prefecture'],
  quartier:   ['pays', 'region', 'prefecture', 'commune'],
  zone:       ['pays', 'region', 'prefecture', 'commune'],
};
const ANCESTOR_LABEL: Record<AncestorKey, string> = {
  pays: 'Pays', region: 'Région', prefecture: 'Préfecture', commune: 'Commune',
};

/* ── En-têtes reconnus (insensibles à la casse / aux accents / séparateurs) ── */
const CANONICAL_HEADERS = [
  'code', 'nom', 'description', 'paysCode', 'regionCode', 'prefectureCode', 'communeCode',
  'iso2', 'iso3', 'indicatif', 'devise', 'chef_lieu', 'type', 'population',
  'rayonKm', 'fraisLivraison', 'tempsEstime',
];
const headerKey = (h: string) =>
  h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const HEADER_ALIASES: Record<string, string> = {
  ...Object.fromEntries(CANONICAL_HEADERS.map(h => [headerKey(h), h])),
  name: 'nom', libelle: 'nom', pays: 'paysCode', region: 'regionCode',
  prefecture: 'prefectureCode', commune: 'communeCode', cheflieu: 'chef_lieu',
};

/* ── Détection du niveau d'après les colonnes ── */
function detectLevel(headers: string[]): GeoLevel | null {
  const h = new Set(headers);
  if (h.has('communeCode')) return h.has('rayonKm') || h.has('fraisLivraison') ? 'zone' : 'quartier';
  if (h.has('prefectureCode')) return 'commune';
  if (h.has('regionCode'))     return 'prefecture';
  if (h.has('paysCode'))       return 'region';
  if (h.has('iso3') || h.has('indicatif') || h.has('devise')) return 'pays';
  return null;
}

const normName = (v: string) => v.replace(/\s+/g, ' ').trim().toLocaleUpperCase('fr-FR');

/* ── Lecture CSV tolérante ── */
function decodeFile(buf: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('windows-1252').decode(buf); }
}

function parseCSV(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell.trim()); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell.trim()); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell.length || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter(r => r.some(v => v.length > 0));
}

/* ── Ligne préparée pour l'import ── */
type RowStatus = 'pret' | 'existe' | 'parent_manquant' | 'parent_introuvable' | 'invalide';
interface PreparedRow {
  ligne:   number;                 /* numéro de ligne dans le fichier */
  data:    Record<string, string>;
  status:  RowStatus;
  chemin:  string;                 /* « GUINÉE › BOKÉ » */
  message: string;
}

const STATUS_UI: Record<RowStatus, { label: string; cls: string }> = {
  pret:               { label: 'Prêt',               cls: 'bdgOn'   },
  existe:             { label: 'Déjà présent',       cls: 'bdgSky'  },
  parent_manquant:    { label: 'Parent manquant',    cls: 'bdgGold' },
  parent_introuvable: { label: 'Parent introuvable', cls: 'bdgOff'  },
  invalide:           { label: 'Invalide',           cls: 'bdgOff'  },
};

const PREVIEW_LIMIT = 100;

export default function GeoImport({ toast }: GeoImportProps) {
  const [niveau,   setNiveau]   = useState<GeoLevel>('pays');
  const [geo,      setGeo]      = useState<GeoAllResponse | null>(null);
  const [geoErr,   setGeoErr]   = useState(false);
  const [sel,      setSel]      = useState<Record<AncestorKey, string>>({ pays: '', region: '', prefecture: '', commune: '' });
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows,  setRawRows]  = useState<Record<string, string>[]>([]);
  const [ignored,  setIgnored]  = useState<string[]>([]);
  const [result,   setResult]   = useState<ImportResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [historique, setHistorique] = useState<GeoAuditEntry[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const cfg = GEO_LEVELS.find(l => l.level === niveau)!;
  const parentCol = PARENT_COL[niveau];
  const ancestors = ANCESTORS[niveau];

  /* ── Chargement des données (cascade + détection des doublons) ── */
  const loadGeo = useCallback(() => {
    geoApi.all().then(d => { setGeo(d); setGeoErr(false); }).catch(() => setGeoErr(true));
  }, []);
  const loadHistorique = useCallback(() => {
    geoApi.audit({ action: 'import' }).then(setHistorique).catch(() => {});
  }, []);
  useEffect(() => { loadGeo(); loadHistorique(); }, [loadGeo, loadHistorique]);

  /* ── Index et listes par niveau ── */
  const lists = useMemo(() => ({
    pays:       geo?.pays        ?? [],
    region:     geo?.regions     ?? [],
    prefecture: geo?.prefectures ?? [],
    commune:    geo?.communes    ?? [],
    quartier:   geo?.quartiers   ?? [],
    zone:       geo?.zones       ?? [],
  } as Record<GeoLevel, GeoItem[]>), [geo]);

  const byId = useMemo(() => {
    const m = new Map<string, { item: GeoItem; level: GeoLevel }>();
    (Object.keys(lists) as GeoLevel[]).forEach(l => lists[l].forEach(item => m.set(item.id, { item, level: l })));
    return m;
  }, [lists]);

  /* Chemin complet « PAYS › RÉGION › … » d'un élément, lui compris */
  const cheminDe = useCallback((id: string | null | undefined): string => {
    const parts: string[] = [];
    let cur = id ? byId.get(id) : undefined;
    let guard = 0;
    while (cur && guard++ < 6) {
      parts.unshift(cur.item.nom);
      cur = cur.item.parentId ? byId.get(cur.item.parentId) : undefined;
    }
    return parts.join(' › ');
  }, [byId]);

  /* ── Options de chaque sélecteur de la cascade ── */
  const optionsFor = (k: AncestorKey): GeoItem[] => {
    const all = lists[k];
    const idx = ancestors.indexOf(k);
    const parentKey = idx > 0 ? ancestors[idx - 1] : null;
    const parentId = parentKey ? sel[parentKey] : '';
    return (parentKey && parentId ? all.filter(i => i.parentId === parentId) : all)
      .slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  };

  /* Choisir un élément remonte automatiquement ses ancêtres
   * et vide les niveaux inférieurs. */
  const choose = (k: AncestorKey, id: string) => {
    const next: Record<AncestorKey, string> = { ...sel };
    const order: AncestorKey[] = ['pays', 'region', 'prefecture', 'commune'];
    const pos = order.indexOf(k);
    order.slice(pos).forEach(o => { next[o] = ''; });
    next[k] = id;
    let cur = id ? byId.get(id)?.item : undefined;
    for (let i = pos - 1; i >= 0 && cur; i--) {
      next[order[i]] = cur.parentId ?? '';
      cur = cur.parentId ? byId.get(cur.parentId)?.item : undefined;
    }
    setSel(next);
    setResult(null);
  };

  const directParentKey = ancestors.length ? ancestors[ancestors.length - 1] : null;
  const selectedParentId = directParentKey ? sel[directParentKey] : '';

  /* ── Résolution d'un code parent (code, ISO3 pour un pays, ou nom unique) ── */
  const resolveParent = useCallback((raw: string): string | null => {
    if (!directParentKey) return null;
    const pool = lists[directParentKey];
    const key = raw.trim().toUpperCase();
    const byCode = pool.find(p => p.code.toUpperCase() === key)
      ?? (directParentKey === 'pays' ? pool.find(p => String((p as GeoItem & { iso3?: string }).iso3 ?? '').toUpperCase() === key) : undefined);
    if (byCode) return byCode.id;
    const byName = pool.filter(p => normName(p.nom) === normName(raw));
    return byName.length === 1 ? byName[0].id : null;
  }, [directParentKey, lists]);

  /* ── Analyse ligne par ligne ── */
  const prepared: PreparedRow[] = useMemo(() => {
    const existing = lists[niveau];
    const codes = new Set(existing.map(e => e.code.toUpperCase()));
    const seen = new Set<string>();
    return rawRows.map((data, i) => {
      const ligne = i + 2;
      const code = (data.code ?? '').replace(/\s+/g, '').toUpperCase();
      const nom = data.nom ?? '';
      if (!code || !nom.trim()) {
        return { ligne, data, status: 'invalide', chemin: '—', message: 'Colonnes « code » et « nom » obligatoires.' };
      }
      if (seen.has(code)) {
        return { ligne, data, status: 'invalide', chemin: '—', message: `Code « ${code} » en double dans le fichier.` };
      }
      seen.add(code);

      let parentId: string | null = null;
      if (parentCol) {
        const raw = data[parentCol] ?? '';
        if (raw.trim()) {
          parentId = resolveParent(raw);
          if (!parentId) {
            return {
              ligne, data, status: 'parent_introuvable', chemin: '—',
              message: `${ANCESTOR_LABEL[directParentKey!]} « ${raw} » introuvable. Videz la colonne ${parentCol} ou corrigez-la.`,
            };
          }
        } else if (selectedParentId) {
          parentId = selectedParentId;
        } else {
          return {
            ligne, data, status: 'parent_manquant', chemin: '—',
            message: `Choisissez ${ancestors.map(a => ANCESTOR_LABEL[a].toLowerCase()).join(' › ')} ci-dessus.`,
          };
        }
      }

      const chemin = [cheminDe(parentId), normName(nom)].filter(Boolean).join(' › ');
      const dupName = existing.some(e => normName(e.nom) === normName(nom) && (e.parentId ?? null) === parentId);
      if (codes.has(code) || dupName) {
        return { ligne, data, status: 'existe', chemin, message: 'Déjà dans le référentiel — sera ignoré.' };
      }
      return { ligne, data, status: 'pret', chemin, message: '' };
    });
  }, [rawRows, lists, niveau, parentCol, resolveParent, selectedParentId, cheminDe, ancestors, directParentKey]);

  const counts = useMemo(() => {
    const c: Record<RowStatus, number> = { pret: 0, existe: 0, parent_manquant: 0, parent_introuvable: 0, invalide: 0 };
    prepared.forEach(r => { c[r.status]++; });
    return c;
  }, [prepared]);

  /* ── Lecture du fichier ── */
  const resetFile = () => { setFileName(null); setRawRows([]); setIgnored([]); setResult(null); };

  const handleFile = async (file: File) => {
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      toast('error', 'Fichier Excel : enregistrez-le en « CSV UTF-8 » (Fichier › Enregistrer sous) puis importez le .csv.');
      return;
    }
    if (!/\.(csv|txt)$/i.test(file.name)) {
      toast('error', 'Format non supporté. Utilisez un fichier .csv.');
      return;
    }
    const table = parseCSV(decodeFile(await file.arrayBuffer()));
    if (table.length < 2) {
      toast('error', 'Fichier vide ou sans ligne de données.');
      return;
    }
    const [header, ...data] = table;
    const mapped = header.map(h => HEADER_ALIASES[headerKey(h)] ?? null);
    const unknown = header.filter((_, i) => !mapped[i]);
    const rows = data.map(r => {
      const o: Record<string, string> = {};
      mapped.forEach((k, i) => { if (k) o[k] = r[i] ?? ''; });
      return o;
    });

    const detected = detectLevel(mapped.filter(Boolean) as string[]);
    if (detected && detected !== niveau) {
      setNiveau(detected);
      toast('info', `Fichier reconnu comme : ${GEO_LEVELS.find(l => l.level === detected)!.labelPlural}. Niveau ajusté.`);
    }
    setFileName(file.name);
    setRawRows(rows);
    setIgnored(unknown);
    setResult(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files[0]) void handleFile(e.dataTransfer.files[0]);
  };

  /* ── Import : on n'envoie que les lignes prêtes ── */
  const lancerImport = async () => {
    const toSend = prepared.filter(r => r.status === 'pret');
    if (!toSend.length) return;
    setLoading(true);
    try {
      const res = await geoApi.importRows(niveau, toSend.map(r => r.data), selectedParentId || undefined);
      /* Ramène les numéros de ligne serveur (index dans l'envoi) à ceux du fichier */
      const errors = [
        ...res.errors.map(e => ({ ligne: toSend[e.ligne - 2]?.ligne ?? e.ligne, message: e.message })),
        ...prepared.filter(r => r.status !== 'pret' && r.status !== 'existe').map(r => ({ ligne: r.ligne, message: r.message })),
      ].sort((a, b) => a.ligne - b.ligne);
      setResult({ ...res, total: prepared.length, skipped: prepared.length - res.created, errors });
      toast(res.errors.length ? 'info' : 'success',
        res.errors.length
          ? `Import terminé : ${res.created} créé(s), ${res.errors.length} refusé(s) par le serveur`
          : `Import réussi — ${res.created} élément(s) créé(s)`);
      loadGeo();
      loadHistorique();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : "Échec de l'import");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + CSV_TEMPLATES[niveau]], { type: 'text/csv;charset=utf-8' }));
    a.download = `modele-${niveau}.csv`;
    a.click();
    toast('info', `Modèle CSV pour ${cfg.labelPlural} téléchargé`);
  };

  const changeNiveau = (l: GeoLevel) => { setNiveau(l); resetFile(); };

  const selectedPath = cheminDe(selectedParentId);
  const ready = counts.pret;

  return (
    <div className={s.body}>

      {/* ── 1. Niveau + rattachement ── */}
      <div className={s.card}>
        <div className={s.cardHead}>
          <div>
            <div className={s.cardTitle}><i className="fas fa-file-import" style={{ color: 'var(--acid)' }} /> Import massif</div>
            <div className={s.cardSub}>Choisissez le niveau, le rattachement, puis déposez votre fichier CSV</div>
          </div>
          <button className={`${s.btnSecondary} ${s.btnSm}`} onClick={downloadTemplate}>
            <i className="fas fa-download" /> Modèle CSV
          </button>
        </div>
        <div className={s.cardBody}>
          <div className={s.impStepTitle}><span>1</span> Que voulez-vous importer ?</div>
          <div className={s.impLevels}>
            {GEO_LEVELS.map(l => (
              <button key={l.level} type="button"
                className={`${s.impLevelBtn} ${l.level === niveau ? s.impLevelOn : ''}`}
                onClick={() => changeNiveau(l.level)}>
                <i className={`fas ${l.icon}`} style={{ color: `var(${l.color})` }} />
                {l.labelPlural}
              </button>
            ))}
          </div>

          {ancestors.length > 0 && (
            <>
              <div className={s.impStepTitle}><span>2</span> Où les rattacher ?</div>
              {geoErr && (
                <div className={s.fldHint} style={{ color: 'var(--rose)', marginBottom: 10 }}>
                  Impossible de charger le référentiel. <button type="button" className={`${s.btnSecondary} ${s.btnSm}`} onClick={loadGeo}>Réessayer</button>
                </div>
              )}
              <div className={s.impCascade}>
                {ancestors.map((k, i) => {
                  const opts = optionsFor(k);
                  const locked = i > 0 && !sel[ancestors[i - 1]];
                  return (
                    <div className={s.fld} key={k}>
                      <label className={s.fldL}>{ANCESTOR_LABEL[k]}</label>
                      <select className={s.fldSel} value={sel[k]} disabled={locked || !geo}
                        onChange={e => choose(k, e.target.value)}>
                        <option value="">
                          {!geo ? 'Chargement…' : locked ? `Choisissez d'abord : ${ANCESTOR_LABEL[ancestors[i - 1]].toLowerCase()}` : opts.length ? `— ${ANCESTOR_LABEL[k]} —` : 'Aucun élément'}
                        </option>
                        {opts.map(o => <option key={o.id} value={o.id}>{o.nom} ({o.code})</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
              <div className={s.impPath}>
                <i className="fas fa-location-dot" />
                {selectedPath
                  ? <span>Les {cfg.labelPlural.toLowerCase()} sans colonne <code>{parentCol}</code> seront rattaché(e)s à : <strong>{selectedPath}</strong></span>
                  : <span>Choisissez jusqu&apos;à : <strong>{ANCESTOR_LABEL[directParentKey!].toLowerCase()}</strong>. Sinon, chaque ligne doit avoir sa colonne <code>{parentCol}</code>.</span>}
              </div>
            </>
          )}

          <div className={s.impStepTitle}><span>{ancestors.length ? 3 : 2}</span> Fichier</div>
          <div className={`${s.dropZone} ${dragging ? s.over : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}>
            <i className={`fas ${fileName ? 'fa-file-csv' : 'fa-cloud-arrow-up'}`} />
            {fileName
              ? <><div className={s.dropTitle}>{fileName}</div><div className={s.dropSub}>{rawRows.length} ligne{rawRows.length > 1 ? 's' : ''} lue{rawRows.length > 1 ? 's' : ''} — touchez pour changer de fichier</div></>
              : <><div className={s.dropTitle}>Déposez votre fichier CSV ici</div><div className={s.dropSub}>Colonnes : {CSV_TEMPLATES[niveau].split('\n')[0]}</div></>}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleFile(f); }} />
          {ignored.length > 0 && (
            <div className={s.fldHint} style={{ marginTop: 8 }}>
              Colonnes ignorées : {ignored.join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Vérification ── */}
      {prepared.length > 0 && (
        <div className={s.card}>
          <div className={s.cardHead}>
            <div>
              <div className={s.cardTitle}><i className="fas fa-list-check" style={{ color: 'var(--sky)' }} /> Vérification avant import</div>
              <div className={s.cardSub}>{cfg.labelPlural} · {prepared.length} ligne{prepared.length > 1 ? 's' : ''}</div>
            </div>
            <button className={s.btnPrimary} onClick={lancerImport}
              disabled={loading || ready === 0} style={{ opacity: loading || ready === 0 ? .55 : 1 }}>
              <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-upload'}`} />
              {loading ? 'Import en cours…' : `Importer ${ready} élément${ready > 1 ? 's' : ''}`}
            </button>
          </div>
          <div className={s.cardBody}>
            <div className={s.impStats}>
              {(Object.keys(STATUS_UI) as RowStatus[]).filter(k => counts[k] > 0).map(k => (
                <span key={k} className={`${s.bdg} ${s[STATUS_UI[k].cls]}`}>{counts[k]} · {STATUS_UI[k].label}</span>
              ))}
            </div>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr><th>Ligne</th><th>Code</th><th>Rattachement complet</th><th>Statut</th></tr>
                </thead>
                <tbody>
                  {prepared.slice(0, PREVIEW_LIMIT).map(r => (
                    <tr key={r.ligne}>
                      <td style={{ fontFamily: 'var(--font-m)', fontSize: 11, color: 'var(--txt-3)' }}>{r.ligne}</td>
                      <td style={{ fontFamily: 'var(--font-m)', fontSize: 11 }}>{(r.data.code ?? '').toUpperCase()}</td>
                      <td style={{ fontSize: 12 }}>
                        {r.status === 'pret' || r.status === 'existe' ? r.chemin : <span style={{ color: 'var(--txt-2)' }}>{normName(r.data.nom ?? '')}</span>}
                        {r.message && <div className={s.fldHint} style={{ marginTop: 2 }}>{r.message}</div>}
                      </td>
                      <td><span className={`${s.bdg} ${s[STATUS_UI[r.status].cls]}`}>{STATUS_UI[r.status].label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {prepared.length > PREVIEW_LIMIT && (
              <div className={s.fldHint} style={{ marginTop: 8 }}>
                {PREVIEW_LIMIT} premières lignes affichées sur {prepared.length} — toutes seront traitées.
              </div>
            )}
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
            <div className={s.impResult}>
              {[
                { l: 'Lignes du fichier', v: result.total,   c: 'var(--txt-2)' },
                { l: 'Créés',             v: result.created, c: 'var(--acid)' },
                { l: 'Ignorés / Err.',    v: result.skipped, c: 'var(--rose)' },
              ].map(({ l, v, c }) => (
                <div key={l} className={s.impResultBox}>
                  <div style={{ fontFamily: 'var(--font-h)', fontSize: 22, fontWeight: 800, color: c }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div className={s.impErrors}>
                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--gold)', marginBottom: 8 }}>
                  <i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }} />
                  {result.errors.length} ligne{result.errors.length > 1 ? 's' : ''} non importée{result.errors.length > 1 ? 's' : ''}
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
                      <td><span className={`${s.bdg} ${s.bdgSky}`}>{GEO_LEVELS.find(l => l.level === h.niveau)?.label ?? h.niveau}</span></td>
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
