# 🤖 AI Robot IoT Launcher
# Chạy script này để khởi động toàn bộ hệ thống

echo "--------------------------------------"
echo "🚀 Khởi động AI Robot IoT System..."
echo "--------------------------------------"

# 1. Khởi động AI Robot Brain (Python)
echo "🐍 Đang khởi động AI Brain (Python)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd robot-ai; pip install flask flask-cors numpy; python robot.py"

# 2. Khởi động IoT Server (Node.js)
echo "🌐 Đang khởi động IoT Server (Node.js)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd server; npm install; node app.js"

# 3. Mở Dashboard
echo "📊 Đang mở Dashboard..."
Start-Process "dashboard\index.html"

echo "--------------------------------------"
echo "✅ Đã xong! Hệ thống đang chạy."
echo "Hệ thống AI Voice sẽ phát tiếng khi robot học xong."
echo "Click lên bản đồ Dashboard để vẽ vật cản!"
echo "--------------------------------------"
