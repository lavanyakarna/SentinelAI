/* =============================================
   SENTINEL AI — CORE APP SCRIPT (FULL FINAL VERSION)
   ============================================= */

const App = {
  data: [],
  filteredData: [],
  feedSource: [],
  charts: {},
  map: null,
};

document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  initClock();
  initSidebarNav();
  initNotificationBell();
  initTopbarButtons();
  initEntranceAnimations();
  renderModelBanner();
  showLoadingSkeleton();
  loadScoredEvents();
});

function renderModelBanner() {
  const dashboardView = document.getElementById('page-dashboard');
  if (!dashboardView || document.getElementById('model-banner')) return;

  const banner = document.createElement('div');
  banner.className = 'model-banner';
  banner.id = 'model-banner';
  banner.innerHTML = `
    <i data-lucide="info"></i>
    <div><strong>Model confidence note:</strong> tuned for high-recall triage, not autonomous blocking — flagged events should be reviewed by an analyst, not auto-acted on.</div>
    <div class="model-banner-stats">
      <div class="model-banner-stat"><span class="model-banner-stat-value">0.393</span><span class="model-banner-stat-label">Precision</span></div>
      <div class="model-banner-stat"><span class="model-banner-stat-value">0.432</span><span class="model-banner-stat-label">Recall</span></div>
      <div class="model-banner-stat"><span class="model-banner-stat-value">37.5%</span><span class="model-banner-stat-label">FPR@1%</span></div>
    </div>
  `;
  dashboardView.insertBefore(banner, dashboardView.firstChild);
  if (window.lucide) lucide.createIcons();
}

function showLoadingSkeleton() {
  const cardsGrid = document.getElementById('cards-grid');
  if (cardsGrid) cardsGrid.innerHTML = Array(5).fill('<div class="skeleton skeleton-card"></div>').join('');

  const riskPanel = document.getElementById('risk-meter-panel');
  if (riskPanel) riskPanel.innerHTML = '<div class="skeleton skeleton-panel-fill"></div>';

  const feedPanel = document.getElementById('live-feed-panel');
  if (feedPanel) feedPanel.innerHTML = '<div class="skeleton skeleton-line" style="width:40%"></div>' + Array(6).fill('<div class="skeleton skeleton-line"></div>').join('');

  const explainPanel = document.getElementById('explain-panel');
  if (explainPanel) explainPanel.innerHTML = '<div class="skeleton skeleton-panel-fill"></div>';

  const simPanel = document.getElementById('simulation-panel');
  if (simPanel) simPanel.innerHTML = '<div class="skeleton skeleton-line" style="width:200px;height:36px;"></div>';
}

function initIcons() {
  if (window.lucide) lucide.createIcons();
}

function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  const dateEl = document.getElementById('current-date');
  const timeEl = document.getElementById('current-time');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  if (timeEl) timeEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

/* ============================================= */
/* SIDEBAR NAVIGATION / PAGE SWITCHING */
/* ============================================= */
const PAGE_TITLES = {
  'dashboard': ['Security Overview', 'Real-time behavioral anomaly detection'],
  'threat-monitor': ['Threat Monitor', 'Live flagged sessions and active threats'],
  'analytics': ['Analytics', 'Trends, distributions, and model performance'],
  'users': ['Users', 'Entity-level activity and risk profiles'],
  'map': ['Global Map', 'Geographic view of session activity'],
  'settings': ['Settings', 'Dashboard preferences and configuration'],
};

const renderedPages = new Set(['dashboard']);

function initSidebarNav() {
  const links = document.querySelectorAll('.sidebar-link');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      switchPage(link.dataset.page);
    });
  });
}

function switchPage(page) {
  document.querySelectorAll('.page-view').forEach(view => view.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  const [title, subtitle] = PAGE_TITLES[page] || PAGE_TITLES['dashboard'];
  const h1 = document.querySelector('.page-header h1');
  const sub = document.querySelector('.page-subtitle');
  if (h1) h1.textContent = title;
  if (sub) sub.textContent = subtitle;

  if (!renderedPages.has(page) && App.data.length) {
    if (page === 'threat-monitor') renderThreatMonitor(App.data);
    if (page === 'analytics') renderCharts(App.data);
    if (page === 'users') renderUsersTable(App.data);
    if (page === 'map') renderMapFull(App.data);
    if (page === 'settings') renderSettingsPlaceholder();
    renderedPages.add(page);
  }

  if (page === 'map' && App.map) {
    setTimeout(() => App.map.invalidateSize(), 50);
  }
}

/* ============================================= */
/* NOTIFICATION BELL DROPDOWN (toggle behavior) */
/* ============================================= */
function initNotificationBell() {
  const btn = document.getElementById('notification-btn');
  const dropdown = document.getElementById('notification-dropdown');
  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.remove('open');
    }
  });
}

function initTopbarButtons() {
  const settingsBtn = document.getElementById('settings-btn');
  const profileAvatar = document.getElementById('profile-avatar');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      document.querySelector('.sidebar-link[data-page="settings"]').classList.add('active');
      switchPage('settings');
    });
  }

  if (profileAvatar) {
    profileAvatar.addEventListener('click', (e) => {
      e.stopPropagation();
      let dropdown = document.getElementById('profile-dropdown');
      if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'profile-dropdown';
        dropdown.className = 'notification-dropdown';
        dropdown.style.right = '24px';
        dropdown.innerHTML = `
          <div class="notif-header">SentinelAI Analyst</div>
          <div style="padding:14px 16px; font-size:12px; color:var(--text-secondary); line-height:1.6;">
            Role: Security Operations<br>
            Session: Active<br>
            Model: Behavioral Anomaly Detector v1
          </div>
        `;
        document.body.appendChild(dropdown);
      }
      dropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('profile-dropdown');
      if (dropdown && !dropdown.contains(e.target) && e.target !== profileAvatar) {
        dropdown.classList.remove('open');
      }
    });
  }
}

