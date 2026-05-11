/**
 * Predictive Maintenance System
 * Hệ thống bảo trì dự đoán cho robot IOT
 */

class PredictiveMaintenanceSystem {
    constructor() {
        this.robots = new Map();
        this.maintenanceHistory = [];
        this.predictions = new Map();
        this.thresholds = {
            battery: { warning: 30, critical: 15 },
            temperature: { warning: 70, critical: 85 },
            vibration: { warning: 5.0, critical: 8.0 },
            errorRate: { warning: 0.05, critical: 0.15 }
        };
        this.maintenanceSchedule = [];
    }

    /**
     * Đăng ký robot mới
     */
    registerRobot(robotId, specs) {
        this.robots.set(robotId, {
            id: robotId,
            specs: specs,
            health: 100,
            lastMaintenance: Date.now(),
            operatingHours: 0,
            metrics: {
                battery: 100,
                temperature: 25,
                vibration: 0,
                errorCount: 0,
                totalOperations: 0
            },
            components: {
                motor: { health: 100, hoursUsed: 0, lastReplaced: Date.now() },
                sensor: { health: 100, hoursUsed: 0, lastReplaced: Date.now() },
                battery: { health: 100, cycles: 0, lastReplaced: Date.now() },
                wheels: { health: 100, distance: 0, lastReplaced: Date.now() }
            },
            alerts: []
        });

        console.log(`✅ Robot ${robotId} registered for predictive maintenance`);
    }

    /**
     * Cập nhật metrics từ robot
     */
    updateMetrics(robotId, metrics) {
        const robot = this.robots.get(robotId);
        if (!robot) return;

        // Update metrics
        robot.metrics = { ...robot.metrics, ...metrics };
        robot.operatingHours += 0.01; // Increment by 0.01 hour per update

        // Update component usage
        robot.components.motor.hoursUsed += 0.01;
        robot.components.sensor.hoursUsed += 0.01;
        robot.components.wheels.distance += metrics.distanceTraveled || 0;

        // Calculate component health
        this.calculateComponentHealth(robot);

        // Check for anomalies
        this.detectAnomalies(robot);

        // Predict failures
        this.predictFailures(robot);

        // Update overall health
        this.calculateOverallHealth(robot);
    }

    /**
     * Tính toán health của các components
     */
    calculateComponentHealth(robot) {
        // Motor health (degrades with hours and temperature)
        const motorDegradation = (robot.components.motor.hoursUsed / 1000) * 100;
        const tempFactor = Math.max(0, (robot.metrics.temperature - 25) / 60);
        robot.components.motor.health = Math.max(0, 100 - motorDegradation - tempFactor * 20);

        // Sensor health (degrades with errors)
        const errorRate = robot.metrics.errorCount / Math.max(1, robot.metrics.totalOperations);
        robot.components.sensor.health = Math.max(0, 100 - errorRate * 500);

        // Battery health (degrades with cycles)
        const cycleDegradation = (robot.components.battery.cycles / 500) * 100;
        robot.components.battery.health = Math.max(0, 100 - cycleDegradation);

        // Wheels health (degrades with distance)
        const distanceDegradation = (robot.components.wheels.distance / 10000) * 100;
        robot.components.wheels.health = Math.max(0, 100 - distanceDegradation);
    }

    /**
     * Phát hiện anomalies
     */
    detectAnomalies(robot) {
        const alerts = [];

        // Battery anomaly
        if (robot.metrics.battery < this.thresholds.battery.critical) {
            alerts.push({
                type: 'CRITICAL',
                component: 'battery',
                message: `Battery critically low: ${robot.metrics.battery}%`,
                timestamp: Date.now(),
                action: 'Charge immediately'
            });
        } else if (robot.metrics.battery < this.thresholds.battery.warning) {
            alerts.push({
                type: 'WARNING',
                component: 'battery',
                message: `Battery low: ${robot.metrics.battery}%`,
                timestamp: Date.now(),
                action: 'Schedule charging'
            });
        }

        // Temperature anomaly
        if (robot.metrics.temperature > this.thresholds.temperature.critical) {
            alerts.push({
                type: 'CRITICAL',
                component: 'motor',
                message: `Temperature critical: ${robot.metrics.temperature}°C`,
                timestamp: Date.now(),
                action: 'Stop operation and cool down'
            });
        } else if (robot.metrics.temperature > this.thresholds.temperature.warning) {
            alerts.push({
                type: 'WARNING',
                component: 'motor',
                message: `Temperature high: ${robot.metrics.temperature}°C`,
                timestamp: Date.now(),
                action: 'Reduce workload'
            });
        }

        // Vibration anomaly
        if (robot.metrics.vibration > this.thresholds.vibration.critical) {
            alerts.push({
                type: 'CRITICAL',
                component: 'motor',
                message: `Excessive vibration: ${robot.metrics.vibration}`,
                timestamp: Date.now(),
                action: 'Inspect motor and wheels'
            });
        }

        // Error rate anomaly
        const errorRate = robot.metrics.errorCount / Math.max(1, robot.metrics.totalOperations);
        if (errorRate > this.thresholds.errorRate.critical) {
            alerts.push({
                type: 'CRITICAL',
                component: 'sensor',
                message: `High error rate: ${(errorRate * 100).toFixed(2)}%`,
                timestamp: Date.now(),
                action: 'Check sensors and calibration'
            });
        }

        robot.alerts = alerts;
    }

