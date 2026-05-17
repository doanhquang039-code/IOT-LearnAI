/**
 * IOT Robot AI System - Main Server v3.0
 * TÃ­ch há»£p: Computer Vision, Predictive Maintenance, Energy Optimizer,
 *           Swarm Intelligence, NLP, Autonomous Navigation
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

// ==================== IMPORT MODULES ====================
const ComputerVisionSystem = require('./computer-vision');
const PredictiveMaintenanceSystem = require('./predictive-maintenance');
const EnergyOptimizer = require('./energy-optimizer');
const SwarmIntelligence = require('./swarm-intelligence');
const NaturalLanguageProcessor = require('./natural-language-processing');
const AutonomousNavigation = require('./autonomous-navigation');

// ==================== APP SETUP ====================
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'DELETE'] }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dashboard')));

const PORT = 3000;
const ROBOT_AI_URL = 'http://localhost:5000';

// ==================== INITIALIZE MODULES ====================
const cv = new ComputerVisionSystem();
const pms = new PredictiveMaintenanceSystem();
const energyOpt = new EnergyOptimizer();
const swarm = new SwarmIntelligence();
const nlp = new NaturalLanguageProcessor();
const nav = new AutonomousNavigation(100, 100);

// ==================== ROBOT FLEET SIMULATION ====================
const ROBOT_IDS = ['robot-001', 'robot-002', 'robot-003', 'robot-004', 'robot-005'];
const robotFleet = new Map();

function initializeFleet() {
  ROBOT_IDS.forEach((id, idx) => {
    const specs = { model: `RX-${(idx + 1) * 100}`, type: ['delivery', 'patrol', 'inspection', 'transport', 'rescue'][idx], avgPowerDraw: 8 + idx * 2 };

    pms.registerRobot(id, specs);
    energyOpt.registerRobot(id, specs);

    robotFleet.set(id, {
      id,
      specs,
      status: ['EXPLORING', 'IDLE', 'CHARGING', 'EXPLORING', 'GOAL_REACHED'][idx],
      x: Math.floor(Math.random() * 20),
      y: Math.floor(Math.random() * 20),
      battery: 60 + Math.random() * 40,
      temperature: 22 + Math.random() * 8,
      health: 75 + Math.random() * 25,
      episode: 0,
      successCount: 0,
    });
  });

  // Register charging stations
  energyOpt.registerChargingStation('station-A', { x: 5, y: 5 }, 2);
  energyOpt.registerChargingStation('station-B', { x: 95, y: 95 }, 3);
  energyOpt.registerChargingStation('station-C', { x: 50, y: 10 }, 2);

  // Add navigation obstacles
  nav.addObstacle(20, 20, 3);
  nav.addObstacle(50, 50, 5);
  nav.addObstacle(80, 30, 2);
  nav.addDynamicObstacle(30, 70, 0.5, 0.3, 1.5);

  console.log(`âœ… Fleet of ${ROBOT_IDS.length} robots initialized`);
}

function getFleetArray() {
  return Array.from(robotFleet.values());
}

function getFleetSnapshot() {
  return {
    robots: getFleetArray(),
    tasks: activeTasks,
    stats: getSystemStats()
  };
}

function emitFleetSnapshot(eventName = 'fleet_changed') {
  io.emit(eventName, getFleetSnapshot());
}

function createRobotPayload(payload = {}) {
  const id = String(payload.id || '').trim();
  if (!id) throw new Error('Robot ID is required');
  if (robotFleet.has(id)) throw new Error(`Robot already exists: ${id}`);

  const type = String(payload.type || 'patrol').trim() || 'patrol';
  const model = String(payload.model || payload.name || 'Custom').trim() || 'Custom';
  const x = Math.max(0, Math.min(19, Number(payload.x) || 0));
  const y = Math.max(0, Math.min(19, Number(payload.y) || 0));

  return {
    id,
    specs: {
      model,
      type,
      avgPowerDraw: Number(payload.avgPowerDraw) || 10
    },
    status: 'IDLE',
    x,
    y,
    battery: Number(payload.battery) || 100,
    temperature: Number(payload.temperature) || 22,
    health: Number(payload.health) || 100,
    episode: 0,
    successCount: 0,
    createdAt: Date.now()
  };
}

function applyRobotCommand(robot, body = {}) {
  const action = String(body.action || '').toLowerCase();
  robot.lastCommand = { action, target: body.target || null, priority: body.priority || 'medium', at: Date.now() };

  if (action === 'stop' || action === 'emergency_stop') {
    robot.status = 'IDLE';
  } else if (action === 'charge' || action === 'charging') {
    robot.status = 'CHARGING';
  } else if (action === 'offline') {
    robot.status = 'OFFLINE';
  } else if (action) {
    robot.status = 'EXPLORING';
  }

  if (body.target && Number.isFinite(Number(body.target.x)) && Number.isFinite(Number(body.target.y))) {
    robot.target = {
      x: Math.max(0, Math.min(19, Number(body.target.x))),
      y: Math.max(0, Math.min(19, Number(body.target.y)))
    };
  }

  return robot;
}
// ==================== DATA SIMULATION ====================
let sensorHistory = [];
const MAX_HISTORY = 100;
let commandHistory = [];
let systemMetrics = {
  totalCommands: 0,
  totalObjectsDetected: 0,
  totalPathsComputed: 0,
  uptime: 0,
};
let cvStats = { objectsPerSecond: 0, facesDetected: 0, gesturesRecognized: 0, slamLandmarks: 0 };
let navStats = { pathsComputed: 0, avgPathLength: 0, successRate: 0, algorithmsUsed: {} };
let nlpStats = { totalCommands: 0, successRate: 0, avgConfidence: 0, recentCommands: [] };
let activeTasks = [];
let trainingState = {
  active: false,
  paused: false,
  interval: null,
  config: null,
  episode: 0,
  startedAt: null,
  currentModel: null,
  models: [
    { name: 'dqn_model_v1.pt', algorithm: 'dqn', date: '2026-05-10 22:30', episodes: 1200, score: 92.4 },
    { name: 'ppo_model_best.pt', algorithm: 'ppo', date: '2026-05-09 18:15', episodes: 1800, score: 94.1 }
  ]
};

function simulateFleetData() {
  const now = Date.now();

  robotFleet.forEach((robot, id) => {
    // Simulate battery drain
    robot.battery = Math.max(10, robot.battery - (0.01 + Math.random() * 0.02));
    // Simulate temperature fluctuation
    robot.temperature = 22 + Math.sin(now / 10000 + robot.x) * 5 + Math.random() * 2;
    // Simulate position changes
    if (robot.status === 'EXPLORING') {
      robot.x = Math.min(19, Math.max(0, robot.x + (Math.random() > 0.5 ? 1 : -1)));
      robot.y = Math.min(19, Math.max(0, robot.y + (Math.random() > 0.5 ? 1 : -1)));
    }
    // Status transitions
    if (robot.battery < 20 && robot.status !== 'CHARGING') {
      robot.status = 'CHARGING';
    } else if (robot.battery > 80 && robot.status === 'CHARGING') {
      robot.battery = 82 + Math.random() * 15;
      robot.status = 'EXPLORING';
    }
    // Episode simulation
    if (Math.random() < 0.02) {
      robot.episode++;
      if (Math.random() < 0.7) robot.successCount++;
    }
    // Health simulation
    robot.health = Math.max(50, robot.health - 0.001);

    // Update maintenance metrics
    pms.updateMetrics(id, {
      battery: robot.battery,
      temperature: robot.temperature,
      vibration: 1 + Math.random() * 2,
      errorCount: Math.floor(Math.random() * 3),
      totalOperations: robot.episode * 10,
      distanceTraveled: Math.random() * 5,
    });

    // Update energy optimizer
    energyOpt.updateRobotState(id, {
      battery: robot.battery,
      location: { x: robot.x * 5, y: robot.y * 5 },
      speed: robot.status === 'EXPLORING' ? 60 : 0,
      load: 30,
      task: robot.status === 'EXPLORING' ? { id: `task-${robot.episode}` } : null,
    });
  });

  // Simulate Computer Vision
  const detections = cv.detectObjects({ width: 640, height: 480 });
  cvStats.objectsPerSecond = detections.length;
  cvStats.slamLandmarks = cv.landmarks.size;
  systemMetrics.totalObjectsDetected += detections.length;

  // Simulate Navigation
  if (Math.random() < 0.1) {
    try {
      const goal = { x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 };
      const result = nav.navigateTo(goal, Math.random() > 0.5 ? 'astar' : 'rrt');
      navStats.pathsComputed++;
      navStats.avgPathLength = result.length || navStats.avgPathLength;
      navStats.successRate = (navStats.successRate * 9 + 1) / 10;
      systemMetrics.totalPathsComputed++;
    } catch (e) { /* ignore */ }
  }

  // Track history
  const firstRobot = robotFleet.get('robot-001');
  sensorHistory.push({
    time: new Date().toLocaleTimeString(),
    temp: firstRobot ? firstRobot.temperature : 25,
    battery: firstRobot ? firstRobot.battery : 85,
  });
  if (sensorHistory.length > MAX_HISTORY) sensorHistory.shift();

  systemMetrics.uptime = Math.floor(process.uptime());
}

