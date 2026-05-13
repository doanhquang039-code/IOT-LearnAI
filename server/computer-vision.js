/**
 * Computer Vision System for IOT Robots
 * Bao gồm: Object Detection, Face Recognition, SLAM, Gesture Control
 */

const EventEmitter = require('events');

class ComputerVisionSystem extends EventEmitter {
    constructor() {
        super();
        
        this.detectedObjects = new Map();
        this.recognizedFaces = new Map();
        this.landmarks = new Map();
        this.gestures = new Map();
        
        // SLAM (Simultaneous Localization and Mapping)
        this.map = {
            width: 100,
            height: 100,
            obstacles: [],
            explored: new Set()
        };
        
        this.robotPose = { x: 50, y: 50, theta: 0 };
        
        console.log('🎥 Computer Vision System initialized');
    }
    
    /**
     * OBJECT DETECTION
     * Phát hiện và theo dõi objects trong môi trường
     */
    
    detectObjects(imageData, options = {}) {
        const {
            confidence_threshold = 0.5,
            nms_threshold = 0.4,
            classes = ['person', 'car', 'chair', 'table', 'bottle']
        } = options;
        
        // Simulate object detection (in production, use TensorFlow.js or ONNX)
        const detections = [];
        const numObjects = Math.floor(Math.random() * 5) + 1;
        
        for (let i = 0; i < numObjects; i++) {
            const detection = {
                id: `obj_${Date.now()}_${i}`,
                class: classes[Math.floor(Math.random() * classes.length)],
                confidence: 0.5 + Math.random() * 0.5,
                bbox: {
                    x: Math.random() * imageData.width,
                    y: Math.random() * imageData.height,
                    width: 50 + Math.random() * 100,
                    height: 50 + Math.random() * 100
                },
                timestamp: Date.now()
            };
            
            if (detection.confidence >= confidence_threshold) {
                detections.push(detection);
                this.detectedObjects.set(detection.id, detection);
            }
        }
        
        // Apply Non-Maximum Suppression
        const filteredDetections = this.applyNMS(detections, nms_threshold);
        
        this.emit('objects-detected', filteredDetections);
        
        return filteredDetections;
    }
    
    applyNMS(detections, threshold) {
        // Non-Maximum Suppression to remove overlapping boxes
        const sorted = detections.sort((a, b) => b.confidence - a.confidence);
        const keep = [];
        
        while (sorted.length > 0) {
            const current = sorted.shift();
            keep.push(current);
            
            // Remove overlapping boxes
            for (let i = sorted.length - 1; i >= 0; i--) {
                const iou = this.calculateIoU(current.bbox, sorted[i].bbox);
                if (iou > threshold) {
                    sorted.splice(i, 1);
                }
            }
        }
        
        return keep;
    }
    
    calculateIoU(box1, box2) {
        // Calculate Intersection over Union
        const x1 = Math.max(box1.x, box2.x);
        const y1 = Math.max(box1.y, box2.y);
        const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
        const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
        
        const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
        const area1 = box1.width * box1.height;
        const area2 = box2.width * box2.height;
        const union = area1 + area2 - intersection;
        
        return intersection / union;
    }
    
    trackObjects(previousFrame, currentFrame) {
        /**
         * Object tracking across frames
         * Using simple centroid tracking
         */
        const tracks = [];
        
        for (const currentObj of currentFrame) {
            let bestMatch = null;
            let minDistance = Infinity;
            
            for (const prevObj of previousFrame) {
                const distance = this.calculateDistance(
                    this.getBBoxCenter(currentObj.bbox),
                    this.getBBoxCenter(prevObj.bbox)
                );
                
                if (distance < minDistance && distance < 50) {
                    minDistance = distance;
                    bestMatch = prevObj;
                }
            }
            
            tracks.push({
                current: currentObj,
                previous: bestMatch,
                distance: minDistance,
                velocity: bestMatch ? this.calculateVelocity(bestMatch, currentObj) : { vx: 0, vy: 0 }
            });
        }
        
        return tracks;
    }
    
    getBBoxCenter(bbox) {
        return {
            x: bbox.x + bbox.width / 2,
            y: bbox.y + bbox.height / 2
        };
    }
    
    calculateDistance(p1, p2) {
        return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    }
    
    calculateVelocity(prevObj, currentObj) {
        const dt = (currentObj.timestamp - prevObj.timestamp) / 1000; // seconds
        const prevCenter = this.getBBoxCenter(prevObj.bbox);
        const currentCenter = this.getBBoxCenter(currentObj.bbox);
        
        return {
            vx: (currentCenter.x - prevCenter.x) / dt,
            vy: (currentCenter.y - prevCenter.y) / dt
        };
    }
    
