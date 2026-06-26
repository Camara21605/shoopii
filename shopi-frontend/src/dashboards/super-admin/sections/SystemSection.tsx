// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/sections/SystemSection.tsx
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';

interface Props {
  store: SuperAdminStore;
  isActive: boolean;
}

function drawLineChart(svgEl: SVGSVGElement, color: string, W = 700, H = 120) {
  const pL = 10, pR = 10, pT = 15, pB = 5;
  const gW = W - pL - pR, gH = H - pT - pB;
  const data = Array.from({ length: 60 }, () => 20 + Math.floor(Math.random() * 60));
  const mx = Math.max(...data) + 10;
  const toX = (i: number) => pL + (i / (data.length - 1)) * gW;
  const toY = (v: number) => pT + gH - (v / mx) * gH;
  const path = 'M' + data.map((d, i) => `${toX(i)},${toY(d)}`).join('L');
  const area = path + `L${toX(data.length - 1)},${pT + gH}L${toX(0)},${pT + gH}Z`;
  const uid = color.replace(/[^a-z]/gi, '');
  svgEl.innerHTML = `
    <defs><linearGradient id="ag-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#ag-${uid})"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>
  `;
}

export default function SystemSection({ store, isActive }: Props) {
  const cpuRef = useRef<SVGSVGElement>(null);
  const ramRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!isActive) return;
    if (cpuRef.current) drawLineChart(cpuRef.current, '#38BFFF');
    if (ramRef.current) drawLineChart(ramRef.current, '#BF7FFF');
  }, [isActive]);

  if (!isActive) return null;

  const { healthData } = store;

  const allNominal = healthData.every(h => h.status === 'Nominal' || h.val >= 80);

  return (
    <div className="section active">
      <div className="page-header">
        <div>
          <div className="ph-title">Santé <mark>Système</mark></div>
          <div className="ph-sub">Monitoring infrastructure en temps réel</div>
        </div>
        <span
          className={`badge ${allNominal ? 'b-acid' : 'b-gold'}`}
          style={{ fontSize: 13, padding: '6px 16px' }}
        >
          {allNominal ? '✅ Nominal' : '⚠️ Attention'}
        </span>
      </div>

      {/* Cartes services */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {healthData.map((h, i) => (
          <div key={i} className="health-card">
            <div className="health-name">{h.name}</div>
            <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>{h.status}</div>
            <div className="health-val" style={{ color: h.color }}>
              {h.val}
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--txt-2)', marginLeft: 4 }}>{h.unit}</span>
            </div>
            <div className="health-bar">
              <div className="health-fill" style={{ background: h.color, width: `${h.val}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Graphiques CPU / RAM */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">CPU — Dernière heure</div>
            <span className="badge b-sky">Live</span>
          </div>
          <div className="chart-wrap">
            <svg
              ref={cpuRef}
              className="svg-chart"
              viewBox="0 0 700 120"
              height={120}
              preserveAspectRatio="none"
            />
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <div className="card-title">RAM — Dernière heure</div>
            <span className="badge b-violet">Live</span>
          </div>
          <div className="chart-wrap">
            <svg
              ref={ramRef}
              className="svg-chart"
              viewBox="0 0 700 120"
              height={120}
              preserveAspectRatio="none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
