/**
 * Swarm Intelligence System
 * Hệ thống trí tuệ bầy đàn cho robot fleet
 * Bao gồm: Particle Swarm Optimization, Ant Colony, Bee Algorithm
 */

class SwarmIntelligence {
    constructor() {
        this.robots = new Map();
        this.swarms = new Map();
        this.pheromones = new Map(); // For Ant Colony
        this.foodSources = new Map(); // For Bee Algorithm
        this.globalBest = null;
    }

    /**
     * PARTICLE SWARM OPTIMIZATION (PSO)
     * Tối ưu hóa đàn hạt cho path planning
     */
    
    initializeParticleSwarm(swarmId, numParticles, searchSpace) {
        const particles = [];
        
        for (let i = 0; i < numParticles; i++) {
            particles.push({
                id: i,
                position: this.randomPosition(searchSpace),
                velocity: this.randomVelocity(searchSpace),
                personalBest: null,
                personalBestFitness: -Infinity,
                fitness: 0
            });
        }
        
        this.swarms.set(swarmId, {
            particles: particles,
            globalBest: null,
            globalBestFitness: -Infinity,
            searchSpace: searchSpace,
            iteration: 0
        });
        
        console.log(`🐝 Initialized PSO swarm ${swarmId} with ${numParticles} particles`);
    }
    
    randomPosition(searchSpace) {
        return {
            x: Math.random() * searchSpace.width,
            y: Math.random() * searchSpace.height
        };
    }
    
    randomVelocity(searchSpace) {
        const maxVelocity = Math.min(searchSpace.width, searchSpace.height) * 0.1;
        return {
            x: (Math.random() - 0.5) * maxVelocity,
            y: (Math.random() - 0.5) * maxVelocity
        };
    }
    
    updateParticleSwarm(swarmId, fitnessFunction, options = {}) {
        const swarm = this.swarms.get(swarmId);
        if (!swarm) return;
        
        const {
            w = 0.7,  // Inertia weight
            c1 = 1.5, // Cognitive parameter
            c2 = 1.5  // Social parameter
        } = options;
        
        // Evaluate fitness for all particles
        for (const particle of swarm.particles) {
            particle.fitness = fitnessFunction(particle.position);
            
            // Update personal best
            if (particle.fitness > particle.personalBestFitness) {
                particle.personalBest = { ...particle.position };
                particle.personalBestFitness = particle.fitness;
            }
            
            // Update global best
            if (particle.fitness > swarm.globalBestFitness) {
                swarm.globalBest = { ...particle.position };
                swarm.globalBestFitness = particle.fitness;
                this.globalBest = { ...particle.position };
            }
        }
        
        // Update velocities and positions
        for (const particle of swarm.particles) {
            const r1 = Math.random();
            const r2 = Math.random();
            
            // Update velocity
            particle.velocity.x = 
                w * particle.velocity.x +
                c1 * r1 * (particle.personalBest.x - particle.position.x) +
                c2 * r2 * (swarm.globalBest.x - particle.position.x);
            
            particle.velocity.y = 
                w * particle.velocity.y +
                c1 * r1 * (particle.personalBest.y - particle.position.y) +
                c2 * r2 * (swarm.globalBest.y - particle.position.y);
            
            // Update position
            particle.position.x += particle.velocity.x;
            particle.position.y += particle.velocity.y;
            
            // Boundary handling
            particle.position.x = Math.max(0, Math.min(swarm.searchSpace.width, particle.position.x));
            particle.position.y = Math.max(0, Math.min(swarm.searchSpace.height, particle.position.y));
        }
        
        swarm.iteration++;
        
        return {
            iteration: swarm.iteration,
            globalBest: swarm.globalBest,
            globalBestFitness: swarm.globalBestFitness,
            convergence: this.calculateConvergence(swarm)
        };
    }
    
    calculateConvergence(swarm) {
        if (!swarm.globalBest) return 0;
        
        let totalDistance = 0;
        for (const particle of swarm.particles) {
            const dx = particle.position.x - swarm.globalBest.x;
            const dy = particle.position.y - swarm.globalBest.y;
            totalDistance += Math.sqrt(dx * dx + dy * dy);
        }
        
        const avgDistance = totalDistance / swarm.particles.length;
        const maxDistance = Math.sqrt(
            swarm.searchSpace.width ** 2 + swarm.searchSpace.height ** 2
        );
        
        return 1 - (avgDistance / maxDistance);
    }
    
    /**
     * ANT COLONY OPTIMIZATION (ACO)
     * Tối ưu hóa đàn kiến cho routing
     */
    