function initEntranceAnimations() {
  const panels = document.querySelectorAll('.panel');
  panels.forEach((panel, i) => { panel.style.animationDelay = `${i * 60}ms`; });
}

function riskBandClass(riskBand) {
  if (!riskBand) return 'low';
  const band = riskBand.toLowerCase();
  if (band === 'high') return 'high';
  if (band === 'medium') return 'medium';
  return 'low';
}

function formatNumber(n) {
  return Math.round(n).toLocaleString('en-US');
}

/* ============================================= */
/* CSV LOADING */
/* ============================================= */
const CSV_PATH = 'scored_events.csv';
const NUMERIC_FIELDS = ['geo_lat', 'geo_lon', 'session_duration', 'failed_attempts', 'anomaly_score', 'risk_score', 'risk_pct', 'true_anomaly'];

function loadScoredEvents() {
  Papa.parse(CSV_PATH, {
    download: true,
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    complete: (results) => {
      const rows = results.data.map(normalizeRow).filter(row => row.entity_id);
      App.data = rows;
      App.filteredData = rows;
      console.log(`SentinelAI: loaded ${rows.length} events from ${CSV_PATH}`);
      onDataReady();
    },
    error: (err) => {
      console.error('SentinelAI: failed to load scored_events.csv', err);
      showDataLoadError();
    },
  });
}

function normalizeRow(row) {
  const clean = { ...row };
  NUMERIC_FIELDS.forEach(field => {
    if (clean[field] !== undefined && clean[field] !== '') clean[field] = Number(clean[field]);
  });
  ['entity_id', 'entity_type', 'country', 'resource_accessed', 'predicted_type', 'risk_band'].forEach(field => {
    if (typeof clean[field] === 'string') clean[field] = clean[field].trim();
  });
  clean.explanationList = (clean.explanation || '').split(';').map(r => r.trim()).filter(Boolean);
  if (clean.risk_band) clean.risk_band = clean.risk_band.charAt(0).toUpperCase() + clean.risk_band.slice(1).toLowerCase();
  return clean;
}

function onDataReady() {
  renderSummaryCards(App.data);
  renderLiveFeed(App.data);
  renderRiskMeter(App.data);
  renderNotifications(App.data);
  renderSimulationButtons(App.data);
  showAboutModal();
}

