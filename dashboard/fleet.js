/**
 * IOT Robot AI System - Fleet Management JS v3.0
 * Real-time fleet control with Canvas map & Socket.IO
 */

// ==================== SOCKET.IO ====================
const socket = io();
let robots = new Map();
let activeTasks = [];
let selectedRobotId = null;

socket.on('connect', () => {
  console.log('âœ… Fleet Manager connected');
  document.getElementById('fleet-status').className = 'status-indicator online';
});

socket.on('disconnect', () => {
  document.getElementById('fleet-status').className = 'status-indicator offline';
});

socket.on('fleet_init', (data) => {
  if (data.robots) replaceFleet(data.robots);
  if (data.tasks) replaceTasks(data.tasks);
});

socket.on('system_update', (data) => {
  if (data.fleet) replaceFleet(data.fleet);
  if (data.tasks) replaceTasks(data.tasks);
});

socket.on('fleet_changed', (data) => {
  if (data.robots) replaceFleet(data.robots);
  if (data.tasks) replaceTasks(data.tasks);
});

socket.on('task_assigned', (data) => {
  if (data.robots) replaceFleet(data.robots);
  if (data.tasks) replaceTasks(data.tasks);
});

socket.on('task_removed', (data) => {
  if (data.robots) replaceFleet(data.robots);
  if (data.tasks) replaceTasks(data.tasks);
});

function replaceFleet(fleet) {
  robots = new Map(fleet.map(r => [r.id, r]));
  renderRobotGrid();
  populateTaskRobotSelect();
  updateOverview();
  drawMap();
  updateBatteryCharts(fleet);
}

function replaceTasks(tasks) {
  activeTasks = Array.isArray(tasks) ? tasks.slice() : [];
  renderActiveTasks();
}

// ==================== OVERVIEW CARDS ====================
function updateOverview() {
  const all = Array.from(robots.values());
  const active = all.filter(r => r.status === 'EXPLORING').length;
  const warning = all.filter(r => r.battery < 25 && r.status !== 'CHARGING').length;
  const offline = all.filter(r => r.status === 'OFFLINE').length;
  const avgBat = all.length ? (all.reduce((s, r) => s + (r.battery || 0), 0) / all.length).toFixed(0) : 0;

  setEl('overview-total', all.length);
  setEl('overview-active', active);
  setEl('overview-warning', warning);
  setEl('overview-offline', offline);
  setEl('overview-battery', avgBat + '%');
  setEl('active-robots', active);
  setEl('total-robots', all.length);
}

// ==================== ROBOT GRID ====================
function renderRobotGrid() {
  const grid = document.getElementById('robot-grid');
  const searchVal = document.getElementById('search-robot')?.value.toLowerCase() || '';
  const filterStatus = document.getElementById('filter-status')?.value || 'all';
  const sortBy = document.getElementById('sort-by')?.value || 'id';

  let list = Array.from(robots.values());

  if (searchVal) list = list.filter(r => r.id.toLowerCase().includes(searchVal));
  if (filterStatus !== 'all') {
    list = list.filter(r => {
      if (filterStatus === 'active') return r.status === 'EXPLORING';
      if (filterStatus === 'charging') return r.status === 'CHARGING';
      if (filterStatus === 'offline') return r.status === 'OFFLINE';
      if (filterStatus === 'warning') return r.battery < 25 && r.status !== 'CHARGING';
      return true;
    });
  }
  if (sortBy === 'battery') list.sort((a, b) => (a.battery || 0) - (b.battery || 0));
  else if (sortBy === 'status') list.sort((a, b) => a.status.localeCompare(b.status));
  else list.sort((a, b) => a.id.localeCompare(b.id));

  grid.innerHTML = list.map(r => robotCardHTML(r)).join('');

  // Populate task robot dropdown
  populateTaskRobotSelect();
}

