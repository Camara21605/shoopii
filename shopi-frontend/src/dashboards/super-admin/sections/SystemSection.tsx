/* ============================================================
 * FICHIER  : src/dashboards/super-admin/sections/SystemSection.tsx
 * ROLE     : Centre de supervision système enterprise — Shopi Africa
 * RESPONSABILITES :
 *   – Métriques infra temps réel (CPU, RAM, Disque, Réseau, API)
 *   – État des services avec latence et disponibilité
 *   – Graphiques historiques avec sélecteur de période
 *   – Alertes système triées par priorité
 *   – Journal système filtrable
 *   – Auto-refresh polling 30s (architecture WebSocket/SSE-ready)
 *   – Export CSV / JSON
 * DEPENDANCES : store.healthData (compatibilité legacy), données simulées
 *               prêtes à être remplacées par de vraies API calls
 * ============================================================ */

import React, {
  useState, useEffect, useMemo, useCallback, useRef, memo,
} from 'react';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';

/* ─────────────────────────────────────────────────────────────
 * TYPES
 * ───────────────────────────────────────────────────────────── */

type ServiceStatus = 'online' | 'degraded' | 'maintenance' | 'offline' | 'error';
type AlertSeverity = 'critical' | 'warning' | 'info';
type LogLevel      = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
type Period        = '5m' | '30m' | '1h' | '24h' | '7d';

interface ServiceInfo {
  id:          string;
  name:        string;
  icon:        string;
  category:    string;
  status:      ServiceStatus;
  latencyMs:   number | null;
  uptimePct:   number;
  version:     string;
  lastCheck:   string;   // "il y a Xs"
  description: string;
}

interface SystemMetrics {
  cpuPct:       number;
  ramPct:       number;
  diskPct:      number;
  networkMbps:  number;
  apiRespMs:    number;
  reqPerMin:    number;
  activeUsers:  number;
  wsConnections: number;
  uptime:       string;   // "47j 3h 22min"
  uptimePct:    number;
}

interface SystemAlert {
  id:        string;
  severity:  AlertSeverity;
  icon:      string;
  title:     string;
  message:   string;
  service:   string;
  time:      string;
  resolved:  boolean;
}

interface SystemLog {
  id:       number;
  time:     string;
  level:    LogLevel;
  service:  string;
  message:  string;
  duration: number | null;
}

interface ChartData {
  cpu:      number[];
  ram:      number[];
  apiResp:  number[];
  reqMin:   number[];
  labels:   string[];
}

/* ─────────────────────────────────────────────────────────────
 * CONFIGURATION STATUTS
 * ───────────────────────────────────────────────────────────── */

const STATUS_CFG: Record<ServiceStatus, { label: string; color: string; bg: string; icon: string }> = {
  online:      { label: 'En ligne',    color: '#10b981', bg: 'rgba(16,185,129,.14)',  icon: '●' },
  degraded:    { label: 'Dégradé',     color: '#f59e0b', bg: 'rgba(245,158,11,.14)',  icon: '◐' },
  maintenance: { label: 'Maintenance', color: '#38bdf8', bg: 'rgba(56,189,248,.14)',  icon: '◉' },
  offline:     { label: 'Hors ligne',  color: '#ef4444', bg: 'rgba(239,68,68,.14)',   icon: '○' },
  error:       { label: 'Erreur',      color: '#f43f5e', bg: 'rgba(244,63,94,.14)',   icon: '✕' },
};

const ALERT_CFG: Record<AlertSeverity, { color: string; bg: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,.10)' },
  warning:  { color: '#f59e0b', bg: 'rgba(245,158,11,.10)' },
  info:     { color: '#38bdf8', bg: 'rgba(56,189,248,.10)' },
};

const LOG_COLORS: Record<LogLevel, string> = {
  ERROR: '#ef4444', WARN: '#f59e0b', INFO: '#10b981', DEBUG: '#64748b',
};

const PERIOD_LABELS: Record<Period, string> = {
  '5m': '5 min', '30m': '30 min', '1h': '1 heure', '24h': '24 heures', '7d': '7 jours',
};

const PERIOD_POINTS: Record<Period, number> = {
  '5m': 30, '30m': 30, '1h': 60, '24h': 48, '7d': 42,
};

/* ─────────────────────────────────────────────────────────────
 * GÉNÉRATEURS DE DONNÉES (remplaçables par API calls)
 * ───────────────────────────────────────────────────────────── */

/** Génère une série temporelle réaliste avec random walk + spikes */
function timeSeries(n: number, base: number, variance: number, min = 5, max = 95): number[] {
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v += (Math.random() - 0.5) * variance;
    if (Math.random() < 0.04) v += (Math.random() > 0.5 ? 1 : -1) * (variance * 3);
    out.push(Math.round(Math.max(min, Math.min(max, v))));
  }
  return out;
}

