// Kết nối tới IoT Server Node.js
const socket = io('http://localhost:3000');

// DOM Elements
const batteryBar = document.getElementById('battery-level');
const batteryText = document.getElementById('battery-text');
const tempText = document.getElementById('temp-text');
const successCountText = document.getElementById('success-count');
const statusIndicator = document.getElementById('connection-status');
const logContainer = document.getElementById('log-container');

// AI Voice Synthesis
const synth = window.speechSynthesis;
let lastStatus = '';

// Vision Setup
let visionCanvas;
let visionCtx;

// Buttons
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const resetBtn = document.getElementById('reset-btn');
const saveBtn = document.createElement('button'); // Thêm nút Save động
saveBtn.className = 'btn-outline';
saveBtn.innerText = '💾 Save Brain';
document.querySelector('.controls').appendChild(saveBtn);

// Canvas Setup
const canvas = document.getElementById('robotCanvas');
const ctx = canvas.getContext('2d');
let gridWidth = 20;
let gridHeight = 20;
let cellSize = 0;

// Chart.js Setup
const tempChartCtx = document.getElementById('tempChart').getContext('2d');
const tempChart = new Chart(tempChartCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Temp',
            data: [],
            borderColor: '#00f2fe',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            fill: true,
            backgroundColor: 'rgba(0, 242, 254, 0.1)'
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { display: false },
            y: { 
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#94a3b8', font: { size: 10 } }
            }
        }
    }
});

// Handle Socket Updates
socket.on('connect', () => {
    statusIndicator.innerText = 'Connected';
    statusIndicator.className = 'status-indicator online';
    addLog('Connected to IoT Hub', 'system');
});

socket.on('disconnect', () => {
    statusIndicator.innerText = 'Disconnected';
    statusIndicator.className = 'status-indicator offline';
});

socket.on('robot_update', (data) => {
    updateUI(data);
    drawEnvironment(data);
});

socket.on('robot_status', (status) => {
    if (!status.online) {
        statusIndicator.innerText = 'Robot Offline';
        statusIndicator.className = 'status-indicator offline';
    }
});

function updateUI(data) {
    // Battery
    const battery = data.sensors.battery * 100;
    batteryBar.style.width = `${battery}%`;
    batteryText.innerText = `${battery.toFixed(1)}%`;
    
    // Temp
    tempText.innerText = `${data.sensors.temperature}°C`;
    
    // Success
    successCountText.innerText = data.brain.success_count;
    
    // Charts
    if (data.history) {
        tempChart.data.labels = data.history.map(h => h.time);
        tempChart.data.datasets[0].data = data.history.map(h => h.temp);
        tempChart.update('none'); 
    }
    
    // Sensors
    document.getElementById('us-n').style.width = `${data.sensors.ultrasonic_n * 100}%`;
    document.getElementById('us-e').style.width = `${data.sensors.ultrasonic_e * 100}%`;
    document.getElementById('us-s').style.width = `${data.sensors.ultrasonic_s * 100}%`;
    document.getElementById('us-w').style.width = `${data.sensors.ultrasonic_w * 100}%`;

    // AI Voice Alerts
    handleVoiceAlerts(data.robot.status);
    
    // Update Vision Simulation
    drawVision(data.sensors);
    
    // Log Action
    if (data.robot.last_action) {
        const type = data.robot.last_reward > 0 ? 'reward' : (data.robot.last_reward < 0 ? 'penalty' : 'action');
        addLog(`Action: ${data.robot.last_action} (Reward: ${data.robot.last_reward})`, type);
    }
}