function showDataLoadError() {
  const grid = document.getElementById('cards-grid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="panel" style="grid-column: span 12; text-align:center; color: var(--risk-high);">
      <p style="font-family: var(--font-mono); font-size: 13px;">
        ⚠ Could not load scored_events.csv — make sure it's in the same folder as index.html and you're running this via a local server (not file://).
      </p>
    </div>
  `;
}

/* ============================================= */
/* SUMMARY CARDS */
/* ============================================= */
function renderSummaryCards(data) {
  const grid = document.getElementById('cards-grid');
  if (!grid || !data.length) return;

  const totalEvents = data.length;
  const threatsDetected = data.filter(row => row.anomaly_score === 1).length;
  const normalSessions = totalEvents - threatsDetected;
  const avgRisk = data.reduce((sum, row) => sum + (row.risk_pct || 0), 0) / totalEvents;
  const activeSessions = new Set(data.map(row => row.entity_id)).size;

  const cards = [
    { id: 'card-total-events', label: 'Total Events', value: totalEvents, icon: 'activity', color: 'cyan', trend: { direction: 'flat', label: 'baseline' } },
    { id: 'card-threats', label: 'Threats Detected', value: threatsDetected, icon: 'shield-alert', color: 'red', trend: { direction: 'up', label: `${((threatsDetected / totalEvents) * 100).toFixed(1)}% of events` } },
    { id: 'card-normal', label: 'Normal Sessions', value: normalSessions, icon: 'shield-check', color: 'blue', trend: { direction: 'down', label: `${((normalSessions / totalEvents) * 100).toFixed(1)}% of events` } },
    { id: 'card-avg-risk', label: 'Average Risk', value: avgRisk, isDecimal: true, suffix: '%', icon: 'gauge', color: avgRisk >= 66 ? 'red' : avgRisk >= 33 ? 'yellow' : 'green', trend: { direction: avgRisk >= 50 ? 'up' : 'down', label: 'risk_pct avg' } },
    { id: 'card-active', label: 'Active Sessions', value: activeSessions, icon: 'users', color: 'green', trend: { direction: 'flat', label: 'unique entities' } },
  ];

  grid.innerHTML = cards.map(card => `
    <div class="stat-card" id="${card.id}">
      <div class="stat-card-top">
        <div class="stat-icon ${card.color}"><i data-lucide="${card.icon}"></i></div>
        <div class="stat-trend ${card.trend.direction}">
          <i data-lucide="${card.trend.direction === 'up' ? 'trending-up' : card.trend.direction === 'down' ? 'trending-down' : 'minus'}"></i>
          <span>${card.trend.label}</span>
        </div>
      </div>
      <div>
        <div class="stat-value" data-target="${card.value}" data-decimal="${card.isDecimal ? '1' : '0'}" data-suffix="${card.suffix || ''}">0</div>
        <div class="stat-label">${card.label}</div>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
  animateCounters();
}

function animateCounters() {
  document.querySelectorAll('.stat-value').forEach(el => {
    const target = parseFloat(el.dataset.target);
    const isDecimal = el.dataset.decimal === '1';
    const suffix = el.dataset.suffix || '';
    const duration = 900;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      el.textContent = isDecimal ? current.toFixed(1) + suffix : formatNumber(current) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = isDecimal ? target.toFixed(1) + suffix : formatNumber(target) + suffix;
    }
    requestAnimationFrame(tick);
  });
}

/* ============================================= */
/* LIVE LOGIN FEED (sorted by timestamp, realistic mix) */
/* ============================================= */
const FEED_MAX_ITEMS = 40;
const FEED_TICK_MS = 2500;
let feedCursor = 0;

function renderLiveFeed(data) {
  const panel = document.getElementById('live-feed-panel');
  if (!panel || !data.length) return;

  panel.innerHTML = `
    <div class="feed-header">
      <h3>Live Login Feed</h3>
      <div class="feed-live-badge"><span class="feed-live-dot"></span><span>LIVE</span></div>
    </div>
    <div class="feed-search-wrap">
      <i data-lucide="search"></i>
      <input type="text" class="feed-search-input" id="feed-search" placeholder="Filter by entity ID or country...">
    </div>
    <div class="feed-list" id="feed-list"></div>
  `;

  App.feedSource = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  App.feedFilter = '';

  renderFeedList();

  const firstFlagged = data.find(row => row.anomaly_score === 1);
  renderExplainPanel(firstFlagged || null);

  document.getElementById('feed-search').addEventListener('input', (e) => {
    App.feedFilter = e.target.value.trim().toLowerCase();
    renderFeedList();
  });

  if (window.__feedInterval) clearInterval(window.__feedInterval);
  window.__feedInterval = setInterval(() => {
    const source = App.feedSource.length ? App.feedSource : App.data;
    if (!source.length) return;
    const row = source[feedCursor % source.length];
    feedCursor++;
    if (matchesFeedFilter(row)) addFeedItem(row, true);
  }, window.__feedRate || FEED_TICK_MS);

  if (window.lucide) lucide.createIcons();
}

function matchesFeedFilter(row) {
  if (!App.feedFilter) return true;
  const f = App.feedFilter;
  return (row.entity_id || '').toLowerCase().includes(f) || (row.country || '').toLowerCase().includes(f);
}

function renderFeedList() {
  const list = document.getElementById('feed-list');
  if (!list) return;
  list.innerHTML = '';
  const filtered = App.feedSource.filter(matchesFeedFilter).slice(0, 12);
  if (!filtered.length) {
    list.innerHTML = `<div class="feed-empty">No matching events</div>`;
    return;
  }
  // Reversed on purpose: fixes an ordering bug where prepend + forward iteration put oldest on top
  [...filtered].reverse().forEach(row => addFeedItem(row, false));
}

function addFeedItem(row, animate) {
  const list = document.getElementById('feed-list');
  if (!list) return;

  const band = riskBandClass(row.risk_band);
  const isHigh = band === 'high';

  const item = document.createElement('div');
  item.className = 'feed-item clickable';
  if (!animate) item.style.animation = 'none';

  item.innerHTML = `
    <div class="feed-item-icon ${isHigh ? 'high' : ''}">
      <i data-lucide="${isHigh ? 'shield-alert' : entityIcon(row.entity_type)}"></i>
    </div>
    <div class="feed-item-main">
      <div class="feed-item-user">${row.entity_id || 'Unknown'}</div>
      <div class="feed-item-meta">${row.entity_type || '—'} · ${row.country || '—'} · ${row.resource_accessed || '—'}</div>
    </div>
    <div class="feed-item-prediction">
      <div class="feed-item-prediction-label">${formatPredictedType(row.predicted_type)}</div>
      <span class="risk-badge ${band}">${row.risk_band || 'Low'}</span>
    </div>
    <div class="feed-item-time">${formatFeedTime(row.timestamp)}</div>
  `;

  item.addEventListener('click', () => updateExplainPanel(row));
  if (animate && riskBandClass(row.risk_band) === 'high') showToast(row);
  list.prepend(item);

  while (list.children.length > FEED_MAX_ITEMS) list.removeChild(list.lastChild);
  if (window.lucide) lucide.createIcons();
}

function entityIcon(entityType) {
  if (!entityType) return 'user';
  const type = entityType.toLowerCase();
  if (type.includes('service')) return 'server';
  if (type.includes('device')) return 'hard-drive';
  return 'user';
}

function formatPredictedType(type) {
  if (!type) return 'Unclassified';
  return type.replace(/_/g, ' ').replace(/\//g, ' / ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatFeedTime(timestamp) {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return String(timestamp).slice(0, 16);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/* ============================================= */
/* RISK METER GAUGE */
/* ============================================= */
function renderRiskMeter(data) {
  const panel = document.getElementById('risk-meter-panel');
  if (!panel || !data.length) return;

  const avgRisk = data.reduce((sum, row) => sum + (row.risk_pct || 0), 0) / data.length;
  const clamped = Math.max(0, Math.min(100, avgRisk));
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped >= 66 ? 'var(--risk-high)' : clamped >= 33 ? 'var(--risk-medium)' : 'var(--risk-safe)';
  const bandLabel = clamped >= 66 ? 'High Risk' : clamped >= 33 ? 'Medium Risk' : 'Low Risk';

  panel.innerHTML = `
    <div class="gauge-title">Average Risk Level</div>
    <div class="gauge-wrap">
      <svg viewBox="0 0 180 180">
        <circle class="gauge-track" cx="90" cy="90" r="${radius}"></circle>
        <circle class="gauge-value-arc" cx="90" cy="90" r="${radius}" stroke="${color}"
          stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" id="gauge-arc"></circle>
      </svg>
      <div class="gauge-center">
        <div class="gauge-number" id="gauge-number">0</div>
        <div class="gauge-unit">risk_pct avg</div>
      </div>
    </div>
    <div class="gauge-band-label" style="color:${color}">${bandLabel}</div>
    <div class="gauge-legend">
      <div class="gauge-legend-item"><span class="gauge-legend-dot" style="background:var(--risk-safe)"></span>Low</div>
      <div class="gauge-legend-item"><span class="gauge-legend-dot" style="background:var(--risk-medium)"></span>Medium</div>
      <div class="gauge-legend-item"><span class="gauge-legend-dot" style="background:var(--risk-high)"></span>High</div>
    </div>
  `;

  requestAnimationFrame(() => {
    const arc = document.getElementById('gauge-arc');
    if (arc) arc.style.strokeDashoffset = offset;
  });
  animateGaugeNumber(clamped);
}

function animateGaugeNumber(target) {
  const el = document.getElementById('gauge-number');
  if (!el) return;
  const duration = 1000;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = (target * eased).toFixed(1);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = target.toFixed(1);
  }
  requestAnimationFrame(tick);
}

/* ============================================= */
/* CHARTS */
/* ============================================= */
const CHART_COLORS = { cyan: '#22d3ee', blue: '#3b82f6', low: '#38bdf8', medium: '#fbbf24', high: '#f43f5e', grid: 'rgba(255, 255, 255, 0.06)', text: '#94a3b8' };
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = CHART_COLORS.text;

function renderCharts(data) {
  const panel = document.getElementById('charts-panel');
  if (!panel || !data.length) return;

  panel.innerHTML = `
    <div class="charts-header">Analytics</div>
    <div class="charts-grid">
      <div class="chart-card"><div class="chart-card-title">Threats vs Normal</div><canvas id="chart-pie"></canvas></div>
      <div class="chart-card"><div class="chart-card-title">Events Over Time</div><canvas id="chart-line"></canvas></div>
      <div class="chart-card"><div class="chart-card-title">Top Predicted Attack Types</div><canvas id="chart-bar"></canvas></div>
      <div class="chart-card"><div class="chart-card-title">Risk Score Distribution</div><canvas id="chart-histogram"></canvas></div>
      <div class="chart-card" style="grid-column: span 2;">
        <div class="chart-card-title">Top Risk Countries</div>
        <div class="country-risk-list" id="country-risk-list"></div>
      </div>
    </div>
  `;

  renderPieChart(data);
  renderLineChart(data);
  renderBarChart(data);
  renderHistogramChart(data);
  renderCountryRiskList(data);
}

function renderCountryRiskList(data) {
  const list = document.getElementById('country-risk-list');
  if (!list) return;

  const byCountry = {};
  data.forEach(row => {
    const country = row.country || 'Unknown';
    if (!byCountry[country]) byCountry[country] = { sum: 0, count: 0 };
    byCountry[country].sum += (row.risk_pct || 0);
    byCountry[country].count++;
  });

  const ranked = Object.entries(byCountry)
    .map(([country, v]) => ({ country, avgRisk: v.sum / v.count, sessions: v.count }))
    .filter(c => c.sessions >= 3)
    .sort((a, b) => b.avgRisk - a.avgRisk)
    .slice(0, 8);

  const maxRisk = Math.max(...ranked.map(c => c.avgRisk), 1);

  list.innerHTML = ranked.map(c => {
    const pctOfMax = (c.avgRisk / maxRisk) * 100;
    const color = c.avgRisk >= 66 ? 'var(--risk-high)' : c.avgRisk >= 33 ? 'var(--risk-medium)' : 'var(--risk-safe)';
    return `
      <div class="country-risk-row">
        <div class="country-risk-name">${c.country}</div>
        <div class="country-risk-bar-track"><div class="country-risk-bar-fill" style="width:0%; background:${color};" data-width="${pctOfMax}"></div></div>
        <div class="country-risk-pct">${c.avgRisk.toFixed(1)}%</div>
      </div>
    `;
  }).join('');

  requestAnimationFrame(() => {
    list.querySelectorAll('.country-risk-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.width + '%';
    });
  });
}
function renderPieChart(data) {
  const ctx = document.getElementById('chart-pie');
  if (!ctx) return;
  const threats = data.filter(r => r.anomaly_score === 1).length;
  const normal = data.length - threats;
  destroyChart('pie');
  App.charts.pie = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['Threats', 'Normal'], datasets: [{ data: [threats, normal], backgroundColor: [CHART_COLORS.high, CHART_COLORS.blue], borderColor: '#0a0e17', borderWidth: 3 }] },
    options: { responsive: true, maintainAspectRatio: true, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14, font: { size: 11 } } } } },
  });
}

