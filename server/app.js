const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const PORT = 3000;
const ROBOT_API_URL = 'http://localhost:5000/api/state';

// Cấu hình lưu trữ dữ liệu sensor lịch sử (giả lập database)
let sensorHistory = [];
const MAX_HISTORY = 50;

// Loop để fetch dữ liệu từ Robot AI Python và phát qua WebSocket
setInterval(async () => {
  try {
    const response = await axios.get(ROBOT_API_URL);
    const data = response.data;
    
    // Lưu lịch sử nhiệt độ và pin
    sensorHistory.push({
      time: new Date().toLocaleTimeString(),
      temp: data.sensors.temperature,
      battery: data.sensors.battery
    });
    
    if (sensorHistory.length > MAX_HISTORY) sensorHistory.shift();
    
    // Gửi data tới tất cả client đang kết nối dashboard
    io.emit('robot_update', {
      ...data,
      history: sensorHistory
    });
  } catch (error) {
    // Nếu robot offline
    io.emit('robot_status', { online: false });
  }
}, 200); // 5Hz update rate

// API Routes
app.get('/api/history', (req, res) => {
  res.json(sensorHistory);
});

app.post('/api/proxy/command', async (req, res) => {
  try {
    const response = await axios.post('http://localhost:5000/api/command', req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Cannot reach Robot AI' });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 IoT Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📡 WebSocket đã sẵn sàng kết nối Dashboard`);
});
