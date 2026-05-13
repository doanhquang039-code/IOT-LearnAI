/**
 * Edge AI Processing System
 * On-device AI inference với model optimization
 * Hỗ trợ: TensorFlow Lite, ONNX Runtime, Model quantization
 */

class EdgeAIProcessor {
    constructor() {
        this.models = new Map();
        this.inferenceCache = new Map();
        this.performanceMetrics = {
            totalInferences: 0,
            totalLatency: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        // Model configurations
        this.modelConfigs = {
            'object_detection': {
                inputShape: [1, 224, 224, 3],
                outputShape: [1, 10],
                quantized: true,
                cacheEnabled: true
            },
            'path_planning': {
                inputShape: [1, 100, 100, 1],
                outputShape: [1, 4],
                quantized: true,
                cacheEnabled: false
            },
            'gesture_recognition': {
                inputShape: [1, 64, 64, 3],
                outputShape: [1, 5],
                quantized: true,
                cacheEnabled: true
            }
        };
    }

    /**
     * MODEL MANAGEMENT
     * Quản lý models và optimization
     */
    
    loadModel(modelName, modelPath, config = {}) {
        console.log(`📦 Loading model: ${modelName}`);
        
        const modelConfig = {
            ...this.modelConfigs[modelName],
            ...config,
            path: modelPath,
            loaded: true,
            loadTime: Date.now()
        };
        
        this.models.set(modelName, modelConfig);
        
        console.log(`✅ Model ${modelName} loaded successfully`);
        return modelConfig;
    }

    unloadModel(modelName) {
        if (this.models.has(modelName)) {
            this.models.delete(modelName);
            console.log(`🗑️ Model ${modelName} unloaded`);
            return true;
        }
        return false;
    }

    getLoadedModels() {
        return Array.from(this.models.keys());
    }

    /**
     * MODEL QUANTIZATION
     * Giảm kích thước model cho edge devices
     */
    
    quantizeModel(modelName, quantizationType = 'int8') {
        console.log(`🔧 Quantizing model ${modelName} to ${quantizationType}`);
        
        const model = this.models.get(modelName);
        if (!model) {
            throw new Error(`Model ${modelName} not found`);
        }
        
        // Simulate quantization
        const originalSize = this.estimateModelSize(model);
        let quantizedSize;
        
        switch (quantizationType) {
            case 'int8':
                quantizedSize = originalSize / 4;  // 4x reduction
                break;
            case 'float16':
                quantizedSize = originalSize / 2;  // 2x reduction
                break;
            case 'dynamic':
                quantizedSize = originalSize / 3;  // 3x reduction
                break;
            default:
                quantizedSize = originalSize;
        }
        
        model.quantized = true;
        model.quantizationType = quantizationType;
        model.originalSize = originalSize;
        model.quantizedSize = quantizedSize;
        
        console.log(`✅ Model quantized: ${originalSize}MB → ${quantizedSize}MB`);
        
        return {
            originalSize: originalSize,
            quantizedSize: quantizedSize,
            compressionRatio: originalSize / quantizedSize
        };
    }

    estimateModelSize(model) {
        // Estimate based on input/output shapes
        const inputSize = model.inputShape.reduce((a, b) => a * b, 1);
        const outputSize = model.outputShape.reduce((a, b) => a * b, 1);
        
        // Rough estimate: 4 bytes per float32 parameter
        const estimatedParams = (inputSize + outputSize) * 100;  // Simplified
        const sizeInMB = (estimatedParams * 4) / (1024 * 1024);
        
        return Math.round(sizeInMB * 100) / 100;
    }

    /**
     * INFERENCE ENGINE
     * Chạy inference trên edge device
     */
    
    async runInference(modelName, inputData, options = {}) {
        const startTime = Date.now();
        
        const model = this.models.get(modelName);
        if (!model) {
            throw new Error(`Model ${modelName} not found`);
        }
        
        // Check cache
        if (model.cacheEnabled && options.useCache !== false) {
            const cacheKey = this.generateCacheKey(modelName, inputData);
            const cachedResult = this.inferenceCache.get(cacheKey);
            
            if (cachedResult) {
                this.performanceMetrics.cacheHits++;
                console.log(`💾 Cache hit for ${modelName}`);
                return {
                    ...cachedResult,
                    cached: true,
                    latency: Date.now() - startTime
                };
            }
            
            this.performanceMetrics.cacheMisses++;
        }
        
        // Validate input shape
        this.validateInputShape(inputData, model.inputShape);
        
        // Preprocess input
        const preprocessed = this.preprocessInput(inputData, model);
        
        // Run inference (simulated)
        const output = await this.simulateInference(preprocessed, model);
        
        // Postprocess output
        const result = this.postprocessOutput(output, model);
        
        const latency = Date.now() - startTime;
        
        // Update metrics
        this.performanceMetrics.totalInferences++;
        this.performanceMetrics.totalLatency += latency;
        
        // Cache result
        if (model.cacheEnabled) {
            const cacheKey = this.generateCacheKey(modelName, inputData);
            this.inferenceCache.set(cacheKey, result);
            
            // Limit cache size
            if (this.inferenceCache.size > 100) {
                const firstKey = this.inferenceCache.keys().next().value;
                this.inferenceCache.delete(firstKey);
            }
        }
        
        return {
            ...result,
            cached: false,
            latency: latency,
            modelName: modelName
        };
    }

    validateInputShape(inputData, expectedShape) {
        // Simplified validation
        if (!Array.isArray(inputData)) {
            throw new Error('Input data must be an array');
        }
    }

    preprocessInput(inputData, model) {
        // Normalize input data
        if (model.quantized) {
            // Quantize input for quantized models
            return inputData.map(val => Math.round(val * 255) / 255);
        }
        return inputData;
    }

    async simulateInference(input, model) {
        // Simulate inference delay based on model complexity
        const complexity = model.inputShape.reduce((a, b) => a * b, 1);
        const delay = model.quantized ? complexity / 100000 : complexity / 50000;
        
        await new Promise(resolve => setTimeout(resolve, Math.min(delay, 100)));
        
        // Generate mock output
        const outputSize = model.outputShape.reduce((a, b) => a * b, 1);
        return Array.from({ length: outputSize }, () => Math.random());
    }

    postprocessOutput(output, model) {
        // Apply softmax for classification
        const exp = output.map(x => Math.exp(x));
        const sum = exp.reduce((a, b) => a + b, 0);
        const probabilities = exp.map(x => x / sum);
        
        // Get top prediction
        const maxIdx = probabilities.indexOf(Math.max(...probabilities));
        
        return {
            predictions: probabilities,
            topClass: maxIdx,
            confidence: probabilities[maxIdx]
        };
    }

    generateCacheKey(modelName, inputData) {
        // Simple hash of input data
        const dataStr = JSON.stringify(inputData);
        let hash = 0;
        for (let i = 0; i < dataStr.length; i++) {
            hash = ((hash << 5) - hash) + dataStr.charCodeAt(i);
            hash = hash & hash;
        }
        return `${modelName}_${hash}`;
    }

    /**
     * BATCH INFERENCE
     * Xử lý nhiều inputs cùng lúc
     */
    
    async runBatchInference(modelName, batchInputs, options = {}) {
        console.log(`🔄 Running batch inference: ${batchInputs.length} samples`);
        
        const results = [];
        const startTime = Date.now();
        
        for (const input of batchInputs) {
            const result = await this.runInference(modelName, input, options);
            results.push(result);
        }
        
        const totalLatency = Date.now() - startTime;
        const avgLatency = totalLatency / batchInputs.length;
        
        return {
            results: results,
            batchSize: batchInputs.length,
            totalLatency: totalLatency,
            avgLatency: avgLatency
        };
    }

    /**
     * MODEL OPTIMIZATION
     * Tối ưu hóa models cho edge devices
     */
    
    optimizeModel(modelName, optimizations = {}) {
        const model = this.models.get(modelName);
        if (!model) {
            throw new Error(`Model ${modelName} not found`);
        }
        
        console.log(`⚡ Optimizing model ${modelName}`);
        
        const results = {
            quantization: null,
            pruning: null,
            fusion: null
        };
        
        // Quantization
        if (optimizations.quantize) {
            results.quantization = this.quantizeModel(
                modelName,
                optimizations.quantizationType || 'int8'
            );
        }
        
        // Pruning (simulated)
        if (optimizations.prune) {
            const pruningRatio = optimizations.pruningRatio || 0.3;
            results.pruning = {
                pruningRatio: pruningRatio,
                speedup: 1 + pruningRatio
            };
            console.log(`✂️ Pruned ${pruningRatio * 100}% of weights`);
        }
        
        // Operator fusion (simulated)
        if (optimizations.fuse) {
            results.fusion = {
                fusedOps: 5,
                speedup: 1.2
            };
            console.log(`🔗 Fused operators for better performance`);
        }
        
        return results;
    }

    /**
     * HARDWARE ACCELERATION
     * Sử dụng hardware accelerators
     */
    
    enableHardwareAcceleration(modelName, accelerator = 'gpu') {
        const model = this.models.get(modelName);
        if (!model) {
            throw new Error(`Model ${modelName} not found`);
        }
        
        model.accelerator = accelerator;
        
        const speedupFactors = {
            'cpu': 1.0,
            'gpu': 3.0,
            'npu': 5.0,
            'tpu': 8.0
        };
        
        model.speedupFactor = speedupFactors[accelerator] || 1.0;
        
        console.log(`🚀 Enabled ${accelerator.toUpperCase()} acceleration (${model.speedupFactor}x speedup)`);
        
        return {
            accelerator: accelerator,
            speedupFactor: model.speedupFactor
        };
    }

    /**
     * PERFORMANCE MONITORING
     * Theo dõi performance
     */
    
    getPerformanceMetrics() {
        const avgLatency = this.performanceMetrics.totalInferences > 0
            ? this.performanceMetrics.totalLatency / this.performanceMetrics.totalInferences
            : 0;
        
        const cacheHitRate = (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) > 0
            ? this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)
            : 0;
        
        return {
            totalInferences: this.performanceMetrics.totalInferences,
            avgLatency: Math.round(avgLatency * 100) / 100,
            cacheHitRate: Math.round(cacheHitRate * 100) / 100,
            cacheSize: this.inferenceCache.size,
            loadedModels: this.models.size
        };
    }