function generateChartData(period: Period, tick: number): ChartData {
  const n = PERIOD_POINTS[period];
  // On utilise tick pour "invalider" le useMemo sur refresh
  void tick;
  const now = new Date();
  const stepMs: Record<Period, number> = {
    '5m': 10_000, '30m': 60_000, '1h': 60_000, '24h': 1_800_000, '7d': 14_400_000,
  };
  const step = stepMs[period];
  const labels = Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getTime() - (n - 1 - i) * step);
    return period === '7d'
      ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  });
  return {
    cpu:     timeSeries(n, 42, 8, 10, 90),
    ram:     timeSeries(n, 67, 5, 30, 88),
    apiResp: timeSeries(n, 145, 30, 60, 800),
    reqMin:  timeSeries(n, 380, 80, 40, 900),
    labels,
  };
}

function generateMetrics(tick: number): SystemMetrics {
  void tick;
  return {
    cpuPct:       35 + Math.round(Math.random() * 15),
    ramPct:       63 + Math.round(Math.random() * 8),
    diskPct:      58 + Math.round(Math.random() * 3),
    networkMbps:  210 + Math.round(Math.random() * 60),
    apiRespMs:    130 + Math.round(Math.random() * 40),
    reqPerMin:    340 + Math.round(Math.random() * 80),
    activeUsers:  128 + Math.round(Math.random() * 20),
    wsConnections: 43 + Math.round(Math.random() * 10),
    uptime:       '47j 3h 22min',
    uptimePct:    99.97,
  };
}

const SERVICES: ServiceInfo[] = [
  { id:'api',    name:'Backend API',         icon:'⚡', category:'Core',      status:'online',      latencyMs:145, uptimePct:99.98, version:'v2.4.1', lastCheck:'il y a 28s',  description:'NestJS REST API' },
  { id:'cdn',    name:'Frontend CDN',         icon:'🌐', category:'Core',      status:'online',      latencyMs:32,  uptimePct:100,   version:'v1.9.0', lastCheck:'il y a 31s',  description:'Vite + Nginx' },
  { id:'db',     name:'PostgreSQL',           icon:'🗄', category:'Données',   status:'online',      latencyMs:8,   uptimePct:99.95, version:'15.3',   lastCheck:'il y a 15s',  description:'Base de données principale' },
  { id:'redis',  name:'Redis Cache',          icon:'⚡', category:'Données',   status:'online',      latencyMs:1,   uptimePct:100,   version:'7.2',    lastCheck:'il y a 15s',  description:'Cache & files de messages' },
  { id:'ws',     name:'WebSocket',            icon:'🔌', category:'Temps réel', status:'online',     latencyMs:null, uptimePct:99.92, version:'v2.1',  lastCheck:'il y a 30s',  description:'Socket.IO — 43 connexions' },
  { id:'email',  name:'Service Email',        icon:'📧', category:'Notifs',    status:'degraded',    latencyMs:2400, uptimePct:96.3, version:'v1.3',   lastCheck:'il y a 2min', description:'Nodemailer SMTP — latence élevée' },
  { id:'push',   name:'Push Notifications',   icon:'🔔', category:'Notifs',    status:'online',      latencyMs:180, uptimePct:99.87, version:'v1.5',   lastCheck:'il y a 28s',  description:'Firebase FCM / APNs' },
  { id:'pay',    name:'Passerelle Paiement',  icon:'💳', category:'Finance',   status:'online',      latencyMs:320, uptimePct:99.95, version:'v3.0',   lastCheck:'il y a 45s',  description:'MTN Money / Orange Money' },
  { id:'storage',name:'Stockage Fichiers',    icon:'🗂', category:'Infra',     status:'online',      latencyMs:95,  uptimePct:100,   version:'v2.0',   lastCheck:'il y a 28s',  description:'Minio S3-compatible' },
  { id:'queue',  name:'File de Tâches',       icon:'⚙️', category:'Infra',     status:'online',      latencyMs:null, uptimePct:99.99, version:'Bull4', lastCheck:'il y a 15s',  description:'BullMQ — 12 workers actifs' },
  { id:'search', name:'Moteur de Recherche',  icon:'🔍', category:'Services',  status:'maintenance', latencyMs:null, uptimePct:0,    version:'ES8.9',  lastCheck:'En maintenance', description:'Elasticsearch — mise à jour index' },
  { id:'backup', name:'Sauvegarde',           icon:'💾', category:'Infra',     status:'online',      latencyMs:null, uptimePct:100,   version:'v1.2',   lastCheck:'il y a 1h',   description:'Backup quotidien S3 — 99.2 GB' },
];