// ==================== AI TRAINING SIMULATION ====================
function getTrainingSnapshot() {
  return {
    active: trainingState.active,
    paused: trainingState.paused,
    episode: trainingState.episode,
    config: trainingState.config,
    startedAt: trainingState.startedAt,
    currentModel: trainingState.currentModel,
    models: trainingState.models
  };
}

function stopTrainingSession() {
  if (trainingState.interval) clearInterval(trainingState.interval);
  trainingState.interval = null;
  trainingState.active = false;
  trainingState.paused = false;
}

function startTrainingSession(config = {}) {
  stopTrainingSession();

  const totalEpisodes = Math.max(1, Number(config.episodes) || 1000);
  const startEpsilon = Number(config.epsilon) || 0.1;
  const learningRate = Number(config.learningRate) || 0.001;
  const maxSteps = Number(config.maxSteps) || 200;

  trainingState.active = true;
  trainingState.paused = false;
  trainingState.config = { ...config, episodes: totalEpisodes, learningRate, epsilon: startEpsilon, maxSteps };
  trainingState.episode = 0;
  trainingState.startedAt = Date.now();

  trainingState.interval = setInterval(() => {
    if (!trainingState.active || trainingState.paused) return;

    trainingState.episode += 1;
    const progress = trainingState.episode / totalEpisodes;
    const stability = Math.min(1, progress * 1.35);
    const exploration = Math.max(0.02, startEpsilon * (1 - progress * 0.92));
    const wave = Math.sin(trainingState.episode / 9) * 4;
    const avgReward = 18 + stability * 82 + wave + (Math.random() - 0.5) * 8;
    const loss = Math.max(0.001, (1 - stability) * learningRate * 120 + Math.random() * 0.015);
    const avgSteps = Math.max(12, maxSteps - stability * maxSteps * 0.62 + Math.random() * 10);

    io.emit('training-update', {
      episode: trainingState.episode,
      totalEpisodes,
      avgReward,
      loss,
      epsilon: exploration,
      avgSteps,
      algorithm: trainingState.config.algorithm || 'dqn',
      progress: Math.min(100, progress * 100)
    });

    if (trainingState.episode >= totalEpisodes) {
      stopTrainingSession();
      io.emit('training-complete', getTrainingSnapshot());
    }
  }, 350);

  return getTrainingSnapshot();
}

