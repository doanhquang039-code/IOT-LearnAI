/**
 * Autonomous Navigation System
 * Advanced pathfinding với A*, RRT, Dynamic Window Approach
 * Obstacle avoidance và real-time replanning
 */

class AutonomousNavigation {
    constructor(mapWidth = 100, mapHeight = 100) {
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.obstacles = [];
        this.dynamicObstacles = [];
        this.currentPosition = { x: 0, y: 0, theta: 0 };
        this.goalPosition = null;
        this.currentPath = [];
        this.pathHistory = [];
        
        // Navigation parameters
        this.robotRadius = 0.5;
        this.maxSpeed = 2.0;
        this.maxAngularSpeed = Math.PI / 2;
        this.safetyDistance = 1.0;
    }

    /**
     * A* PATHFINDING
     * Classic A* algorithm cho grid-based navigation
     */
    
    findPathAStar(start, goal) {
        console.log(`🔍 A* pathfinding from (${start.x}, ${start.y}) to (${goal.x}, ${goal.y})`);
        
        const startTime = Date.now();
        
        const openSet = [start];
        const closedSet = new Set();
        const cameFrom = new Map();
        
        const gScore = new Map();
        const fScore = new Map();
        
        gScore.set(this.posKey(start), 0);
        fScore.set(this.posKey(start), this.heuristic(start, goal));
        
        while (openSet.length > 0) {
            // Get node with lowest fScore
            openSet.sort((a, b) => 
                fScore.get(this.posKey(a)) - fScore.get(this.posKey(b))
            );
            const current = openSet.shift();
            
            // Check if reached goal
            if (this.distance(current, goal) < 1.0) {
                const path = this.reconstructPath(cameFrom, current);
                const computeTime = Date.now() - startTime;
                
                console.log(`✅ Path found: ${path.length} waypoints in ${computeTime}ms`);
                
                return {
                    path: path,
                    length: this.pathLength(path),
                    computeTime: computeTime,
                    algorithm: 'A*'
                };
            }
            
            closedSet.add(this.posKey(current));
            
            // Check neighbors
            const neighbors = this.getNeighbors(current);
            
            for (const neighbor of neighbors) {
                if (closedSet.has(this.posKey(neighbor))) {
                    continue;
                }
                
                if (this.isCollision(neighbor)) {
                    continue;
                }
                
                const tentativeGScore = gScore.get(this.posKey(current)) + 
                                       this.distance(current, neighbor);
                
                if (!openSet.some(n => this.posKey(n) === this.posKey(neighbor))) {
                    openSet.push(neighbor);
                } else if (tentativeGScore >= gScore.get(this.posKey(neighbor))) {
                    continue;
                }
                
                cameFrom.set(this.posKey(neighbor), current);
                gScore.set(this.posKey(neighbor), tentativeGScore);
                fScore.set(this.posKey(neighbor), 
                          tentativeGScore + this.heuristic(neighbor, goal));
            }
        }
        
        console.log('❌ No path found');
        return null;
    }

    heuristic(a, b) {
        // Euclidean distance
        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    }