function robotCardHTML(r) {
  const bat = Math.round(r.battery || 0);
  const statusClass = r.status === 'EXPLORING' ? 'active'
    : r.status === 'CHARGING' ? 'charging'
    : r.battery < 25 ? 'warning' : 'offline';
  const statusLabel = r.status === 'EXPLORING' ? 'ðŸŸ¢ Active'
    : r.status === 'CHARGING' ? 'ðŸ”Œ Charging'
    : r.status === 'IDLE' ? 'â¸ Idle' : r.status;
  const batClass = bat > 60 ? '' : bat > 30 ? 'medium' : 'low';
  const health = Math.round(r.health || 0);
  const temp = (r.temperature || 0).toFixed(1);
  const typeIcon = { delivery: 'ðŸ“¦', patrol: 'ðŸ›¡ï¸', inspection: 'ðŸ”', transport: 'ðŸš›', rescue: 'ðŸš¨' }[r.specs?.type] || 'ðŸ¤–';

  return `
    <div class="robot-card ${statusClass}" onclick="showRobotDetail('${r.id}')" id="card-${r.id}">
      <div class="robot-header">
        <div class="robot-id">${typeIcon} ${r.id}</div>
        <div class="robot-status-badge ${statusClass}">${statusLabel}</div>
      </div>
      <div class="robot-info">
        <div class="info-row"><span class="info-label">Type</span><span class="info-value">${r.specs?.type || 'Unknown'}</span></div>
        <div class="info-row"><span class="info-label">Position</span><span class="info-value">(${r.x || 0}, ${r.y || 0})</span></div>
        <div class="info-row"><span class="info-label">Health</span><span class="info-value" style="color:${health>70?'#00ff88':health>40?'#ffd60a':'#ff4d4d'}">${health}%</span></div>
        <div class="info-row"><span class="info-label">Temp</span><span class="info-value">${temp}Â°C</span></div>
      </div>
      <div class="robot-battery">
        <div class="battery-label"><span>ðŸ”‹ Battery</span><span>${bat}%</span></div>
        <div class="battery-bar"><div class="battery-fill ${batClass}" style="width:${bat}%"></div></div>
      </div>
      <div class="robot-actions">
        <button class="btn-control" onclick="event.stopPropagation();controlRobot('${r.id}','patrol')">ðŸ“¡ Patrol</button>
        <button class="btn-stop" onclick="event.stopPropagation();controlRobot('${r.id}','stop')">ðŸ›‘ Stop</button>
      </div>
    </div>`;
}

// ==================== CANVAS MAP ====================
const MAP_W = 20, MAP_H = 20;
let mapScale = 1;
let mapCanvas, mapCtx;

function initMap() {
  mapCanvas = document.getElementById('fleetMapCanvas');
  if (!mapCanvas) return;
  mapCtx = mapCanvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  const container = mapCanvas.parentElement;
  mapCanvas.width = container.clientWidth;
  mapCanvas.height = container.clientHeight;
  drawMap();
}

function drawMap() {
  if (!mapCtx || !mapCanvas) return;
  const cw = mapCanvas.width, ch = mapCanvas.height;
  const cellW = (cw / MAP_W) * mapScale;
  const cellH = (ch / MAP_H) * mapScale;

  // Background
  mapCtx.fillStyle = '#050a15';
  mapCtx.fillRect(0, 0, cw, ch);

  // Grid
  mapCtx.strokeStyle = 'rgba(0,229,255,0.07)';
  mapCtx.lineWidth = 0.5;
  for (let x = 0; x <= MAP_W; x++) {
    mapCtx.beginPath(); mapCtx.moveTo(x * cellW, 0); mapCtx.lineTo(x * cellW, ch); mapCtx.stroke();
  }
  for (let y = 0; y <= MAP_H; y++) {
    mapCtx.beginPath(); mapCtx.moveTo(0, y * cellH); mapCtx.lineTo(cw, y * cellH); mapCtx.stroke();
  }

  // Charging stations
  const stations = [{ x: 5, y: 5 }, { x: 18, y: 18 }, { x: 10, y: 2 }];
  stations.forEach(s => {
    const px = s.x * cellW, py = s.y * cellH;
    mapCtx.fillStyle = 'rgba(0,229,255,0.15)';
    mapCtx.beginPath(); mapCtx.arc(px, py, 14, 0, Math.PI * 2); mapCtx.fill();
    mapCtx.fillStyle = '#00e5ff'; mapCtx.font = '16px serif';
    mapCtx.textAlign = 'center'; mapCtx.textBaseline = 'middle';
    mapCtx.fillText('âš¡', px, py);
  });

  // Obstacles
  const obstacles = [{ x: 4, y: 10 }, { x: 10, y: 10 }, { x: 16, y: 6 }];
  obstacles.forEach(o => {
    mapCtx.fillStyle = 'rgba(255,77,77,0.2)';
    mapCtx.beginPath(); mapCtx.arc(o.x * cellW, o.y * cellH, cellW * 0.4, 0, Math.PI * 2); mapCtx.fill();
  });

  // Robots
  robots.forEach(r => {
    const px = (r.x || 0) * cellW + cellW / 2;
    const py = (r.y || 0) * cellH + cellH / 2;
    const color = r.status === 'EXPLORING' ? '#00ff88'
      : r.status === 'CHARGING' ? '#00e5ff'
      : r.battery < 25 ? '#ffd60a' : '#ff4d4d';

    // Glow
    mapCtx.shadowColor = color; mapCtx.shadowBlur = 15;
    mapCtx.fillStyle = color;
    mapCtx.beginPath(); mapCtx.arc(px, py, 8, 0, Math.PI * 2); mapCtx.fill();
    mapCtx.shadowBlur = 0;

    // Label
    mapCtx.fillStyle = '#fff'; mapCtx.font = 'bold 8px Inter';
    mapCtx.textAlign = 'center'; mapCtx.textBaseline = 'middle';
    mapCtx.fillText(r.id.slice(-3), px, py);

    // Battery arc
    const bat = (r.battery || 0) / 100;
    mapCtx.strokeStyle = color; mapCtx.lineWidth = 2;
    mapCtx.beginPath(); mapCtx.arc(px, py, 12, -Math.PI / 2, -Math.PI / 2 + bat * Math.PI * 2); mapCtx.stroke();
  });
}