function normalizeModelName(name) {
  const clean = String(name || '').trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
  return clean || `model_${Date.now()}.pt`;
}
// ==================== WEBSOCKET ====================
io.on('connection', (socket) => {
  console.log(`ðŸ“¡ Client connected: ${socket.id}`);

  // Send initial data
  socket.emit('fleet_init', {
    robots: getFleetArray(),
    tasks: activeTasks,
    stats: getSystemStats(),
  });

  socket.on('disconnect', () => {
    console.log(`ðŸ“´ Client disconnected: ${socket.id}`);
  });

  // Handle NLP commands from dashboard
  socket.on('nlp_command', (data) => {
    try {
      const result = nlp.processCommand ? nlp.processCommand(data.text) : {
        intent: 'movement',
        confidence: 0.85,
        message: `Processing: "${data.text}"`,
        command: data.text.toLowerCase().includes('stop') ? 'STOP' : 'MOVE'
      };
      const cmd = {
        text: data.text,
        timestamp: Date.now(),
        result: result,
        robot: data.robotId || 'robot-001'
      };
      commandHistory.unshift(cmd);
      if (commandHistory.length > 20) commandHistory.pop();
      nlpStats.totalCommands++;
      nlpStats.recentCommands = commandHistory.slice(0, 5);
      socket.emit('nlp_result', cmd);
    } catch (e) {
      socket.emit('nlp_result', { error: e.message });
    }
  });

  socket.emit('training-state', getTrainingSnapshot());
  socket.emit('model-list', trainingState.models);

  socket.on('start-training', (config) => {
    const snapshot = startTrainingSession(config || {});
    io.emit('training-started', snapshot);
  });

  socket.on('pause-training', () => {
    if (!trainingState.active) return;
    trainingState.paused = true;
    io.emit('training-paused', getTrainingSnapshot());
  });

  socket.on('resume-training', () => {
    if (!trainingState.active) return;
    trainingState.paused = false;
    io.emit('training-resumed', getTrainingSnapshot());
  });

  socket.on('stop-training', () => {
    stopTrainingSession();
    io.emit('training-stopped', getTrainingSnapshot());
  });

  socket.on('get-models', () => {
    socket.emit('model-list', trainingState.models);
  });

  socket.on('save-model', (data = {}) => {
    const model = {
      name: normalizeModelName(data.name),
      algorithm: trainingState.config?.algorithm || 'dqn',
      date: new Date().toLocaleString('vi-VN'),
      episodes: trainingState.episode,
      score: Number((70 + Math.random() * 28).toFixed(1))
    };
    trainingState.models.unshift(model);
    trainingState.currentModel = model.name;
    io.emit('model-saved', model);
    io.emit('model-list', trainingState.models);
  });

  socket.on('load-model', (data = {}) => {
    const name = normalizeModelName(data.name);
    const model = trainingState.models.find(item => item.name === name);
    if (!model) return socket.emit('model-error', { message: `Model not found: ${name}` });
    trainingState.currentModel = model.name;
    socket.emit('model-loaded', model);
    socket.emit('training-state', getTrainingSnapshot());
  });

  socket.on('delete-model', (data = {}) => {
    const name = normalizeModelName(data.name);
    const before = trainingState.models.length;
    trainingState.models = trainingState.models.filter(item => item.name !== name);
    if (trainingState.currentModel === name) trainingState.currentModel = null;
    if (before === trainingState.models.length) socket.emit('model-error', { message: `Model not found: ${name}` });
    io.emit('model-deleted', { name });
    io.emit('model-list', trainingState.models);
  });
});