function renderLineChart(data) {
  const ctx = document.getElementById('chart-line');
  if (!ctx) return;
  const buckets = {};
  data.forEach(row => {
    const date = new Date(row.timestamp);
    if (isNaN(date.getTime())) return;
    const key = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
    buckets[key] = (buckets[key] || 0) + 1;
  });
  const labels = Object.keys(buckets).slice(-24);
  const values = labels.map(l => buckets[l]);
  destroyChart('line');
  App.charts.line = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Events', data: values, borderColor: CHART_COLORS.cyan, backgroundColor: 'rgba(34, 211, 238, 0.12)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6, font: { size: 10 } } },
        y: { grid: { color: CHART_COLORS.grid }, beginAtZero: true, ticks: { font: { size: 10 } } },
      },
    },
  });
}

function renderBarChart(data) {
  const ctx = document.getElementById('chart-bar');
  if (!ctx) return;
  const counts = {};
  data.forEach(row => {
    const type = row.predicted_type || 'unknown';
    if (type === 'normal') return;
    counts[type] = (counts[type] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const labels = sorted.map(([type]) => formatPredictedType(type));
  const values = sorted.map(([, count]) => count);
  destroyChart('bar');
  App.charts.bar = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Count', data: values, backgroundColor: CHART_COLORS.medium, borderRadius: 5, maxBarThickness: 28 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: CHART_COLORS.grid }, beginAtZero: true, ticks: { font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } },
      },
    },
  });
}