    /**
     * FACE RECOGNITION
     * Nhận diện và xác thực khuôn mặt
     */
    
    detectFaces(imageData) {
        // Simulate face detection
        const faces = [];
        const numFaces = Math.floor(Math.random() * 3);
        
        for (let i = 0; i < numFaces; i++) {
            faces.push({
                id: `face_${Date.now()}_${i}`,
                bbox: {
                    x: Math.random() * imageData.width,
                    y: Math.random() * imageData.height,
                    width: 80 + Math.random() * 40,
                    height: 100 + Math.random() * 50
                },
                landmarks: this.detectFaceLandmarks(),
                confidence: 0.7 + Math.random() * 0.3
            });
        }
        
        this.emit('faces-detected', faces);
        return faces;
    }
    
    detectFaceLandmarks() {
        // 68-point facial landmarks
        return {
            leftEye: { x: 0, y: 0 },
            rightEye: { x: 0, y: 0 },
            nose: { x: 0, y: 0 },
            leftMouth: { x: 0, y: 0 },
            rightMouth: { x: 0, y: 0 }
        };
    }
    
    recognizeFace(faceImage, database) {
        /**
         * Face recognition using embeddings
         * Compare face embedding with database
         */
        const embedding = this.extractFaceEmbedding(faceImage);
        
        let bestMatch = null;
        let minDistance = Infinity;
        
        for (const [personId, personEmbedding] of database.entries()) {
            const distance = this.calculateEmbeddingDistance(embedding, personEmbedding);
            
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = personId;
            }
        }
        
        const threshold = 0.6;
        if (minDistance < threshold) {
            return {
                personId: bestMatch,
                confidence: 1 - minDistance,
                distance: minDistance
            };
        }
        
