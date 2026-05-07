"""
AI Robot Brain - Q-Learning Navigation System
Robot học cách điều hướng trong môi trường, tránh vật cản
"""

import numpy as np
import json
import time
import math
import random
import threading
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ==================== ENVIRONMENT ====================
class RobotEnvironment:
    """Môi trường 2D grid cho robot"""
    
    def __init__(self, width=20, height=20):
        self.width = width
        self.height = height
        self.grid = np.zeros((height, width))
        self.obstacles = set()
        self.goal = (width - 2, height - 2)
        self._generate_obstacles()
    
    def _generate_obstacles(self):
        """Sinh ngẫu nhiên chướng ngại vật"""
        random.seed(42)
        obstacle_count = int(self.width * self.height * 0.15)
        for _ in range(obstacle_count):
            x = random.randint(1, self.width - 2)
            y = random.randint(1, self.height - 2)
            # Không đặt obstacle tại start và goal
            if (x, y) not in [(0, 0), (1, 0), (0, 1)] and \
               (x, y) != self.goal and \
               abs(x - self.goal[0]) + abs(y - self.goal[1]) > 2:
                self.obstacles.add((x, y))
                self.grid[y][x] = 1
    
    def is_valid(self, x, y):
        return (0 <= x < self.width and 0 <= y < self.height and 
                (x, y) not in self.obstacles)
    
    def get_state_data(self):
        return {
            'width': self.width,
            'height': self.height,
            'obstacles': list(self.obstacles),
            'goal': self.goal
        }


# ==================== SENSORS ====================
class SensorArray:
    """Mảng cảm biến robot"""
    
    def __init__(self, env):
        self.env = env
        self.noise_level = 0.05
    
    def _add_noise(self, value, max_val=1.0):
        noise = random.gauss(0, self.noise_level)
        return max(0, min(max_val, value + noise))
    
    def ultrasonic(self, x, y, direction):
        """Cảm biến siêu âm - đo khoảng cách"""
        dx, dy = direction
        distance = 0
        cx, cy = x, y
        max_range = 8
        while distance < max_range:
            cx += dx
            cy += dy
            distance += 1
            if not (0 <= cx < self.env.width and 0 <= cy < self.env.height):
                break
            if (cx, cy) in self.env.obstacles:
                break
        return self._add_noise(distance / max_range)
    
    def get_all_readings(self, x, y, heading):
        """Lấy tất cả dữ liệu cảm biến"""
        directions = [(0,-1), (1,0), (0,1), (-1,0)]  # N, E, S, W
        
        ultrasonic_readings = [
            self.ultrasonic(x, y, d) for d in directions
        ]
        
        goal_dx = self.env.goal[0] - x
        goal_dy = self.env.goal[1] - y
        goal_dist = math.sqrt(goal_dx**2 + goal_dy**2)
        goal_angle = math.atan2(goal_dy, goal_dx)
        
        battery = self._add_noise(0.85, 1.0)
        temperature = 25 + random.gauss(0, 2)
        
        return {
            'ultrasonic_n': round(ultrasonic_readings[0], 3),
            'ultrasonic_e': round(ultrasonic_readings[1], 3),
            'ultrasonic_s': round(ultrasonic_readings[2], 3),
            'ultrasonic_w': round(ultrasonic_readings[3], 3),
            'goal_distance': round(goal_dist, 2),
            'goal_angle': round(math.degrees(goal_angle), 1),
            'battery': round(battery, 2),
            'temperature': round(temperature, 1),
            'heading': heading,
            'position': {'x': x, 'y': y}
        }