function renderHistogramChart(data) {
  const ctx = document.getElementById('chart-histogram');
  if (!ctx) return;
  const bucketSize = 10;
  const buckets = Array(10).fill(0);
  data.forEach(row => {
    const pct = Math.max(0, Math.min(99.99, row.risk_pct || 0));
    buckets[Math.floor(pct / bucketSize)]++;
  });
  const labels = buckets.map((_, i) => `${i * bucketSize}-${i * bucketSize + bucketSize}`);
  const colors = buckets.map((_, i) => {
    const mid = i * bucketSize + bucketSize / 2;
    return mid >= 66 ? CHART_COLORS.high : mid >= 33 ? CHART_COLORS.medium : CHART_COLORS.low;
  });
  destroyChart('histogram');
  App.charts.histogram = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Sessions', data: buckets, backgroundColor: colors, borderRadius: 4, maxBarThickness: 22 }] },
    options: {
      responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 } } },
        y: { grid: { color: CHART_COLORS.grid }, beginAtZero: true, ticks: { font: { size: 10 } } },
      },
    },
  });
}

function destroyChart(key) {
  if (App.charts[key]) { App.charts[key].destroy(); delete App.charts[key]; }
}

/* ============================================= */
/* EXPLAINABLE AI PANEL */
/* ============================================= */
function renderExplainPanel(initialRow) {
  const panel = document.getElementById('explain-panel');
  if (!panel) return;
  panel.innerHTML = `<div class="explain-header">Explainable AI</div><div id="explain-content"></div>`;
  if (initialRow) updateExplainPanel(initialRow);
  else showExplainEmptyState();
}

function showExplainEmptyState() {
  const content = document.getElementById('explain-content');
  if (!content) return;
  content.innerHTML = `<div class="explain-empty"><i data-lucide="mouse-pointer-click"></i><span>Click a flagged event in the Live Feed to see why it was flagged</span></div>`;
  if (window.lucide) lucide.createIcons();
}