    /**
     * Dự đoán failures
     */
    predictFailures(robot) {
        const predictions = [];

        // Motor failure prediction
        if (robot.components.motor.health < 30) {
            const daysToFailure = this.estimateDaysToFailure(robot.components.motor.health, 2);
            predictions.push({
                component: 'motor',
                probability: (100 - robot.components.motor.health) / 100,
                estimatedDays: daysToFailure,
                recommendation: 'Schedule motor replacement',
                priority: daysToFailure < 7 ? 'HIGH' : 'MEDIUM'
            });
        }

        // Battery failure prediction
        if (robot.components.battery.health < 40) {
            const daysToFailure = this.estimateDaysToFailure(robot.components.battery.health, 3);
            predictions.push({
                component: 'battery',
                probability: (100 - robot.components.battery.health) / 100,
                estimatedDays: daysToFailure,
                recommendation: 'Replace battery soon',
                priority: daysToFailure < 14 ? 'HIGH' : 'MEDIUM'
            });
        }

        // Sensor failure prediction
        if (robot.components.sensor.health < 50) {
            const daysToFailure = this.estimateDaysToFailure(robot.components.sensor.health, 1.5);
            predictions.push({
                component: 'sensor',
                probability: (100 - robot.components.sensor.health) / 100,
                estimatedDays: daysToFailure,
                recommendation: 'Calibrate or replace sensors',
                priority: daysToFailure < 10 ? 'HIGH' : 'MEDIUM'
            });
        }

        // Wheels failure prediction
        if (robot.components.wheels.health < 35) {
            const daysToFailure = this.estimateDaysToFailure(robot.components.wheels.health, 2.5);
            predictions.push({
                component: 'wheels',
                probability: (100 - robot.components.wheels.health) / 100,
                estimatedDays: daysToFailure,
                recommendation: 'Replace wheels',
                priority: daysToFailure < 7 ? 'HIGH' : 'MEDIUM'
            });
        }

        this.predictions.set(robot.id, predictions);

        // Auto-schedule maintenance if needed
        this.autoScheduleMaintenance(robot, predictions);
    }

    /**
     * Ước tính số ngày đến khi failure
     */
    estimateDaysToFailure(currentHealth, degradationRate) {
        if (currentHealth <= 0) return 0;
        return Math.floor(currentHealth / degradationRate);
    }

    /**
     * Tính toán overall health
     */
    calculateOverallHealth(robot) {
        const weights = {
            motor: 0.3,
            sensor: 0.2,
            battery: 0.3,
            wheels: 0.2
        };

        robot.health = 
            robot.components.motor.health * weights.motor +
            robot.components.sensor.health * weights.sensor +
            robot.components.battery.health * weights.battery +
            robot.components.wheels.health * weights.wheels;
    }

    /**
     * Tự động lên lịch bảo trì
     */
    autoScheduleMaintenance(robot, predictions) {
        for (const prediction of predictions) {
            if (prediction.priority === 'HIGH') {
                // Check if already scheduled
                const existing = this.maintenanceSchedule.find(
                    s => s.robotId === robot.id && s.component === prediction.component
                );

                if (!existing) {
                    this.maintenanceSchedule.push({
                        robotId: robot.id,
                        component: prediction.component,
                        scheduledDate: Date.now() + prediction.estimatedDays * 24 * 60 * 60 * 1000,
                        priority: prediction.priority,
                        reason: prediction.recommendation,
                        status: 'SCHEDULED'
                    });

                    console.log(`📅 Maintenance scheduled for Robot ${robot.id} - ${prediction.component}`);
                }
            }
        }
    }

