// ─────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/sections/AnalyticsSection.tsx
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';

interface Props { store: SuperAdminStore; isActive: boolean; }

const FLAGS: Record<string, string> = { GN: '🇬🇳', SN: '🇸🇳', ML: '🇲🇱', CI: '🇨🇮' };
const COUNTRY_NAMES: Record<string, string> = { GN: 'Guinée', SN: 'Sénégal', ML: 'Mali', CI: "Côte d'Ivoire" };

export default function AnalyticsSection({ store, isActive }: Props) {
  const barRef = useRef<SVGSVGElement>(null);
  const lineRef = useRef<SVGSVGElement>(null);

  const users = store.users;
  const total = users.length;

  // Répartition par pays
  const countries = ['GN', 'SN', 'ML', 'CI'];
  const countryCounts = countries.map(c => ({ code: c, count: users.filter(u => u.country === c).length }));
  const maxCountry = Math.max(...countryCounts.map(c => c.count));

  // Répartition par statut
  const statuses = [
    { key: 'active', label: 'Actifs', color: 'var(--acid)' },
    { key: 'blocked', label: 'Bloqués', color: 'var(--rose)' },
    { key: 'pending', label: 'En attente', color: 'var(--gold)' },
    { key: 'suspended', label: 'Suspendus', color: 'var(--txt-2)' },
  ];

  // Courbe mensuelle simulée
  useEffect(() => {
    if (!isActive || !lineRef.current) return;
    const svg = lineRef.current;
    const W = 700, H = 160, pL = 10, pR = 10, pT = 16, pB = 8;
    const gW = W - pL - pR, gH = H - pT - pB, months = 6;
    const data = [4, 7, 5, 11, 8, 13];
    const mx = Math.max(...data) + 3;
    const toX = (i: number) => pL + (i / (months - 1)) * gW;
    const toY = (v: number) => pT + gH - (v / mx) * gH;
    const path = 'M' + data.map((d, i) => `${toX(i)},${toY(d)}`).join('L');
    const area = path + `L${toX(months - 1)},${pT + gH}L${toX(0)},${pT + gH}Z`;
    svg.innerHTML = `
      <defs>
        <linearGradient id="ga2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38BFFF" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#38BFFF" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${[0, .33, .66, 1].map(p => `<line x1="${pL}" y1="${pT + gH * p}" x2="${W - pR}" y2="${pT + gH * p}" stroke="rgba(128,128,128,0.07)" stroke-width="1"/>`).join('')}
      <path d="${area}" fill="url(#ga2)"/>
      <path d="${path}" fill="none" stroke="#38BFFF" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${data.map((d, i) => `<circle cx="${toX(i)}" cy="${toY(d)}" r="3.5" fill="var(--surface)" stroke="#38BFFF" stroke-width="1.5"/>`).join('')}
    `;
  }, [isActive]);

  // Barchart vérifiés vs non vérifiés
  useEffect(() => {
    if (!isActive || !barRef.current) return;
    const svg = barRef.current;
    const verified = users.filter(u => u.verified).length;
    const unverified = total - verified;
    const W = 300, H = 100, barW = 60, gap = 40;
    const maxV = Math.max(verified, unverified) + 2;
    const toY = (v: number) => H - (v / maxV) * (H - 20);
    const toH = (v: number) => (v / maxV) * (H - 20);
    svg.innerHTML = `
      <rect x="${gap}" y="${toY(verified)}" width="${barW}" height="${toH(verified)}" rx="6" fill="var(--acid)" opacity="0.8"/>
      <rect x="${gap * 2 + barW}" y="${toY(unverified)}" width="${barW}" height="${toH(unverified)}" rx="6" fill="var(--gold)" opacity="0.8"/>
      <text x="${gap + barW / 2}" y="${toY(verified) - 6}" text-anchor="middle" fill="var(--acid)" font-size="12" font-family="Space Mono" font-weight="700">${verified}</text>
      <text x="${gap * 2 + barW + barW / 2}" y="${toY(unverified) - 6}" text-anchor="middle" fill="var(--gold)" font-size="12" font-family="Space Mono" font-weight="700">${unverified}</text>
      <text x="${gap + barW / 2}" y="${H + 14}" text-anchor="middle" fill="var(--txt-3)" font-size="10" font-family="Space Mono">Vérifiés</text>
      <text x="${gap * 2 + barW + barW / 2}" y="${H + 14}" text-anchor="middle" fill="var(--txt-3)" font-size="10" font-family="Space Mono">Non vérifiés</text>
    `;
  }, [isActive, users, total]);

  if (!isActive) return null;

  const MONTHS = ['Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr'];

  return (
    <div className="section active">
      <div className="page-header">
        <div>
          <div className="ph-title">Tableau <mark>Analytique</mark></div>
          <div className="ph-sub">Statistiques globales de la plateforme</div>
        </div>
        <div className="ph-actions">
          <span className="badge b-sky">🔴 Live</span>
        </div>
      </div>

      {/* KPIs rapides */}
      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Taux de vérification', val: `${total ? Math.round(users.filter(u => u.verified).length / total * 100) : 0}%`, ico: '✅', color: 'acid' },
          { label: 'Comptes actifs',        val: users.filter(u => u.status === 'active').length,                                   ico: '🟢', color: 'sky'  },
          { label: 'Comptes bloqués',       val: users.filter(u => u.status === 'blocked').length,                                  ico: '🚫', color: 'rose' },
          { label: 'Taux d\'activité',      val: `${total ? Math.round(users.filter(u => u.status === 'active').length / total * 100) : 0}%`, ico: '📊', color: 'violet' },
        ].map((k, i) => (
          <div key={i} className={`kpi ${k.color}`}>
            <div className="kpi-top">
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-ico">{k.ico}</div>
            </div>
            <div className="kpi-val">{k.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Courbe inscriptions mensuelles */}
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Inscriptions — 6 derniers mois</div>
              <div className="card-sub">Nouveaux comptes par mois</div>
            </div>
            <span className="badge b-sky">Mensuel</span>
          </div>
          <div className="chart-wrap">
            <svg ref={lineRef} className="svg-chart" viewBox="0 0 700 160" height={160} preserveAspectRatio="none" />
          </div>
          <div className="chart-labels">
            {MONTHS.map(m => <span key={m}>{m}</span>)}
          </div>
        </div>

        {/* Répartition par pays */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Répartition géographique</div>
            <span className="badge b-violet">4 pays</span>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {countryCounts.map(c => {
              const pct = maxCountry ? Math.round(c.count / maxCountry * 100) : 0;
              return (
                <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18, width: 28 }}>{FLAGS[c.code]}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-2)', width: 90 }}>{COUNTRY_NAMES[c.code]}</span>
                  <div className="hi-bar" style={{ flex: 1 }}>
                    <div className="hi-fill" style={{ background: 'var(--violet)', width: `${pct}%` }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-m)', fontSize: 11, width: 24, textAlign: 'right' }}>{c.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Statuts */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Répartition par statut</div>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {statuses.map(s => {
              const cnt = users.filter(u => u.status === s.key).length;
              const pct = total ? Math.round(cnt / total * 100) : 0;
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-2)', width: 90 }}>{s.label}</span>
                  <div className="hi-bar" style={{ flex: 1 }}>
                    <div className="hi-fill" style={{ background: s.color, width: `${pct}%` }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-m)', fontSize: 11, width: 52, textAlign: 'right', color: s.color }}>
                    {cnt} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vérification */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Vérification des comptes</div>
            <span className="badge b-gold">KYC</span>
          </div>
          <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 32 }}>
            <svg ref={barRef} viewBox="0 0 300 120" width={220} height={120} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--txt-2)' }}>
                <span style={{ color: 'var(--acid)', fontWeight: 700 }}>{users.filter(u => u.verified).length} vérifiés</span>
                {' '}sur {total} comptes
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt-2)' }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{users.filter(u => !u.verified).length} non vérifiés</span>
                {' '}en attente KYC
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}