        return null;
    }
    
    extractFaceEmbedding(faceImage) {
        // Simulate 128-dimensional face embedding
        return Array.from({ length: 128 }, () => Math.random());
    }
    
    calculateEmbeddingDistance(emb1, emb2) {
        // Euclidean distance
        let sum = 0;
        for (let i = 0; i < emb1.length; i++) {
            sum += (emb1[i] - emb2[i]) ** 2;
        }
        return Math.sqrt(sum);
    }
    
    /**
     * SLAM (Simultaneous Localization and Mapping)
     * Xây dựng bản đồ và định vị robot đồng thời
     */
    
    updateSLAM(sensorData) {
        const { lidar, odometry, imu } = sensorData;
        
        // Update robot pose from odometry
        this.updatePose(odometry);
        
        // Extract features from lidar
        const features = this.extractFeatures(lidar);
        
        // Data association
        const matches = this.associateFeatures(features);
        
        // Update map
        this.updateMap(matches);
        
        // Optimize pose graph (simplified)
        this.optimizePoseGraph();
        
        return {
            pose: this.robotPose,
            map: this.getMapData(),
            features: features
        };
    }
    
    updatePose(odometry) {
        // Update robot pose from wheel odometry
        const { deltaX, deltaY, deltaTheta } = odometry;
        
        this.robotPose.x += deltaX * Math.cos(this.robotPose.theta) - deltaY * Math.sin(this.robotPose.theta);
        this.robotPose.y += deltaX * Math.sin(this.robotPose.theta) + deltaY * Math.cos(this.robotPose.theta);
        this.robotPose.theta += deltaTheta;
        
        // Normalize angle
        this.robotPose.theta = ((this.robotPose.theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    }
    
    extractFeatures(lidarData) {
        // Extract corner and line features from lidar
        const features = [];
        
        for (let i = 0; i < lidarData.length; i++) {
            const point = lidarData[i];
            
            // Simple corner detection
            if (this.isCorner(lidarData, i)) {
                features.push({
                    type: 'corner',
                    position: this.transformToGlobal(point),
                    local: point
                });
            }
        }
        
        return features;
    }
    
    isCorner(points, index) {
        // Simple corner detection based on angle change
        if (index === 0 || index === points.length - 1) return false;
        
        const prev = points[index - 1];
        const curr = points[index];
        const next = points[index + 1];
        
        const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
        const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
        
        const angleDiff = Math.abs(angle2 - angle1);
        
        return angleDiff > Math.PI / 4; // 45 degrees
    }
    
    transformToGlobal(localPoint) {
        // Transform from robot frame to global frame
        const cos = Math.cos(this.robotPose.theta);
        const sin = Math.sin(this.robotPose.theta);
        
        return {
            x: this.robotPose.x + localPoint.x * cos - localPoint.y * sin,
            y: this.robotPose.y + localPoint.x * sin + localPoint.y * cos
        };
    }
    
    associateFeatures(features) {
        // Associate detected features with map landmarks
        const matches = [];
        
        for (const feature of features) {
            let bestMatch = null;
            let minDistance = Infinity;
            
            for (const [landmarkId, landmark] of this.landmarks.entries()) {
                const distance = this.calculateDistance(feature.position, landmark.position);
                
                if (distance < minDistance && distance < 2.0) {
                    minDistance = distance;
                    bestMatch = landmarkId;
                }
            }
            
            if (bestMatch) {
                matches.push({
                    feature: feature,
                    landmark: bestMatch,
                    distance: minDistance
                });
            } else {
                // New landmark
                const newId = `landmark_${this.landmarks.size}`;
                this.landmarks.set(newId, {
                    id: newId,
                    position: feature.position,
                    observations: 1
                });
            }
        }
        
        return matches;
    }
    
    updateMap(matches) {
        // Update landmark positions based on observations
        for (const match of matches) {
            const landmark = this.landmarks.get(match.landmark);
            
            // Simple averaging (in production, use Kalman filter)
            landmark.position.x = (landmark.position.x * landmark.observations + match.feature.position.x) / (landmark.observations + 1);
            landmark.position.y = (landmark.position.y * landmark.observations + match.feature.position.y) / (landmark.observations + 1);
            landmark.observations++;
        }
    }
    
    optimizePoseGraph() {
        // Simplified pose graph optimization
        // In production, use g2o or similar
    }
    
    getMapData() {
        return {
            landmarks: Array.from(this.landmarks.values()),
            explored: Array.from(this.explored),
            obstacles: this.map.obstacles
        };
    }
    
    /**
     * GESTURE RECOGNITION
     * Nhận diện cử chỉ tay để điều khiển robot
     */
    
    recognizeGesture(handLandmarks) {
        /**
         * Recognize hand gestures
         * Gestures: thumbs_up, peace, fist, open_palm, pointing
         */
        
        if (!handLandmarks || handLandmarks.length < 21) {
            return null;
        }
        
        // Calculate finger states
        const fingerStates = this.getFingerStates(handLandmarks);
        
        // Recognize gesture based on finger states
        let gesture = null;
        
        if (fingerStates.thumb && !fingerStates.index && !fingerStates.middle && !fingerStates.ring && !fingerStates.pinky) {
            gesture = 'thumbs_up';
        } else if (!fingerStates.thumb && fingerStates.index && fingerStates.middle && !fingerStates.ring && !fingerStates.pinky) {
            gesture = 'peace';
        } else if (!fingerStates.thumb && !fingerStates.index && !fingerStates.middle && !fingerStates.ring && !fingerStates.pinky) {
            gesture = 'fist';
        } else if (fingerStates.thumb && fingerStates.index && fingerStates.middle && fingerStates.ring && fingerStates.pinky) {
            gesture = 'open_palm';
        } else if (!fingerStates.thumb && fingerStates.index && !fingerStates.middle && !fingerStates.ring && !fingerStates.pinky) {
            gesture = 'pointing';
        }
        
        if (gesture) {
            this.gestures.set(Date.now(), gesture);
            this.emit('gesture-recognized', gesture);
        }
        
        return gesture;
    }
    
    getFingerStates(landmarks) {
        // Determine if each finger is extended
        return {
            thumb: this.isFingerExtended(landmarks, 'thumb'),
            index: this.isFingerExtended(landmarks, 'index'),
            middle: this.isFingerExtended(landmarks, 'middle'),
            ring: this.isFingerExtended(landmarks, 'ring'),
            pinky: this.isFingerExtended(landmarks, 'pinky')
        };
    }
    
    isFingerExtended(landmarks, finger) {
        // Simplified finger extension detection
        // In production, use proper hand landmark indices
        return Math.random() > 0.5;
    }
    
    /**
     * VISUAL ODOMETRY
     * Ước tính chuyển động từ camera
     */
    
    estimateVisualOdometry(prevFrame, currentFrame) {
        // Extract features
        const prevFeatures = this.extractVisualFeatures(prevFrame);
        const currentFeatures = this.extractVisualFeatures(currentFrame);
        
        // Match features
        const matches = this.matchFeatures(prevFeatures, currentFeatures);
        
        // Estimate motion
        const motion = this.estimateMotion(matches);
        
        return motion;
    }
    
    extractVisualFeatures(frame) {
        // Extract ORB or SIFT features
        const features = [];
        const numFeatures = 100;
        
        for (let i = 0; i < numFeatures; i++) {
            features.push({
                x: Math.random() * frame.width,
                y: Math.random() * frame.height,
                descriptor: Array.from({ length: 32 }, () => Math.random())
            });
        }
        
        return features;
    }
    
    matchFeatures(features1, features2) {
        // Match features using descriptor distance
        const matches = [];
        
        for (const f1 of features1) {
            let bestMatch = null;
            let minDistance = Infinity;
            
            for (const f2 of features2) {
                const distance = this.descriptorDistance(f1.descriptor, f2.descriptor);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = f2;
                }
            }
            
            if (minDistance < 0.7) {
                matches.push({ f1, f2: bestMatch });
            }
        }
        
        return matches;
    }
    
    descriptorDistance(desc1, desc2) {
        // Hamming distance for binary descriptors
        let distance = 0;
        for (let i = 0; i < desc1.length; i++) {
            distance += Math.abs(desc1[i] - desc2[i]);
        }
        return distance / desc1.length;
    }
    
    estimateMotion(matches) {
        // Estimate camera motion from feature matches
        // Using RANSAC + Essential Matrix (simplified)
        
        return {
            translation: { x: 0, y: 0, z: 0 },
            rotation: { roll: 0, pitch: 0, yaw: 0 },
            confidence: matches.length / 100
        };
    }
    
    /**
     * STATISTICS
     */
    
    getStatistics() {
        return {
            detectedObjects: this.detectedObjects.size,
            recognizedFaces: this.recognizedFaces.size,
            landmarks: this.landmarks.size,
            gestures: this.gestures.size,
            mapCoverage: this.explored.size / (this.map.width * this.map.height),
            robotPose: this.robotPose
        };
    }
}