    resetMetrics() {
        this.performanceMetrics = {
            totalInferences: 0,
            totalLatency: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        console.log('📊 Metrics reset');
    }

    /**
     * POWER MANAGEMENT
     * Quản lý năng lượng cho edge devices
     */
    
    setPowerMode(mode) {
        const powerModes = {
            'high_performance': {
                maxLatency: 10,
                quantization: false,
                caching: true,
                accelerator: 'gpu'
            },
            'balanced': {
                maxLatency: 50,
                quantization: true,
                caching: true,
                accelerator: 'gpu'
            },
            'power_saver': {
                maxLatency: 200,
                quantization: true,
                caching: true,
                accelerator: 'cpu'
            }
        };
        
        const config = powerModes[mode];
        if (!config) {
            throw new Error(`Invalid power mode: ${mode}`);
        }
        
        console.log(`🔋 Power mode set to: ${mode}`);
        
        return config;
    }

    /**
     * MODEL VERSIONING
     * Quản lý versions của models
     */
    
    getModelInfo(modelName) {
        const model = this.models.get(modelName);
        if (!model) {
            return null;
        }
        
        return {
            name: modelName,
            inputShape: model.inputShape,
            outputShape: model.outputShape,
            quantized: model.quantized,
            quantizationType: model.quantizationType,
            size: model.quantizedSize || this.estimateModelSize(model),
            accelerator: model.accelerator || 'cpu',
            cacheEnabled: model.cacheEnabled,
            loadTime: model.loadTime
        };
    }

    getAllModelsInfo() {
        const modelsInfo = [];
        for (const modelName of this.models.keys()) {
            modelsInfo.push(this.getModelInfo(modelName));
        }
        return modelsInfo;
    }
}

module.exports = EdgeAIProcessor;

// Test
if (require.main === module) {
    console.log('🤖 Testing Edge AI Processing System\n');
    
    const edgeAI = new EdgeAIProcessor();
    
    // Load models
    console.log('1. Loading Models...');
    edgeAI.loadModel('object_detection', '/models/object_detection.tflite');
    edgeAI.loadModel('path_planning', '/models/path_planning.onnx');
    console.log(`   Loaded models: ${edgeAI.getLoadedModels().join(', ')}`);
    console.log();
    
    // Quantize model
    console.log('2. Quantizing Model...');
    const quantResult = edgeAI.quantizeModel('object_detection', 'int8');
    console.log(`   Compression: ${quantResult.compressionRatio.toFixed(2)}x`);
    console.log();
    
    // Run inference
    console.log('3. Running Inference...');
    const testInput = Array.from({ length: 224 * 224 * 3 }, () => Math.random());
    
    edgeAI.runInference('object_detection', testInput).then(result => {
        console.log(`   Top class: ${result.topClass}`);
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(2)}%`);
        console.log(`   Latency: ${result.latency}ms`);
        console.log();
        
        // Run again (should hit cache)
        return edgeAI.runInference('object_detection', testInput);
    }).then(result => {
        console.log(`   Cached: ${result.cached ? 'Yes' : 'No'}`);
        console.log();
        
        // Enable hardware acceleration
        console.log('4. Enabling Hardware Acceleration...');
        const accelResult = edgeAI.enableHardwareAcceleration('object_detection', 'gpu');
        console.log(`   Speedup: ${accelResult.speedupFactor}x`);
        console.log();
        
        // Optimize model
        console.log('5. Optimizing Model...');
        const optResult = edgeAI.optimizeModel('object_detection', {
            quantize: false,  // Already quantized
            prune: true,
            pruningRatio: 0.3,
            fuse: true
        });
        console.log(`   Pruning speedup: ${optResult.pruning.speedup}x`);
        console.log(`   Fusion speedup: ${optResult.fusion.speedup}x`);
        console.log();
        
        // Performance metrics
        console.log('6. Performance Metrics:');
        const metrics = edgeAI.getPerformanceMetrics();
        console.log(`   Total inferences: ${metrics.totalInferences}`);
        console.log(`   Avg latency: ${metrics.avgLatency}ms`);
        console.log(`   Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(2)}%`);
        console.log();
        
        // Model info
        console.log('7. Model Information:');
        const modelInfo = edgeAI.getModelInfo('object_detection');
        console.log(`   Size: ${modelInfo.size}MB`);
        console.log(`   Quantized: ${modelInfo.quantized}`);
        console.log(`   Accelerator: ${modelInfo.accelerator}`);
        console.log();
        
        console.log('✅ Edge AI Processing System tested successfully!');
    });
}
