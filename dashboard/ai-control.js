// AI Control Panel JavaScript

// Socket.IO connection
const socket = io('http://localhost:3000');

// State management
let currentAlgorithm = 'dqn';
let isTraining = false;
let currentEpisode = 0;
let totalEpisodes = 1000;
let trainingData = {
    rewards: [],
    losses: [],
    steps: []
};

// Chart instance
let rewardChart = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeAlgorithmSelector();
    initializeHyperparameters();
    initializeNetworkBuilder();
    initializeTrainingControls();
    initializeRewardShaping();
    initializeModelManagement();
    initializeChart();
    initializeWebSocket();
    initializeConsole();
});

// Algorithm Selection
function initializeAlgorithmSelector() {
    const algoOptions = document.querySelectorAll('.algo-option');
    
    algoOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove active class from all
            algoOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active class to clicked
            option.classList.add('active');
            
            // Update current algorithm
            currentAlgorithm = option.dataset.algo;
            
            logToConsole(`Algorithm changed to: ${currentAlgorithm.toUpperCase()}`, 'info');
        });
    });
}

// Hyperparameters
function initializeHyperparameters() {
    // Learning Rate
    const lrSlider = document.getElementById('learning-rate');
    const lrValue = document.getElementById('lr-value');
    lrSlider.addEventListener('input', (e) => {
        lrValue.textContent = parseFloat(e.target.value).toFixed(4);
    });
    
    // Gamma
    const gammaSlider = document.getElementById('gamma');
    const gammaValue = document.getElementById('gamma-value');
    gammaSlider.addEventListener('input', (e) => {
        gammaValue.textContent = parseFloat(e.target.value).toFixed(2);
    });
    
    // Epsilon
    const epsilonSlider = document.getElementById('epsilon');
    const epsilonValue = document.getElementById('epsilon-value');
    epsilonSlider.addEventListener('input', (e) => {
        epsilonValue.textContent = parseFloat(e.target.value).toFixed(2);
    });
}

// Neural Network Builder
function initializeNetworkBuilder() {
    const addLayerBtn = document.getElementById('add-layer-btn');
    
    addLayerBtn.addEventListener('click', () => {
        const layerList = document.querySelector('.layer-list');
        const outputLayer = layerList.lastElementChild;
        
        // Create new layer
        const newLayer = document.createElement('div');
        newLayer.className = 'layer-item editable';
        newLayer.innerHTML = `
            <span class="layer-type">Hidden Layer ${layerList.children.length - 1}</span>
            <input type="number" class="layer-size-input" value="64" min="16" max="512">
            <button class="btn-remove">âœ•</button>
        `;
        
        // Insert before output layer
        layerList.insertBefore(newLayer, outputLayer);
        
        // Add remove listener
        newLayer.querySelector('.btn-remove').addEventListener('click', () => {
            newLayer.remove();
            updateLayerNumbers();
        });
        
        logToConsole('Hidden layer added to network', 'info');
    });
    
    // Remove layer buttons
    document.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.layer-item').remove();
            updateLayerNumbers();
            logToConsole('Hidden layer removed from network', 'info');
        });
    });
}

function updateLayerNumbers() {
    const layers = document.querySelectorAll('.layer-item.editable');
    layers.forEach((layer, index) => {
        layer.querySelector('.layer-type').textContent = `Hidden Layer ${index + 1}`;
    });
}

// Training Controls
function initializeTrainingControls() {
    const startBtn = document.getElementById('start-training-btn');
    const pauseBtn = document.getElementById('pause-training-btn');
    const stopBtn = document.getElementById('stop-training-btn');
    const episodesInput = document.getElementById('episodes');
    
    startBtn.addEventListener('click', startTraining);
    pauseBtn.addEventListener('click', pauseTraining);
    stopBtn.addEventListener('click', stopTraining);
    
    episodesInput.addEventListener('change', (e) => {
        totalEpisodes = parseInt(e.target.value);
        document.getElementById('total-episodes').textContent = totalEpisodes;
    });
}

function startTraining() {
    if (isTraining) return;
    
    isTraining = true;
    currentEpisode = 0;
    
    // Get configuration
    const config = {
        algorithm: currentAlgorithm,
        learningRate: parseFloat(document.getElementById('learning-rate').value),
        gamma: parseFloat(document.getElementById('gamma').value),
        epsilon: parseFloat(document.getElementById('epsilon').value),
        batchSize: parseInt(document.getElementById('batch-size').value),
        memorySize: parseInt(document.getElementById('memory-size').value),
        updateFreq: parseInt(document.getElementById('update-freq').value),
        episodes: parseInt(document.getElementById('episodes').value),
        maxSteps: parseInt(document.getElementById('max-steps').value),
        trainingMode: document.getElementById('training-mode').value,
        activation: document.getElementById('activation').value,
        rewards: {
            goal: parseFloat(document.getElementById('reward-goal').value),
            collision: parseFloat(document.getElementById('reward-collision').value),
            step: parseFloat(document.getElementById('reward-step').value),
            distance: parseFloat(document.getElementById('reward-distance').value)
        }
    };
    
    // Send to server
    socket.emit('start-training', config);
    
    logToConsole('Training started with configuration:', 'system');
    logToConsole(JSON.stringify(config, null, 2), 'info');
    
    // Update UI
    document.getElementById('ai-status').textContent = 'Training';
    document.getElementById('ai-status').className = 'status-indicator online';
}