// ==================== MAP CONTROLS ====================
document.getElementById('zoom-in-btn')?.addEventListener('click', () => { mapScale = Math.min(3, mapScale + 0.25); drawMap(); });
document.getElementById('zoom-out-btn')?.addEventListener('click', () => { mapScale = Math.max(0.5, mapScale - 0.25); drawMap(); });
document.getElementById('center-map-btn')?.addEventListener('click', () => { mapScale = 1; drawMap(); });

// ==================== ROBOT DETAIL MODAL ====================
function showRobotDetail(robotId) {
  selectedRobotId = robotId;
  const r = robots.get(robotId);
  if (!r) return;

  const modal = document.getElementById('robot-modal');
  const content = document.getElementById('robot-detail-content');
  const bat = Math.round(r.battery || 0);
  const typeIcon = { delivery: 'ðŸ“¦', patrol: 'ðŸ›¡ï¸', inspection: 'ðŸ”', transport: 'ðŸš›', rescue: 'ðŸš¨' }[r.specs?.type] || 'ðŸ¤–';

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div>
        <h3 style="color:#00e5ff;margin-bottom:12px">${typeIcon} ${r.id}</h3>
        <table style="width:100%;font-size:13px;border-collapse:collapse">
          <tr><td style="color:#aaa;padding:6px 0">Model</td><td style="color:#fff;font-weight:600">${r.specs?.model || 'N/A'}</td></tr>
          <tr><td style="color:#aaa;padding:6px 0">Type</td><td style="color:#fff;font-weight:600">${r.specs?.type || 'N/A'}</td></tr>
          <tr><td style="color:#aaa;padding:6px 0">Status</td><td style="color:#00ff88;font-weight:600">${r.status}</td></tr>
          <tr><td style="color:#aaa;padding:6px 0">Position</td><td style="color:#fff;font-weight:600">(${r.x || 0}, ${r.y || 0})</td></tr>
          <tr><td style="color:#aaa;padding:6px 0">Temperature</td><td style="color:#fff;font-weight:600">${(r.temperature||0).toFixed(1)}Â°C</td></tr>
          <tr><td style="color:#aaa;padding:6px 0">Health</td><td style="color:#00ff88;font-weight:600">${Math.round(r.health||0)}%</td></tr>
          <tr><td style="color:#aaa;padding:6px 0">Episodes</td><td style="color:#fff;font-weight:600">${r.episode || 0}</td></tr>
          <tr><td style="color:#aaa;padding:6px 0">Success</td><td style="color:#fff;font-weight:600">${r.successCount || 0}</td></tr>
        </table>
      </div>
      <div>
        <div style="text-align:center;margin-bottom:16px">
          <div style="color:#aaa;font-size:12px;margin-bottom:8px">ðŸ”‹ Battery Level</div>
          <div style="font-size:48px;font-weight:700;color:${bat>60?'#00ff88':bat>30?'#ffd60a':'#ff4d4d'};font-family:'Orbitron',sans-serif">${bat}%</div>
        </div>
        <div style="margin-bottom:16px">
          <div style="height:12px;background:rgba(255,255,255,0.1);border-radius:6px;overflow:hidden">
            <div style="height:100%;width:${bat}%;background:linear-gradient(90deg,#00ff88,#00cc66);transition:width 0.3s"></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn-primary" onclick="controlRobot('${r.id}','patrol')">ðŸ“¡ Start Patrol</button>
          <button class="btn-secondary" onclick="controlRobot('${r.id}','charge')">ðŸ”Œ Send to Charge</button>
          <button class="btn-danger" onclick="controlRobot('${r.id}','stop')">ðŸ›‘ Emergency Stop</button>
        </div>
      </div>
    </div>`;

  modal.classList.add('active');
}

// ==================== ROBOT CONTROLS ====================
function controlRobot(robotId, action) {
  fetch(`/api/fleet/${robotId}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  })
  .then(r => r.json())
  .then(data => showToast(`âœ… ${robotId}: ${action} command sent`))
  .catch(() => showToast(`ðŸ“¡ ${robotId}: ${action} (simulated)`));
}