const ALERTS: SystemAlert[] = [
  { id:'a1', severity:'critical', icon:'📧', title:'Service Email dégradé',         message:'Latence SMTP anormale : 2400ms (seuil : 500ms). Vérifier le serveur SMTP.',          service:'Email',     time:'il y a 47min', resolved:false },
  { id:'a2', severity:'warning',  icon:'💻', title:'Pic CPU détecté',               message:'Utilisation CPU a atteint 87% pendant 3 minutes sur le serveur principal.',           service:'API',       time:'il y a 2h',    resolved:false },
  { id:'a3', severity:'warning',  icon:'🗄', title:'Requête lente PostgreSQL',       message:'SELECT sur la table users : 2.3s (seuil : 500ms). Index manquant sur user.countryCode.', service:'PostgreSQL', time:'il y a 3h', resolved:false },
  { id:'a4', severity:'info',     icon:'🔍', title:'Maintenance moteur de recherche', message:'Reindexation planifiée. Durée estimée : 45 minutes. Impact : recherche indisponible.', service:'Search',    time:'il y a 1h',    resolved:false },
  { id:'a5', severity:'info',     icon:'💾', title:'Sauvegarde terminée',            message:'Sauvegarde complète réussie : 99.2 GB en 8 minutes. Stockée sur S3.',                 service:'Backup',    time:'il y a 4h',    resolved:true  },
];

const LOGS: SystemLog[] = [
  { id:1,  time:'14:38:12', level:'INFO',  service:'API',        message:'POST /api/auth/login — 200 OK',                         duration:24 },
  { id:2,  time:'14:38:09', level:'WARN',  service:'Email',      message:'SMTP timeout après 2400ms pour user@example.com',       duration:2400 },
  { id:3,  time:'14:38:05', level:'INFO',  service:'Queue',      message:'Job "send-notification" terminé avec succès',           duration:450 },
  { id:4,  time:'14:37:58', level:'INFO',  service:'API',        message:'GET /api/produits?page=1&limit=20 — 200 OK',            duration:67 },
  { id:5,  time:'14:37:52', level:'ERROR', service:'Email',      message:'Échec envoi email #4521 — Connection refused SMTP',     duration:null },
  { id:6,  time:'14:37:48', level:'INFO',  service:'API',        message:'PATCH /api/dashboard/super-admin/users/:id/block — 200', duration:45 },
  { id:7,  time:'14:37:41', level:'WARN',  service:'PostgreSQL', message:'Requête lente (2312ms) : SELECT * FROM users WHERE…',   duration:2312 },
  { id:8,  time:'14:37:35', level:'INFO',  service:'WebSocket',  message:'43 connexions actives — 3 nouvelles ce dernier cycle',  duration:null },
  { id:9,  time:'14:37:29', level:'INFO',  service:'Queue',      message:'Job "process-commande" terminé — commande #8821',       duration:1230 },
  { id:10, time:'14:37:22', level:'DEBUG', service:'Redis',      message:'Cache MISS sur clé user:profile:uuid-4821',            duration:2 },
  { id:11, time:'14:37:18', level:'INFO',  service:'API',        message:'POST /api/commandes — 201 Created',                    duration:189 },
  { id:12, time:'14:37:10', level:'INFO',  service:'Backup',     message:'Sauvegarde quotidienne démarrée — 99.2 GB estimés',    duration:null },
  { id:13, time:'14:37:05', level:'WARN',  service:'API',        message:'Rate limit atteint pour IP 41.203.64.xx (55 req/min)', duration:null },
  { id:14, time:'14:36:58', level:'INFO',  service:'API',        message:'GET /api/public/boutiques — 200 OK',                  duration:88 },
  { id:15, time:'14:36:50', level:'INFO',  service:'Queue',      message:'Job "send-sms" ajouté à la file — priorité NORMAL',    duration:null },
];

function exportCsv(services: ServiceInfo[]): void {
  const h = ['Service','Catégorie','Statut','Latence','Disponibilité','Version','Vérification'];
  const rows = services.map(s => [
    s.name, s.category,
    STATUS_CFG[s.status].label,
    s.latencyMs != null ? `${s.latencyMs}ms` : 'N/A',
    `${s.uptimePct}%`, s.version, s.lastCheck,
  ].join(','));
  dl('﻿' + [h.join(','), ...rows].join('\n'), 'system-health.csv', 'text/csv;charset=utf-8');
}

function exportJson(metrics: SystemMetrics, services: ServiceInfo[], alerts: SystemAlert[]): void {
  dl(
    JSON.stringify({ generatedAt: new Date().toISOString(), metrics, services, alerts }, null, 2),
    'system-report.json', 'application/json',
  );
}

function dl(content: string, name: string, mime: string): void {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: mime })),
    download: name,
  });
  a.click(); URL.revokeObjectURL(a.href);
}

/* ─────────────────────────────────────────────────────────────
 * HOOK MONITORING
 * ───────────────────────────────────────────────────────────── */

function useSystemMonitor(refreshMs = 30_000) {
  const [tick,    setTick]    = useState(0);
  const [paused,  setPaused]  = useState(false);
  const [lastUpd, setLastUpd] = useState(new Date());
  const [period,  setPeriod]  = useState<Period>('1h');

  /* Auto-refresh toutes les refreshMs millisecondes */
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setTick(t => t + 1);
      setLastUpd(new Date());
    }, refreshMs);
    return () => clearInterval(id);
  }, [paused, refreshMs]);

  const metrics   = useMemo(() => generateMetrics(tick), [tick]);
  const chartData = useMemo(() => generateChartData(period, tick), [period, tick]);

  const togglePause = useCallback(() => setPaused(p => !p), []);
  const manualRefresh = useCallback(() => {
    setTick(t => t + 1);
    setLastUpd(new Date());
  }, []);

  return { metrics, chartData, period, setPeriod, paused, togglePause, manualRefresh, lastUpd };
}