function updateExplainPanel(row) {
  const content = document.getElementById('explain-content');
  if (!content) return;
  const band = riskBandClass(row.risk_band);
  const reasons = row.explanationList && row.explanationList.length ? row.explanationList : ['No specific reasons recorded'];
  const recommendation = buildRecommendation(row);

  content.innerHTML = `
    <div class="explain-body">
      <div class="explain-top">
        <div><div class="explain-user">${row.entity_id}</div><div class="explain-meta">${row.entity_type || '—'} · ${row.country || '—'}</div></div>
        <span class="risk-badge ${band}">${row.risk_band || 'Low'}</span>
      </div>
      <div class="explain-stats">
        <div class="explain-stat"><div class="explain-stat-label">Prediction</div><div class="explain-stat-value" style="font-size:13px;">${formatPredictedType(row.predicted_type)}</div></div>
        <div class="explain-stat"><div class="explain-stat-label">Risk Score</div><div class="explain-stat-value">${(row.risk_pct ?? 0).toFixed(1)}%</div></div>
      </div>
      <div>
        <div class="explain-checklist-title">Flagged Reasons</div>
        <div class="explain-checklist">${reasons.map(r => `<div class="explain-check-item"><i data-lucide="check-circle-2"></i><span>${r}</span></div>`).join('')}</div>
      </div>
      <div class="explain-recommendation"><strong>Recommendation:</strong> ${recommendation}</div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function buildRecommendation(row) {
  const band = (row.risk_band || 'Low').toLowerCase();
  const type = (row.predicted_type || '').toLowerCase();
  if (band === 'high') {
    if (type.includes('impossible_travel')) return 'Force re-authentication and verify device/location with the user immediately.';
    if (type.includes('brute_force') || type.includes('credential_stuffing')) return 'Lock the account temporarily and require password reset.';
    if (type.includes('device_spoofing')) return 'Block the session and flag the device fingerprint for review.';
    if (type.includes('lateral_movement')) return 'Isolate the entity and audit all resources it accessed in this session.';
    if (type.includes('insider_drift')) return 'Escalate to security team for manual behavioral review.';
    return 'Escalate for manual investigation — high-confidence anomaly.';
  }
  if (band === 'medium') return 'Monitor this entity closely; consider step-up authentication on next access.';
  return 'No action needed — behavior within normal range.';
}

/* ============================================= */
/* MAP — full page, draggable, zoomable */
/* ============================================= */
function renderMapFull(data) {
  const panel = document.getElementById('map-panel-full');
  if (!panel || !data.length) return;

  panel.innerHTML = `<div class="map-header">Global Session Map</div><div id="leaflet-map-full"></div>`;

  const map = L.map('leaflet-map-full', {
    zoomControl: true, attributionControl: false, dragging: true,
    scrollWheelZoom: true, doubleClickZoom: true, worldCopyJump: true,
  }).setView([20, 0], 2);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);
  App.map = map;

  const sample = data.filter(r => r.geo_lat && r.geo_lon).slice(0, 1000);
  sample.forEach(row => {
    const isThreat = row.anomaly_score === 1;
    const marker = L.circleMarker([row.geo_lat, row.geo_lon], {
      radius: isThreat ? 6 : 4, fillColor: isThreat ? '#f43f5e' : '#3b82f6',
      color: isThreat ? '#f43f5e' : '#3b82f6', weight: 1, fillOpacity: 0.7,
    }).addTo(map);

    marker.bindPopup(`
      <div class="map-popup-title">${row.entity_id}</div>
      <div class="map-popup-row">Risk: ${row.risk_band} (${(row.risk_pct ?? 0).toFixed(1)}%)</div>
      <div class="map-popup-row">${formatPredictedType(row.predicted_type)}</div>
    `);
  });

  setTimeout(() => map.invalidateSize(), 100);
}

/* ============================================= */
/* THREAT MONITOR VIEW */
/* ============================================= */
function renderThreatMonitor(data) {
  const panel = document.getElementById('threat-monitor-panel');
  if (!panel) return;

  const allThreats = data.filter(r => r.anomaly_score === 1).sort((a, b) => (b.risk_pct || 0) - (a.risk_pct || 0));

  panel.innerHTML = `
    <div class="tm-header-row">
      <div class="charts-header" style="margin-bottom:0;">Flagged Threats (${allThreats.length})</div>
      <button class="export-btn" id="export-threats-btn"><i data-lucide="download"></i>Export CSV</button>
    </div>
    <div class="tm-filter-wrap" style="margin-bottom:14px;">
      <i data-lucide="search"></i>
      <input type="text" class="tm-filter-input" id="tm-filter" placeholder="Filter by entity, type, or country...">
    </div>
    <div class="tm-table-wrap">
      <table class="tm-table">
        <thead><tr><th>Entity</th><th>Type</th><th>Country</th><th>Prediction</th><th>Risk</th><th>Time</th></tr></thead>
        <tbody id="tm-table-body"></tbody>
      </table>
    </div>
  `;

  function draw(list) {
    const body = document.getElementById('tm-table-body');
    const rows = list.slice(0, 200);
    body.innerHTML = rows.map(row => `
      <tr class="clickable-row" data-entity="${row.entity_id}" style="cursor:pointer;">
        <td>${row.entity_id}</td><td>${row.entity_type || '—'}</td><td>${row.country || '—'}</td>
        <td>${formatPredictedType(row.predicted_type)}</td>
        <td><span class="risk-badge ${riskBandClass(row.risk_band)}">${row.risk_band} (${(row.risk_pct ?? 0).toFixed(1)}%)</span></td>
        <td>${formatFeedTime(row.timestamp)}</td>
      </tr>
    `).join('');
    body.querySelectorAll('.clickable-row').forEach(tr => {
      tr.addEventListener('click', () => {
        const row = rows.find(r => r.entity_id === tr.dataset.entity);
        if (row) showThreatModal(row);
      });
    });
  }

  draw(allThreats);

  document.getElementById('tm-filter').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = q ? allThreats.filter(r =>
      (r.entity_id || '').toLowerCase().includes(q) ||
      (r.entity_type || '').toLowerCase().includes(q) ||
      (r.country || '').toLowerCase().includes(q) ||
      (r.predicted_type || '').toLowerCase().includes(q)
    ) : allThreats;
    draw(filtered);
  });

  document.getElementById('export-threats-btn').addEventListener('click', () => exportThreatsCSV(allThreats));

  if (window.lucide) lucide.createIcons();
}
function exportThreatsCSV(threats) {
  const headers = ['entity_id', 'entity_type', 'country', 'predicted_type', 'risk_band', 'risk_pct', 'timestamp', 'explanation'];
  const rows = threats.map(row => headers.map(h => {
    const val = String(row[h] ?? '').replace(/"/g, '""');
    return `"${val}"`;
  }).join(','));
  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sentinelai_flagged_threats_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
/* ============================================= */
/* USERS VIEW */
/* ============================================= */
function renderUsersTable(data) {
  const panel = document.getElementById('users-table-panel');
  if (!panel) return;

  const byEntity = {};
  data.forEach(row => {
    if (!byEntity[row.entity_id]) {
      byEntity[row.entity_id] = { entity_id: row.entity_id, entity_type: row.entity_type, sessions: 0, riskSum: 0, maxRiskPct: 0, maxRiskBand: 'Low', lastSeen: row.timestamp };
    }
    const e = byEntity[row.entity_id];
    e.sessions++;
    e.riskSum += (row.risk_pct || 0);
    if ((row.risk_pct || 0) > e.maxRiskPct) { e.maxRiskPct = row.risk_pct; e.maxRiskBand = row.risk_band; }
    if (new Date(row.timestamp) > new Date(e.lastSeen)) e.lastSeen = row.timestamp;
  });

  const users = Object.values(byEntity).map(e => ({ ...e, avgRisk: e.riskSum / e.sessions })).sort((a, b) => b.maxRiskPct - a.maxRiskPct).slice(0, 300);

  panel.innerHTML = `
    <div class="charts-header">Entities (${Object.keys(byEntity).length} unique)</div>
    <div class="users-table-wrap">
      <table class="users-table">
        <thead><tr><th>Entity</th><th>Type</th><th>Sessions</th><th>Avg Risk</th><th>Peak Risk</th><th>Last Seen</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${u.entity_id}</td><td>${u.entity_type || '—'}</td><td>${u.sessions}</td>
              <td>${u.avgRisk.toFixed(1)}%</td>
              <td><span class="risk-badge ${riskBandClass(u.maxRiskBand)}">${u.maxRiskBand} (${u.maxRiskPct.toFixed(1)}%)</span></td>
              <td>${formatFeedTime(u.lastSeen)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ============================================= */
/* SETTINGS VIEW (placeholder) */
/* ============================================= */
function renderSettingsPlaceholder() {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-title">Model Performance</div>
      <div class="settings-stats-grid">
        <div class="settings-stat-card"><div class="settings-stat-value">0.393</div><div class="settings-stat-label">Precision</div></div>
        <div class="settings-stat-card"><div class="settings-stat-value">0.432</div><div class="settings-stat-label">Recall</div></div>
        <div class="settings-stat-card"><div class="settings-stat-value">37.5%</div><div class="settings-stat-label">FPR @ Top 1%</div></div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Dashboard Preferences</div>

      <div class="settings-row">
        <div>
          <div class="settings-row-label">Live Feed Streaming</div>
          <div class="settings-row-desc">Auto-add new events to the Live Login Feed</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="setting-feed-toggle" checked>
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-row-label">Feed Refresh Rate</div>
          <div class="settings-row-desc">How often new events stream into the feed</div>
        </div>
        <select class="settings-select" id="setting-feed-rate">
          <option value="1000">Fast (1s)</option>
          <option value="2500" selected>Normal (2.5s)</option>
          <option value="5000">Slow (5s)</option>
        </select>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-row-label">Alert Threshold</div>
          <div class="settings-row-desc">Minimum risk_band to trigger notification bell alerts</div>
        </div>
        <select class="settings-select" id="setting-alert-threshold">
          <option value="High" selected>High only</option>
          <option value="Medium">Medium & above</option>
          <option value="Low">All events</option>
        </select>
      </div>
    </div>
  `;

  document.getElementById('setting-feed-toggle').addEventListener('change', (e) => {
    if (e.target.checked) {
      window.__feedInterval = setInterval(() => {
        const source = App.feedSource.length ? App.feedSource : App.data;
        if (!source.length) return;
        const row = source[feedCursor % source.length];
        feedCursor++;
        addFeedItem(row, true);
      }, window.__feedRate || FEED_TICK_MS);
    } else {
      clearInterval(window.__feedInterval);
    }
  });

  document.getElementById('setting-feed-rate').addEventListener('change', (e) => {
    window.__feedRate = parseInt(e.target.value, 10);
    const toggle = document.getElementById('setting-feed-toggle');
    clearInterval(window.__feedInterval);
    if (toggle.checked) {
      window.__feedInterval = setInterval(() => {
        const source = App.feedSource.length ? App.feedSource : App.data;
        if (!source.length) return;
        const row = source[feedCursor % source.length];
        feedCursor++;
        addFeedItem(row, true);
      }, window.__feedRate);
    }
  });

  document.getElementById('setting-alert-threshold').addEventListener('change', (e) => {
    renderNotifications(App.data, e.target.value);
  });

  if (window.lucide) lucide.createIcons();
}

/* ============================================= */
/* NOTIFICATION BELL CONTENT */
/* ============================================= */
function renderNotifications(data, minBand) {
  const dropdown = document.getElementById('notification-dropdown');
  const dot = document.getElementById('notification-dot');
  if (!dropdown) return;

  const order = { Low: 0, Medium: 1, High: 2 };
  const threshold = order[minBand] ?? order['High'];

  const alerts = data.filter(r => (order[r.risk_band] ?? 0) >= threshold).slice(0, 8);
  if (alerts.length && dot) dot.classList.add('active');
  if (!alerts.length && dot) dot.classList.remove('active');

  dropdown.innerHTML = `
    <div class="notif-header">Critical Alerts (${alerts.length})</div>
    <div class="notif-list">
      ${alerts.length ? alerts.map(row => `
        <div class="notif-item" data-entity="${row.entity_id}">
          <i data-lucide="alert-triangle"></i>
          <div class="notif-item-text"><strong>${row.entity_id}</strong> — ${formatPredictedType(row.predicted_type)}
          <div>${row.country || '—'} · ${(row.risk_pct ?? 0).toFixed(1)}% risk</div></div>
        </div>
      `).join('') : `<div class="notif-empty">No alerts at this threshold</div>`}
    </div>
  `;

  dropdown.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', () => {
      const row = data.find(r => r.entity_id === item.dataset.entity);
      if (row) showThreatModal(row);
      dropdown.classList.remove('open');
    });
  });
  if (window.lucide) lucide.createIcons();
}

/* ============================================= */
/* ATTACK SIMULATION BUTTONS */
/* ============================================= */
const SIM_TYPES = [
  { label: 'Normal Login', match: 'normal', icon: 'log-in' },
  { label: 'Brute Force', match: 'brute_force', icon: 'key-round' },
  { label: 'Impossible Travel', match: 'impossible_travel', icon: 'plane' },
  { label: 'Credential Theft', match: 'credential_stuffing', icon: 'lock' },
  { label: 'Device Spoofing', match: 'device_spoofing', icon: 'hard-drive' },
  { label: 'Insider Threat', match: 'insider_drift', icon: 'user-x' },
];

function renderSimulationButtons(data) {
  const panel = document.getElementById('simulation-panel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="sim-header">Attack Simulation</div>
    <div class="sim-buttons">
      ${SIM_TYPES.map(sim => `<button class="sim-btn" data-match="${sim.match}"><i data-lucide="${sim.icon}"></i>${sim.label}</button>`).join('')}
      <button class="sim-btn reset" data-match="__reset"><i data-lucide="rotate-ccw"></i>Reset</button>
    </div>
  `;

  panel.querySelectorAll('.sim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.sim-btn').forEach(b => b.classList.remove('active'));
      const match = btn.dataset.match;

      if (match === '__reset') {
        App.filteredData = App.data;
      } else {
        btn.classList.add('active');
        App.filteredData = App.data.filter(row => (row.predicted_type || '').toLowerCase().includes(match));
      }

      const view = App.filteredData.length ? App.filteredData : App.data;
      renderSummaryCards(view);
      renderRiskMeter(view);
      renderNotifications(view);

      const flagged = view.find(row => row.anomaly_score === 1) || view[0];
      if (flagged) showThreatModal(flagged);
    });
  });

  if (window.lucide) lucide.createIcons();
}