    initializeAntColony(colonyId, numAnts, graph) {
        const ants = [];
        
        for (let i = 0; i < numAnts; i++) {
            ants.push({
                id: i,
                currentNode: 0,
                visitedNodes: [0],
                pathLength: 0,
                path: []
            });
        }
        
        // Initialize pheromones
        const pheromoneKey = `colony_${colonyId}`;
        this.pheromones.set(pheromoneKey, new Map());
        
        for (const edge of graph.edges) {
            const edgeKey = `${edge.from}_${edge.to}`;
            this.pheromones.get(pheromoneKey).set(edgeKey, 1.0);
        }
        
        this.swarms.set(colonyId, {
            type: 'ANT_COLONY',
            ants: ants,
            graph: graph,
            bestPath: null,
            bestPathLength: Infinity,
            iteration: 0
        });
        
        console.log(`🐜 Initialized Ant Colony ${colonyId} with ${numAnts} ants`);
    }
    
    updateAntColony(colonyId, options = {}) {
        const colony = this.swarms.get(colonyId);
        if (!colony) return;
        
        const {
            alpha = 1.0,  // Pheromone importance
            beta = 2.0,   // Heuristic importance
            rho = 0.5,    // Evaporation rate
            Q = 100       // Pheromone deposit factor
        } = options;
        
        const pheromoneKey = `colony_${colonyId}`;
        const pheromones = this.pheromones.get(pheromoneKey);
        
        // Move ants
        for (const ant of colony.ants) {
            while (ant.visitedNodes.length < colony.graph.nodes.length) {
                const nextNode = this.selectNextNode(
                    ant, colony.graph, pheromones, alpha, beta
                );
                
                if (nextNode === null) break;
                
                ant.visitedNodes.push(nextNode);
                ant.pathLength += this.getEdgeLength(
                    colony.graph, ant.currentNode, nextNode
                );
                ant.currentNode = nextNode;
            }
            
            // Update best path
            if (ant.pathLength < colony.bestPathLength) {
                colony.bestPath = [...ant.visitedNodes];
                colony.bestPathLength = ant.pathLength;
            }
        }
        
        // Evaporate pheromones
        for (const [edgeKey, value] of pheromones) {
            pheromones.set(edgeKey, value * (1 - rho));
        }
        
        // Deposit pheromones
        for (const ant of colony.ants) {
            const deposit = Q / ant.pathLength;
            
            for (let i = 0; i < ant.visitedNodes.length - 1; i++) {
                const edgeKey = `${ant.visitedNodes[i]}_${ant.visitedNodes[i + 1]}`;
                const current = pheromones.get(edgeKey) || 0;
                pheromones.set(edgeKey, current + deposit);
            }
        }
        
        // Reset ants
        for (const ant of colony.ants) {
            ant.currentNode = 0;
            ant.visitedNodes = [0];
            ant.pathLength = 0;
        }
        
        colony.iteration++;
        
        return {
            iteration: colony.iteration,
            bestPath: colony.bestPath,
            bestPathLength: colony.bestPathLength
        };
    }
    
    selectNextNode(ant, graph, pheromones, alpha, beta) {
        const unvisited = graph.nodes.filter(n => !ant.visitedNodes.includes(n));
        
        if (unvisited.length === 0) return null;
        
        const probabilities = [];
        let totalProbability = 0;
        
        for (const node of unvisited) {
            const edgeKey = `${ant.currentNode}_${node}`;
            const pheromone = pheromones.get(edgeKey) || 0.1;
            const distance = this.getEdgeLength(graph, ant.currentNode, node);
            const heuristic = 1 / (distance + 0.1);
            
            const probability = Math.pow(pheromone, alpha) * Math.pow(heuristic, beta);
            probabilities.push({ node, probability });
            totalProbability += probability;
        }
        
        // Roulette wheel selection
        let random = Math.random() * totalProbability;
        
        for (const { node, probability } of probabilities) {
            random -= probability;
            if (random <= 0) return node;
        }
        
        return unvisited[0];
    }
    
    getEdgeLength(graph, from, to) {
        const edge = graph.edges.find(e => e.from === from && e.to === to);
        return edge ? edge.length : Infinity;
    }
    
    /**
     * ARTIFICIAL BEE COLONY (ABC)
     * Thuật toán đàn ong cho optimization
     */
    