// ==================== TASK ASSIGNMENT ====================
function populateTaskRobotSelect() {
  const sel = document.getElementById('task-robot-select');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Select Robot --</option>';
  robots.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `${r.id} (${r.status})`;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

document.getElementById('assign-task-btn')?.addEventListener('click', () => {
  const robotId = document.getElementById('task-robot-select').value;
  const taskType = document.getElementById('task-type').value;
  const x = parseFloat(document.getElementById('task-x').value) || Math.random() * 20;
  const y = parseFloat(document.getElementById('task-y').value) || Math.random() * 20;
  const priority = document.getElementById('task-priority').value;

  if (!robotId) { showToast('Please select a robot first'); return; }

  fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ robotId, type: taskType, target: { x, y }, priority })
  })
  .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
  .then(task => showToast(`Task "${task.type}" assigned to ${task.robotId}`))
  .catch(err => showToast(err.error || 'Could not assign task'));
});

function renderActiveTasks() {
  const el = document.getElementById('active-tasks-list');
  if (!el) return;
  if (activeTasks.length === 0) {
    el.innerHTML = '<div style="color:#666;text-align:center;padding:20px">No active tasks</div>';
    return;
  }
  el.innerHTML = activeTasks.map(t => {
    const priorityColor = { urgent: '#ff4d4d', high: '#ffd60a', medium: '#4da6ff', low: '#aaa' }[t.priority] || '#aaa';
    return `
      <div class="task-item">
        <div class="task-header">
          <span class="task-robot">${t.robotId}</span>
          <span class="task-priority ${t.priority}" style="color:${priorityColor}">${t.priority.toUpperCase()}</span>
        </div>
        <div class="task-info">
          ðŸ“‹ ${t.type} â†’ (${t.target.x.toFixed(1)}, ${t.target.y.toFixed(1)})
        </div>
      </div>`;
  }).join('');
}

// ==================== CHARTS ====================
let batteryChart, taskChart, utilizationChart;

function initCharts() {
  const opts = { responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, plugins: { legend: { display: false } } };

  batteryChart = new Chart(document.getElementById('batteryChart'), {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Battery %', data: [], backgroundColor: 'rgba(0,229,255,0.6)', borderColor: '#00e5ff', borderWidth: 2, borderRadius: 4 }] },
    options: { ...opts, scales: { y: { min: 0, max: 100, ticks: { color: '#8090a8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#8090a8', font: { size: 10 } }, grid: { display: false } } } }
  });

  taskChart = new Chart(document.getElementById('taskChart'), {
    type: 'doughnut',
    data: { labels: ['Patrol', 'Delivery', 'Inspection', 'Idle'], datasets: [{ data: [2, 1, 1, 1], backgroundColor: ['#00e5ff', '#00ff88', '#ffd60a', '#4a5568'], borderWidth: 0 }] },
    options: { ...opts, cutout: '65%' }
  });

  utilizationChart = new Chart(document.getElementById('utilizationChart'), {
    type: 'radar',
    data: {
      labels: ['Uptime', 'Battery', 'Tasks', 'Health', 'Speed'],
      datasets: [{ label: 'Fleet Avg', data: [85, 72, 60, 88, 75], backgroundColor: 'rgba(0,229,255,0.1)', borderColor: '#00e5ff', pointBackgroundColor: '#00e5ff', borderWidth: 2 }]
    },
    options: { ...opts, scales: { r: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { display: false }, pointLabels: { color: '#8090a8', font: { size: 10 } } } } }
  });
}