function pauseTraining() {
    if (!isTraining) return;
    
    socket.emit('pause-training');
    logToConsole('Training paused', 'warning');
    
    document.getElementById('ai-status').textContent = 'Paused';
    document.getElementById('ai-status').className = 'status-indicator warning';
}

function stopTraining() {
    if (!isTraining) return;
    
    isTraining = false;
    socket.emit('stop-training');
    
    logToConsole('Training stopped', 'error');
    
    document.getElementById('ai-status').textContent = 'Idle';
    document.getElementById('ai-status').className = 'status-indicator offline';
}

// Reward Shaping
function initializeRewardShaping() {
    // Already handled by input fields
}

// Model Management
function initializeModelManagement() {
    const saveBtn = document.getElementById('save-model-btn');
    const saveConfigBtn = document.getElementById('save-config-btn');
    const loadConfigBtn = document.getElementById('load-config-btn');
    
    saveBtn.addEventListener('click', saveModel);
    saveConfigBtn.addEventListener('click', saveConfiguration);
    loadConfigBtn.addEventListener('click', loadConfiguration);
    
    // Load and delete buttons for existing models
    document.querySelectorAll('.btn-load').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modelName = e.target.closest('.model-item').querySelector('.model-name').textContent;
            loadModel(modelName);
        });
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modelName = e.target.closest('.model-item').querySelector('.model-name').textContent;
            deleteModel(modelName);
        });
    });
}

function saveModel() {
    const modelName = `${currentAlgorithm}_model_${Date.now()}.pt`;
    socket.emit('save-model', { name: modelName });
    logToConsole(`Model saved: ${modelName}`, 'system');
}

function loadModel(modelName) {
    socket.emit('load-model', { name: modelName });
    logToConsole(`Loading model: ${modelName}`, 'info');
}

function deleteModel(modelName) {
    if (confirm(`Delete model: ${modelName}?`)) {
        socket.emit('delete-model', { name: modelName });
        logToConsole(`Model deleted: ${modelName}`, 'warning');
    }
}

