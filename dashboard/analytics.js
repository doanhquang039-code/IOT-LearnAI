/**
 * IOT Robot AI System - Analytics Dashboard JS v3.0
 * Real-time data visualization with Chart.js + Socket.IO
 */

// ==================== SOCKET.IO ====================
const socket = io();
let isConnected = false;

socket.on('connect', () => {
  isConnected = true;
  updateConnectionStatus(true);
  console.log('✅ Connected to IOT Server');
});

socket.on('disconnect', () => {
  isConnected = false;
  updateConnectionStatus(false);
});

socket.on('system_update', (data) => {
  updateAllPanels(data);
});

socket.on('nlp_result', (result) => {
  addNLPEntry(result, false);
});

// ==================== CHART INSTANCES ====================
let sensorChart = null;
let fleetStatusChart = null;
let energyChart = null;
let maintenanceChart = null;
let cvChart = null;
let navChart = null;

// History buffers
const MAX_POINTS = 60;
const sensorLabels = [];
const batteryData = [];
const tempData = [];
const cvHistory = [];
const energyHistory = [];

// ==================== INIT CHARTS ====================
function initCharts() {
  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: { legend: { display: false } },
  };

  // --- Sensor Line Chart ---
  const sensorCtx = document.getElementById('sensorChart').getContext('2d');
  sensorChart = new Chart(sensorCtx, {
    type: 'line',
    data: {
      labels: sensorLabels,
      datasets: [
        {
          label: 'Battery %',
          data: batteryData,
          borderColor: '#00e5ff',
          backgroundColor: 'rgba(0,229,255,0.08)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'Temp °C',
          data: tempData,
          borderColor: '#ff9000',
          backgroundColor: 'rgba(255,144,0,0.06)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
          yAxisID: 'y1',
        }
      ]
    },
    options: {
      ...chartDefaults,
      scales: {
        x: { display: false },
        y: {
          position: 'left', min: 0, max: 100,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#8090a8', font: { size: 10 } }
        },
        y1: {
          position: 'right', min: 15, max: 45,
          grid: { drawOnChartArea: false },
          ticks: { color: '#ff9000', font: { size: 10 } }
        }
      },
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }
    }
  });

  // --- Fleet Status Donut ---
  const fleetCtx = document.getElementById('fleetStatusChart').getContext('2d');
  fleetStatusChart = new Chart(fleetCtx, {
    type: 'doughnut',
    data: {
      labels: ['Exploring', 'Charging', 'Idle', 'Other'],
      datasets: [{
        data: [3, 1, 1, 0],
        backgroundColor: ['#00e5ff', '#00ff88', '#4a5568', '#b388ff'],
        borderColor: 'rgba(0,0,0,0)',
        borderWidth: 0,
        hoverOffset: 6,
      }]
    },
    options: {
      ...chartDefaults,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}` } }
      }
    }
  });

  // --- Energy History Chart ---
  const energyCtx = document.getElementById('energyChart').getContext('2d');
  energyChart = new Chart(energyCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Power Draw (W)',
        data: energyHistory,
        borderColor: '#ffd60a',
        backgroundColor: 'rgba(255,214,10,0.08)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
      }]
    },
    options: {
      ...chartDefaults,
      scales: {
        x: { display: false },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8090a8', font: { size: 10 } } }
      }
    }
  });

  // --- Maintenance Radar/Bar Chart ---
  const mainCtx = document.getElementById('maintenanceChart').getContext('2d');
  maintenanceChart = new Chart(mainCtx, {
    type: 'bar',
    data: {
      labels: ['Motor', 'Sensor', 'Battery', 'Wheels'],
      datasets: [{
        label: 'Health %',
        data: [95, 88, 72, 91],
        backgroundColor: ['rgba(0,229,255,0.6)', 'rgba(0,255,136,0.6)', 'rgba(255,214,10,0.6)', 'rgba(77,166,255,0.6)'],
        borderColor: ['#00e5ff', '#00ff88', '#ffd60a', '#4da6ff'],
        borderWidth: 2,
        borderRadius: 6,
      }]
    },
    options: {
      ...chartDefaults,
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8090a8', font: { size: 10 } } },
        y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8090a8', font: { size: 10 } } }
      }
    }
  });

  // --- CV History Chart ---
  const cvCtx = document.getElementById('cvChart').getContext('2d');
  cvChart = new Chart(cvCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Objects',
        data: cvHistory,
        backgroundColor: 'rgba(179,136,255,0.6)',
        borderColor: '#b388ff',
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      ...chartDefaults,
      scales: {
        x: { display: false },
        y: { min: 0, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8090a8', font: { size: 9 } } }
      }
    }
  });

  // --- Navigation Trend Chart ---
  const navCtx = document.getElementById('navChart').getContext('2d');
  navChart = new Chart(navCtx, {
    type: 'line',
    data: {
      labels: ['A*', 'RRT', 'DWA', 'PF', 'Total'],
      datasets: [{
        label: 'Algorithm Usage',
        data: [45, 25, 20, 10, 100],
        borderColor: '#4da6ff',
        backgroundColor: 'rgba(77,166,255,0.08)',
        borderWidth: 2,
        pointBackgroundColor: '#4da6ff',
        pointRadius: 4,
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      ...chartDefaults,
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8090a8', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8090a8', font: { size: 10 } } }
      }
    }
  });
}

// ==================== UPDATE PANELS ====================
function updateAllPanels(data) {
  const now = new Date().toLocaleTimeString();
  document.getElementById('last-update').textContent = now;

  if (data.systemStats) updateKPIs(data.systemStats, data);
  if (data.fleet) updateFleetStatus(data.fleet);
  if (data.sensors && data.sensors.length > 0) updateSensorChart(data.sensors);
  if (data.energy) updateEnergy(data.energy);
  if (data.maintenance) updateMaintenance(data.maintenance, data.fleet);
  if (data.cv) updateCV(data.cv);
  if (data.navigation) updateNavigation(data.navigation);
  if (data.nlp) updateNLPStats(data.nlp);
  if (data.systemStats) updateSystemInfo(data.systemStats);
}

function updateKPIs(stats, data) {
  setEl('kpi-active-robots', stats.activeRobots ?? '--');
  setEl('kpi-total-robots', stats.fleetSize ?? 5);
  setEl('kpi-avg-health', stats.avgHealth ? stats.avgHealth.toFixed(0) + '%' : '--');
  setEl('kpi-avg-battery', stats.avgBattery ? stats.avgBattery.toFixed(0) + '%' : '--');
  setEl('kpi-objects', stats.totalObjectsDetected ? fmtNum(stats.totalObjectsDetected) : '--');
  setEl('kpi-paths-count', stats.totalPathsComputed ? fmtNum(stats.totalPathsComputed) : '--');

  if (data.maintenance) {
    setEl('kpi-alerts-count', data.maintenance.totalAlerts ?? '--');
  }
}

function updateFleetStatus(fleet) {
  let exploring = 0, charging = 0, idle = 0, other = 0;

  fleet.forEach(r => {
    if (r.status === 'EXPLORING') exploring++;
    else if (r.status === 'CHARGING') charging++;
    else if (r.status === 'IDLE') idle++;
    else other++;
  });

  setEl('dl-exploring', exploring);
  setEl('dl-charging', charging);
  setEl('dl-idle', idle + other);

  if (fleetStatusChart) {
    fleetStatusChart.data.datasets[0].data = [exploring, charging, idle + other, other];
    fleetStatusChart.update('none');
  }

  // Fleet battery list
  const listEl = document.getElementById('fleet-battery-list');
  if (listEl) {
    listEl.innerHTML = fleet.map(r => {
      const pct = Math.round(r.battery || 0);
      const color = pct > 60 ? '#00e5ff' : pct > 30 ? '#ffd60a' : '#ff4d4d';
      const statusIcon = r.status === 'CHARGING' ? '🔌' : r.status === 'EXPLORING' ? '🔵' : '⚫';
      return `
        <div class="fb-item">
          <div class="fb-header">
            <span class="fb-id">${statusIcon} ${r.id}</span>
            <span class="fb-pct" style="color:${color}">${pct}%</span>
          </div>
          <div class="fb-bar-wrap">
            <div class="fb-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <div class="fb-status">${r.status} · ${r.specs?.type || 'unknown'}</div>
        </div>
      `;
    }).join('');
  }
}

function updateSensorChart(sensors) {
  const recent = sensors.slice(-MAX_POINTS);

  sensorLabels.length = 0;
  batteryData.length = 0;
  tempData.length = 0;

  recent.forEach(s => {
    sensorLabels.push(s.time);
    batteryData.push(s.battery ? parseFloat(s.battery).toFixed(1) : null);
    tempData.push(s.temp ? parseFloat(s.temp).toFixed(1) : null);
  });

  if (sensorChart) sensorChart.update('none');
}

function updateEnergy(energy) {
  const fleet = energy.fleet || {};
  const en = energy.energy || {};
  const charging = energy.charging || {};

  setEl('e-consumed', parseFloat(en.totalConsumed || 0).toFixed(1));
  setEl('e-charged', parseFloat(en.totalCharged || 0).toFixed(1));
  setEl('e-savings', parseFloat(en.totalSavings || 0).toFixed(1));
  setEl('e-draw', parseFloat(en.currentPowerDraw || 0).toFixed(1));

  // Push to energy chart
  energyHistory.push(parseFloat(en.currentPowerDraw || 0));
  if (energyHistory.length > MAX_POINTS) energyHistory.shift();
  if (energyChart) {
    energyChart.data.labels = energyHistory.map((_, i) => i);
    energyChart.update('none');
  }
}

function updateMaintenance(maintenance, fleet) {
  const tbody = document.getElementById('maintenance-tbody');
  const alertBadge = document.getElementById('alert-badge');
  const alertsEl = document.getElementById('maintenance-alerts');

  const totalAlerts = maintenance.totalAlerts || 0;
  if (alertBadge) alertBadge.textContent = `${totalAlerts} alerts`;

  // Update component health chart
  if (maintenanceChart && fleet && fleet.length > 0) {
    // Average health from maintenance data
    const avgHealth = maintenance.averageHealth || 90;
    const healthData = [
      Math.min(100, avgHealth + 5),
      Math.min(100, avgHealth - 2),
      Math.min(100, avgHealth - 8),
      Math.min(100, avgHealth + 3),
    ];
    maintenanceChart.data.datasets[0].data = healthData;
    maintenanceChart.update('none');
  }

  // Recent alerts
  if (alertsEl && maintenance.recentAlerts) {
    alertsEl.innerHTML = maintenance.recentAlerts.slice(0, 3).map(a => `
      <div class="m-alert ${a.type === 'CRITICAL' ? 'crit' : a.type === 'WARNING' ? 'warn' : 'ok'}">
        <span>${a.type === 'CRITICAL' ? '🔴' : '🟡'}</span>
        <span>${a.message || 'Alert'}</span>
      </div>
    `).join('') || '<div class="m-alert ok">✅ All systems nominal</div>';
  }

  // Maintenance table
  if (tbody && fleet) {
    const components = ['motor', 'sensor', 'battery', 'wheels'];
    const rows = [];

    fleet.slice(0, 5).forEach(robot => {
      components.forEach(comp => {
        const health = Math.round(75 + Math.random() * 25);
        const status = health > 70 ? 'ok' : health > 40 ? 'warning' : 'critical';
        const statusLabel = health > 70 ? 'OK' : health > 40 ? 'Warning' : 'Critical';
        const alertType = health > 70 ? '' : health > 40 ? '⚠️ Monitor' : '🔴 Replace';

        rows.push(`
          <tr>
            <td style="font-family:'Orbitron',monospace;font-size:11px;color:#00e5ff">${robot.id}</td>
            <td style="text-transform:capitalize">${comp}</td>
            <td>
              <span class="health-pill ${status}">
                ${status === 'ok' ? '●' : '●'} ${health}%
              </span>
            </td>
            <td><span class="status-badge ${status}">${statusLabel}</span></td>
            <td style="font-size:11px;color:${health > 70 ? '#00ff88' : health > 40 ? '#ffd60a' : '#ff4d4d'}">${alertType || '✅ Normal'}</td>
            <td>
              <button class="action-btn" onclick="performMaintenance('${robot.id}','${comp}')">
                🔧 Inspect
              </button>
            </td>
          </tr>
        `);
      });
    });

    tbody.innerHTML = rows.join('');
  }
}

function updateCV(cv) {
  setEl('cv-obj', cv.objectsPerSecond ?? '--');
  setEl('cv-total', cv.totalDetected ? fmtNum(cv.totalDetected) : '--');
  setEl('cv-landmarks', cv.landmarkCount ?? cv.slamLandmarks ?? '--');
  setEl('cv-pose-x', cv.robotPose ? cv.robotPose.x.toFixed(1) : '--');
  setEl('cv-pose-y', cv.robotPose ? cv.robotPose.y.toFixed(1) : '--');

  // Update CV chart
  cvHistory.push(cv.objectsPerSecond || 0);
  if (cvHistory.length > 30) cvHistory.shift();
  if (cvChart) {
    cvChart.data.labels = cvHistory.map((_, i) => i);
    cvChart.update('none');
  }
}

function updateNavigation(nav) {
  setEl('nav-paths', fmtNum(nav.totalPaths || nav.pathsComputed || 0));
  setEl('nav-avg-len', nav.avgPathLength ? nav.avgPathLength.toFixed(1) : '--');
  setEl('nav-success', nav.successRate ? (nav.successRate * 100).toFixed(0) + '%' : '--');
  setEl('nav-obstacles', nav.obstacleCount || '--');

  if (navChart && nav.pathsComputed > 0) {
    // Update algorithm distribution chart with simulated data
    const astar = Math.floor(nav.totalPaths * 0.45);
    const rrt = Math.floor(nav.totalPaths * 0.25);
    const dwa = Math.floor(nav.totalPaths * 0.2);
    const pf = nav.totalPaths - astar - rrt - dwa;
    navChart.data.datasets[0].data = [astar, rrt, dwa, pf, nav.totalPaths];
    navChart.update('none');
  }
}

function updateNLPStats(nlp) {
  setEl('nlp-total', nlp.totalCommands || 0);
  setEl('nlp-conf', nlp.avgConfidence ? (nlp.avgConfidence * 100).toFixed(0) + '%' : '--');
}

function updateSystemInfo(stats) {
  setEl('sys-uptime', formatUptime(stats.uptime || 0));
}

// ==================== NLP ====================
function sendNLPCommand() {
  const input = document.getElementById('nlp-input');
  const text = input.value.trim();
  if (!text) return;

  addNLPEntry({ text, timestamp: Date.now() }, true);

  if (isConnected) {
    socket.emit('nlp_command', { text, robotId: 'robot-001' });
  } else {
    // Simulate response
    setTimeout(() => {
      addNLPEntry({
        text: `[Simulated] Processing: "${text}"`,
        result: { intent: 'movement', confidence: 0.85 },
        timestamp: Date.now()
      }, false);
    }, 300);
  }

  input.value = '';
}

function addNLPEntry(data, isUser) {
  const historyEl = document.getElementById('nlp-history');
  if (!historyEl) return;

  const time = new Date(data.timestamp || Date.now()).toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `nlp-entry ${isUser ? 'user' : 'bot'}`;

  if (isUser) {
    entry.innerHTML = `<span class="nlp-time">${time}</span> 👤 <strong>${data.text}</strong>`;
  } else {
    const msg = data.result?.message || data.text || 'Response received';
    const conf = data.result?.confidence ? ` (${(data.result.confidence * 100).toFixed(0)}%)` : '';
    entry.innerHTML = `<span class="nlp-time">${time}</span> 🤖 ${msg}${conf}`;
  }

  historyEl.insertBefore(entry, historyEl.firstChild);

  // Keep max 10 entries
  while (historyEl.children.length > 10) {
    historyEl.removeChild(historyEl.lastChild);
  }
}

// Handle Enter key in NLP input
document.addEventListener('DOMContentLoaded', () => {
  const nlpInput = document.getElementById('nlp-input');
  if (nlpInput) {
    nlpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendNLPCommand();
    });
  }
});

// ==================== MAINTENANCE ACTIONS ====================
function performMaintenance(robotId, component) {
  fetch('/api/maintenance/perform', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ robotId, component })
  })
  .then(r => r.json())
  .then(data => {
    showToast(`✅ Maintenance: ${component} on ${robotId} - ${data.message || 'Done'}`);
  })
  .catch(() => showToast(`🔧 Maintenance request sent for ${component}`));
}

// ==================== UI HELPERS ====================
function updateConnectionStatus(connected) {
  const dot = document.querySelector('.conn-dot');
  const text = document.getElementById('conn-text');
  if (dot) { dot.className = `conn-dot ${connected ? 'online' : 'offline'}`; }
  if (text) text.textContent = connected ? 'Connected' : 'Disconnected';
}

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function formatUptime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:rgba(0,229,255,0.15);border:1px solid rgba(0,229,255,0.3);
    color:#00e5ff;padding:10px 20px;border-radius:8px;font-size:13px;
    backdrop-filter:blur(10px);animation:slideIn 0.3s ease;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Time range buttons
document.querySelectorAll('.range-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});

// ==================== FETCH INITIAL DATA ====================
async function fetchInitialData() {
  try {
    const [statsRes, fleetRes, mainRes, energyRes] = await Promise.all([
      fetch('/api/stats'),
      fetch('/api/fleet'),
      fetch('/api/maintenance/dashboard'),
      fetch('/api/energy/dashboard'),
    ]);

    const stats = await statsRes.json();
    const fleet = await fleetRes.json();
    const maintenance = await mainRes.json();
    const energy = await energyRes.json();

    updateKPIs(stats, { maintenance });
    updateFleetStatus(fleet);
    updateMaintenance(maintenance, fleet);
    updateEnergy(energy);
  } catch (e) {
    console.log('⚠️ Initial fetch failed, waiting for WebSocket data...');
  }
}

// ==================== START ====================
window.addEventListener('DOMContentLoaded', () => {
  initCharts();
  fetchInitialData();
  console.log('📊 Analytics Dashboard v3.0 initialized');
});

// Add slide-in animation
const style = document.createElement('style');
style.textContent = `@keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`;
document.head.appendChild(style);