/* ─────────────────────────────────────────────────────────────
 * SOUS-COMPOSANT : StatusBadge
 * ───────────────────────────────────────────────────────────── */

const StatusBadge = memo(({ status }: { status: ServiceStatus }) => {
  const cfg = STATUS_CFG[status];
  const isPulsing = status === 'online';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
      letterSpacing: '.4px', textTransform: 'uppercase' as const,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}40`,
      whiteSpace: 'nowrap' as const,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0,
        animation: isPulsing ? 'pulse 2s ease-in-out infinite' : undefined,
      }} />
      {cfg.label}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

/* ─────────────────────────────────────────────────────────────
 * SOUS-COMPOSANT : MetricCard
 * ───────────────────────────────────────────────────────────── */

const MetricCard = memo(({
  label, value, unit, icon, color, bar, sub, warning,
}: {
  label: string; value: number | string; unit?: string; icon: string;
  color: string; bar?: number; sub?: string; warning?: boolean;
}) => (
  <div style={{
    flex: '1 1 150px', minWidth: 140,
    background: 'var(--surface)', border: `1px solid ${warning ? '#f59e0b40' : 'var(--border)'}`,
    borderRadius: 14, padding: '14px 16px',
    display: 'flex', flexDirection: 'column' as const, gap: 8,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt-3)', textTransform: 'uppercase' as const, letterSpacing: '.5px', lineHeight: 1.4 }}>
        {label}
      </span>
      <span style={{ fontSize: 20 }}>{icon}</span>
    </div>
    <div>
      <span style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'var(--font-m)', lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString('fr') : value}
      </span>
      {unit && <span style={{ fontSize: 12, color: 'var(--txt-3)', marginLeft: 4 }}>{unit}</span>}
    </div>
    {bar !== undefined && (
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4,
          background: bar > 80 ? '#ef4444' : bar > 65 ? '#f59e0b' : color,
          width: `${bar}%`, transition: 'width .6s ease',
        }} />
      </div>
    )}
    {sub && <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>{sub}</div>}
  </div>
));
MetricCard.displayName = 'MetricCard';

/* ─────────────────────────────────────────────────────────────
 * SOUS-COMPOSANT : Sparkline (mini graphique SVG)
 * ───────────────────────────────────────────────────────────── */

const SparkLine = memo(({ data, color, H = 32 }: { data: number[]; color: string; H?: number }) => {
  const W = 80;
  if (!data.length) return null;
  const mx = Math.max(...data, 1);
  const mn = Math.min(...data);
  const range = mx - mn || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - mn) / range) * H;
    return `${x},${y}`;
  }).join('L');
  const area = `M${pts}L${W},${H}L0,${H}Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M${area}`} fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, '')})`} />
      <path d={`M${pts}`} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
});
SparkLine.displayName = 'SparkLine';

/* ─────────────────────────────────────────────────────────────
 * SOUS-COMPOSANT : AreaChart (graphique principal)
 * ───────────────────────────────────────────────────────────── */

interface AreaChartProps {
  data:   number[];
  labels: string[];
  color:  string;
  unit:   string;
  H?:     number;
}

const AreaChart = memo(({ data, labels, color, unit, H = 130 }: AreaChartProps) => {
  const ref = useRef<SVGSVGElement>(null);
  const W = 700, pL = 36, pR = 12, pT = 18, pB = 24;
  const gW = W - pL - pR, gH = H - pT - pB;

  useEffect(() => {
    if (!ref.current || !data.length) return;
    const mx = Math.max(...data, 1);
    const mn = Math.min(...data, 0);
    const range = mx - mn || 1;
    const toX = (i: number) => pL + (i / (data.length - 1)) * gW;
    const toY = (v: number) => pT + gH - ((v - mn) / range) * gH;

    const path = 'M' + data.map((v, i) => `${toX(i)},${toY(v)}`).join('L');
    const area = path + `L${toX(data.length - 1)},${pT + gH}L${pL},${pT + gH}Z`;

    const uid = `ac-${color.replace(/[^a-z0-9]/gi, '')}`;
    const lastVal = data[data.length - 1];
    const lastX   = toX(data.length - 1);
    const lastY   = toY(lastVal);

    /* Axe Y — 5 lignes de grille */
    const gridLines = [0, .25, .5, .75, 1].map(p => {
      const yy = pT + gH * p;
      const val = Math.round(mn + range * (1 - p));
      return `<line x1="${pL}" y1="${yy}" x2="${W - pR}" y2="${yy}" stroke="rgba(128,128,128,0.07)" stroke-width="1"/>
              <text x="${pL - 5}" y="${yy + 4}" text-anchor="end" fill="var(--txt-3)" font-size="9" font-family="Space Mono">${val}</text>`;
    }).join('');

    /* Labels axe X — environ 6 labels */
    const step = Math.max(1, Math.floor(data.length / 6));
    const xLabels = data.map((_, i) => {
      if (i % step !== 0 && i !== data.length - 1) return '';
      return `<text x="${toX(i)}" y="${H - 4}" text-anchor="middle" fill="var(--txt-3)" font-size="9" font-family="Space Mono">${labels[i] ?? ''}</text>`;
    }).join('');

    ref.current.innerHTML = `
      <defs>
        <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="${uid}-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="${color}"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${area}" fill="url(#${uid})"/>
      <path d="${path}" fill="none" stroke="url(#${uid}-line)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${xLabels}
      <circle cx="${lastX}" cy="${lastY}" r="12" fill="${color}" fill-opacity="0.12"/>
      <circle cx="${lastX}" cy="${lastY}" r="4.5" fill="${color}"/>
      <text x="${lastX}" y="${lastY - 12}" text-anchor="middle" fill="${color}" font-size="10" font-family="Space Mono" font-weight="700">${lastVal}${unit}</text>
    `;
  }, [data, labels, color, unit, gW, gH]);

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} height={H}
      style={{ width: '100%', display: 'block' }} preserveAspectRatio="none" />
  );
});
AreaChart.displayName = 'AreaChart';

