# 🤖 AI Robot IoT System

Hệ thống Robot Trí Tuệ Nhân Tạo với IoT Dashboard real-time.

## Tính năng
- AI Brain với Q-Learning tự học điều hướng
- Simulation môi trường 2D với chướng ngại vật
- Sensor Fusion (Ultrasonic, Camera, Gyroscope, GPS)
- Web Dashboard real-time cực đẹp
- REST API quản lý fleet robot
- WebSocket cho dữ liệu live

## Cài đặt

### Backend (Node.js)
```bash
cd server
npm install
node app.js
```

### AI Brain (Python)
```bash
cd robot-ai
pip install flask numpy
python robot.py
```

### Dashboard
Mở trình duyệt: http://localhost:3000

## Kiến trúc
```
robot-ai/    → AI Brain Python (Q-Learning, Sensor Sim)
server/      → Node.js Backend + WebSocket
dashboard/   → Web UI (Dark Glassmorphism)
```