function drawEnvironment(data) {
    const env = data.environment;
    const robot = data.robot;
    
    const rect = canvas.parentNode.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
    }
    
    cellSize = Math.min(canvas.width / env.width, canvas.height / env.height);
    const offsetX = (canvas.width - env.width * cellSize) / 2;
    const offsetY = (canvas.height - env.height * cellSize) / 2;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i <= env.width; i++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + i * cellSize, offsetY);
        ctx.lineTo(offsetX + i * cellSize, offsetY + env.height * cellSize);
        ctx.stroke();
    }
    for (let j = 0; j <= env.height; j++) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + j * cellSize);
        ctx.lineTo(offsetX + env.width * cellSize, offsetY + j * cellSize);
        ctx.stroke();
    }
    
    ctx.fillStyle = '#334155';
    env.obstacles.forEach(obs => {
        ctx.roundRect(offsetX + obs[0] * cellSize + 2, offsetY + obs[1] * cellSize + 2, cellSize - 4, cellSize - 4, 4);
        ctx.fill();
    });
    
    ctx.fillStyle = 'rgba(32, 226, 215, 0.3)';
    ctx.fillRect(offsetX + env.goal[0] * cellSize, offsetY + env.goal[1] * cellSize, cellSize, cellSize);
    ctx.strokeStyle = '#20e2d7';
    ctx.strokeRect(offsetX + env.goal[0] * cellSize + 2, offsetY + env.goal[1] * cellSize + 2, cellSize - 4, cellSize - 4);
    
    if (robot.path_history.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
        ctx.setLineDash([5, 5]);
        ctx.moveTo(offsetX + robot.path_history[0][0] * cellSize + cellSize/2, offsetY + robot.path_history[0][1] * cellSize + cellSize/2);
        for (let i = 1; i < robot.path_history.length; i++) {
            ctx.lineTo(offsetX + robot.path_history[i][0] * cellSize + cellSize/2, offsetY + robot.path_history[i][1] * cellSize + cellSize/2);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    const rx = offsetX + robot.x * cellSize + cellSize/2;
    const ry = offsetY + robot.y * cellSize + cellSize/2;
    
    const gradient = ctx.createRadialGradient(rx, ry, 0, rx, ry, cellSize);
    gradient.addColorStop(0, 'rgba(0, 242, 254, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 242, 254, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(rx, ry, cellSize * 0.8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(rx, ry, cellSize * 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    const angleMap = { 'NORTH': -Math.PI/2, 'EAST': 0, 'SOUTH': Math.PI/2, 'WEST': Math.PI };
    const angle = angleMap[robot.heading] || 0;
    ctx.lineTo(rx + Math.cos(angle) * cellSize * 0.5, ry + Math.sin(angle) * cellSize * 0.5);
    ctx.stroke();
}

function addLog(msg, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    if (logContainer.childNodes.length > 50) {
        logContainer.removeChild(logContainer.firstChild);
    }
}

function handleVoiceAlerts(status) {
    if (status === lastStatus) return;
    lastStatus = status;
    
    let message = "";
    if (status === 'GOAL_REACHED') message = "Target reached. Optimizing neural path.";
    else if (status === 'COLLISION_AVOIDED') message = "Obstacle detected. Recalculating trajectory.";
    else if (status === 'MANUAL_CONTROL') message = "Manual override engaged.";
    
    if (message && synth) {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 0.9;
        utterance.pitch = 0.8; 
        synth.speak(utterance);
    }
}

function drawVision(sensors) {
    if (!visionCanvas) {
        const container = document.querySelector('.sensor-card');
        const vDiv = document.createElement('div');
        vDiv.innerHTML = '<h3 style="margin-top:20px">👁️ Robot Vision</h3><canvas id="visionCanvas" style="width:100%; height:120px; background:#000; border-radius:10px; margin-top:10px"></canvas>';
        container.appendChild(vDiv);
        visionCanvas = document.getElementById('visionCanvas');
        visionCtx = visionCanvas.getContext('2d');
    }
    
    const w = visionCanvas.width;
    const h = visionCanvas.height;
    visionCtx.fillStyle = '#000';
    visionCtx.fillRect(0, 0, w, h);
    
    visionCtx.strokeStyle = '#00f2fe';
    visionCtx.lineWidth = 1;
    
    for(let i=0; i<500; i++) {
        visionCtx.fillStyle = `rgba(0, 242, 254, ${Math.random() * 0.2})`;
        visionCtx.fillRect(Math.random()*w, Math.random()*h, 1, 1);
    }
    
    const sValues = [sensors.ultrasonic_w, sensors.ultrasonic_n, sensors.ultrasonic_e];
    const colors = ['#f093fb', '#00f2fe', '#20e2d7'];
    
    sValues.forEach((val, i) => {
        const barH = val * h * 0.8;
        const barW = w / 4;
        const x = (i + 0.5) * (w / 3) - barW / 2;
        
        const grad = visionCtx.createLinearGradient(0, h, 0, h - barH);
        grad.addColorStop(0, 'rgba(0, 242, 254, 0.1)');
        grad.addColorStop(1, colors[i]);
        
        visionCtx.fillStyle = grad;
        visionCtx.fillRect(x, h - barH, barW, barH);
        
        visionCtx.shadowBlur = 10;
        visionCtx.shadowColor = colors[i];
        visionCtx.strokeRect(x, h - barH, barW, barH);
        visionCtx.shadowBlur = 0;
    });
    
    const scanY = (Date.now() / 10) % h;
    visionCtx.strokeStyle = 'rgba(0, 242, 254, 0.3)';
    visionCtx.beginPath();
    visionCtx.moveTo(0, scanY);
    visionCtx.lineTo(w, scanY);
    visionCtx.stroke();
}

// Controls
startBtn.onclick = () => fetch('http://localhost:5000/api/start', { method: 'POST' });
stopBtn.onclick = () => fetch('http://localhost:5000/api/stop', { method: 'POST' });
resetBtn.onclick = () => fetch('http://localhost:5000/api/reset', { method: 'POST' }).then(() => location.reload());
saveBtn.onclick = () => {
    fetch('http://localhost:5000/api/brain/save', { method: 'POST' });
    addLog('AI Memory saved to disk!', 'success');
};

// Environment Editor: Click to toggle obstacles
canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Tính toán tọa độ grid từ tọa độ pixel
    const envW = 20; // Giả sử grid là 20x20
    const envH = 20;
    const cellSize = Math.min(canvas.width / envW, canvas.height / envH);
    const offsetX = (canvas.width - envW * cellSize) / 2;
    const offsetY = (canvas.height - envH * cellSize) / 2;
    
    const gridX = Math.floor((x - offsetX) / cellSize);
    const gridY = Math.floor((y - offsetY) / cellSize);
    
    if (gridX >= 0 && gridX < envW && gridY >= 0 && gridY < envH) {
        fetch('http://localhost:5000/api/environment/obstacle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x: gridX, y: gridY })
        }).then(() => {
            addLog(`Obstacle toggled at [${gridX}, ${gridY}]`, 'system');
        });
    }
};

CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  this.beginPath();
  this.moveTo(x + r, y);
  this.arcTo(x + w, y, x + w, y + h, r);
  this.arcTo(x + w, y + h, x, y + h, r);
  this.arcTo(x, y + h, x, y, r);
  this.arcTo(x, y, x + w, y, r);
  this.closePath();
  return this;
}