/* ============================================= */
/* THREAT POPUP MODAL */
/* ============================================= */
function showThreatModal(row) {
  const overlay = document.getElementById('threat-modal-overlay');
  const modal = document.getElementById('threat-modal');
  if (!overlay || !modal) return;

  const band = riskBandClass(row.risk_band);
  modal.innerHTML = `
    <div class="threat-modal-icon"><i data-lucide="shield-alert"></i></div>
    <div class="threat-modal-title">Threat Detected</div>
    <div class="threat-modal-sub">Anomalous behavior flagged for review</div>
    <div class="threat-modal-row"><span>User</span><span>${row.entity_id}</span></div>
    <div class="threat-modal-row"><span>Risk</span><span class="risk-badge ${band}">${row.risk_band} (${(row.risk_pct ?? 0).toFixed(1)}%)</span></div>
    <div class="threat-modal-row"><span>Prediction</span><span>${formatPredictedType(row.predicted_type)}</span></div>
    <div class="threat-modal-row"><span>Reason</span><span>${(row.explanationList && row.explanationList[0]) || 'N/A'}</span></div>
    <div class="threat-modal-actions"><button class="threat-modal-btn dismiss" id="threat-modal-dismiss">Dismiss</button></div>
  `;

  overlay.classList.add('open');
  if (window.lucide) lucide.createIcons();
  document.getElementById('threat-modal-dismiss').addEventListener('click', closeThreatModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeThreatModal(); });
}