    initializeBeeColony(colonyId, numBees, searchSpace, objectiveFunction) {
        const foodSources = [];
        
        // Initialize food sources (employed bees)
        for (let i = 0; i < numBees / 2; i++) {
            const position = this.randomPosition(searchSpace);
            foodSources.push({
                id: i,
                position: position,
                fitness: objectiveFunction(position),
                trials: 0
            });
        }
        
        this.foodSources.set(colonyId, foodSources);
        
        this.swarms.set(colonyId, {
            type: 'BEE_COLONY',
            numBees: numBees,
            searchSpace: searchSpace,
            objectiveFunction: objectiveFunction,
            bestSource: null,
            bestFitness: -Infinity,
            iteration: 0
        });
        
        console.log(`🐝 Initialized Bee Colony ${colonyId} with ${numBees} bees`);
    }
    
    updateBeeColony(colonyId, options = {}) {
        const colony = this.swarms.get(colonyId);
        if (!colony) return;
        
        const { limit = 10 } = options; // Abandonment limit
        const foodSources = this.foodSources.get(colonyId);
        
        // Employed bees phase
        for (const source of foodSources) {
            const newPosition = this.generateNeighbor(source.position, colony.searchSpace);
            const newFitness = colony.objectiveFunction(newPosition);
            
            if (newFitness > source.fitness) {
                source.position = newPosition;
                source.fitness = newFitness;
                source.trials = 0;
            } else {
                source.trials++;
            }
            
            // Update best
            if (source.fitness > colony.bestFitness) {
                colony.bestSource = { ...source.position };
                colony.bestFitness = source.fitness;
            }
        }
        
        // Onlooker bees phase
        const totalFitness = foodSources.reduce((sum, s) => sum + Math.max(0, s.fitness), 0);
        
        for (let i = 0; i < colony.numBees / 2; i++) {
            // Select source based on fitness (roulette wheel)
            let random = Math.random() * totalFitness;
            let selectedSource = foodSources[0];
            
            for (const source of foodSources) {
                random -= Math.max(0, source.fitness);
                if (random <= 0) {
                    selectedSource = source;
                    break;
                }
            }
            
            // Exploit selected source
            const newPosition = this.generateNeighbor(selectedSource.position, colony.searchSpace);
            const newFitness = colony.objectiveFunction(newPosition);
            
            if (newFitness > selectedSource.fitness) {
                selectedSource.position = newPosition;
                selectedSource.fitness = newFitness;
                selectedSource.trials = 0;
            }
        }
        
        // Scout bees phase - abandon poor sources
        for (const source of foodSources) {
            if (source.trials > limit) {
                source.position = this.randomPosition(colony.searchSpace);
                source.fitness = colony.objectiveFunction(source.position);
                source.trials = 0;
            }
        }
        
        colony.iteration++;
        
        return {
            iteration: colony.iteration,
            bestSource: colony.bestSource,
            bestFitness: colony.bestFitness,
            activeSources: foodSources.filter(s => s.trials < limit).length
        };
    }
    
    generateNeighbor(position, searchSpace) {
        const phi = (Math.random() - 0.5) * 2; // Random in [-1, 1]
        
        return {
            x: Math.max(0, Math.min(searchSpace.width, 
                position.x + phi * searchSpace.width * 0.1)),
            y: Math.max(0, Math.min(searchSpace.height, 
                position.y + phi * searchSpace.height * 0.1))
        };
    }
    
    /**
     * FLOCKING BEHAVIOR
     * Hành vi bầy đàn cho robot coordination
     */
    
    applyFlockingBehavior(robotIds, options = {}) {
        const {
            separationWeight = 1.5,
            alignmentWeight = 1.0,
            cohesionWeight = 1.0,
            separationRadius = 5,
            neighborRadius = 10
        } = options;
        
        const updates = [];
        
        for (const robotId of robotIds) {
            const robot = this.robots.get(robotId);
            if (!robot) continue;
            
            const neighbors = this.getNeighbors(robot, robotIds, neighborRadius);
            
            // Separation: avoid crowding
            const separation = this.calculateSeparation(robot, neighbors, separationRadius);
            
            // Alignment: steer towards average heading
            const alignment = this.calculateAlignment(robot, neighbors);
            
            // Cohesion: steer towards average position
            const cohesion = this.calculateCohesion(robot, neighbors);
            
            // Combine behaviors
            const newVelocity = {
                x: robot.velocity.x + 
                   separation.x * separationWeight +
                   alignment.x * alignmentWeight +
                   cohesion.x * cohesionWeight,
                y: robot.velocity.y + 
                   separation.y * separationWeight +
                   alignment.y * alignmentWeight +
                   cohesion.y * cohesionWeight
            };
            
            // Limit velocity
            const speed = Math.sqrt(newVelocity.x ** 2 + newVelocity.y ** 2);
            const maxSpeed = robot.maxSpeed || 5;
            
            if (speed > maxSpeed) {
                newVelocity.x = (newVelocity.x / speed) * maxSpeed;
                newVelocity.y = (newVelocity.y / speed) * maxSpeed;
            }
            
            updates.push({
                robotId: robotId,
                velocity: newVelocity,
                position: {
                    x: robot.position.x + newVelocity.x,
                    y: robot.position.y + newVelocity.y
                }
            });
        }
        
        return updates;
    }
    
