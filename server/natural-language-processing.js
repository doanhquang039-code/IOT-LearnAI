/**
 * Natural Language Processing for Robot Control
 * Xử lý ngôn ngữ tự nhiên cho điều khiển robot bằng giọng nói
 */

class NaturalLanguageProcessor {
    constructor() {
        this.commands = new Map();
        this.intents = new Map();
        this.entities = new Map();
        this.conversationHistory = [];
        this.contextWindow = 5;
        
        // Initialize command patterns
        this.initializeCommands();
        this.initializeIntents();
    }

    /**
     * COMMAND PATTERNS
     * Định nghĩa các patterns cho commands
     */
    
    initializeCommands() {
        // Movement commands
        this.commands.set('move', {
            patterns: [
                /move (forward|backward|left|right)/i,
                /go (forward|backward|left|right)/i,
                /drive (forward|backward|left|right)/i,
                /(forward|backward|left|right)/i
            ],
            handler: this.handleMovement.bind(this)
        });
        
        // Speed commands
        this.commands.set('speed', {
            patterns: [
                /speed (\d+)/i,
                /set speed to (\d+)/i,
                /go (faster|slower)/i,
                /(fast|slow|medium) speed/i
            ],
            handler: this.handleSpeed.bind(this)
        });
        
        // Navigation commands
        this.commands.set('navigate', {
            patterns: [
                /go to ([\w\s]+)/i,
                /navigate to ([\w\s]+)/i,
                /move to ([\w\s]+)/i,
                /head to ([\w\s]+)/i
            ],
            handler: this.handleNavigation.bind(this)
        });
        
        // Task commands
        this.commands.set('task', {
            patterns: [
                /pick up ([\w\s]+)/i,
                /grab ([\w\s]+)/i,
                /deliver ([\w\s]+) to ([\w\s]+)/i,
                /bring me ([\w\s]+)/i
            ],
            handler: this.handleTask.bind(this)
        });
        
        // Status commands
        this.commands.set('status', {
            patterns: [
                /what('?s| is) (your|the) (status|state)/i,
                /how are you/i,
                /report status/i,
                /battery level/i
            ],
            handler: this.handleStatus.bind(this)
        });
        
        // Stop commands
        this.commands.set('stop', {
            patterns: [
                /stop/i,
                /halt/i,
                /freeze/i,
                /emergency stop/i
            ],
            handler: this.handleStop.bind(this)
        });
    }

    /**
     * INTENT RECOGNITION
     * Nhận diện ý định từ câu lệnh
     */
    
    initializeIntents() {
        this.intents.set('movement', {
            keywords: ['move', 'go', 'drive', 'forward', 'backward', 'left', 'right'],
            confidence: 0.8
        });
        
        this.intents.set('navigation', {
            keywords: ['navigate', 'go to', 'head to', 'find', 'location'],
            confidence: 0.8
        });
        
        this.intents.set('manipulation', {
            keywords: ['pick', 'grab', 'drop', 'place', 'hold'],
            confidence: 0.7
        });
        
        this.intents.set('query', {
            keywords: ['what', 'where', 'how', 'status', 'report'],
            confidence: 0.9
        });
        
        this.intents.set('emergency', {
            keywords: ['stop', 'halt', 'emergency', 'freeze'],
            confidence: 1.0
        });
    }

    /**
     * MAIN PROCESSING
     * Xử lý câu lệnh chính
     */
    
    processCommand(text) {
        console.log(`🎤 Processing command: "${text}"`);
        
        // Normalize text
        const normalizedText = this.normalizeText(text);
        
        // Extract intent
        const intent = this.extractIntent(normalizedText);
        
        // Extract entities
        const entities = this.extractEntities(normalizedText);
        
        // Match command pattern
        const command = this.matchCommand(normalizedText);
        
        // Store in conversation history
        this.conversationHistory.push({
            text: text,
            normalized: normalizedText,
            intent: intent,
            entities: entities,
            command: command,
            timestamp: Date.now()
        });
        
        // Keep only recent history
        if (this.conversationHistory.length > this.contextWindow) {
            this.conversationHistory.shift();
        }
        
        // Execute command
        if (command) {
            return command.handler(entities, intent);
        }
        
        return {
            success: false,
            message: 'Command not recognized',
            intent: intent,
            entities: entities
        };
    }

    normalizeText(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ');
    }

    extractIntent(text) {
        let bestIntent = null;
        let bestScore = 0;
        
        for (const [intentName, intentData] of this.intents) {
            let score = 0;
            
            for (const keyword of intentData.keywords) {
                if (text.includes(keyword)) {
                    score += intentData.confidence;
                }
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestIntent = intentName;
            }
        }
        
        return {
            name: bestIntent,
            confidence: bestScore
        };
    }

    extractEntities(text) {
        const entities = {
            direction: null,
            location: null,
            object: null,
            speed: null,
            distance: null
        };
        
        // Extract direction
        const directionMatch = text.match(/\b(forward|backward|left|right|north|south|east|west)\b/i);
        if (directionMatch) {
            entities.direction = directionMatch[1].toLowerCase();
        }
        
        // Extract speed
        const speedMatch = text.match(/\b(\d+)\s*(km\/h|mph|m\/s)?\b/i);
        if (speedMatch) {
            entities.speed = parseInt(speedMatch[1]);
        }
        
        // Extract distance
        const distanceMatch = text.match(/\b(\d+)\s*(meters?|m|feet|ft)\b/i);
        if (distanceMatch) {
            entities.distance = parseInt(distanceMatch[1]);
        }
        
        // Extract location (after "to" or "at")
        const locationMatch = text.match(/\b(?:to|at)\s+([\w\s]+?)(?:\s+and|\s+then|$)/i);
        if (locationMatch) {
            entities.location = locationMatch[1].trim();
        }
        
        // Extract object (after "pick up", "grab", etc.)
        const objectMatch = text.match(/\b(?:pick up|grab|get|bring)\s+([\w\s]+?)(?:\s+and|\s+then|$)/i);
        if (objectMatch) {
            entities.object = objectMatch[1].trim();
        }
        
        return entities;
    }

    matchCommand(text) {
        for (const [commandName, commandData] of this.commands) {
            for (const pattern of commandData.patterns) {
                if (pattern.test(text)) {
                    return commandData;
                }
            }
        }
        return null;
    }

    /**
     * COMMAND HANDLERS
     * Xử lý các loại commands
     */
    
    handleMovement(entities, intent) {
        const direction = entities.direction || 'forward';
        const speed = entities.speed || 50;
        const distance = entities.distance || null;
        
        return {
            success: true,
            action: 'move',
            parameters: {
                direction: direction,
                speed: speed,
                distance: distance
            },
            message: `Moving ${direction} at speed ${speed}${distance ? ` for ${distance} meters` : ''}`
        };
    }

    handleSpeed(entities, intent) {
        const speed = entities.speed || 50;
        
        return {
            success: true,
            action: 'set_speed',
            parameters: {
                speed: speed
            },
            message: `Setting speed to ${speed}`
        };
    }

    handleNavigation(entities, intent) {
        const location = entities.location;
        
        if (!location) {
            return {
                success: false,
                message: 'Please specify a location'
            };
        }
        
        return {
            success: true,
            action: 'navigate',
            parameters: {
                destination: location
            },
            message: `Navigating to ${location}`
        };
    }

    handleTask(entities, intent) {
        const object = entities.object;
        const location = entities.location;
        
        if (!object) {
            return {
                success: false,
                message: 'Please specify an object'
            };
        }
        
        return {
            success: true,
            action: 'task',
            parameters: {
                task_type: 'pick_and_place',
                object: object,
                destination: location
            },
            message: `Picking up ${object}${location ? ` and delivering to ${location}` : ''}`
        };
    }

    handleStatus(entities, intent) {
        return {
            success: true,
            action: 'get_status',
            parameters: {},
            message: 'Retrieving robot status'
        };
    }

    handleStop(entities, intent) {
        return {
            success: true,
            action: 'emergency_stop',
            parameters: {},
            message: 'Emergency stop activated'
        };
    }

    /**
     * CONTEXT AWARENESS
     * Sử dụng context từ conversation history
     */
    
    getContext() {
        if (this.conversationHistory.length === 0) {
            return null;
        }
        
        const recentCommands = this.conversationHistory.slice(-3);
        
        return {
            lastCommand: recentCommands[recentCommands.length - 1],
            recentIntents: recentCommands.map(c => c.intent.name),
            recentEntities: recentCommands.map(c => c.entities)
        };
    }

    resolveReference(text) {
        // Resolve pronouns like "it", "there", "that"
        const context = this.getContext();
        
        if (!context) {
            return text;
        }
        
        let resolvedText = text;
        
        // Replace "it" with last mentioned object
        if (text.includes('it')) {
            const lastObject = context.recentEntities
                .reverse()
                .find(e => e.object)?.object;
            
            if (lastObject) {
                resolvedText = resolvedText.replace(/\bit\b/gi, lastObject);
            }
        }
        
        // Replace "there" with last mentioned location
        if (text.includes('there')) {
            const lastLocation = context.recentEntities
                .reverse()
                .find(e => e.location)?.location;
            
            if (lastLocation) {
                resolvedText = resolvedText.replace(/\bthere\b/gi, lastLocation);
            }
        }
        
        return resolvedText;
    }

    /**
     * MULTI-LANGUAGE SUPPORT
     * Hỗ trợ nhiều ngôn ngữ
     */
    
    processVietnamese(text) {
        // Vietnamese command mapping
        const vnCommands = {
            'di thẳng': 'move forward',
            'di lui': 'move backward',
            'rẽ trái': 'turn left',
            'rẽ phải': 'turn right',
            'dừng lại': 'stop',
            'tăng tốc': 'go faster',
            'giảm tốc': 'go slower',
            'đi tới': 'go to',
            'lấy': 'pick up',
            'thả': 'drop',
            'trạng thái': 'status'
        };
        
        let translatedText = text.toLowerCase();
        
        for (const [vn, en] of Object.entries(vnCommands)) {
            translatedText = translatedText.replace(new RegExp(vn, 'gi'), en);
        }
        
        return this.processCommand(translatedText);
    }

    /**
     * VOICE COMMAND PROCESSING
     * Xử lý voice commands với confidence scoring
     */
    
    processVoiceCommand(transcription, confidence) {
        console.log(`🎙️ Voice command: "${transcription}" (confidence: ${confidence})`);
        
        if (confidence < 0.6) {
            return {
                success: false,
                message: 'Low confidence, please repeat',
                confidence: confidence
            };
        }
        
        // Resolve references using context
        const resolvedText = this.resolveReference(transcription);
        
        // Process command
        const result = this.processCommand(resolvedText);
        result.confidence = confidence;
        
        return result;
    }

    /**
     * COMMAND SUGGESTIONS
     * Gợi ý commands dựa trên context
     */
    
    getSuggestions() {
        const context = this.getContext();
        
        if (!context) {
            return [
                'Move forward',
                'Go to charging station',
                'What is your status?'
            ];
        }
        
        const suggestions = [];
        const lastIntent = context.lastCommand.intent.name;
        
        if (lastIntent === 'movement') {
            suggestions.push('Stop', 'Turn left', 'Turn right');
        } else if (lastIntent === 'navigation') {
            suggestions.push('Stop', 'Speed up', 'What is your status?');
        } else if (lastIntent === 'manipulation') {
            suggestions.push('Drop it', 'Move to next location', 'Return home');
        }
        
        return suggestions;
    }

    /**
     * STATISTICS
     */
    
    getStatistics() {
        const totalCommands = this.conversationHistory.length;
        const intentCounts = {};
        
        for (const entry of this.conversationHistory) {
            const intent = entry.intent.name;
            intentCounts[intent] = (intentCounts[intent] || 0) + 1;
        }
        
        return {
            totalCommands: totalCommands,
            intentDistribution: intentCounts,
            averageConfidence: this.conversationHistory.reduce((sum, e) => 
                sum + e.intent.confidence, 0) / totalCommands || 0
        };
    }
}

module.exports = NaturalLanguageProcessor;

// Test
if (require.main === module) {
    console.log('🎤 Testing Natural Language Processing System\n');
    
    const nlp = new NaturalLanguageProcessor();
    
    // Test commands
    const testCommands = [
        'Move forward',
        'Go to charging station',
        'Set speed to 75',
        'Pick up the box',
        'Navigate to warehouse',
        'What is your status?',
        'Stop',
        'Deliver it to room 5',  // Reference resolution
        'Di thẳng',  // Vietnamese
        'Rẽ trái'    // Vietnamese
    ];
    
    console.log('Testing Commands:\n');
    
    for (const command of testCommands) {
        const result = nlp.processCommand(command);
        console.log(`Command: "${command}"`);
        console.log(`Result: ${result.success ? '✅' : '❌'} ${result.message}`);
        if (result.parameters) {
            console.log(`Parameters:`, result.parameters);
        }
        console.log();
    }
    
    // Test voice command
    console.log('Testing Voice Command:');
    const voiceResult = nlp.processVoiceCommand('move forward at speed 80', 0.85);
    console.log(`Voice Result:`, voiceResult);
    console.log();
    
    // Test suggestions
    console.log('Command Suggestions:');
    const suggestions = nlp.getSuggestions();
    console.log(suggestions);
    console.log();
    
    // Statistics
    console.log('Statistics:');
    const stats = nlp.getStatistics();
    console.log(stats);
    console.log();
    
    console.log('✅ NLP System tested successfully!');
}