// ==================== BROADCAST LOOP ====================
setInterval(async () => {
  simulateFleetData();

  // Try fetch from Python AI Brain
  let robotAIData = null;
  try {
    const response = await axios.get(`${ROBOT_AI_URL}/api/state`, { timeout: 500 });
    robotAIData = response.data;
  } catch (e) { /* Python AI offline, use simulation */ }

  const broadcastData = {
    fleet: getFleetArray(),
    tasks: activeTasks,
    robotAI: robotAIData,
    sensors: sensorHistory,
    systemStats: getSystemStats(),
    cv: getCVData(),
    maintenance: pms.getDashboardData(),
    energy: energyOpt.getSystemDashboard(),
    navigation: getNavStats(),
    nlp: nlpStats,
    timestamp: Date.now(),
  };

  io.emit('system_update', broadcastData);

  // Also emit legacy format for backward compat
  if (robotAIData) {
    io.emit('robot_update', { ...robotAIData, history: sensorHistory });
  }
}, 500); // 2Hz

// ==================== HELPER FUNCTIONS ====================
function getSystemStats() {
  const fleet = getFleetArray();
  const fleetSize = fleet.length;
  return {
    ...systemMetrics,
    fleetSize,
    activeRobots: fleet.filter(r => r.status === 'EXPLORING').length,
    chargingRobots: fleet.filter(r => r.status === 'CHARGING').length,
    avgBattery: fleetSize ? fleet.reduce((s, r) => s + r.battery, 0) / fleetSize : 0,
    avgHealth: fleetSize ? fleet.reduce((s, r) => s + r.health, 0) / fleetSize : 0,
  };
}