    /**
     * Thực hiện bảo trì
     */
    performMaintenance(robotId, component) {
        const robot = this.robots.get(robotId);
        if (!robot) return { success: false, message: 'Robot not found' };

        // Reset component
        if (robot.components[component]) {
            robot.components[component].health = 100;
            robot.components[component].hoursUsed = 0;
            robot.components[component].lastReplaced = Date.now();

            if (component === 'battery') {
                robot.components[component].cycles = 0;
            }
            if (component === 'wheels') {
                robot.components[component].distance = 0;
            }
        }

        // Update maintenance history
        this.maintenanceHistory.push({
            robotId: robotId,
            component: component,
            timestamp: Date.now(),
            type: 'REPLACEMENT',
            cost: this.getMaintenanceCost(component)
        });

        // Update last maintenance
        robot.lastMaintenance = Date.now();

        // Remove from schedule
        this.maintenanceSchedule = this.maintenanceSchedule.filter(
            s => !(s.robotId === robotId && s.component === component)
        );

        // Recalculate health
        this.calculateOverallHealth(robot);

        console.log(`🔧 Maintenance completed for Robot ${robotId} - ${component}`);

        return { success: true, message: 'Maintenance completed successfully' };
    }

    /**
     * Lấy chi phí bảo trì
     */
    getMaintenanceCost(component) {
        const costs = {
            motor: 500,
            sensor: 200,
            battery: 300,
            wheels: 150
        };
        return costs[component] || 100;
    }

    /**
     * Lấy báo cáo bảo trì
     */
    getMaintenanceReport(robotId) {
        const robot = this.robots.get(robotId);
        if (!robot) return null;

        const predictions = this.predictions.get(robotId) || [];
        const schedule = this.maintenanceSchedule.filter(s => s.robotId === robotId);
        const history = this.maintenanceHistory.filter(h => h.robotId === robotId);

        return {
            robotId: robotId,
            overallHealth: robot.health.toFixed(1),
            components: robot.components,
            alerts: robot.alerts,
            predictions: predictions,
            scheduledMaintenance: schedule,
            maintenanceHistory: history.slice(-10),
            totalMaintenanceCost: history.reduce((sum, h) => sum + h.cost, 0),
            operatingHours: robot.operatingHours.toFixed(2),
            daysSinceLastMaintenance: Math.floor((Date.now() - robot.lastMaintenance) / (24 * 60 * 60 * 1000))
        };
    }

    /**
     * Lấy dashboard data
     */
    getDashboardData() {
        const robots = Array.from(this.robots.values());
        
        return {
            totalRobots: robots.length,
            healthyRobots: robots.filter(r => r.health > 70).length,
            warningRobots: robots.filter(r => r.health > 40 && r.health <= 70).length,
            criticalRobots: robots.filter(r => r.health <= 40).length,
            averageHealth: robots.reduce((sum, r) => sum + r.health, 0) / robots.length || 0,
            totalAlerts: robots.reduce((sum, r) => sum + r.alerts.length, 0),
            scheduledMaintenance: this.maintenanceSchedule.length,
            totalMaintenanceCost: this.maintenanceHistory.reduce((sum, h) => sum + h.cost, 0),
            recentAlerts: robots.flatMap(r => 
                r.alerts.map(a => ({ ...a, robotId: r.id }))
            ).slice(0, 10)
        };
    }
}

module.exports = PredictiveMaintenanceSystem;

// Test
if (require.main === module) {
    console.log('🔧 Testing Predictive Maintenance System\n');

    const pms = new PredictiveMaintenanceSystem();

    // Register robots
    pms.registerRobot('robot-001', { model: 'RX-100', type: 'delivery' });
    pms.registerRobot('robot-002', { model: 'RX-200', type: 'patrol' });

    // Simulate metrics updates
    for (let i = 0; i < 50; i++) {
        pms.updateMetrics('robot-001', {
            battery: 100 - i * 1.5,
            temperature: 25 + i * 0.8,
            vibration: i * 0.1,
            errorCount: Math.floor(i / 10),
            totalOperations: i * 10,
            distanceTraveled: i * 50
        });
    }

    // Get report
    const report = pms.getMaintenanceReport('robot-001');
    console.log('\n📊 Maintenance Report for robot-001:');
    console.log(`   Overall Health: ${report.overallHealth}%`);
    console.log(`   Alerts: ${report.alerts.length}`);
    console.log(`   Predictions: ${report.predictions.length}`);
    console.log(`   Scheduled Maintenance: ${report.scheduledMaintenance.length}`);

    // Dashboard
    const dashboard = pms.getDashboardData();
    console.log('\n📈 Dashboard Summary:');
    console.log(`   Total Robots: ${dashboard.totalRobots}`);
    console.log(`   Average Health: ${dashboard.averageHealth.toFixed(1)}%`);
    console.log(`   Total Alerts: ${dashboard.totalAlerts}`);

    console.log('\n✅ Test complete!');
}