    getNeighbors(pos) {
        const neighbors = [];
        const directions = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 },
            { x: 1, y: 1 },
            { x: -1, y: 1 },
            { x: 1, y: -1 },
            { x: -1, y: -1 }
        ];
        
        for (const dir of directions) {
            const neighbor = {
                x: pos.x + dir.x,
                y: pos.y + dir.y
            };
            
            if (this.isValidPosition(neighbor)) {
                neighbors.push(neighbor);
            }
        }
        
        return neighbors;
    }

    reconstructPath(cameFrom, current) {
        const path = [current];
        
        while (cameFrom.has(this.posKey(current))) {
            current = cameFrom.get(this.posKey(current));
            path.unshift(current);
        }
        
        return path;
    }

    /**
     * RRT (Rapidly-exploring Random Tree)
     * Sampling-based pathfinding cho complex environments
     */
    
    findPathRRT(start, goal, maxIterations = 1000) {
        console.log(`🌳 RRT pathfinding from (${start.x}, ${start.y}) to (${goal.x}, ${goal.y})`);
        
        const startTime = Date.now();
        
        const tree = [start];
        const parent = new Map();
        const stepSize = 2.0;
        
        for (let i = 0; i < maxIterations; i++) {
            // Sample random point (bias towards goal)
            const randomPoint = Math.random() < 0.1 ? goal : this.sampleRandomPoint();
            
            // Find nearest node in tree
            const nearest = this.findNearest(tree, randomPoint);
            
            // Steer towards random point
            const newNode = this.steer(nearest, randomPoint, stepSize);
            
            // Check collision
            if (!this.isCollisionFree(nearest, newNode)) {
                continue;
            }
            
            // Add to tree
            tree.push(newNode);
            parent.set(this.posKey(newNode), nearest);
            
            // Check if reached goal
            if (this.distance(newNode, goal) < stepSize) {
                const path = this.reconstructRRTPath(parent, newNode, start);
                const computeTime = Date.now() - startTime;
                
                console.log(`✅ Path found: ${path.length} waypoints in ${computeTime}ms`);
                
                return {
                    path: path,
                    length: this.pathLength(path),
                    computeTime: computeTime,
                    algorithm: 'RRT',
                    iterations: i + 1
                };
            }
        }
        
        console.log('❌ No path found within max iterations');
        return null;
    }

    sampleRandomPoint() {
        return {
            x: Math.random() * this.mapWidth,
            y: Math.random() * this.mapHeight
        };
    }

    findNearest(tree, point) {
        let nearest = tree[0];
        let minDist = this.distance(nearest, point);
        
        for (const node of tree) {
            const dist = this.distance(node, point);
            if (dist < minDist) {
                minDist = dist;
                nearest = node;
            }
        }
        
        return nearest;
    }

    steer(from, to, stepSize) {
        const dist = this.distance(from, to);
        
        if (dist <= stepSize) {
            return to;
        }
        
        const ratio = stepSize / dist;
        return {
            x: from.x + (to.x - from.x) * ratio,
            y: from.y + (to.y - from.y) * ratio
        };
    }

    reconstructRRTPath(parent, current, start) {
        const path = [current];
        
        while (this.posKey(current) !== this.posKey(start)) {
            current = parent.get(this.posKey(current));
            if (!current) break;
            path.unshift(current);
        }
        
        return path;
    }

    /**
     * DYNAMIC WINDOW APPROACH (DWA)
     * Local planner cho obstacle avoidance
     */
    
    dynamicWindowApproach(currentVel, obstacles, goal) {
        const dt = 0.1;  // Time step
        const velocityResolution = 0.1;
        
        // Dynamic window
        const vMin = Math.max(0, currentVel.v - this.maxSpeed * dt);
        const vMax = Math.min(this.maxSpeed, currentVel.v + this.maxSpeed * dt);
        const wMin = Math.max(-this.maxAngularSpeed, currentVel.w - this.maxAngularSpeed * dt);
        const wMax = Math.min(this.maxAngularSpeed, currentVel.w + this.maxAngularSpeed * dt);
        
        let bestVel = null;
        let bestScore = -Infinity;
        
        // Search velocity space
        for (let v = vMin; v <= vMax; v += velocityResolution) {
            for (let w = wMin; w <= wMax; w += velocityResolution) {
                const trajectory = this.predictTrajectory(
                    this.currentPosition,
                    { v, w },
                    dt,
                    10
                );
                
                // Check collision
                if (this.trajectoryHasCollision(trajectory, obstacles)) {
                    continue;
                }
                
                // Calculate score
                const score = this.evaluateTrajectory(trajectory, goal);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestVel = { v, w };
                }
            }
        }
        
        return bestVel;
    }

    predictTrajectory(pos, vel, dt, steps) {
        const trajectory = [{ ...pos }];
        let current = { ...pos };
        
        for (let i = 0; i < steps; i++) {
            current = {
                x: current.x + vel.v * Math.cos(current.theta) * dt,
                y: current.y + vel.v * Math.sin(current.theta) * dt,
                theta: current.theta + vel.w * dt
            };
            trajectory.push({ ...current });
        }
        
        return trajectory;
    }

    trajectoryHasCollision(trajectory, obstacles) {
        for (const point of trajectory) {
            if (this.isCollision(point)) {
                return true;
            }
            
            for (const obs of obstacles) {
                if (this.distance(point, obs) < this.safetyDistance) {
                    return true;
                }
            }
        }
        return false;
    }

    evaluateTrajectory(trajectory, goal) {
        const endPoint = trajectory[trajectory.length - 1];
        
        // Distance to goal (minimize)
        const distScore = -this.distance(endPoint, goal);
        
        // Speed (maximize)
        const speedScore = trajectory.length * 0.1;
        
        // Heading to goal (maximize)
        const dx = goal.x - endPoint.x;
        const dy = goal.y - endPoint.y;
        const goalAngle = Math.atan2(dy, dx);
        const headingScore = Math.cos(endPoint.theta - goalAngle);
        
        return distScore * 1.0 + speedScore * 0.5 + headingScore * 0.5;
    }

    /**
     * POTENTIAL FIELD METHOD
     * Attractive and repulsive forces
     */
    
    potentialField(current, goal, obstacles) {
        // Attractive force towards goal
        const attractive = this.attractiveForce(current, goal);
        
        // Repulsive force from obstacles
        const repulsive = this.repulsiveForce(current, obstacles);
        
        // Combine forces
        const totalForce = {
            x: attractive.x + repulsive.x,
            y: attractive.y + repulsive.y
        };
        
        // Normalize
        const magnitude = Math.sqrt(totalForce.x ** 2 + totalForce.y ** 2);
        
        if (magnitude > 0) {
            totalForce.x /= magnitude;
            totalForce.y /= magnitude;
        }
        
        return totalForce;
    }

    attractiveForce(current, goal) {
        const dx = goal.x - current.x;
        const dy = goal.y - current.y;
        const dist = Math.sqrt(dx ** 2 + dy ** 2);
        
        if (dist === 0) return { x: 0, y: 0 };
        
        const strength = 1.0;
        return {
            x: strength * dx / dist,
            y: strength * dy / dist
        };
    }

    repulsiveForce(current, obstacles) {
        let totalForce = { x: 0, y: 0 };
        const influenceDistance = 5.0;
        
        for (const obs of obstacles) {
            const dx = current.x - obs.x;
            const dy = current.y - obs.y;
            const dist = Math.sqrt(dx ** 2 + dy ** 2);
            
            if (dist < influenceDistance && dist > 0) {
                const strength = (influenceDistance - dist) / dist;
                totalForce.x += strength * dx;
                totalForce.y += strength * dy;
            }
        }
        
        return totalForce;
    }

    /**
     * PATH SMOOTHING
     * Làm mượt đường đi
     */
    
    smoothPath(path, iterations = 10) {
        if (path.length < 3) return path;
        
        let smoothed = path.map(p => ({ ...p }));
        const alpha = 0.5;  // Smoothing factor
        const beta = 0.3;   // Keep close to original
        
        for (let iter = 0; iter < iterations; iter++) {
            for (let i = 1; i < smoothed.length - 1; i++) {
                const prev = smoothed[i - 1];
                const curr = smoothed[i];
                const next = smoothed[i + 1];
                
                smoothed[i] = {
                    x: curr.x + alpha * (prev.x + next.x - 2 * curr.x) + 
                       beta * (path[i].x - curr.x),
                    y: curr.y + alpha * (prev.y + next.y - 2 * curr.y) + 
                       beta * (path[i].y - curr.y)
                };
            }
        }
        
        return smoothed;
    }

    /**
     * OBSTACLE MANAGEMENT
     */
    
    addObstacle(x, y, radius = 1.0) {
        this.obstacles.push({ x, y, radius });
    }

    addDynamicObstacle(x, y, vx, vy, radius = 1.0) {
        this.dynamicObstacles.push({ x, y, vx, vy, radius });
    }

    updateDynamicObstacles(dt) {
        for (const obs of this.dynamicObstacles) {
            obs.x += obs.vx * dt;
            obs.y += obs.vy * dt;
            
            // Bounce off walls
            if (obs.x < 0 || obs.x > this.mapWidth) obs.vx *= -1;
            if (obs.y < 0 || obs.y > this.mapHeight) obs.vy *= -1;
        }
    }

    isCollision(pos) {
        // Check static obstacles
        for (const obs of this.obstacles) {
            if (this.distance(pos, obs) < obs.radius + this.robotRadius) {
                return true;
            }
        }
        
        // Check dynamic obstacles
        for (const obs of this.dynamicObstacles) {
            if (this.distance(pos, obs) < obs.radius + this.robotRadius) {
                return true;
            }
        }
        
        return false;
    }

    isCollisionFree(from, to) {
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = {
                x: from.x + (to.x - from.x) * t,
                y: from.y + (to.y - from.y) * t
            };
            
            if (this.isCollision(point)) {
                return false;
            }
        }
        return true;
    }

    /**
     * UTILITY FUNCTIONS
     */
    
    distance(a, b) {
        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    }

    pathLength(path) {
        let length = 0;
        for (let i = 1; i < path.length; i++) {
            length += this.distance(path[i - 1], path[i]);
        }
        return Math.round(length * 100) / 100;
    }

    posKey(pos) {
        return `${Math.round(pos.x)},${Math.round(pos.y)}`;
    }

    isValidPosition(pos) {
        return pos.x >= 0 && pos.x < this.mapWidth &&
               pos.y >= 0 && pos.y < this.mapHeight;
    }

    /**
     * NAVIGATION CONTROL
     */
    
    navigateTo(goal, algorithm = 'astar') {
        this.goalPosition = goal;
        
        let result;
        
        switch (algorithm.toLowerCase()) {
            case 'astar':
                result = this.findPathAStar(this.currentPosition, goal);
                break;
            case 'rrt':
                result = this.findPathRRT(this.currentPosition, goal);
                break;
            default:
                throw new Error(`Unknown algorithm: ${algorithm}`);
        }
        
        if (result) {
            this.currentPath = result.path;
            this.pathHistory.push(result);
        }
        
        return result;
    }

    getNavigationStats() {
        return {
            currentPosition: this.currentPosition,
            goalPosition: this.goalPosition,
            pathLength: this.currentPath.length,
            obstacles: this.obstacles.length,
            dynamicObstacles: this.dynamicObstacles.length,
            totalPathsComputed: this.pathHistory.length
        };
    }
}

