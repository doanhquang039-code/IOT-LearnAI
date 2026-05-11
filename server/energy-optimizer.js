/**
 * Energy Optimization Module
 * Tối ưu hóa năng lượng cho hệ thống robot IOT
 */

class EnergyOptimizer {
    constructor() {
        this.robots = new Map();
        this.chargingStations = new Map();
        this.energyHistory = [];
        this.optimizationRules = [];
        this.savingsTotal = 0;
        
        // Default optimization settings
        this.settings = {
            lowPowerMode: {
                enabled: true,
                batteryThreshold: 30,
                speedReduction: 0.5,
                sensorReduction: 0.3
            },
            smartCharging: {
                enabled: true,
                optimalChargeLevel: 80,
                fastChargeThreshold: 20
            },
            taskScheduling: {
                enabled: true,
                prioritizeEfficiency: true
            },
            sleepMode: {
                enabled: true,
                idleTimeout: 300000, // 5 minutes
                wakeupThreshold: 0.1
            }
        };
    }

    /**
     * Đăng ký robot
     */
    registerRobot(robotId, specs) {
        this.robots.set(robotId, {
            id: robotId,
            specs: specs,
            battery: 100,
            powerConsumption: 0,
            mode: 'NORMAL', // NORMAL, LOW_POWER, SLEEP, CHARGING
            lastActivity: Date.now(),
            energyProfile: {
                totalConsumed: 0,
                totalCharged: 0,
                efficiency: 100,
                avgConsumptionRate: specs.avgPowerDraw || 10
            },
            currentTask: null,
            location: { x: 0, y: 0 }
        });

        console.log(`⚡ Robot ${robotId} registered for energy optimization`);
    }

    /**
     * Đăng ký charging station
     */
    registerChargingStation(stationId, location, capacity) {
        this.chargingStations.set(stationId, {
            id: stationId,
            location: location,
            capacity: capacity,
            currentLoad: 0,
            queue: [],
            status: 'AVAILABLE',
            totalEnergyDelivered: 0
        });

        console.log(`🔌 Charging station ${stationId} registered`);
    }

    /**
     * Cập nhật trạng thái robot
     */
    updateRobotState(robotId, state) {
        const robot = this.robots.get(robotId);
        if (!robot) return;

        // Update battery
        if (state.battery !== undefined) {
            robot.battery = state.battery;
        }

        // Update location
        if (state.location) {
            robot.location = state.location;
        }

        // Update task
        if (state.task) {
            robot.currentTask = state.task;
            robot.lastActivity = Date.now();
        }

        // Calculate power consumption
        this.calculatePowerConsumption(robot, state);

        // Apply optimization rules
        this.applyOptimizationRules(robot);

        // Check if charging needed
        this.checkChargingNeeded(robot);
    }

    /**
     * Tính toán power consumption
     */
    calculatePowerConsumption(robot, state) {
        let consumption = robot.energyProfile.avgConsumptionRate;

        // Adjust based on activity
        if (state.speed) {
            consumption *= (1 + state.speed / 100);
        }

        if (state.load) {
            consumption *= (1 + state.load / 50);
        }

        // Mode adjustments
        if (robot.mode === 'LOW_POWER') {
            consumption *= 0.6;
        } else if (robot.mode === 'SLEEP') {
            consumption *= 0.1;
        }

        robot.powerConsumption = consumption;
        robot.energyProfile.totalConsumed += consumption * 0.01; // Per update

        // Update efficiency
        this.updateEfficiency(robot);
    }

    /**
     * Cập nhật efficiency
     */
    updateEfficiency(robot) {
        const theoreticalConsumption = robot.energyProfile.avgConsumptionRate * 
            (robot.energyProfile.totalConsumed / robot.energyProfile.avgConsumptionRate);
        
        robot.energyProfile.efficiency = 
            (theoreticalConsumption / Math.max(1, robot.energyProfile.totalConsumed)) * 100;
    }

    /**
     * Áp dụng optimization rules
     */
    applyOptimizationRules(robot) {
        // Low power mode
        if (this.settings.lowPowerMode.enabled && 
            robot.battery < this.settings.lowPowerMode.batteryThreshold &&
            robot.mode !== 'CHARGING') {
            this.enableLowPowerMode(robot);
        }

        // Sleep mode
        if (this.settings.sleepMode.enabled &&
            !robot.currentTask &&
            Date.now() - robot.lastActivity > this.settings.sleepMode.idleTimeout &&
            robot.mode !== 'CHARGING') {
            this.enableSleepMode(robot);
        }

        // Wake from sleep if task assigned
        if (robot.mode === 'SLEEP' && robot.currentTask) {
            this.wakeFromSleep(robot);
        }
    }

    /**
     * Enable low power mode
     */
    enableLowPowerMode(robot) {
        if (robot.mode === 'LOW_POWER') return;

        robot.mode = 'LOW_POWER';
        const savings = robot.powerConsumption * 0.4;
        this.savingsTotal += savings;

        console.log(`💡 Robot ${robot.id} entered LOW_POWER mode (saving ${savings.toFixed(2)}W)`);
    }