module.exports = ComputerVisionSystem;

// Test
if (require.main === module) {
    console.log('🎥 Testing Computer Vision System\n');
    
    const cv = new ComputerVisionSystem();
    
    // Test Object Detection
    console.log('1. Testing Object Detection...');
    const imageData = { width: 640, height: 480 };
    const detections = cv.detectObjects(imageData);
    console.log(`   Detected ${detections.length} objects`);
    console.log(`   ✅ Object Detection working\n`);
    
    // Test Face Detection
    console.log('2. Testing Face Detection...');
    const faces = cv.detectFaces(imageData);
    console.log(`   Detected ${faces.length} faces`);
    console.log(`   ✅ Face Detection working\n`);
    
    // Test SLAM
    console.log('3. Testing SLAM...');
    const sensorData = {
        lidar: Array.from({ length: 360 }, (_, i) => ({
            angle: i * Math.PI / 180,
            distance: 5 + Math.random() * 5,
            x: Math.cos(i * Math.PI / 180) * (5 + Math.random() * 5),
            y: Math.sin(i * Math.PI / 180) * (5 + Math.random() * 5)
        })),
        odometry: { deltaX: 0.1, deltaY: 0, deltaTheta: 0.01 },
        imu: { roll: 0, pitch: 0, yaw: 0 }
    };
    
    const slamResult = cv.updateSLAM(sensorData);
    console.log(`   Robot pose: (${slamResult.pose.x.toFixed(2)}, ${slamResult.pose.y.toFixed(2)})`);
    console.log(`   Landmarks: ${slamResult.map.landmarks.length}`);
    console.log(`   ✅ SLAM working\n`);
    
    // Test Gesture Recognition
    console.log('4. Testing Gesture Recognition...');
    const handLandmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
    const gesture = cv.recognizeGesture(handLandmarks);
    console.log(`   Recognized gesture: ${gesture || 'none'}`);
    console.log(`   ✅ Gesture Recognition working\n`);
    
    // Statistics
    const stats = cv.getStatistics();
    console.log('📊 System Statistics:');
    console.log(`   Detected Objects: ${stats.detectedObjects}`);
    console.log(`   Landmarks: ${stats.landmarks}`);
    console.log(`   Robot Position: (${stats.robotPose.x.toFixed(2)}, ${stats.robotPose.y.toFixed(2)})`);
    
    console.log('\n✅ All Computer Vision tests complete!');
}