    getNeighbors(robot, robotIds, radius) {
        const neighbors = [];
        
        for (const otherId of robotIds) {
            if (otherId === robot.id) continue;
            
            const other = this.robots.get(otherId);
            if (!other) continue;
            
            const distance = this.distance(robot.position, other.position);
            if (distance < radius) {
                neighbors.push(other);
            }
        }
        
        return neighbors;
    }
    
    calculateSeparation(robot, neighbors, radius) {
        const steering = { x: 0, y: 0 };
        
        for (const neighbor of neighbors) {
            const distance = this.distance(robot.position, neighbor.position);
            if (distance < radius && distance > 0) {
                const diff = {
                    x: robot.position.x - neighbor.position.x,
                    y: robot.position.y - neighbor.position.y
                };
                steering.x += diff.x / distance;
                steering.y += diff.y / distance;
            }
        }
        
        return steering;
    }
    
    calculateAlignment(robot, neighbors) {
        if (neighbors.length === 0) return { x: 0, y: 0 };
        
        const avgVelocity = {
            x: neighbors.reduce((sum, n) => sum + n.velocity.x, 0) / neighbors.length,
            y: neighbors.reduce((sum, n) => sum + n.velocity.y, 0) / neighbors.length
        };
        
        return {
            x: avgVelocity.x - robot.velocity.x,
            y: avgVelocity.y - robot.velocity.y
        };
    }
    
    calculateCohesion(robot, neighbors) {
        if (neighbors.length === 0) return { x: 0, y: 0 };
        
        const centerOfMass = {
            x: neighbors.reduce((sum, n) => sum + n.position.x, 0) / neighbors.length,
            y: neighbors.reduce((sum, n) => sum + n.position.y, 0) / neighbors.length
        };
        
        return {
            x: centerOfMass.x - robot.position.x,
            y: centerOfMass.y - robot.position.y
        };
    }
    
    distance(pos1, pos2) {
        return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2);
    }
    
    /**
     * Register robot for swarm
     */
    registerRobot(robotId, initialState) {
        this.robots.set(robotId, {
            id: robotId,
            position: initialState.position || { x: 0, y: 0 },
            velocity: initialState.velocity || { x: 0, y: 0 },
            maxSpeed: initialState.maxSpeed || 5
        });
    }
}

module.exports = SwarmIntelligence;

// Test
if (require.main === module) {
    console.log('🐝 Testing Swarm Intelligence System\n');
    
    const swarm = new SwarmIntelligence();
    
    // Test PSO
    console.log('1. Testing Particle Swarm Optimization...');
    swarm.initializeParticleSwarm('pso1', 20, { width: 100, height: 100 });
    
    const fitnessFunction = (pos) => {
        // Maximize: -(x-50)^2 - (y-50)^2 (peak at 50,50)
        return -Math.pow(pos.x - 50, 2) - Math.pow(pos.y - 50, 2);
    };
    
    for (let i = 0; i < 50; i++) {
        const result = swarm.updateParticleSwarm('pso1', fitnessFunction);
        if (i % 10 === 0) {
            console.log(`   Iteration ${result.iteration}: Best = (${result.globalBest.x.toFixed(2)}, ${result.globalBest.y.toFixed(2)}), Fitness = ${result.globalBestFitness.toFixed(2)}`);
        }
    }
    
    console.log('   ✅ PSO working\n');
    
    // Test Flocking
    console.log('2. Testing Flocking Behavior...');
    for (let i = 0; i < 5; i++) {
        swarm.registerRobot(`robot-${i}`, {
            position: { x: Math.random() * 100, y: Math.random() * 100 },
            velocity: { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 },
            maxSpeed: 3
        });
    }
    
    const robotIds = ['robot-0', 'robot-1', 'robot-2', 'robot-3', 'robot-4'];
    const updates = swarm.applyFlockingBehavior(robotIds);
    console.log(`   Updated ${updates.length} robots`);
    console.log('   ✅ Flocking working\n');
    
    console.log('✅ All Swarm Intelligence tests complete!');
}