function getCVData() {
  return {
    ...cvStats,
    totalDetected: systemMetrics.totalObjectsDetected,
    robotPose: cv.robotPose,
    landmarkCount: cv.landmarks.size,
  };
}

function getNavStats() {
  const stats = nav.getNavigationStats ? nav.getNavigationStats() : {};
  return {
    ...navStats,
    ...stats,
    totalPaths: systemMetrics.totalPathsComputed,
  };
}

// ==================== REST API ROUTES ====================

// --- System ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', version: '3.0.0', uptime: process.uptime(), modules: 7 });
});

app.get('/api/stats', (req, res) => {
  res.json(getSystemStats());
});

app.get('/api/history', (req, res) => {
  res.json(sensorHistory);
});

// --- Fleet ---
app.get('/api/fleet', (req, res) => {
  res.json(getFleetArray());
});

app.post('/api/fleet', (req, res) => {
  try {
    const robot = createRobotPayload(req.body);
    robotFleet.set(robot.id, robot);
    pms.registerRobot(robot.id, robot.specs);
    energyOpt.registerRobot(robot.id, robot.specs);
    emitFleetSnapshot();
    res.status(201).json(robot);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/fleet/:id', (req, res) => {
  const robot = robotFleet.get(req.params.id);
  if (!robot) return res.status(404).json({ error: 'Robot not found' });
  res.json(robot);
});

app.put('/api/fleet/:id', (req, res) => {
  const robot = robotFleet.get(req.params.id);
  if (!robot) return res.status(404).json({ error: 'Robot not found' });

  if (req.body.status) robot.status = String(req.body.status).toUpperCase();
  if (req.body.type) robot.specs.type = String(req.body.type);
  if (req.body.model) robot.specs.model = String(req.body.model);
  if (Number.isFinite(Number(req.body.x))) robot.x = Math.max(0, Math.min(19, Number(req.body.x)));
  if (Number.isFinite(Number(req.body.y))) robot.y = Math.max(0, Math.min(19, Number(req.body.y)));

  robot.updatedAt = Date.now();
  emitFleetSnapshot();
  res.json(robot);
});

app.delete('/api/fleet/:id', (req, res) => {
  const robot = robotFleet.get(req.params.id);
  if (!robot) return res.status(404).json({ error: 'Robot not found' });

  robotFleet.delete(req.params.id);
  activeTasks = activeTasks.filter(task => task.robotId !== req.params.id);
  emitFleetSnapshot();
  res.json({ success: true, id: req.params.id });
});

app.post('/api/fleet/:id/command', async (req, res) => {
  const robot = robotFleet.get(req.params.id);
  if (!robot) return res.status(404).json({ error: 'Robot not found' });

  const robotState = applyRobotCommand(robot, req.body);
  let aiResponse = null;

  try {
    const response = await axios.post(`${ROBOT_AI_URL}/api/command`, req.body, { timeout: 1000 });
    aiResponse = response.data;
  } catch (e) {
    aiResponse = { status: 'simulated', message: 'AI Brain offline, command applied to fleet simulation' };
  }

  emitFleetSnapshot();
  res.json({ status: aiResponse.status || 'ok', aiResponse, robotState, command: req.body.action });
});

// --- Fleet Tasks ---
app.get('/api/tasks', (req, res) => {
  res.json(activeTasks);
});

app.post('/api/tasks', (req, res) => {
  const robot = robotFleet.get(req.body.robotId);
  if (!robot) return res.status(404).json({ error: 'Robot not found' });

  const task = {
    id: req.body.id || `task-${Date.now()}`,
    robotId: req.body.robotId,
    type: req.body.type || 'patrol',
    target: {
      x: Math.max(0, Math.min(19, Number(req.body.target?.x) || 0)),
      y: Math.max(0, Math.min(19, Number(req.body.target?.y) || 0))
    },
    priority: req.body.priority || 'medium',
    status: 'active',
    timestamp: Date.now()
  };

  activeTasks.unshift(task);
  if (activeTasks.length > 50) activeTasks.pop();
  applyRobotCommand(robot, { action: task.type, target: task.target, priority: task.priority });
  emitFleetSnapshot('task_assigned');
  res.status(201).json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const before = activeTasks.length;
  activeTasks = activeTasks.filter(task => task.id !== req.params.id);
  emitFleetSnapshot('task_removed');
  res.json({ success: before !== activeTasks.length, id: req.params.id });
});

// --- Robot AI Proxy ---
app.get('/api/robot/state', async (req, res) => {
  try {
    const response = await axios.get(`${ROBOT_AI_URL}/api/state`, { timeout: 1000 });
    res.json(response.data);
  } catch (e) {
    res.json({ error: 'AI Brain offline', simulation: true, fleet: getFleetArray() });
  }
});

app.post('/api/robot/start', async (req, res) => {
  try {
    const response = await axios.post(`${ROBOT_AI_URL}/api/start`, {}, { timeout: 1000 });
    res.json(response.data);
  } catch (e) {
    res.json({ status: 'simulated_start', message: 'Robot fleet training started (simulation)' });
  }
});

app.post('/api/robot/stop', async (req, res) => {
  try {
    const response = await axios.post(`${ROBOT_AI_URL}/api/stop`, {}, { timeout: 1000 });
    res.json(response.data);
  } catch (e) {
    res.json({ status: 'simulated_stop' });
  }
});

app.post('/api/robot/reset', async (req, res) => {
  try {
    const response = await axios.post(`${ROBOT_AI_URL}/api/reset`, {}, { timeout: 1000 });
    res.json(response.data);
  } catch (e) {
    res.json({ status: 'simulated_reset' });
  }
});

app.post('/api/proxy/command', async (req, res) => {
  try {
    const response = await axios.post(`${ROBOT_AI_URL}/api/command`, req.body, { timeout: 1000 });
    res.json(response.data);
  } catch (e) {
    res.status(503).json({ error: 'Cannot reach Robot AI Brain' });
  }
});

// --- Computer Vision ---
app.get('/api/cv/stats', (req, res) => {
  res.json(getCVData());
});

app.post('/api/cv/detect', (req, res) => {
  const { width = 640, height = 480 } = req.body;
  const detections = cv.detectObjects({ width, height }, req.body.options);
  res.json({ detections, count: detections.length, timestamp: Date.now() });
});

app.get('/api/cv/slam', (req, res) => {
  res.json({
    pose: cv.robotPose,
    landmarks: cv.landmarks.size,
    map: { width: cv.map.width, height: cv.map.height }
  });
});

// --- Predictive Maintenance ---
app.get('/api/maintenance/dashboard', (req, res) => {
  res.json(pms.getDashboardData());
});

app.get('/api/maintenance/report/:robotId', (req, res) => {
  const report = pms.getMaintenanceReport(req.params.robotId);
  if (!report) return res.status(404).json({ error: 'Robot not found' });
  res.json(report);
});

app.post('/api/maintenance/perform', (req, res) => {
  const { robotId, component } = req.body;
  const result = pms.performMaintenance(robotId, component);
  res.json(result);
});

app.get('/api/maintenance/schedule', (req, res) => {
  res.json(pms.maintenanceSchedule);
});

// --- Energy Optimizer ---
app.get('/api/energy/dashboard', (req, res) => {
  res.json(energyOpt.getSystemDashboard());
});

app.get('/api/energy/report/:robotId', (req, res) => {
  const report = energyOpt.getEnergyReport(req.params.robotId);
  if (!report) return res.status(404).json({ error: 'Robot not found' });
  res.json(report);
});

app.post('/api/energy/charge/:robotId', (req, res) => {
  const { stationId } = req.body;
  const result = energyOpt.startCharging(req.params.robotId, stationId || 'station-A');
  res.json(result);
});

app.get('/api/energy/stations', (req, res) => {
  res.json(Array.from(energyOpt.chargingStations.values()));
});

// --- Navigation ---
app.get('/api/nav/stats', (req, res) => {
  res.json(getNavStats());
});

app.post('/api/nav/plan', (req, res) => {
  const { goal, algorithm = 'astar' } = req.body;
  try {
    const result = nav.navigateTo(goal, algorithm);
    navStats.pathsComputed++;
    res.json({ success: true, path: result.path, length: result.length, computeTime: result.computeTime });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/nav/obstacle', (req, res) => {
  const { x, y, radius = 1 } = req.body;
  nav.addObstacle(x, y, radius);
  res.json({ success: true, message: `Obstacle added at (${x}, ${y})` });
});

// --- NLP ---
app.post('/api/nlp/process', (req, res) => {
  const { text, confidence = 0.9 } = req.body;
  try {
    // Use NLP module if method exists, otherwise simulate
    const result = typeof nlp.processCommand === 'function'
      ? nlp.processCommand(text)
      : typeof nlp.processVoiceCommand === 'function'
        ? nlp.processVoiceCommand(text, confidence)
        : { intent: 'unknown', message: `Processed: ${text}`, confidence };

    commandHistory.unshift({ text, result, timestamp: Date.now() });
    if (commandHistory.length > 50) commandHistory.pop();
    nlpStats.totalCommands++;

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/nlp/history', (req, res) => {
  res.json(commandHistory.slice(0, 20));
});

// --- AI Training / Models ---
app.get('/api/training/state', (req, res) => {
  res.json(getTrainingSnapshot());
});

app.post('/api/training/start', (req, res) => {
  res.json(startTrainingSession(req.body || {}));
});

app.post('/api/training/pause', (req, res) => {
  if (trainingState.active) trainingState.paused = true;
  res.json(getTrainingSnapshot());
});

app.post('/api/training/stop', (req, res) => {
  stopTrainingSession();
  res.json(getTrainingSnapshot());
});

app.get('/api/models', (req, res) => {
  res.json(trainingState.models);
});
// --- Swarm ---
app.get('/api/swarm/stats', (req, res) => {
  try {
    const stats = typeof swarm.getStats === 'function' ? swarm.getStats() : { status: 'active', swarmSize: 5 };
    res.json(stats);
  } catch (e) {
    res.json({ status: 'active', swarmSize: ROBOT_IDS.length });
  }
});

// ==================== DASHBOARD ROUTES ====================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/index.html'));
});

app.get('/analytics', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/analytics.html'));
});

app.get('/ai-control', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/ai-control.html'));
});

app.get('/fleet', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/fleet.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/settings.html'));
});

// ==================== START ====================
initializeFleet();

server.listen(PORT, () => {
  console.log(`\nðŸš€ IOT Robot AI System v3.0`);
  console.log(`ðŸ“¡ Server: http://localhost:${PORT}`);
  console.log(`ðŸ“Š Dashboard: http://localhost:${PORT}/`);
  console.log(`ðŸ“ˆ Analytics: http://localhost:${PORT}/analytics`);
  console.log(`ðŸ¤– AI Control: http://localhost:${PORT}/ai-control`);
  console.log(`ðŸš Fleet: http://localhost:${PORT}/fleet`);
  console.log(`\nâœ… Modules loaded: Computer Vision, Predictive Maintenance,`);
  console.log(`   Energy Optimizer, Swarm Intelligence, NLP, Navigation\n`);
});




