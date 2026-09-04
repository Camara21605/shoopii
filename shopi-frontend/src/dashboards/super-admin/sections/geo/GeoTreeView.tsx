/* ================================================================
 * FICHIER : sections/geo/GeoTreeView.tsx
 * Vue arborescente de toute la hiérarchie géographique.
 * Navigation, expansion/repli, indicateurs de statut.
 * Données réelles — reçues en props depuis GeoReferentielSection
 * (déjà chargées via geoApi.all()), pas de données mock.
 * ================================================================ */

import { useState } from 'react';
import s from '../GeoReferentielSection.module.css';
import type { GeoLevel, GeoItem } from './geo.types';
import { GEO_LEVELS } from './geo.types';

interface TreeData {
  pays:        GeoItem[];
  regions:     GeoItem[];
  prefectures: GeoItem[];
  communes:    GeoItem[];
  quartiers:   GeoItem[];
  zones:       GeoItem[];
}

interface GeoTreeViewProps {
  data:       TreeData;
  onNavigate: (level: GeoLevel, parentId?: string) => void;
}

/* ── Nœud récursif ── */
interface TreeNodeProps {
  id:         string;
  code:       string;
  nom:        string;
  statut:     'actif' | 'inactif';
  level:      GeoLevel;
  depth:      number;
  forceOpen:  boolean;
  data:       TreeData;
  onNavigate: (level: GeoLevel, parentId?: string) => void;
}

function TreeNode({ id, code, nom, statut, level, depth, forceOpen, data, onNavigate }: TreeNodeProps) {
  const [open, setOpen] = useState(forceOpen || depth < 1);
  const cfg = GEO_LEVELS.find(l => l.level === level)!;

  /* Enfants selon le niveau courant */
  const children: { id: string; code: string; nom: string; statut: 'actif' | 'inactif'; childLevel: GeoLevel }[] = [];

  if (cfg.childLevel) {
    const childCfg = GEO_LEVELS.find(l => l.level === cfg.childLevel)!;
    const sourceMap: Record<string, GeoItem[]> = {
      region: data.regions, prefecture: data.prefectures, commune: data.communes,
      quartier: data.quartiers, zone: data.zones,
    };
    const source = sourceMap[cfg.childLevel] ?? [];
    source.filter(x => x.parentId === id).forEach(x =>
      children.push({ id: x.id, code: x.code, nom: x.nom, statut: x.statut, childLevel: childCfg.level as GeoLevel }),
    );
  }

  const hasChildren = children.length > 0;
  const accentColor = `var(${cfg.color})`;

  return (
    <div className={s.tNode}>
      {/* Bouton toggle */}
      <div className={`${s.tToggle} ${open ? s.open : ''}`}
        onClick={() => hasChildren && setOpen(v => !v)}
        style={{ visibility: hasChildren ? 'visible' : 'hidden' }}>
        <i className="fas fa-chevron-right" />
      </div>

      <div className={s.tContent}>
        {/* Item */}
        <div className={s.tItem} onClick={() => onNavigate(level, id)}>
          <div className={s.tIc} style={{ background: `${accentColor}18`, color: accentColor }}>
            <i className={`fas ${cfg.icon}`} />
          </div>
          <span className={s.tName}>{nom}</span>
          <span className={s.tCode}>{code}</span>
          {hasChildren && (
            <span style={{ fontSize: 10, color: 'var(--txt-3)', marginLeft: 6 }}>
              {children.length}
            </span>
          )}
          <span className={`${s.bdg} ${statut === 'actif' ? s.bdgOn : s.bdgOff}`}
            style={{ fontSize: 9, padding: '1px 6px', marginLeft: 4 }}>
            {statut === 'actif' ? '●' : '○'}
          </span>
        </div>

        {/* Sous-arbre */}
        {open && hasChildren && (
          <div className={s.tChildren}>
            {children.map(ch => (
              <TreeNode
                key={ch.id} id={ch.id} code={ch.code} nom={ch.nom}
                statut={ch.statut} level={ch.childLevel}
                depth={depth + 1} forceOpen={forceOpen} data={data} onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Composant principal ── */
export default function GeoTreeView({ data, onNavigate }: GeoTreeViewProps) {
  const [search, setSearch] = useState('');
  const [expandAll, setExpandAll] = useState(false);

  const filtered = data.pays.filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className={s.body}>
      <div className={s.card}>
        <div className={s.cardHead}>
          <div>
            <div className={s.cardTitle}><i className="fas fa-sitemap" style={{ color: 'var(--acid)' }} /> Arbre hiérarchique complet</div>
            <div className={s.cardSub}>Parcourez toute la hiérarchie Pays → Région → Préfecture → Commune → Quartier → Zone</div>
          </div>
          <div className={s.cardActions}>
            <button className={`${s.btnSecondary} ${s.btnSm}`}
              onClick={() => setExpandAll(v => !v)}>
              <i className={`fas ${expandAll ? 'fa-compress' : 'fa-expand'}`} />
              {expandAll ? 'Tout réduire' : 'Tout développer'}
            </button>
          </div>
        </div>
        <div className={s.cardBody}>
          {/* Recherche */}
          <div className={s.filterBar} style={{ marginBottom: 16 }}>
            <div className={s.searchBox} style={{ maxWidth: 340 }}>
              <i className="fas fa-magnifying-glass" />
              <input placeholder="Rechercher dans l'arbre…" value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Légende des niveaux */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, padding: '10px 14px', background: 'var(--surface)', borderRadius: 'var(--r-sm)' }}>
            {GEO_LEVELS.map(cfg => (
              <span key={cfg.level} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--txt-2)' }}>
                <i className={`fas ${cfg.icon}`} style={{ color: `var(${cfg.color})`, fontSize: 10 }} />
                {cfg.label}
              </span>
            ))}
          </div>

          {/* Arbre — remonté (key) à chaque bascule "Tout développer/réduire"
             pour que l'état initial de chaque nœud reflète le nouveau mode. */}
          <div className={s.tree} key={expandAll ? 'expanded' : 'collapsed'}>
            {filtered.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--txt-3)', fontSize: 13, padding: '20px 0' }}>Aucun résultat</p>
            )}
            {filtered.map(pays => (
              <TreeNode
                key={pays.id}
                id={pays.id} code={pays.code} nom={pays.nom} statut={pays.statut}
                level="pays" depth={0} forceOpen={expandAll} data={data} onNavigate={onNavigate}
              />
            ))}
          </div>

          <p style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <i className="fas fa-info-circle" style={{ marginRight: 5 }} />
            Cliquez sur un élément pour naviguer directement vers ce niveau. Les éléments inactifs sont marqués ○.
          </p>
        </div>
      </div>
    </div>
  );
}