/* ─────────────────────────────────────────────────────────────
 * SOUS-COMPOSANT : ServiceRow (ligne du tableau)
 * ───────────────────────────────────────────────────────────── */

const ServiceRow = memo(({ svc, spark }: { svc: ServiceInfo; spark: number[] }) => {
  const cfg = STATUS_CFG[svc.status];
  return (
    <tr
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
      style={{ transition: 'background .12s' }}
    >
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>{svc.icon}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--txt-1)' }}>{svc.name}</div>
            <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>{svc.description}</div>
          </div>
        </div>
      </td>
      <td><span style={{ fontSize: 10, color: 'var(--txt-3)', fontWeight: 600 }}>{svc.category}</span></td>
      <td><StatusBadge status={svc.status} /></td>
      <td>
        <span style={{ fontFamily: 'var(--font-m)', fontSize: 12, color: svc.latencyMs && svc.latencyMs > 500 ? '#f59e0b' : 'var(--txt-1)' }}>
          {svc.latencyMs != null ? `${svc.latencyMs} ms` : '—'}
        </span>
      </td>
      <td>
        <div>
          <div style={{ fontFamily: 'var(--font-m)', fontSize: 12, fontWeight: 700,
            color: svc.uptimePct >= 99.9 ? '#10b981' : svc.uptimePct >= 98 ? '#f59e0b' : '#ef4444' }}>
            {svc.uptimePct === 0 ? 'N/A' : `${svc.uptimePct}%`}
          </div>
          {svc.uptimePct > 0 && (
            <div style={{ height: 3, width: 64, background: 'var(--border)', borderRadius: 4, marginTop: 3 }}>
              <div style={{ height: '100%', borderRadius: 4, background: cfg.color, width: `${svc.uptimePct}%` }} />
            </div>
          )}
        </div>
      </td>
      <td>
        {spark.length > 0 ? <SparkLine data={spark} color={cfg.color} /> : <span style={{ color: 'var(--txt-3)', fontSize: 11 }}>—</span>}
      </td>
      <td style={{ fontFamily: 'var(--font-m)', fontSize: 10.5, color: 'var(--txt-3)' }}>{svc.version}</td>
      <td style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>{svc.lastCheck}</td>
    </tr>
  );
});
ServiceRow.displayName = 'ServiceRow';

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT PRINCIPAL
 * ───────────────────────────────────────────────────────────── */

interface Props {
  store:    SuperAdminStore;
  isActive: boolean;
}