# ==================== Q-LEARNING AI BRAIN ====================
class QLearningBrain:
    """AI Brain sử dụng Q-Learning"""
    
    def __init__(self, state_size, action_size):
        self.state_size = state_size
        self.action_size = action_size
        self.q_table = {}
        
        # Hyperparameters
        self.learning_rate = 0.1
        self.discount_factor = 0.95
        self.epsilon = 1.0          # Exploration rate
        self.epsilon_decay = 0.995
        self.epsilon_min = 0.01
        
        self.total_reward = 0
        self.episode = 0
        self.steps = 0
        self.success_count = 0
        self.training_history = []
        self.load_brain()

    def save_brain(self):
        """Lưu Q-table vào file"""
        try:
            # Chuyển tuple keys thành string để lưu JSON
            serializable_q = {str(k): v.tolist() for k, v in self.q_table.items()}
            with open('brain_memory.json', 'w') as f:
                json.dump(serializable_q, f)
            print("💾 Đã lưu bộ não AI vào brain_memory.json")
        except Exception as e:
            print(f"❌ Lỗi khi lưu bộ não: {e}")

    def load_brain(self):
        """Tải Q-table từ file"""
        try:
            import os
            if os.path.exists('brain_memory.json'):
                with open('brain_memory.json', 'r') as f:
                    data = json.load(f)
                # Khôi phục lại Q-table
                for k, v in data.items():
                    key = eval(k) # Convert string back to tuple
                    self.q_table[key] = np.array(v)
                print(f"🧠 Đã tải bộ não AI ({len(self.q_table)} states)")
        except Exception as e:
            print(f"⚠️ Không thể tải bộ não cũ, khởi tạo mới: {e}")
    
    def get_state_key(self, x, y, sensors):
        """Chuyển state thành key cho Q-table"""
        # Discretize sensor readings
        us_n = int(sensors['ultrasonic_n'] * 4)
        us_e = int(sensors['ultrasonic_e'] * 4)
        us_s = int(sensors['ultrasonic_s'] * 4)
        us_w = int(sensors['ultrasonic_w'] * 4)
        goal_sector = int((sensors['goal_angle'] + 180) / 45)
        return (x, y, us_n, us_e, us_s, us_w, goal_sector)
    
    def get_q_values(self, state_key):
        if state_key not in self.q_table:
            self.q_table[state_key] = np.zeros(self.action_size)
        return self.q_table[state_key]
    
    def choose_action(self, state_key):
        """Epsilon-greedy policy"""
        if random.random() < self.epsilon:
            return random.randint(0, self.action_size - 1)
        q_values = self.get_q_values(state_key)
        return int(np.argmax(q_values))
    
    def learn(self, state, action, reward, next_state, done):
        """Cập nhật Q-table"""
        current_q = self.get_q_values(state)[action]
        
        if done:
            target_q = reward
        else:
            next_q = np.max(self.get_q_values(next_state))
            target_q = reward + self.discount_factor * next_q
        
        self.q_table[state][action] += self.learning_rate * (target_q - current_q)
        
        # Decay epsilon
        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay
        
        self.total_reward += reward
        self.steps += 1
    
    def get_brain_stats(self):
        return {
            'episode': self.episode,
            'steps': self.steps,
            'epsilon': round(self.epsilon, 4),
            'total_reward': round(self.total_reward, 2),
            'q_table_size': len(self.q_table),
            'success_count': self.success_count,
            'learning_rate': self.learning_rate,
            'training_history': self.training_history[-20:]
        }


# ==================== ROBOT ====================
class AIRobot:
    """Robot AI chính"""
    
    ACTIONS = [(0, -1), (1, 0), (0, 1), (-1, 0)]  # N, E, S, W
    ACTION_NAMES = ['NORTH', 'EAST', 'SOUTH', 'WEST']
    
    def __init__(self):
        self.env = RobotEnvironment(20, 20)
        self.sensors = SensorArray(self.env)
        self.brain = QLearningBrain(
            state_size=7,
            action_size=4
        )
        
        self.x = 0
        self.y = 0
        self.heading = 'NORTH'
        self.alive = True
        self.episode_steps = 0
        self.max_steps = 200
        self.status = 'IDLE'
        self.last_action = None
        self.last_reward = 0
        self.path_history = []
        self.is_running = False
        self._lock = threading.Lock()
    
    def reset(self):
        """Reset robot về vị trí ban đầu"""
        with self._lock:
            self.x = 0
            self.y = 0
            self.heading = 'NORTH'
            self.episode_steps = 0
            self.path_history = [(0, 0)]
            self.brain.episode += 1
            self.status = 'EXPLORING'
    
    def step(self):
        """Thực hiện một bước"""
        with self._lock:
            sensor_data = self.sensors.get_all_readings(self.x, self.y, self.heading)
            state_key = self.brain.get_state_key(self.x, self.y, sensor_data)
            
            action_idx = self.brain.choose_action(state_key)
            self.last_action = self.ACTION_NAMES[action_idx]
            
            dx, dy = self.ACTIONS[action_idx]
            new_x = self.x + dx
            new_y = self.y + dy
            
            # Tính reward
            if not self.env.is_valid(new_x, new_y):
                reward = -10  # Đâm vào tường/vật cản
                new_x, new_y = self.x, self.y
                self.status = 'COLLISION_AVOIDED'
            elif (new_x, new_y) == self.env.goal:
                reward = 100  # Đạt mục tiêu!
                self.x, self.y = new_x, new_y
                self.brain.success_count += 1
                self.status = 'GOAL_REACHED'
                
                # Log success
                self.brain.training_history.append({
                    'episode': self.brain.episode,
                    'steps': self.episode_steps,
                    'reward': reward,
                    'success': True
                })
                
                self.path_history.append((self.x, self.y))
                next_sensor = self.sensors.get_all_readings(self.x, self.y, self.heading)
                next_state = self.brain.get_state_key(self.x, self.y, next_sensor)
                self.brain.learn(state_key, action_idx, reward, next_state, done=True)
                self.last_reward = reward
                return True
            else:
                # Reward dựa trên khoảng cách đến goal
                old_dist = math.sqrt((self.x - self.env.goal[0])**2 + (self.y - self.env.goal[1])**2)
                new_dist = math.sqrt((new_x - self.env.goal[0])**2 + (new_y - self.env.goal[1])**2)
                reward = (old_dist - new_dist) * 2 - 0.1  # Khuyến khích tiến gần goal
                self.x, self.y = new_x, new_y
                self.status = 'EXPLORING'
            
            self.path_history.append((self.x, self.y))
            if len(self.path_history) > 50:
                self.path_history = self.path_history[-50:]
            
            next_sensor = self.sensors.get_all_readings(self.x, self.y, self.heading)
            next_state = self.brain.get_state_key(self.x, self.y, next_sensor)
            self.brain.learn(state_key, action_idx, reward, next_state, done=False)
            
            self.last_reward = reward
            self.episode_steps += 1
            
            # Timeout
            if self.episode_steps >= self.max_steps:
                self.brain.training_history.append({
                    'episode': self.brain.episode,
                    'steps': self.episode_steps,
                    'reward': self.brain.total_reward,
                    'success': False
                })
                return True  # End episode
            
            return False
    
    def run_episode(self):
        """Chạy một episode"""
        self.reset()
        done = False
        while not done and self.is_running:
            done = self.step()
            time.sleep(0.05)
    
    def start_training(self):
        """Bắt đầu training"""
        self.is_running = True
        def training_loop():
            while self.is_running:
                self.run_episode()
        
        t = threading.Thread(target=training_loop, daemon=True)
        t.start()
    
    def stop_training(self):
        self.is_running = False
        self.status = 'IDLE'
    
    def get_full_state(self):
        """Trả về toàn bộ state cho API"""
        with self._lock:
            sensor_data = self.sensors.get_all_readings(self.x, self.y, self.heading)
            return {
                'robot': {
                    'x': self.x,
                    'y': self.y,
                    'heading': self.heading,
                    'status': self.status,
                    'last_action': self.last_action,
                    'last_reward': round(self.last_reward, 3),
                    'episode_steps': self.episode_steps,
                    'is_running': self.is_running,
                    'path_history': self.path_history[-20:]
                },
                'sensors': sensor_data,
                'brain': self.brain.get_brain_stats(),
                'environment': self.env.get_state_data(),
                'timestamp': time.time()
            }