    /**
     * Enable sleep mode
     */
    enableSleepMode(robot) {
        if (robot.mode === 'SLEEP') return;

        robot.mode = 'SLEEP';
        const savings = robot.powerConsumption * 0.9;
        this.savingsTotal += savings;

        console.log(`😴 Robot ${robot.id} entered SLEEP mode (saving ${savings.toFixed(2)}W)`);
    }

    /**
     * Wake from sleep
     */
    wakeFromSleep(robot) {
        robot.mode = 'NORMAL';
        robot.lastActivity = Date.now();
        console.log(`⏰ Robot ${robot.id} woke from SLEEP mode`);
    }

    /**
     * Kiểm tra nếu cần charging
     */
    checkChargingNeeded(robot) {
        if (robot.mode === 'CHARGING') return;

        const threshold = this.settings.smartCharging.fastChargeThreshold;

        if (robot.battery < threshold) {
            this.requestCharging(robot, 'URGENT');
        } else if (robot.battery < 40 && !robot.currentTask) {
            this.requestCharging(robot, 'NORMAL');
        }
    }

    /**
     * Request charging
     */
    requestCharging(robot, priority) {
        // Find nearest available charging station
        const station = this.findNearestChargingStation(robot.location);

        if (!station) {
            console.log(`⚠️  No charging station available for Robot ${robot.id}`);
            return;
        }

        // Add to queue
        station.queue.push({
            robotId: robot.id,
            priority: priority,
            requestTime: Date.now(),
            estimatedArrival: this.calculateTravelTime(robot.location, station.location)
        });

        // Sort queue by priority
        station.queue.sort((a, b) => {
            if (a.priority === 'URGENT' && b.priority !== 'URGENT') return -1;
            if (a.priority !== 'URGENT' && b.priority === 'URGENT') return 1;
            return a.requestTime - b.requestTime;
        });

        console.log(`🔋 Robot ${robot.id} requested charging at Station ${station.id} (${priority})`);
    }

    /**
     * Tìm charging station gần nhất
     */
    findNearestChargingStation(location) {
        let nearest = null;
        let minDistance = Infinity;

        for (const station of this.chargingStations.values()) {
            if (station.currentLoad < station.capacity) {
                const distance = this.calculateDistance(location, station.location);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = station;
                }
            }
        }