function closeThreatModal() {
  const overlay = document.getElementById('threat-modal-overlay');
  if (overlay) overlay.classList.remove('open');
}

/* ============================================= */
/* ABOUT MODAL (shows once on first load) */
/* ============================================= */
function showAboutModal() {
  if (sessionStorage && sessionStorage.getItem('sentinelai_seen_intro')) return;

  const overlay = document.getElementById('threat-modal-overlay');
  const modal = document.getElementById('threat-modal');
  if (!overlay || !modal) return;

  modal.innerHTML = `
    <div class="about-modal-body">
      <div class="about-modal-title">SentinelAI</div>
      <div class="about-modal-text">AI-powered behavioral anomaly detection for cybersecurity. This dashboard visualizes a machine learning model's output — scoring login/session behavior for anomalies like impossible travel, brute force, and device spoofing.</div>
      <ul class="about-modal-list">
        <li>Live Feed + Map replay real historical session data to simulate a live SOC view</li>
        <li>Explainable AI panel shows exactly why each event was flagged</li>
        <li>Model tuned for high-recall triage — flagged events need analyst review, not auto-blocking</li>
      </ul>
      <div class="about-modal-btn" id="about-modal-close">Enter Dashboard</div>
    </div>
  `;
  overlay.classList.add('open');

  document.getElementById('about-modal-close').addEventListener('click', () => {
    overlay.classList.remove('open');
    if (sessionStorage) sessionStorage.setItem('sentinelai_seen_intro', '1');
  });
}

/* ============================================= */
/* TOAST ALERTS (fires when a High-risk row streams into the feed) */
/* ============================================= */
function showToast(row) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <i data-lucide="shield-alert"></i>
    <div><strong>${row.entity_id}</strong> — ${formatPredictedType(row.predicted_type)} (${(row.risk_pct ?? 0).toFixed(1)}%)</div>
  `;
  toast.addEventListener('click', () => { showThreatModal(row); dismissToast(toast); });

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => dismissToast(toast), 4500);
}

function dismissToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.classList.add('toast-out');
  setTimeout(() => toast.remove(), 300);
}