# ==================== ROBOT INSTANCE ====================
robot = AIRobot()


# ==================== API ROUTES ====================
@app.route('/api/environment/obstacle', methods=['POST'])
def toggle_obstacle():
    data = request.get_json()
    x, y = data.get('x'), data.get('y')
    if 0 <= x < robot.env.width and 0 <= y < robot.env.height:
        if (x, y) in robot.env.obstacles:
            robot.env.obstacles.remove((x, y))
            robot.env.grid[y][x] = 0
        else:
            robot.env.obstacles.add((x, y))
            robot.env.grid[y][x] = 1
        return jsonify({'status': 'success', 'obstacles': list(robot.env.obstacles)})
    return jsonify({'status': 'error', 'message': 'Vị trí không hợp lệ'}), 400

@app.route('/api/brain/save', methods=['POST'])
def save_brain_api():
    robot.brain.save_brain()
    return jsonify({'status': 'saved'})

@app.route('/api/state', methods=['GET'])
def get_state():
    return jsonify(robot.get_full_state())

@app.route('/api/start', methods=['POST'])
def start_robot():
    if not robot.is_running:
        robot.start_training()
        return jsonify({'status': 'started', 'message': 'Robot AI đang học...'})
    return jsonify({'status': 'already_running'})

@app.route('/api/stop', methods=['POST'])
def stop_robot():
    robot.stop_training()
    return jsonify({'status': 'stopped'})

@app.route('/api/reset', methods=['POST'])
def reset_robot():
    robot.stop_training()
    robot.__init__()
    return jsonify({'status': 'reset', 'message': 'Robot đã được reset'})

@app.route('/api/environment', methods=['GET'])
def get_environment():
    return jsonify(robot.env.get_state_data())

@app.route('/api/brain', methods=['GET'])
def get_brain():
    return jsonify(robot.brain.get_brain_stats())

@app.route('/api/command', methods=['POST'])
def manual_command():
    """Điều khiển robot thủ công"""
    data = request.get_json()
    action = data.get('action', '').upper()
    
    action_map = {'NORTH': 0, 'EAST': 1, 'SOUTH': 2, 'WEST': 3}
    if action in action_map:
        robot.stop_training()
        time.sleep(0.1)
        
        action_idx = action_map[action]
        dx, dy = robot.ACTIONS[action_idx]
        new_x = robot.x + dx
        new_y = robot.y + dy
        
        if robot.env.is_valid(new_x, new_y):
            robot.x, robot.y = new_x, new_y
            robot.last_action = action
            robot.status = 'MANUAL_CONTROL'
            return jsonify({'status': 'moved', 'x': robot.x, 'y': robot.y})
        else:
            return jsonify({'status': 'blocked', 'message': 'Có vật cản!'})
    
    return jsonify({'status': 'error', 'message': 'Lệnh không hợp lệ'})

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'online', 'robot': 'AI Robot IoT v1.0'})


if __name__ == '__main__':
    print("🤖 AI Robot Brain đang khởi động...")
    print("📡 API Server: http://localhost:5000")
    print("📊 Endpoints: /api/state, /api/start, /api/stop, /api/reset")
    app.run(host='0.0.0.0', port=5000, debug=False)