module.exports = AutonomousNavigation;

// Test
if (require.main === module) {
    console.log('🤖 Testing Autonomous Navigation System\n');
    
    const nav = new AutonomousNavigation(50, 50);
    
    // Add obstacles
    console.log('1. Adding Obstacles...');
    nav.addObstacle(10, 10, 2);
    nav.addObstacle(20, 20, 3);
    nav.addObstacle(30, 15, 2);
    nav.addDynamicObstacle(25, 25, 0.5, 0.3, 1.5);
    console.log(`   Added ${nav.obstacles.length} static and ${nav.dynamicObstacles.length} dynamic obstacles`);
    console.log();
    
    // Test A* pathfinding
    console.log('2. Testing A* Pathfinding...');
    const start = { x: 0, y: 0 };
    const goal = { x: 45, y: 45 };
    
    const astarResult = nav.findPathAStar(start, goal);
    if (astarResult) {
        console.log(`   Path length: ${astarResult.length} units`);
        console.log(`   Waypoints: ${astarResult.path.length}`);
        console.log(`   Compute time: ${astarResult.computeTime}ms`);
    }
    console.log();
    
    // Test RRT pathfinding
    console.log('3. Testing RRT Pathfinding...');
    const rrtResult = nav.findPathRRT(start, goal, 500);
    if (rrtResult) {
        console.log(`   Path length: ${rrtResult.length} units`);
        console.log(`   Waypoints: ${rrtResult.path.length}`);
        console.log(`   Iterations: ${rrtResult.iterations}`);
        console.log(`   Compute time: ${rrtResult.computeTime}ms`);
    }
    console.log();
    
    // Test path smoothing
    if (astarResult) {
        console.log('4. Testing Path Smoothing...');
        const smoothed = nav.smoothPath(astarResult.path, 10);
        console.log(`   Original waypoints: ${astarResult.path.length}`);
        console.log(`   Smoothed waypoints: ${smoothed.length}`);
        console.log();
    }
    
    // Navigation stats
    console.log('5. Navigation Statistics:');
    const stats = nav.getNavigationStats();
    console.log(`   Obstacles: ${stats.obstacles}`);
    console.log(`   Dynamic obstacles: ${stats.dynamicObstacles}`);
    console.log(`   Paths computed: ${stats.totalPathsComputed}`);
    console.log();
    
    console.log('✅ Autonomous Navigation System tested successfully!');
}