        return nearest;
    }

    /**
     * Tính khoảng cách
     */
    calculateDistance(loc1, loc2) {
        return Math.sqrt(
            Math.pow(loc1.x - loc2.x, 2) + 
            Math.pow(loc1.y - loc2.y, 2)
        );
    }

    /**
     * Tính thời gian di chuyển
     */
    calculateTravelTime(from, to) {
        const distance = this.calculateDistance(from, to);
        const speed = 2; // units per second
        return distance / speed;
    }

    /**
     * Start charging
     */
    startCharging(robotId, stationId) {
        const robot = this.robots.get(robotId);
        const station = this.chargingStations.get(stationId);

        if (!robot || !station) return { success: false };

        robot.mode = 'CHARGING';
        station.currentLoad++;

        // Remove from queue
        station.queue = station.queue.filter(q => q.robotId !== robotId);

        console.log(`🔌 Robot ${robotId} started charging at Station ${stationId}`);

        return { success: true };
    }

    /**
     * Update charging
     */
    updateCharging(robotId, chargeRate = 2) {
        const robot = this.robots.get(robotId);
        if (!robot || robot.mode !== 'CHARGING') return;

        // Charge battery
        robot.battery = Math.min(100, robot.battery + chargeRate);
        robot.energyProfile.totalCharged += chargeRate;

        // Check if fully charged or optimal level reached
        const optimalLevel = this.settings.smartCharging.optimalChargeLevel;
        
        if (robot.battery >= optimalLevel || robot.battery >= 100) {
            this.stopCharging(robotId);
        }
    }

    /**
     * Stop charging
     */
    stopCharging(robotId) {
        const robot = this.robots.get(robotId);
        if (!robot) return;

        // Find station
        for (const station of this.chargingStations.values()) {
            if (station.currentLoad > 0) {
                station.currentLoad--;
                station.totalEnergyDelivered += (100 - robot.battery);
                break;
            }
        }

        robot.mode = 'NORMAL';
        console.log(`✅ Robot ${robotId} finished charging (${robot.battery.toFixed(1)}%)`);
    }

    /**
     * Optimize task scheduling
     */
    optimizeTaskScheduling(tasks, robots) {
        if (!this.settings.taskScheduling.enabled) {
            return tasks;
        }

        // Sort tasks by energy efficiency
        const optimizedTasks = tasks.map(task => {
            // Calculate energy cost for each robot
            const costs = robots.map(robot => {
                const distance = this.calculateDistance(robot.location, task.location);
                const energyCost = distance * 0.5 + task.complexity * 2;
                return { robotId: robot.id, cost: energyCost };
            });

            // Assign to most efficient robot
            costs.sort((a, b) => a.cost - b.cost);
            task.assignedRobot = costs[0].robotId;
            task.estimatedEnergyCost = costs[0].cost;

            return task;
        });

        return optimizedTasks;
    }

    /**
     * Lấy energy report
     */
    getEnergyReport(robotId) {
        const robot = this.robots.get(robotId);
        if (!robot) return null;

        return {
            robotId: robotId,
            currentBattery: robot.battery.toFixed(1),
            mode: robot.mode,
            powerConsumption: robot.powerConsumption.toFixed(2),
            energyProfile: {
                totalConsumed: robot.energyProfile.totalConsumed.toFixed(2),
                totalCharged: robot.energyProfile.totalCharged.toFixed(2),
                efficiency: robot.energyProfile.efficiency.toFixed(1),
                netConsumption: (robot.energyProfile.totalConsumed - robot.energyProfile.totalCharged).toFixed(2)
            },
            optimizationStatus: {
                lowPowerModeActive: robot.mode === 'LOW_POWER',
                sleepModeActive: robot.mode === 'SLEEP',
                chargingActive: robot.mode === 'CHARGING'
            }
        };
    }

    /**
     * Lấy system dashboard
     */
    getSystemDashboard() {
        const robots = Array.from(this.robots.values());
        const stations = Array.from(this.chargingStations.values());

        const totalConsumption = robots.reduce((sum, r) => sum + r.energyProfile.totalConsumed, 0);
        const totalCharged = robots.reduce((sum, r) => sum + r.energyProfile.totalCharged, 0);
        const avgEfficiency = robots.reduce((sum, r) => sum + r.energyProfile.efficiency, 0) / robots.length || 0;

        return {
            fleet: {
                totalRobots: robots.length,
                activeRobots: robots.filter(r => r.mode === 'NORMAL').length,
                chargingRobots: robots.filter(r => r.mode === 'CHARGING').length,
                lowPowerRobots: robots.filter(r => r.mode === 'LOW_POWER').length,
                sleepingRobots: robots.filter(r => r.mode === 'SLEEP').length,
                averageBattery: robots.reduce((sum, r) => sum + r.battery, 0) / robots.length || 0
            },
            energy: {
                totalConsumed: totalConsumption.toFixed(2),
                totalCharged: totalCharged.toFixed(2),
                netConsumption: (totalConsumption - totalCharged).toFixed(2),
                averageEfficiency: avgEfficiency.toFixed(1),
                totalSavings: this.savingsTotal.toFixed(2),
                currentPowerDraw: robots.reduce((sum, r) => sum + r.powerConsumption, 0).toFixed(2)
            },
            charging: {
                totalStations: stations.length,
                availableStations: stations.filter(s => s.currentLoad < s.capacity).length,
                totalCapacity: stations.reduce((sum, s) => sum + s.capacity, 0),
                currentLoad: stations.reduce((sum, s) => sum + s.currentLoad, 0),
                queueLength: stations.reduce((sum, s) => sum + s.queue.length, 0),
                totalEnergyDelivered: stations.reduce((sum, s) => sum + s.totalEnergyDelivered, 0).toFixed(2)
            },
            optimization: {
                lowPowerModeEnabled: this.settings.lowPowerMode.enabled,
                smartChargingEnabled: this.settings.smartCharging.enabled,
                taskSchedulingEnabled: this.settings.taskScheduling.enabled,
                sleepModeEnabled: this.settings.sleepMode.enabled
            }
        };
    }
}

module.exports = EnergyOptimizer;

// Test
if (require.main === module) {
    console.log('⚡ Testing Energy Optimizer\n');

    const optimizer = new EnergyOptimizer();

    // Register robots
    optimizer.registerRobot('robot-001', { avgPowerDraw: 10 });
    optimizer.registerRobot('robot-002', { avgPowerDraw: 12 });

    // Register charging stations
    optimizer.registerChargingStation('station-001', { x: 10, y: 10 }, 2);
    optimizer.registerChargingStation('station-002', { x: 50, y: 50 }, 3);

    // Simulate operations
    for (let i = 0; i < 100; i++) {
        optimizer.updateRobotState('robot-001', {
            battery: 100 - i * 0.8,
            location: { x: i, y: i },
            speed: 50,
            load: 30,
            task: i < 80 ? { id: `task-${i}` } : null
        });

        if (i % 10 === 0) {
            optimizer.updateCharging('robot-001', 5);
        }
    }

    // Get reports
    const report = optimizer.getEnergyReport('robot-001');
    console.log('\n📊 Energy Report for robot-001:');
    console.log(`   Battery: ${report.currentBattery}%`);
    console.log(`   Mode: ${report.mode}`);
    console.log(`   Efficiency: ${report.energyProfile.efficiency}%`);

    const dashboard = optimizer.getSystemDashboard();
    console.log('\n📈 System Dashboard:');
    console.log(`   Active Robots: ${dashboard.fleet.activeRobots}`);
    console.log(`   Average Battery: ${dashboard.fleet.averageBattery.toFixed(1)}%`);
    console.log(`   Total Savings: ${dashboard.energy.totalSavings}W`);
    console.log(`   Available Stations: ${dashboard.charging.availableStations}`);

    console.log('\n✅ Test complete!');
}