function updateBatteryCharts(fleet) {
  if (!batteryChart) return;
  batteryChart.data.labels = fleet.map(r => r.id.replace('robot-', 'R'));
  batteryChart.data.datasets[0].data = fleet.map(r => Math.round(r.battery || 0));
  batteryChart.data.datasets[0].backgroundColor = fleet.map(r => {
    const b = r.battery || 0;
    return b > 60 ? 'rgba(0,255,136,0.6)' : b > 30 ? 'rgba(255,214,10,0.6)' : 'rgba(255,77,77,0.6)';
  });
  batteryChart.update('none');
}

// ==================== MODALS ====================
document.getElementById('add-robot-btn')?.addEventListener('click', () => {
  document.getElementById('add-robot-modal').classList.add('active');
});

document.getElementById('confirm-add-btn')?.addEventListener('click', () => {
  const id = document.getElementById('new-robot-id').value.trim();
  const name = document.getElementById('new-robot-name').value.trim();
  const type = document.getElementById('new-robot-type').value;
  const x = parseInt(document.getElementById('new-robot-x').value) || 0;
  const y = parseInt(document.getElementById('new-robot-y').value) || 0;

  if (!id || !name) { showToast('Please fill in Robot ID and Name'); return; }

  fetch('/api/fleet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, type, x, y })
  })
  .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
  .then(robot => {
    document.getElementById('add-robot-form')?.reset();
    document.getElementById('add-robot-modal').classList.remove('active');
    showToast(`Robot ${robot.id} added to fleet`);
  })
  .catch(err => showToast(err.error || 'Could not add robot'));
});

document.getElementById('cancel-add-btn')?.addEventListener('click', () => document.getElementById('add-robot-modal').classList.remove('active'));
document.getElementById('close-modal-btn')?.addEventListener('click', () => document.getElementById('robot-modal').classList.remove('active'));
document.getElementById('delete-robot-btn')?.addEventListener('click', () => {
  if (!selectedRobotId) return;
  if (!confirm(`Delete robot ${selectedRobotId}?`)) return;

  fetch(`/api/fleet/${selectedRobotId}`, { method: 'DELETE' })
    .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)))
    .then(() => {
      document.getElementById('robot-modal').classList.remove('active');
      showToast(`Robot ${selectedRobotId} deleted`);
      selectedRobotId = null;
    })
    .catch(err => showToast(err.error || 'Could not delete robot'));
});
document.getElementById('emergency-stop-all-btn')?.addEventListener('click', () => {
  robots.forEach((_, id) => fetch(`/api/fleet/${id}/command`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) }).catch(() => {}));
  showToast('ðŸ›‘ Emergency stop sent to all robots!');
});
document.getElementById('refresh-fleet-btn')?.addEventListener('click', () => {
  fetch('/api/fleet').then(r => r.json()).then(fleet => { replaceFleet(fleet); showToast('Fleet refreshed'); }).catch(() => {});
});

document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}));

// ==================== SEARCH & FILTER ====================
document.getElementById('search-robot')?.addEventListener('input', renderRobotGrid);
document.getElementById('filter-status')?.addEventListener('change', renderRobotGrid);
document.getElementById('sort-by')?.addEventListener('change', renderRobotGrid);

// ==================== HELPERS ====================
function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:rgba(0,229,255,0.15);border:1px solid rgba(0,229,255,0.3);color:#00e5ff;padding:10px 20px;border-radius:8px;font-size:13px;backdrop-filter:blur(10px)';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ==================== INIT ====================
window.addEventListener('DOMContentLoaded', () => {
  initMap();
  initCharts();
  renderActiveTasks();

  // Load initial data
  fetch('/api/fleet').then(r => r.json()).then(fleet => {
    replaceFleet(fleet);
  }).catch(console.warn);
  console.log('ðŸ¤– Fleet Manager v3.0 initialized');
});



