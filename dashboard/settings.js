/**
 * IOT Robot AI System - Settings JS v3.0
 */

const socket = io();
const logs = [];

socket.on('connect', () => {
  addLog('info', '✅ WebSocket connected to server');
  document.getElementById('ws-status').className = 'badge-online';
  document.getElementById('ws-status').textContent = '● Connected';
  document.getElementById('sys-status').className = 'status-indicator online';
  document.getElementById('sys-status').textContent = 'Online';
});

socket.on('disconnect', () => {
  addLog('warn', '⚠️ WebSocket disconnected');
  document.getElementById('ws-status').className = 'badge-offline';
  document.getElementById('ws-status').textContent = '● Disconnected';
  document.getElementById('sys-status').className = 'status-indicator offline';
});

socket.on('system_update', (data) => {
  if (data.systemStats) {
    const uptime = data.systemStats.uptime || 0;
    document.getElementById('sys-uptime').textContent = formatUptime(uptime);
    document.getElementById('sys-robots').textContent = data.systemStats.fleetSize || 5;
  }
});

// ==================== PANEL SWITCHING ====================
function switchPanel(name, el) {
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  el.classList.add('active');
}

// ==================== SAVE SETTINGS ====================
function saveAllSettings() {
  const settings = {
    animations: document.getElementById('opt-animations')?.checked,
    compact: document.getElementById('opt-compact')?.checked,
    theme: document.getElementById('opt-theme')?.value,
    refresh: document.getElementById('opt-refresh')?.value,
    history: document.getElementById('opt-history')?.value,
    navAlgo: document.getElementById('opt-nav-algo')?.value,
    swarm: document.getElementById('opt-swarm')?.checked,
    collision: document.getElementById('opt-collision')?.checked,
    host: document.getElementById('opt-host')?.value,
    port: document.getElementById('opt-port')?.value,
    sound: document.getElementById('opt-sound')?.checked,
    notif: document.getElementById('opt-notif')?.checked,
    fleetSize: document.getElementById('fleet-size')?.value,
  };

  localStorage.setItem('iot_settings', JSON.stringify(settings));
  addLog('info', '💾 Settings saved: ' + Object.keys(settings).length + ' options');
  showToast('✅ All settings saved successfully!');
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('iot_settings') || '{}');
    if (s.animations !== undefined && document.getElementById('opt-animations')) document.getElementById('opt-animations').checked = s.animations;
    if (s.theme && document.getElementById('opt-theme')) document.getElementById('opt-theme').value = s.theme;
    if (s.refresh && document.getElementById('opt-refresh')) document.getElementById('opt-refresh').value = s.refresh;
    if (s.fleetSize && document.getElementById('fleet-size')) document.getElementById('fleet-size').value = s.fleetSize;
    if (s.navAlgo && document.getElementById('opt-nav-algo')) document.getElementById('opt-nav-algo').value = s.navAlgo;
    addLog('info', '📂 Settings loaded from localStorage');
  } catch (e) {
    addLog('warn', '⚠️ Could not load saved settings');
  }
}

// ==================== LOGS ====================
function addLog(type, msg) {
  const time = new Date().toLocaleTimeString();
  logs.unshift({ time, type, msg });
  if (logs.length > 100) logs.pop();
  renderLogs();
}

function renderLogs() {
  const el = document.getElementById('log-container');
  if (!el) return;
  el.innerHTML = logs.map(l =>
    `<div class="log-entry ${l.type}">[${l.time}] ${l.msg}</div>`
  ).join('');
}

function clearLogs() {
  logs.length = 0;
  renderLogs();
  showToast('🗑️ Logs cleared');
}

// ==================== SYSTEM INFO ====================
async function fetchSystemInfo() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    document.getElementById('sys-version').textContent = data.version || 'v3.0.0';
    document.getElementById('sys-uptime').textContent = formatUptime(data.uptime || 0);
    document.getElementById('sys-modules').textContent = data.modules || 7;
    addLog('info', `🚀 Server v${data.version} | Uptime: ${formatUptime(data.uptime)}`);
  } catch (e) {
    addLog('err', '❌ Could not reach server health endpoint');
  }

  try {
    await fetch('http://localhost:5000/api/state', { signal: AbortSignal.timeout(1000) });
    document.getElementById('ai-status').className = 'badge-online';
    document.getElementById('ai-status').textContent = '● Online';
    addLog('info', '🤖 Python AI Brain: Online');
  } catch (e) {
    document.getElementById('ai-status').className = 'badge-offline';
    document.getElementById('ai-status').textContent = '● Offline';
    addLog('warn', '🤖 Python AI Brain: Offline (simulation mode active)');
  }
}

// ==================== RANGE SYNC ====================
document.getElementById('opt-history')?.addEventListener('input', function() {
  document.getElementById('hist-display').textContent = this.value;
});

// ==================== HELPERS ====================
function formatUptime(s) {
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
}

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:rgba(0,229,255,0.15);border:1px solid rgba(0,229,255,0.3);color:#00e5ff;padding:10px 20px;border-radius:8px;font-size:13px;backdrop-filter:blur(10px)';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ==================== INIT ====================
window.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  fetchSystemInfo();
  addLog('info', '⚙️ Settings page initialized');
  addLog('info', '📡 Connecting to WebSocket server...');
  console.log('⚙️ Settings v3.0 loaded');
});