function saveConfiguration() {
    const config = {
        algorithm: currentAlgorithm,
        hyperparameters: {
            learningRate: parseFloat(document.getElementById('learning-rate').value),
            gamma: parseFloat(document.getElementById('gamma').value),
            epsilon: parseFloat(document.getElementById('epsilon').value),
            batchSize: parseInt(document.getElementById('batch-size').value),
            memorySize: parseInt(document.getElementById('memory-size').value),
            updateFreq: parseInt(document.getElementById('update-freq').value)
        },
        training: {
            episodes: parseInt(document.getElementById('episodes').value),
            maxSteps: parseInt(document.getElementById('max-steps').value),
            mode: document.getElementById('training-mode').value
        },
        rewards: {
            goal: parseFloat(document.getElementById('reward-goal').value),
            collision: parseFloat(document.getElementById('reward-collision').value),
            step: parseFloat(document.getElementById('reward-step').value),
            distance: parseFloat(document.getElementById('reward-distance').value)
        }
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    logToConsole('Configuration saved', 'system');
}

function loadConfiguration() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const config = JSON.parse(event.target.result);
                applyConfiguration(config);
                logToConsole('Configuration loaded', 'system');
            } catch (error) {
                logToConsole('Error loading configuration', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function applyConfiguration(config) {
    // Apply algorithm
    document.querySelector(`[data-algo="${config.algorithm}"]`).click();
    
    // Apply hyperparameters
    document.getElementById('learning-rate').value = config.hyperparameters.learningRate;
    document.getElementById('lr-value').textContent = config.hyperparameters.learningRate.toFixed(4);
    document.getElementById('gamma').value = config.hyperparameters.gamma;
    document.getElementById('gamma-value').textContent = config.hyperparameters.gamma.toFixed(2);
    document.getElementById('epsilon').value = config.hyperparameters.epsilon;
    document.getElementById('epsilon-value').textContent = config.hyperparameters.epsilon.toFixed(2);
    document.getElementById('batch-size').value = config.hyperparameters.batchSize;
    document.getElementById('memory-size').value = config.hyperparameters.memorySize;
    document.getElementById('update-freq').value = config.hyperparameters.updateFreq;
    
    // Apply training settings
    document.getElementById('episodes').value = config.training.episodes;
    document.getElementById('max-steps').value = config.training.maxSteps;
    document.getElementById('training-mode').value = config.training.mode;
    
    // Apply rewards
    document.getElementById('reward-goal').value = config.rewards.goal;
    document.getElementById('reward-collision').value = config.rewards.collision;
    document.getElementById('reward-step').value = config.rewards.step;
    document.getElementById('reward-distance').value = config.rewards.distance;
}

// Chart
function initializeChart() {
    const ctx = document.getElementById('rewardChart').getContext('2d');
    rewardChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Average Reward',
                data: [],
                borderColor: '#00ffff',
                backgroundColor: 'rgba(0, 255, 255, 0.1)',
                borderWidth: 2,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#fff'
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#aaa' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y: {
                    ticks: { color: '#aaa' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
}

function updateChart(episode, reward) {
    rewardChart.data.labels.push(episode);
    rewardChart.data.datasets[0].data.push(reward);
    
    // Keep last 50 points
    if (rewardChart.data.labels.length > 50) {
        rewardChart.data.labels.shift();
        rewardChart.data.datasets[0].data.shift();
    }
    
    rewardChart.update();
}

// WebSocket
function initializeWebSocket() {
    socket.on('connect', () => {
        logToConsole('Connected to server', 'system');
        socket.emit('get-models');
    });
    
    socket.on('disconnect', () => {
        logToConsole('Disconnected from server', 'error');
    });
    
    socket.on('training-update', (data) => {
        updateTrainingMetrics(data);
    });
    
    socket.on('training-complete', () => {
        isTraining = false;
        logToConsole('Training completed!', 'system');
        document.getElementById('ai-status').textContent = 'Idle';
        document.getElementById('ai-status').className = 'status-indicator offline';
    });

    socket.on('training-started', (state) => {
        isTraining = true;
        if (state?.config?.episodes) totalEpisodes = state.config.episodes;
        logToConsole('Server accepted training session', 'system');
    });

    socket.on('training-paused', () => {
        logToConsole('Server paused training loop', 'warning');
    });

    socket.on('training-stopped', () => {
        isTraining = false;
        logToConsole('Server stopped training loop', 'warning');
        document.getElementById('ai-status').textContent = 'Idle';
        document.getElementById('ai-status').className = 'status-indicator offline';
    });

    socket.on('training-state', (state) => {
        if (!state) return;
        isTraining = Boolean(state.active && !state.paused);
        currentEpisode = state.episode || 0;
        if (state.config?.episodes) totalEpisodes = state.config.episodes;
        if (state.models) renderModelList(state.models);
    });

    socket.on('model-list', renderModelList);
    socket.on('model-saved', (model) => logToConsole(`Model saved on server: ${model.name}`, 'system'));
    socket.on('model-loaded', (model) => logToConsole(`Model loaded: ${model.name}`, 'system'));
    socket.on('model-deleted', (data) => logToConsole(`Model deleted: ${data.name}`, 'warning'));
    socket.on('model-error', (err) => logToConsole(err.message || 'Model operation failed', 'error'));
}

function updateTrainingMetrics(data) {
    currentEpisode = data.episode;
    
    // Update progress
    const progress = (currentEpisode / totalEpisodes) * 100;
    document.getElementById('current-episode').textContent = currentEpisode;
    document.getElementById('progress-percent').textContent = progress.toFixed(1) + '%';
    document.getElementById('training-progress-bar').style.width = progress + '%';
    
    // Update metrics
    document.getElementById('avg-reward').textContent = data.avgReward.toFixed(2);
    document.getElementById('loss-value').textContent = data.loss.toFixed(4);
    document.getElementById('exploration').textContent = (data.epsilon * 100).toFixed(1) + '%';
    document.getElementById('avg-steps').textContent = Math.round(data.avgSteps);
    
    // Update chart
    updateChart(currentEpisode, data.avgReward);
    
    // Log
    logToConsole(`Episode ${currentEpisode}: Reward=${data.avgReward.toFixed(2)}, Loss=${data.loss.toFixed(4)}`, 'info');
}

// Console
function initializeConsole() {
    const clearBtn = document.getElementById('clear-console-btn');
    clearBtn.addEventListener('click', clearConsole);
}

function logToConsole(message, type = 'info') {
    const consoleLog = document.getElementById('console-log');
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    consoleLog.appendChild(line);
    consoleLog.scrollTop = consoleLog.scrollHeight;
}

function clearConsole() {
    const consoleLog = document.getElementById('console-log');
    consoleLog.innerHTML = '<div class="console-line system">[SYSTEM] Console cleared</div>';
}

function renderModelList(models = []) {
    const list = document.querySelector('.model-list');
    if (!list) return;

    if (!models.length) {
        list.innerHTML = '<div class="model-item"><div class="model-info"><span class="model-name">No saved models</span><span class="model-date">Start training and save a model</span></div></div>';
        return;
    }

    list.innerHTML = models.map(model => `
        <div class="model-item">
            <div class="model-info">
                <span class="model-name">${model.name}</span>
                <span class="model-date">${model.date || ''} · ${model.algorithm || 'ai'} · ${model.episodes || 0} eps · ${model.score || '--'} score</span>
            </div>
            <div class="model-actions">
                <button class="btn-load">📂 Load</button>
                <button class="btn-delete">🗑️</button>
            </div>
        </div>
    `).join('');

    list.querySelectorAll('.btn-load').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modelName = e.target.closest('.model-item').querySelector('.model-name').textContent;
            loadModel(modelName);
        });
    });

    list.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modelName = e.target.closest('.model-item').querySelector('.model-name').textContent;
            deleteModel(modelName);
        });
    });
}