export default function SystemSection({ store, isActive }: Props) {
  const { metrics, chartData, period, setPeriod, paused, togglePause, manualRefresh, lastUpd } =
    useSystemMonitor(30_000);

  /* ── États locaux ────────────────────────────────────────── */
  const [svcSearch,  setSvcSearch]  = useState('');
  const [svcStatus,  setSvcStatus]  = useState<ServiceStatus | 'all'>('all');
  const [logSearch,  setLogSearch]  = useState('');
  const [logLevel,   setLogLevel]   = useState<LogLevel | 'all'>('all');
  const [logSvc,     setLogSvc]     = useState('all');
  const [exportOpen, setExportOpen] = useState(false);
  const [activeChart, setActiveChart] = useState<'cpu' | 'ram' | 'apiResp' | 'reqMin'>('cpu');

  /* ── Calculs mémoïsés ────────────────────────────────────── */

  const filteredServices = useMemo(() => {
    let s = SERVICES;
    if (svcStatus !== 'all') s = s.filter(svc => svc.status === svcStatus);
    if (svcSearch) {
      const q = svcSearch.toLowerCase();
      s = s.filter(svc => svc.name.toLowerCase().includes(q) || svc.category.toLowerCase().includes(q));
    }
    return s;
  }, [svcSearch, svcStatus]);

  const filteredLogs = useMemo(() => {
    let l = LOGS;
    if (logLevel !== 'all') l = l.filter(e => e.level === logLevel);
    if (logSvc   !== 'all') l = l.filter(e => e.service === logSvc);
    if (logSearch) {
      const q = logSearch.toLowerCase();
      l = l.filter(e => e.message.toLowerCase().includes(q) || e.service.toLowerCase().includes(q));
    }
    return l;
  }, [logLevel, logSvc, logSearch]);

  const pendingAlerts = useMemo(
    () => ALERTS.filter(a => !a.resolved).sort((a, b) => {
      const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    }),
    [],
  );

  /* Sparklines par service : 15 points de données aléatoires */
  const sparks = useMemo(() => {
    const map: Record<string, number[]> = {};
    SERVICES.forEach(svc => {
      const base = svc.status === 'online' ? 70 : svc.status === 'degraded' ? 40 : 0;
      map[svc.id] = svc.status !== 'maintenance'
        ? timeSeries(15, base, 10, 20, 95)
        : [];
    });
    return map;
  }, []); // sparklines fixes — changent seulement sur refresh complet

  /* État global */
  const globalStatus: ServiceStatus = useMemo(() => {
    if (SERVICES.some(s => s.status === 'offline' || s.status === 'error')) return 'error';
    if (SERVICES.some(s => s.status === 'degraded')) return 'degraded';
    if (SERVICES.some(s => s.status === 'maintenance')) return 'maintenance';
    return 'online';
  }, []);

  const uniqueLogServices = useMemo(
    () => [...new Set(LOGS.map(l => l.service))].sort(),
    [],
  );

  /* ── Callbacks ───────────────────────────────────────────── */
  const handleExportCsv  = useCallback(() => { exportCsv(filteredServices);                             setExportOpen(false); }, [filteredServices]);
  const handleExportJson = useCallback(() => { exportJson(metrics, SERVICES, ALERTS);                   setExportOpen(false); }, [metrics]);

  /* Temps depuis dernière MAJ */
  const [sinceUpdate, setSinceUpdate] = useState('');
  useEffect(() => {
    const interval = setInterval(() => {
      const s = Math.round((Date.now() - lastUpd.getTime()) / 1000);
      setSinceUpdate(s < 60 ? `il y a ${s}s` : `il y a ${Math.round(s / 60)}min`);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpd]);

  if (!isActive) return null;

  /* Données du graphique actif */
  const CHART_CFG = {
    cpu:     { data: chartData.cpu,     unit: '%',    color: '#38bdf8', label: 'CPU' },
    ram:     { data: chartData.ram,     unit: '%',    color: '#a78bfa', label: 'Mémoire RAM' },
    apiResp: { data: chartData.apiResp, unit: 'ms',   color: '#f59e0b', label: 'Temps réponse API' },
    reqMin:  { data: chartData.reqMin,  unit: ' req', color: '#10b981', label: 'Requêtes / minute' },
  } as const;

  const chart = CHART_CFG[activeChart];

  /* ═══════════════════════════════════════════════════════════
   * RENDU
   * ═══════════════════════════════════════════════════════════ */
  return (
    <div className="section active">

      {/* ── En-tête ── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Point live pulsant */}
          <span style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: globalStatus === 'online' ? '#10b981' : globalStatus === 'degraded' ? '#f59e0b' : '#ef4444',
            boxShadow: `0 0 0 3px ${globalStatus === 'online' ? 'rgba(16,185,129,.25)' : 'rgba(245,158,11,.25)'}`,
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <div>
            <div className="ph-title">Santé <mark>Système</mark></div>
            <div className="ph-sub">
              {paused ? '⏸ Auto-refresh suspendu' : `Monitoring actif · ${sinceUpdate}`}
            </div>
          </div>
        </div>

        <div className="ph-actions" style={{ position: 'relative' }}>
          <button className="btn btn-ghost btn-sm" onClick={manualRefresh} title="Actualiser maintenant">🔄</button>
          <button
            className={`btn btn-sm ${paused ? 'btn-primary' : 'btn-ghost'}`}
            onClick={togglePause}
            title={paused ? 'Reprendre le monitoring' : 'Suspendre le monitoring'}
          >
            {paused ? '▶ Reprendre' : '⏸ Pause'}
          </button>
          {/* Export */}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setExportOpen(v => !v)}>
              ⬇ Export ▾
            </button>
            {exportOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setExportOpen(false)} />
                <div style={{
                  position: 'absolute', top: '110%', right: 0, zIndex: 50,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.2)',
                  minWidth: 180, overflow: 'hidden',
                }}>
                  {([
                    { label: '📄 Services CSV',    fn: handleExportCsv  },
                    { label: '📦 Rapport JSON',    fn: handleExportJson },
                  ] as const).map(item => (
                    <button key={item.label} onClick={item.fn}
                      style={{ width: '100%', background: 'none', border: 'none', padding: '10px 16px', textAlign: 'left' as const, fontSize: 13, color: 'var(--txt-1)', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Bannière état global ── */}
      {globalStatus !== 'online' && (
        <div style={{
          marginBottom: 18, padding: '12px 18px',
          background: STATUS_CFG[globalStatus].bg,
          border: `1px solid ${STATUS_CFG[globalStatus].color}35`,
          borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 18 }}>
            {globalStatus === 'degraded' ? '⚠️' : globalStatus === 'maintenance' ? '🔧' : '🔴'}
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: STATUS_CFG[globalStatus].color }}>
              {globalStatus === 'degraded'    ? 'Système dégradé — 1 service en alerte'    :
               globalStatus === 'maintenance' ? 'Maintenance en cours — 1 service indisponible' :
               'Incident détecté — intervention requise'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2 }}>
              Consultez le journal et les alertes pour plus de détails.
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Infra (8 métriques) ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <MetricCard label="CPU"             value={metrics.cpuPct}       unit="%" icon="💻" color="var(--sky)"    bar={metrics.cpuPct}  warning={metrics.cpuPct > 75} sub="Serveur principal" />
        <MetricCard label="RAM"             value={metrics.ramPct}       unit="%" icon="🧠" color="var(--violet)" bar={metrics.ramPct}  warning={metrics.ramPct > 80} sub="16 GB installés" />
        <MetricCard label="Disque"          value={metrics.diskPct}      unit="%" icon="💾" color="var(--gold)"   bar={metrics.diskPct} sub="SSD 500 GB" />
        <MetricCard label="Réseau"          value={metrics.networkMbps}  unit="Mb/s" icon="📡" color="var(--acid)" sub="Entrant + Sortant" />
        <MetricCard label="Réponse API"     value={metrics.apiRespMs}    unit="ms" icon="⚡" color={metrics.apiRespMs > 300 ? '#f59e0b' : '#10b981'} sub="Médiane p50" />
        <MetricCard label="Req / min"       value={metrics.reqPerMin}    icon="📊" color="var(--sky)" sub="Toutes routes" />
        <MetricCard label="Utilisateurs"    value={metrics.activeUsers}  icon="👥" color="var(--acid)" sub="Sessions actives" />
        <MetricCard label="Uptime 30j"      value={`${metrics.uptimePct}%`} icon="🕐" color="#10b981" sub={metrics.uptime} />
      </div>

      {/* ── Graphiques ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">{chart.label}</div>
            <div className="card-sub">Historique — {PERIOD_LABELS[period]}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Sélecteur métrique */}
            {(Object.keys(CHART_CFG) as Array<keyof typeof CHART_CFG>).map(k => (
              <button key={k} onClick={() => setActiveChart(k)}
                style={{
                  padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 8,
                  border: `1px solid ${k === activeChart ? CHART_CFG[k].color : 'var(--border)'}`,
                  background: k === activeChart ? `${CHART_CFG[k].color}20` : 'none',
                  color: k === activeChart ? CHART_CFG[k].color : 'var(--txt-3)',
                  cursor: 'pointer',
                }}>
                {CHART_CFG[k].label}
              </button>
            ))}
            {/* Sélecteur période */}
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
            {(['5m', '30m', '1h', '24h', '7d'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{
                  padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 8,
                  border: `1px solid ${p === period ? chart.color : 'var(--border)'}`,
                  background: p === period ? `${chart.color}20` : 'none',
                  color: p === period ? chart.color : 'var(--txt-3)',
                  cursor: 'pointer',
                }}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-wrap" style={{ paddingBottom: 8 }}>
          <AreaChart data={chart.data} labels={chartData.labels} color={chart.color} unit={chart.unit} H={140} />
        </div>
      </div>

      {/* ── Services ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Services</div>
            <div className="card-sub">
              {SERVICES.filter(s => s.status === 'online').length} / {SERVICES.length} opérationnels
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="tbl-search" style={{ minWidth: 160 }}>
              <span style={{ color: 'var(--txt-3)' }}>🔍</span>
              <input type="text" placeholder="Rechercher…" value={svcSearch}
                onChange={e => setSvcSearch(e.target.value)} />
            </div>
            <select className="sel" value={svcStatus}
              onChange={e => setSvcStatus(e.target.value as ServiceStatus | 'all')}>
              <option value="all">Tous les statuts</option>
              {(Object.keys(STATUS_CFG) as ServiceStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_CFG[s].label}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ tableLayout: 'fixed' as const, minWidth: 820 }}>
            <colgroup>
              <col style={{ width: 'auto' }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 115 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 110 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ fontWeight: 700, fontSize: 11 }}>Service</th>
                <th style={{ fontWeight: 700, fontSize: 11 }}>Catégorie</th>
                <th style={{ fontWeight: 700, fontSize: 11 }}>Statut</th>
                <th style={{ fontWeight: 700, fontSize: 11 }}>Latence</th>
                <th style={{ fontWeight: 700, fontSize: 11 }}>Disponibilité 30j</th>
                <th style={{ fontWeight: 700, fontSize: 11 }}>Activité</th>
                <th style={{ fontWeight: 700, fontSize: 11 }}>Version</th>
                <th style={{ fontWeight: 700, fontSize: 11 }}>Vérification</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.map(svc => (
                <ServiceRow key={svc.id} svc={svc} spark={sparks[svc.id] ?? []} />
              ))}
              {filteredServices.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--txt-3)' }}>
                    Aucun service correspondant
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Alertes + Journal ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Alertes */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Alertes système</div>
            <span className="badge b-rose">{pendingAlerts.length}</span>
          </div>
          <div>
            {pendingAlerts.map(alert => {
              const cfg = ALERT_CFG[alert.severity];
              return (
                <div key={alert.id} style={{
                  display: 'flex', gap: 12, padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  background: cfg.bg, transition: 'filter .15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.04)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = '')}
                >
                  <div style={{
                    width: 4, flexShrink: 0, borderRadius: 4,
                    background: cfg.color, alignSelf: 'stretch',
                  }} />
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{alert.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--txt-1)' }}>{alert.title}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, color: cfg.color, padding: '1px 6px', borderRadius: 10, border: `1px solid ${cfg.color}40`, whiteSpace: 'nowrap' as const }}>
                        {alert.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt-2)', lineHeight: 1.5 }}>{alert.message}</div>
                    <div style={{ marginTop: 5, display: 'flex', gap: 12, fontSize: 10, color: 'var(--txt-3)' }}>
                      <span>⚙️ {alert.service}</span>
                      <span>🕐 {alert.time}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {!pendingAlerts.length && (
              <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--txt-2)', textAlign: 'center' as const }}>
                ✅ Aucune alerte active
              </div>
            )}
          </div>
        </div>

        {/* Journal système */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Journal système</div>
            <span className="badge b-muted">{filteredLogs.length}</span>
          </div>

          {/* Filtres journal */}
          <div style={{ padding: '8px 16px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <div className="tbl-search" style={{ flex: '1 1 120px', minWidth: 100 }}>
              <span style={{ color: 'var(--txt-3)', fontSize: 11 }}>🔍</span>
              <input type="text" placeholder="Rechercher…" value={logSearch}
                style={{ fontSize: 11 }}
                onChange={e => setLogSearch(e.target.value)} />
            </div>
            <select className="sel" style={{ padding: '3px 6px', fontSize: 11 }}
              value={logLevel} onChange={e => setLogLevel(e.target.value as LogLevel | 'all')}>
              <option value="all">Tous niveaux</option>
              {(['ERROR', 'WARN', 'INFO', 'DEBUG'] as LogLevel[]).map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <select className="sel" style={{ padding: '3px 6px', fontSize: 11 }}
              value={logSvc} onChange={e => setLogSvc(e.target.value)}>
              <option value="all">Tous services</option>
              {uniqueLogServices.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Entrées de log */}
          <div style={{ maxHeight: 340, overflowY: 'auto', fontFamily: 'var(--font-m)', fontSize: 11 }}>
            {filteredLogs.map(entry => (
              <div key={entry.id} style={{
                display: 'flex', gap: 10, padding: '7px 16px',
                borderBottom: '1px solid var(--border)',
                alignItems: 'flex-start',
                transition: 'background .1s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <span style={{ color: 'var(--txt-3)', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                  {entry.time}
                </span>
                <span style={{
                  padding: '0px 5px', borderRadius: 4, fontSize: 9.5, fontWeight: 700,
                  color: LOG_COLORS[entry.level], background: `${LOG_COLORS[entry.level]}18`,
                  flexShrink: 0, alignSelf: 'center',
                }}>
                  {entry.level}
                </span>
                <span style={{ color: 'var(--sky)', flexShrink: 0, fontSize: 10.5 }}>
                  [{entry.service}]
                </span>
                <span style={{ flex: 1, color: 'var(--txt-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {entry.message}
                </span>
                {entry.duration != null && (
                  <span style={{ color: entry.duration > 1000 ? '#f59e0b' : 'var(--txt-3)', flexShrink: 0 }}>
                    {entry.duration}ms
                  </span>
                )}
              </div>
            ))}
            {filteredLogs.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center' as const, color: 'var(--txt-3)' }}>
                Aucune entrée
              </div>
            )}
          </div>

          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => {
                const csv = '﻿Heure,Niveau,Service,Message,Durée\n' +
                  filteredLogs.map(l => `${l.time},${l.level},${l.service},"${l.message.replace(/"/g,'""')}",${l.duration ?? ''}`).join('\n');
                dl(csv, 'system-logs.csv', 'text/csv');
              }}
            >
              ⬇ CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── Compatibilité legacy : healthData du store ── */}
      {store.healthData.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head">
            <div className="card-title">Métriques serveur (héritage)</div>
            <span className="badge b-muted">Infrastructure</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, padding: '12px 16px' }}>
            {store.healthData.map((h, i) => (
              <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-3)', marginBottom: 6 }}>{h.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: h.color, fontFamily: 'var(--font-m)' }}>
                  {h.val}<span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3 }}>{h.unit}</span>
                </div>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: h.color, width: `${h.val}%`, transition: 'width .6s' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 6 }}>{h.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
